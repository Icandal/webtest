import { useState, useEffect, useRef, useCallback } from 'react';
import './GoNoGoTask.css';
import stimuli from './stimuli.json';
import api from '../utils/api';

const LEVEL_CONFIGS = {
  1: {
    name: 'Тест 3 - Категории',
    sourceType: 'words',
    numCategoriesToSelect: 3,
    trialsPerCategory: 30,
    stimulusDuration: 2000,
    itiDuration: 250,
    targetProbability: 0.5,
    keys: { yes: ['ArrowRight'], no: ['ArrowLeft'] }
  },
  2: {
    name: 'Тест 4 - Предложения с ошибками',
    sourceType: 'phrases',
    trialsPerCategory: 30,
    stimulusDuration: 5000,
    itiDuration: 250,
    categories: [{ name: 'С ошибкой', words: stimuli?.phrases?.incorrect || [] }],
    nonCategoryWords: stimuli?.phrases?.correct || [],
    targetProbability: 0.5,
    keys: { yes: ['ArrowRight'], no: ['ArrowLeft'] }
  },
  3: {
    name: 'Тест 5 - Сложные предложения',
    sourceType: 'sentences',
    trialsPerCategory: 30,
    stimulusDuration: 5000,
    itiDuration: 250,
    categories: [{ name: 'С ошибкой', words: stimuli?.sentences?.incorrect || [] }],
    nonCategoryWords: stimuli?.sentences?.correct || [],
    targetProbability: 0.5,
    keys: { yes: ['ArrowRight'], no: ['ArrowLeft'] }
  }
};

const LEVELS = [1, 2, 3];

const GoNoGoTask = ({ blockId, participantId, onBlockComplete }) => {
  // Состояние для рендера
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [currentPhase, setCurrentPhase] = useState('instructions');
  const [currentCategory, setCurrentCategory] = useState(null);
  const [currentWord, setCurrentWord] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [currentLevelCategories, setCurrentLevelCategories] = useState([]);
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);

  // Refs для хранения данных, которые меняются во времени
  const currentLevelRef = useRef(currentLevelIndex);
  const phaseRef = useRef(currentPhase);
  const configRef = useRef(LEVEL_CONFIGS[LEVELS[currentLevelIndex]]);
  const blockDataRef = useRef([]);
  const trialsRef = useRef([]);         // массив проб текущей категории
  const trialIndexRef = useRef(0);      // индекс текущей пробы в категории
  const categoryStartTimeRef = useRef(null);
  const stimulusStartTimeRef = useRef(null);
  const responseReceivedRef = useRef(false);
  const experimentStartedRef = useRef(false);
  const timeoutRef = useRef(null);
  const isRunningRef = useRef(false);   // флаг, чтобы не запускать несколько таймеров одновременно

  // Вспомогательная очистка таймера
  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Генерация категорий для уровня 1
  const selectRandomCategories = (pool, count) => {
    if (!pool) return [];
    const keys = Object.keys(pool).filter(key => key !== 'Прочее');
    if (count >= keys.length) {
      return keys.map(key => ({ name: key, words: pool[key] }));
    }
    const shuffled = [...keys].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(key => ({ name: key, words: pool[key] }));
  };

  // Генерация проб для одной категории
  const generateTrialsForCategory = (category) => {
    const config = configRef.current;
    const currentLevel = currentLevelRef.current;
    const trials = [];
    for (let i = 0; i < config.trialsPerCategory; i++) {
      const isTarget = Math.random() < config.targetProbability;
      let word;
      if (isTarget) {
        word = category.words[Math.floor(Math.random() * category.words.length)];
      } else {
        if (config.sourceType === 'words') {
          const allCategoryWords = Object.values(stimuli?.words?.categories || {})
            .flat()
            .filter(w => !category.words.includes(w));
          const nonWords = stimuli?.words?.categories?.['Прочее'] || [];
          if (nonWords.length > 0 && Math.random() < 0.5) {
            word = nonWords[Math.floor(Math.random() * nonWords.length)];
          } else {
            word = allCategoryWords.length > 0
              ? allCategoryWords[Math.floor(Math.random() * allCategoryWords.length)]
              : nonWords[0] || '?';
          }
        } else {
          const distractors = config.nonCategoryWords || [];
          word = distractors.length > 0
            ? distractors[Math.floor(Math.random() * distractors.length)]
            : '?';
        }
      }
      let correctResponse;
      if (currentLevel === 1) {
        correctResponse = isTarget ? 'yes' : 'no';
      } else {
        correctResponse = isTarget ? 'no' : 'yes';
      }
      trials.push({
        trialNumberInCategory: i + 1,
        category: category.name,
        word,
        isTarget,
        correctResponse
      });
    }
    return trials;
  };

  // Сохранение ответа или пропуска
  const recordTrialData = (trial, responseType, reactionTime) => {
    const isCorrect = responseType ? (responseType === trial.correctResponse) : !trial.isTarget;
    const trialData = {
      experiment_block: parseInt(blockId),
      global_trial_number: blockDataRef.current.length + 1,
      level: currentLevelRef.current,
      category_index: currentCategoryIndex + 1,
      category_name: trial.category,
      trial_in_category: trial.trialNumberInCategory,
      stimulus: trial.word,
      response: responseType || null,
      correct_response: trial.correctResponse,
      is_correct: isCorrect,
      is_target: trial.isTarget,
      reaction_time: reactionTime || null,
      client_category_time: categoryStartTimeRef.current,
      client_stimulus_time: responseType ? stimulusStartTimeRef.current : null,
      client_response_time: responseType ? Date.now() : null,
    };
    blockDataRef.current.push(trialData);
  };

  // Запуск следующей пробы (вызывается из таймера или после ответа)
  const advanceToNextTrial = useCallback(() => {
    clearTimer();
    if (!isRunningRef.current) return;
    
    const nextIndex = trialIndexRef.current + 1;
    if (nextIndex < trialsRef.current.length) {
      // Есть следующая проба в текущей категории
      trialIndexRef.current = nextIndex;
      startTrial(nextIndex);
    } else {
      // Категория закончилась, переходим к следующей категории
      finishCurrentCategory();
    }
  }, []);

  // Запуск конкретной пробы по индексу
  const startTrial = useCallback((index) => {
    const trial = trialsRef.current[index];
    if (!trial) return;
    clearTimer();
    responseReceivedRef.current = false;
    setCurrentPhase('stimulus');
    setCurrentWord(trial.word);
    stimulusStartTimeRef.current = Date.now();
    
    // Устанавливаем таймер на случай отсутствия ответа
    timeoutRef.current = setTimeout(() => {
      if (!responseReceivedRef.current && phaseRef.current === 'stimulus') {
        // Нет ответа
        recordTrialData(trial, null, null);
        responseReceivedRef.current = true;
        setCurrentPhase('iti');
        // Пауза между стимулами
        timeoutRef.current = setTimeout(() => {
          if (isRunningRef.current) advanceToNextTrial();
        }, configRef.current.itiDuration);
      }
    }, configRef.current.stimulusDuration);
  }, []);

  // Обработка ответа участника
  const handleResponse = useCallback((responseType) => {
    if (phaseRef.current !== 'stimulus') return;
    if (responseReceivedRef.current) return;
    
    const trial = trialsRef.current[trialIndexRef.current];
    if (!trial) return;
    
    const reactionTime = Date.now() - stimulusStartTimeRef.current;
    recordTrialData(trial, responseType, reactionTime);
    responseReceivedRef.current = true;
    clearTimer();
    setCurrentPhase('iti');
    
    // Запускаем следующую пробу после паузы
    timeoutRef.current = setTimeout(() => {
      if (isRunningRef.current) advanceToNextTrial();
    }, configRef.current.itiDuration);
  }, []);

  // Завершение текущей категории (загрузка следующей или переход на следующий уровень)
  const finishCurrentCategory = useCallback(() => {
    clearTimer();
    setCurrentPhase('iti');
    // Загружаем следующую категорию после небольшой паузы
    timeoutRef.current = setTimeout(() => {
      if (!isRunningRef.current) return;
      const nextCatIndex = currentCategoryIndex + 1;
      if (nextCatIndex < currentLevelCategories.length) {
        loadCategory(nextCatIndex);
      } else {
        // Все категории текущего уровня завершены -> переход на следующий уровень
        finishCurrentLevel();
      }
    }, configRef.current.itiDuration);
  }, [currentCategoryIndex, currentLevelCategories]);

  // Загрузка категории по индексу (установка проб и запуск первой пробы)
  const loadCategory = useCallback((catIndex) => {
    if (catIndex >= currentLevelCategories.length) return;
    const category = currentLevelCategories[catIndex];
    const trials = generateTrialsForCategory(category);
    trialsRef.current = trials;
    trialIndexRef.current = 0;
    setCurrentCategoryIndex(catIndex);
    setCurrentCategory(category);
    setCurrentWord('');
    responseReceivedRef.current = false;
    clearTimer();
    categoryStartTimeRef.current = Date.now();
    
    if (currentLevelRef.current !== 1) {
      // Для уровней 2 и 3 сразу начинаем пробы
      setCurrentPhase('stimulus');
      startTrial(0);
    } else {
      // Для уровня 1 показываем экран категории
      setCurrentPhase('category');
    }
  }, [currentLevelCategories]);

  // Завершение текущего уровня (переход к следующему или завершение блока)
  const finishCurrentLevel = useCallback(() => {
    clearTimer();
    const nextLevelIdx = currentLevelRef.current + 1;
    if (nextLevelIdx < LEVELS.length) {
      // Переход на следующий уровень
      setCurrentLevelIndex(nextLevelIdx);
      setCurrentPhase('instructions');
      experimentStartedRef.current = false;
      setCurrentCategoryIndex(0);
      setCurrentCategory(null);
      setCurrentWord('');
      setCurrentLevelCategories([]);
      trialsRef.current = [];
      trialIndexRef.current = 0;
      responseReceivedRef.current = false;
      isRunningRef.current = false;
    } else {
      // Все уровни завершены -> завершаем блок
      completeBlock();
    }
  }, []);

  // Завершение блока (отправка данных)
  const completeBlock = useCallback(async () => {
    isRunningRef.current = false;
    clearTimer();
    setIsSending(true);
    let sendSuccess = false;
    if (blockId && blockDataRef.current.length) {
      try {
        const trialsData = blockDataRef.current.map(t => ({
          trial_number: t.global_trial_number,
          level: t.level,
          category_index: t.category_index,
          category_name: t.category_name,
          trial_in_category: t.trial_in_category,
          stimulus: t.stimulus,
          response: t.response,
          correct_response: t.correct_response,
          is_target: t.is_target,
          reaction_time: t.reaction_time,
          client_category_time: t.client_category_time,
          client_stimulus_time: t.client_stimulus_time,
          client_response_time: t.client_response_time,
        }));
        const response = await api.post('/gonogo/trials/batch/', { block_id: blockId, trials: trialsData });
        if (response.status === 201) sendSuccess = true;
      } catch (error) {
        console.error('Ошибка отправки данных Go/NoGo:', error);
      }
    }
    setIsSending(false);
    if (blockId) {
      try { await api.post('/block/complete/', { block_id: blockId }); } catch (e) { console.warn(e); }
    }
    if (onBlockComplete) {
      const totalTrials = blockDataRef.current.length;
      const correctTrials = blockDataRef.current.filter(t => t.is_correct).length;
      onBlockComplete({
        blockType: 'gonogo_task',
        totalTrials,
        completedTrials: totalTrials,
        accuracy: totalTrials ? correctTrials / totalTrials : 0,
        sendSuccess,
        blockId,
        participantId,
        levelsCompleted: LEVELS,
        trialsPerCategory: configRef.current.trialsPerCategory,
      });
    }
  }, [blockId, onBlockComplete, participantId]);

  // Запуск текущего уровня (выбор категорий)
  const startCurrentLevel = useCallback(() => {
    const level = currentLevelRef.current;
    const config = configRef.current;
    if (level === 1 && config.sourceType === 'words') {
      const selected = selectRandomCategories(stimuli?.words?.categories, config.numCategoriesToSelect);
      setCurrentLevelCategories(selected);
      experimentStartedRef.current = true;
      isRunningRef.current = true;
    } else {
      const categories = LEVEL_CONFIGS[level]?.categories || [];
      setCurrentLevelCategories(categories);
      experimentStartedRef.current = true;
      isRunningRef.current = true;
    }
  }, []);

  // Эффект: когда установлены категории, загружаем первую
  useEffect(() => {
    if (experimentStartedRef.current && currentLevelCategories.length > 0 && currentPhase === 'instructions') {
      loadCategory(0);
    }
  }, [currentLevelCategories, loadCategory, currentPhase]);

  // Эффект для обновления рефов при изменении уровня/фазы
  useEffect(() => {
    currentLevelRef.current = currentLevelIndex;
    configRef.current = LEVEL_CONFIGS[LEVELS[currentLevelIndex]];
  }, [currentLevelIndex]);

  useEffect(() => {
    phaseRef.current = currentPhase;
  }, [currentPhase]);

  // Очистка при размонтировании
  useEffect(() => {
    return () => {
      clearTimer();
      isRunningRef.current = false;
    };
  }, [clearTimer]);

  // Обработчик клавиш
  const handleKeyDown = useCallback((e) => {
    const { code } = e;
    const phase = phaseRef.current;
    if (phase === 'instructions' && code === 'Space') {
      e.preventDefault();
      if (!experimentStartedRef.current) startCurrentLevel();
      return;
    }
    if (phase === 'category' && code === 'Space') {
      e.preventDefault();
      // Запускаем первую пробу
      clearTimer();
      setCurrentPhase('stimulus');
      startTrial(0);
      return;
    }
    if (phase === 'stimulus' && !responseReceivedRef.current) {
      const config = configRef.current;
      const yesKeys = config.keys.yes || [];
      const noKeys = config.keys.no || [];
      let responseType = null;
      if (yesKeys.includes(code)) responseType = 'yes';
      else if (noKeys.includes(code)) responseType = 'no';
      if (responseType) {
        e.preventDefault();
        handleResponse(responseType);
      }
    }
  }, [startCurrentLevel, handleResponse, startTrial, clearTimer]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Рендер
  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 'instructions':
        return (
          <div className="gonogo-instructions">
            <h2>{configRef.current.name}</h2>
            {currentLevelRef.current === 1 && (
              <>
                <p>В этом тесте вам будет показана категория, затем слова. Определите, относится ли слово к категории.</p>
                <p><span className="instruction-right">→</span> – относится, <span className="instruction-left">←</span> – не относится.</p>
              </>
            )}
            {currentLevelRef.current === 2 && (
              <p><span className="instruction-right">→</span> – ошибок нет, <span className="instruction-left">←</span> – есть ошибка.</p>
            )}
            {currentLevelRef.current === 3 && (
              <p><span className="instruction-right">→</span> – ошибок нет, <span className="instruction-left">←</span> – есть ошибка.</p>
            )}
            <div className="instruction-keys">
              <div className="key-group"><span className="key key-left">←</span><span className="key-label">Стрелка влево</span></div>
              <div className="key-group"><span className="key key-right">→</span><span className="key-label">Стрелка вправо</span></div>
            </div>
            <div className="progress-indicator">Уровень {currentLevelIndex + 1} из {LEVELS.length}</div>
            <p className="space-message">[ПРОБЕЛ] начать уровень</p>
            {isSending && <p>Отправка...</p>}
          </div>
        );
      case 'category':
        return (
          <div className="gonogo-category">
            <div className="category-container">
              <div className="category-label">Категория</div>
              <div className="category-name">{currentCategory?.name}</div>
              <p className="space-message">[ПРОБЕЛ] начать тест</p>
            </div>
          </div>
        );
      case 'stimulus':
        return (
          <div className="gonogo-stimulus">
            <div className="word-text">{currentWord}</div>
          </div>
        );
      case 'iti':
        return <div className="gonogo-iti"></div>;
      default:
        return null;
    }
  };

  return (
    <div className="gonogo-task">
      <div className="gonogo-content">{renderPhaseContent()}</div>
    </div>
  );
};

export default GoNoGoTask;