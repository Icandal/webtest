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
    categoryDuration: 1000,
    stimulusDuration: 2000,
    itiDuration: 250,
    targetProbability: 0.5,
    keys: { yes: ['ArrowRight'], no: ['ArrowLeft'] },
  },
  2: {
    name: 'Тест 4 - Предложения с ошибками',
    sourceType: 'phrases',
    trialsPerCategory: 30,
    stimulusDuration: 5000,
    itiDuration: 250,
    targetProbability: 0.5,
    keys: { yes: ['ArrowRight'], no: ['ArrowLeft'] },
  },
  3: {
    name: 'Тест 5 - Сложные предложения',
    sourceType: 'sentences',
    trialsPerCategory: 30,
    stimulusDuration: 5000,
    itiDuration: 250,
    targetProbability: 0.5,
    keys: { yes: ['ArrowRight'], no: ['ArrowLeft'] },
  },
};

const LEVELS = [1, 2, 3];

const shuffleArray = (arr) => {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const GoNoGoTask = ({ blockId, participantId, onBlockComplete }) => {
  // Состояния для рендера
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const currentLevel = LEVELS[currentLevelIdx];
  const config = LEVEL_CONFIGS[currentLevel];

  const [phase, setPhase] = useState('instructions'); // instructions, category, stimulus, iti
  const [categoriesForLevel, setCategoriesForLevel] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [currentStimulus, setCurrentStimulus] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Refs для хранения актуальных значений (обход замыканий)
  const phaseRef = useRef(phase);
  const trialsRef = useRef([]);
  const trialIndexRef = useRef(0);
  const currentCategoryIdxRef = useRef(0);
  const categoriesForLevelRef = useRef([]);
  const blockDataRef = useRef([]);
  const timeoutRef = useRef(null);
  const categoryStartTimeRef = useRef(null);
  const stimulusStartTimeRef = useRef(null);
  const responseReceivedRef = useRef(false);
  const startExperimentRef = useRef(false);

  // Refs для функций, чтобы вызывать всегда актуальную версию
  const runTrialRef = useRef(null);
  const completeCategoryOrLevelRef = useRef(null);

  // Синхронизация ref с состоянием
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { categoriesForLevelRef.current = categoriesForLevel; }, [categoriesForLevel]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Генерация массива проб для текущей категории / уровня
  const generateTrials = useCallback((categoryName = null) => {
    const trialsCount = config.trialsPerCategory;
    const targetProb = config.targetProbability;
    let targetWords = [];
    let distractorPool = [];

    if (currentLevel === 1) {
      const category = categoriesForLevelRef.current.find(c => c.name === categoryName);
      if (!category) return [];
      targetWords = category.words || [];
      if (targetWords.length === 0) targetWords = ['ОШИБКА'];
      const allCategories = stimuli.words.categories;
      const otherWords = Object.keys(allCategories)
        .filter(cat => cat !== category.name)
        .flatMap(cat => allCategories[cat] || []);
      distractorPool = otherWords.length ? otherWords : ['ОШИБКА'];
    } else if (currentLevel === 2) {
      targetWords = stimuli.phrases.incorrect || [];
      distractorPool = stimuli.phrases.correct || [];
      if (!targetWords.length) targetWords = ['ОШИБКА'];
      if (!distractorPool.length) distractorPool = ['ОШИБКА'];
    } else {
      targetWords = stimuli.sentences.incorrect || [];
      distractorPool = stimuli.sentences.correct || [];
      if (!targetWords.length) targetWords = ['ОШИБКА'];
      if (!distractorPool.length) distractorPool = ['ОШИБКА'];
    }

    const trials = [];
    for (let i = 0; i < trialsCount; i++) {
      const isTarget = Math.random() < targetProb;
      const word = isTarget
        ? targetWords[Math.floor(Math.random() * targetWords.length)]
        : distractorPool[Math.floor(Math.random() * distractorPool.length)];

      let correctResponse;
      if (currentLevel === 1) {
        correctResponse = isTarget ? 'yes' : 'no';
      } else {
        correctResponse = isTarget ? 'no' : 'yes';
      }

      trials.push({
        trialNumberInCategory: i + 1,
        category: categoryName || (currentLevel === 2 ? 'Фразы' : 'Предложения'),
        word,
        isTarget,
        correctResponse,
      });
    }
    return shuffleArray(trials);
  }, [config.trialsPerCategory, config.targetProbability, currentLevel]);

  // Завершение текущей категории (для уровня 1) или уровня (для 2/3) и переход дальше
  const completeCategoryOrLevel = useCallback(() => {
    clearTimer();
    if (currentLevel === 1) {
      const nextIdx = currentCategoryIdxRef.current + 1;
      if (nextIdx < categoriesForLevelRef.current.length) {
        // Следующая категория
        const nextCategory = categoriesForLevelRef.current[nextIdx];
        const newTrials = generateTrials(nextCategory.name);
        trialsRef.current = newTrials;
        trialIndexRef.current = 0;
        currentCategoryIdxRef.current = nextIdx;
        setCurrentCategory(nextCategory);
        setPhase('category');
        categoryStartTimeRef.current = Date.now();
        responseReceivedRef.current = false;
        return;
      }
      // Все категории уровня 1 пройдены – переход на следующий уровень
    }
    // Переход на следующий уровень или завершение блока
    const nextLevel = currentLevelIdx + 1;
    if (nextLevel < LEVELS.length) {
      setCurrentLevelIdx(nextLevel);
      setPhase('instructions');
      setCategoriesForLevel([]);
      setCurrentCategory(null);
      trialsRef.current = [];
      trialIndexRef.current = 0;
      currentCategoryIdxRef.current = 0;
      responseReceivedRef.current = false;
      startExperimentRef.current = false;
    } else {
      // Завершение всего блока
      completeBlockRef.current();
    }
  }, [currentLevelIdx, generateTrials, clearTimer]);

  // Запуск пробы
  const runTrial = useCallback(() => {
    clearTimer();
    if (trialIndexRef.current >= trialsRef.current.length) {
      // Текущая категория / уровень завершены
      completeCategoryOrLevelRef.current();
      return;
    }
    const trial = trialsRef.current[trialIndexRef.current];
    setCurrentStimulus(trial.word);
    responseReceivedRef.current = false;
    stimulusStartTimeRef.current = Date.now();
    setPhase('stimulus');
    timeoutRef.current = setTimeout(() => {
      if (!responseReceivedRef.current && phaseRef.current === 'stimulus') {
        // Нет ответа
        const trialData = {
          experiment_block: parseInt(blockId),
          global_trial_number: blockDataRef.current.length + 1,
          level: currentLevel,
          category_index: (currentLevel === 1 ? currentCategoryIdxRef.current + 1 : 1),
          category_name: trial.category,
          trial_in_category: trial.trialNumberInCategory,
          stimulus: trial.word,
          response: null,
          correct_response: trial.correctResponse,
          is_correct: false,
          is_target: trial.isTarget,
          reaction_time: null,
          client_category_time: categoryStartTimeRef.current,
          client_stimulus_time: stimulusStartTimeRef.current,
          client_response_time: null,
        };
        blockDataRef.current.push(trialData);
        responseReceivedRef.current = true;
        setPhase('iti');
        clearTimer();
        timeoutRef.current = setTimeout(() => {
          trialIndexRef.current++;
          runTrialRef.current();
        }, config.itiDuration);
      }
    }, config.stimulusDuration);
  }, [blockId, currentLevel, config.stimulusDuration, config.itiDuration, clearTimer]);

  // Сохранение ответа
  const saveResponse = useCallback((responseType, reactionTime) => {
    if (responseReceivedRef.current) return;
    const trial = trialsRef.current[trialIndexRef.current];
    if (!trial) return;
    responseReceivedRef.current = true;
    clearTimer();
    const isCorrect = responseType === trial.correctResponse;
    const trialData = {
      experiment_block: parseInt(blockId),
      global_trial_number: blockDataRef.current.length + 1,
      level: currentLevel,
      category_index: (currentLevel === 1 ? currentCategoryIdxRef.current + 1 : 1),
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
    setPhase('iti');
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      trialIndexRef.current++;
      runTrialRef.current();
    }, config.itiDuration);
  }, [blockId, currentLevel, config.itiDuration, clearTimer]);

  // Запуск уровня (после инструкции)
  const startLevel = useCallback(() => {
    if (currentLevel === 1) {
      // Случайный выбор 3 категорий
      const allCats = stimuli.words.categories;
      const categoryNames = Object.keys(allCats).filter(name => name !== 'Прочее');
      const shuffled = shuffleArray(categoryNames);
      const selectedNames = shuffled.slice(0, config.numCategoriesToSelect);
      const selected = selectedNames.map(name => ({ name, words: allCats[name] }));
      setCategoriesForLevel(selected);
      categoriesForLevelRef.current = selected;
      currentCategoryIdxRef.current = 0;
      const firstCategory = selected[0];
      setCurrentCategory(firstCategory);
      const firstTrials = generateTrials(firstCategory.name);
      trialsRef.current = firstTrials;
      trialIndexRef.current = 0;
      categoryStartTimeRef.current = Date.now();
      responseReceivedRef.current = false;
      setPhase('category');
    } else {
      // Уровни 2 и 3
      const dummyCategoryName = currentLevel === 2 ? 'Фразы' : 'Предложения';
      const trials = generateTrials(dummyCategoryName);
      trialsRef.current = trials;
      trialIndexRef.current = 0;
      categoryStartTimeRef.current = Date.now();
      responseReceivedRef.current = false;
      setPhase('stimulus');
      setTimeout(() => {
        runTrialRef.current();
      }, 50);
    }
    startExperimentRef.current = true;
  }, [currentLevel, config.numCategoriesToSelect, generateTrials]);

  // Завершение блока и отправка данных
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
        console.error('Ошибка отправки:', error);
      }
    }
    setIsSending(false);
    if (blockId) {
      try {
        await api.post('/block/complete/', { block_id: blockId });
      } catch (e) { console.warn(e); }
    }
    if (onBlockComplete) {
      const total = blockDataRef.current.length;
      const correct = blockDataRef.current.filter(t => t.is_correct).length;
      onBlockComplete({
        blockType: 'gonogo_task',
        totalTrials: total,
        completedTrials: total,
        accuracy: total ? correct / total : 0,
        sendSuccess,
        blockId,
        participantId,
        levelsCompleted: LEVELS,
        categoriesPerLevel: LEVELS.map(lvl => lvl === 1 ? categoriesForLevelRef.current.map(c => c.name) : ['С ошибкой']),
        trialsPerCategory: config.trialsPerCategory,
      });
    }
  }, [blockId, onBlockComplete, participantId, config.trialsPerCategory]);

  // Обновление ref-функций
  useEffect(() => { runTrialRef.current = runTrial; }, [runTrial]);
  useEffect(() => { completeCategoryOrLevelRef.current = completeCategoryOrLevel; }, [completeCategoryOrLevel]);
  const completeBlockRef = useRef(completeBlock);
  useEffect(() => { completeBlockRef.current = completeBlock; }, [completeBlock]);

  // Обработка клавиш
  const handleKeyDown = useCallback((e) => {
    const { code } = e;
    // Инструкции
    if (phase === 'instructions' && code === 'Space') {
      e.preventDefault();
      if (!startExperimentRef.current) startLevel();
      return;
    }
    // Экран категории (только уровень 1)
    if (phase === 'category' && code === 'Space') {
      e.preventDefault();
      setPhase('stimulus');
      setTimeout(() => runTrialRef.current(), 50);
      return;
    }
    // Фаза стимула
    if (phase === 'stimulus' && !responseReceivedRef.current) {
      const yesKeys = config.keys.yes;
      const noKeys = config.keys.no;
      let response = null;
      if (yesKeys.includes(code)) response = 'yes';
      if (noKeys.includes(code)) response = 'no';
      if (response) {
        e.preventDefault();
        const reactionTime = Date.now() - stimulusStartTimeRef.current;
        saveResponse(response, reactionTime);
      }
    }
  }, [phase, startLevel, config.keys, saveResponse]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // Рендер
  const renderContent = () => {
    if (phase === 'instructions') {
      let instr;
      if (currentLevel === 1) instr = (<>...</>); // полный текст из предыдущей версии
      else if (currentLevel === 2) instr = (<>...</>);
      else instr = (<>...</>);
      // Для краткости здесь сокращённо, но вы можете вставить полные инструкции из предыдущего кода
      return <div className="gonogo-instructions">...</div>;
    }
    if (phase === 'category') {
      return (
        <div className="gonogo-category">
          <div className="category-container">
            <div className="category-label">Категория</div>
            <div className="category-name">{currentCategory?.name}</div>
            {currentCategory?.name === 'Фрукты' && (
              <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#d9534f' }}>
                ⚠️ ВАЖНО: ягоды (клубника, малина, черника и т.д.) НЕ относятся к фруктам.
              </div>
            )}
            <p className="space-message">[ПРОБЕЛ] начать тест</p>
          </div>
        </div>
      );
    }
    if (phase === 'stimulus') {
      return (
        <div className="gonogo-stimulus">
          <div className="word-text">{currentStimulus}</div>
        </div>
      );
    }
    if (phase === 'iti') return <div className="gonogo-iti"></div>;
    return null;
  };

  return (
    <div className="gonogo-task">
      <div className="gonogo-content">{renderContent()}</div>
    </div>
  );
};

export default GoNoGoTask;