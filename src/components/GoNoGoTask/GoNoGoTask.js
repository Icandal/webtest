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
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const currentLevel = LEVELS[currentLevelIndex];
  const config = LEVEL_CONFIGS[currentLevel];

  const [currentLevelCategories, setCurrentLevelCategories] = useState([]);
  const [currentPhase, setCurrentPhase] = useState('instructions');
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [trialsForCurrentCategory, setTrialsForCurrentCategory] = useState([]);
  const [currentWord, setCurrentWord] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Refs для синхронизации без замыканий
  const timeoutRef = useRef(null);
  const phaseRef = useRef(currentPhase);
  const trialsRef = useRef([]);
  const currentTrialIndexRef = useRef(0);
  const categoryStartTimeRef = useRef(null);
  const stimulusStartTimeRef = useRef(null);
  const responseReceivedRef = useRef(false);
  const experimentStartedRef = useRef(false);
  const blockDataRef = useRef([]);

  // Стабильные ссылки на функции (чтобы таймеры вызывали актуальные версии)
  const nextTrialRef = useRef(null);
  const completeCategoryRef = useRef(null);
  const loadCategoryRef = useRef(null);
  const runTrialRef = useRef(null);
  const saveResponseRef = useRef(null);
  const handleNoResponseRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Генерация случайных категорий для уровня 1
  const selectRandomCategories = (pool, count) => {
    if (!pool) return [];
    const keys = Object.keys(pool).filter(key => key !== 'Прочее');
    if (count >= keys.length) {
      return keys.map(key => ({ name: key, words: pool[key] }));
    }
    const shuffled = [...keys].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(key => ({ name: key, words: pool[key] }));
  };

  // Генерация списка проб для одной категории
  const generateTrialsForCategory = useCallback((category) => {
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
  }, [config, currentLevel]);

  // Запуск текущей пробы по индексу
  const runTrial = useCallback((trialIndex) => {
    const trial = trialsRef.current[trialIndex];
    if (!trial) return;
    clearTimer();
    responseReceivedRef.current = false;
    setCurrentPhase('stimulus');
    setCurrentWord(trial.word);
    stimulusStartTimeRef.current = Date.now();
    timeoutRef.current = setTimeout(() => {
      if (!responseReceivedRef.current && phaseRef.current === 'stimulus') {
        handleNoResponseRef.current(trial);
      }
    }, config.stimulusDuration);
  }, [config.stimulusDuration, clearTimer]);

  // Переход к следующей пробе
  const nextTrial = useCallback(() => {
    clearTimer();
    const nextIndex = currentTrialIndexRef.current + 1;
    if (nextIndex < config.trialsPerCategory) {
      currentTrialIndexRef.current = nextIndex;
      runTrialRef.current(nextIndex);
    } else {
      completeCategoryRef.current();
    }
  }, [config.trialsPerCategory, clearTimer]);

  // Обработка ответа
  const saveResponse = useCallback((trial, reactionTime, responseType) => {
    const isCorrect = (responseType === trial.correctResponse);
    const trialData = {
      experiment_block: parseInt(blockId),
      global_trial_number: blockDataRef.current.length + 1,
      level: currentLevel,
      category_index: currentCategoryIndex + 1,
      category_name: trial.category,
      trial_in_category: trial.trialNumberInCategory,
      stimulus: trial.word,
      response: responseType,
      correct_response: trial.correctResponse,
      is_correct: isCorrect,
      is_target: trial.isTarget,
      reaction_time: reactionTime,
      client_category_time: categoryStartTimeRef.current,
      client_stimulus_time: stimulusStartTimeRef.current,
      client_response_time: Date.now(),
    };
    blockDataRef.current.push(trialData);
    responseReceivedRef.current = true;
    clearTimer();
    setCurrentPhase('iti');
    timeoutRef.current = setTimeout(() => nextTrialRef.current(), config.itiDuration);
  }, [blockId, currentLevel, currentCategoryIndex, config.itiDuration, clearTimer]);

  // Обработка отсутствия ответа
  const handleNoResponse = useCallback((trial) => {
    const trialData = {
      experiment_block: parseInt(blockId),
      global_trial_number: blockDataRef.current.length + 1,
      level: currentLevel,
      category_index: currentCategoryIndex + 1,
      category_name: trial.category,
      trial_in_category: trial.trialNumberInCategory,
      stimulus: trial.word,
      response: null,
      correct_response: trial.correctResponse,
      is_correct: !trial.isTarget,
      is_target: trial.isTarget,
      reaction_time: null,
      client_category_time: categoryStartTimeRef.current,
      client_stimulus_time: stimulusStartTimeRef.current,
      client_response_time: null,
    };
    blockDataRef.current.push(trialData);
    responseReceivedRef.current = true;
    clearTimer();
    setCurrentPhase('iti');
    timeoutRef.current = setTimeout(() => nextTrialRef.current(), config.itiDuration);
  }, [blockId, currentLevel, currentCategoryIndex, config.itiDuration, clearTimer]);

  // Завершение категории – загрузка следующей
  const completeCategory = useCallback(() => {
    clearTimer();
    setCurrentPhase('iti');
    timeoutRef.current = setTimeout(() => loadCategoryRef.current(currentCategoryIndex + 1), config.itiDuration);
  }, [currentCategoryIndex, config.itiDuration, clearTimer]);

  // Загрузка категории по индексу
  const loadCategory = useCallback((categoryIndex) => {
    if (!currentLevelCategories.length) return;
    if (categoryIndex >= currentLevelCategories.length) {
      // Переход на следующий уровень
      const nextLevelIndex = currentLevelIndex + 1;
      if (nextLevelIndex < LEVELS.length) {
        setCurrentLevelIndex(nextLevelIndex);
        setCurrentPhase('instructions');
        experimentStartedRef.current = false;
        setCurrentCategoryIndex(0);
        setCurrentCategory(null);
        setTrialsForCurrentCategory([]);
        setCurrentWord('');
        responseReceivedRef.current = false;
        setCurrentLevelCategories([]);
        currentTrialIndexRef.current = 0;
      } else {
        completeBlock();
      }
      return;
    }

    const category = currentLevelCategories[categoryIndex];
    const trials = generateTrialsForCategory(category);
    setCurrentCategoryIndex(categoryIndex);
    setCurrentCategory(category);
    setTrialsForCurrentCategory(trials);
    trialsRef.current = trials;
    currentTrialIndexRef.current = 0;
    setCurrentWord('');
    responseReceivedRef.current = false;
    clearTimer();
    categoryStartTimeRef.current = Date.now();

    if (currentLevel !== 1) {
      setCurrentPhase('stimulus');
      runTrialRef.current(0);
    } else {
      setCurrentPhase('category');
    }
  }, [currentLevelCategories, generateTrialsForCategory, clearTimer, currentLevel, currentLevelIndex]);

  // Завершение всего блока (все уровни пройдены)
  const completeBlock = useCallback(async () => {
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
        trialsPerCategory: config.trialsPerCategory,
      });
    }
  }, [blockId, onBlockComplete, participantId, config.trialsPerCategory]);

  // Запуск текущего уровня (выбор категорий)
  const startCurrentLevel = useCallback(() => {
    if (currentLevel === 1 && config.sourceType === 'words') {
      const selected = selectRandomCategories(stimuli?.words?.categories, config.numCategoriesToSelect);
      setCurrentLevelCategories(selected);
      experimentStartedRef.current = true;
    } else {
      const categories = LEVEL_CONFIGS[currentLevel]?.categories || [];
      setCurrentLevelCategories(categories);
      experimentStartedRef.current = true;
    }
  }, [currentLevel, config]);

  // Эффект для загрузки первой категории после выбора категорий
  useEffect(() => {
    if (experimentStartedRef.current && currentLevelCategories.length > 0) {
      loadCategoryRef.current(0);
    }
  }, [currentLevelCategories]);

  // Связывание ref'ов с функциями (один раз при монтировании)
  useEffect(() => {
    runTrialRef.current = runTrial;
    nextTrialRef.current = nextTrial;
    completeCategoryRef.current = completeCategory;
    loadCategoryRef.current = loadCategory;
    saveResponseRef.current = saveResponse;
    handleNoResponseRef.current = handleNoResponse;
  }, [runTrial, nextTrial, completeCategory, loadCategory, saveResponse, handleNoResponse]);

  // Обновление phaseRef при изменении фазы
  useEffect(() => {
    phaseRef.current = currentPhase;
  }, [currentPhase]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // Обработчик клавиатуры
  const handleKeyDown = useCallback((e) => {
    const { code } = e;
    if (currentPhase === 'instructions' && code === 'Space') {
      e.preventDefault();
      if (!experimentStartedRef.current) startCurrentLevel();
      return;
    }
    if (currentPhase === 'category' && code === 'Space') {
      e.preventDefault();
      runTrialRef.current(0);
      return;
    }
    if (currentPhase === 'stimulus' && !responseReceivedRef.current) {
      const yesKeys = config.keys.yes || [];
      const noKeys = config.keys.no || [];
      let responseType = null;
      if (yesKeys.includes(code)) responseType = 'yes';
      else if (noKeys.includes(code)) responseType = 'no';
      if (responseType) {
        e.preventDefault();
        const reactionTime = Date.now() - stimulusStartTimeRef.current;
        const trial = trialsRef.current[currentTrialIndexRef.current];
        if (trial) saveResponseRef.current(trial, reactionTime, responseType);
      }
    }
  }, [currentPhase, startCurrentLevel, config]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Рендер в зависимости от фазы
  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 'instructions':
        return (
          <div className="gonogo-instructions">
            <h2>{config.name}</h2>
            {currentLevel === 1 && (
              <>
                <p>В этом тесте вам будет показана категория, затем слова. Определите, относится ли слово к категории.</p>
                <p><span className="instruction-right">→</span> – относится, <span className="instruction-left">←</span> – не относится.</p>
              </>
            )}
            {currentLevel === 2 && (
              <p><span className="instruction-right">→</span> – ошибок нет, <span className="instruction-left">←</span> – есть ошибка.</p>
            )}
            {currentLevel === 3 && (
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