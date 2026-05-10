import { useState, useEffect, useRef, useCallback } from 'react';
import './GoNoGoTask.css';
import stimuli from './stimuli.json';
import api from '../utils/api';

// Конфигурация уровней
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

// Перемешивание массива
const shuffleArray = (arr) => {
  const array = [...arr];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const GoNoGoTask = ({ blockId, participantId, onBlockComplete }) => {
  // Состояния
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const currentLevel = LEVELS[currentLevelIdx];
  const config = LEVEL_CONFIGS[currentLevel];

  const [phase, setPhase] = useState('instructions'); // instructions, category, stimulus, iti
  const [categoriesForLevel, setCategoriesForLevel] = useState([]); // для уровня 1: выбранные категории
  const [currentCategoryIdx, setCurrentCategoryIdx] = useState(0);
  const [currentCategory, setCurrentCategory] = useState(null);

  const [trials, setTrials] = useState([]); // массив проб для текущей категории
  const [trialIndex, setTrialIndex] = useState(0);
  const [currentStimulus, setCurrentStimulus] = useState('');

  const [isSending, setIsSending] = useState(false);

  // Refs для таймеров и данных
  const timeoutRef = useRef(null);
  const categoryStartTimeRef = useRef(null);
  const stimulusStartTimeRef = useRef(null);
  const responseReceivedRef = useRef(false);
  const blockDataRef = useRef([]);
  const startExperimentRef = useRef(false);

  // Очистка таймера
  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // ---- Генерация проб для одной категории (уровень 1) или для уровня 2/3 ----
  const generateTrialsForCategory = useCallback(
    (category) => {
      const trialsCount = config.trialsPerCategory;
      const targetProb = config.targetProbability;

      let targetWords = [];
      let distractorPool = [];

      if (currentLevel === 1) {
        // Целевые слова – слова текущей категории
        targetWords = category.words || [];
        if (targetWords.length === 0) {
          console.error(`[GoNoGo] Категория "${category.name}" не содержит слов!`);
          targetWords = ['ОШИБКА'];
        }

        // Дистракторы: все слова из других категорий (включая "Прочее")
        const allCategories = stimuli.words.categories;
        const otherWords = Object.keys(allCategories)
          .filter((catName) => catName !== category.name)
          .flatMap((catName) => allCategories[catName] || []);
        distractorPool = otherWords;
        if (distractorPool.length === 0) {
          console.error('[GoNoGo] Нет дистракторов для уровня 1');
          distractorPool = ['ОШИБКА'];
        }
      } else {
        // Уровни 2 и 3: таргеты – фразы/предложения с ошибкой
        if (currentLevel === 2) {
          targetWords = stimuli.phrases.incorrect || [];
          distractorPool = stimuli.phrases.correct || [];
        } else {
          targetWords = stimuli.sentences.incorrect || [];
          distractorPool = stimuli.sentences.correct || [];
        }

        if (targetWords.length === 0) {
          console.error(`[GoNoGo] Нет целевых стимулов для уровня ${currentLevel}`);
          targetWords = ['ОШИБКА'];
        }
        if (distractorPool.length === 0) {
          console.error(`[GoNoGo] Нет дистракторов для уровня ${currentLevel}`);
          distractorPool = ['ОШИБКА'];
        }
      }

      const generatedTrials = [];
      for (let i = 0; i < trialsCount; i++) {
        const isTarget = Math.random() < targetProb;
        let word;
        if (isTarget) {
          const randIdx = Math.floor(Math.random() * targetWords.length);
          word = targetWords[randIdx];
        } else {
          const randIdx = Math.floor(Math.random() * distractorPool.length);
          word = distractorPool[randIdx];
        }

        // Правильный ответ
        let correctResponse;
        if (currentLevel === 1) {
          correctResponse = isTarget ? 'yes' : 'no';
        } else {
          // Уровни 2 и 3: если есть ошибка (isTarget = true) -> ответ 'no' (левая стрелка)
          correctResponse = isTarget ? 'no' : 'yes';
        }

        generatedTrials.push({
          trialNumberInCategory: i + 1,
          category: category ? category.name : (currentLevel === 2 ? 'Фразы' : 'Предложения'),
          word,
          isTarget,
          correctResponse,
        });
      }

      // Перемешиваем порядок проб
      return shuffleArray(generatedTrials);
    },
    [config.trialsPerCategory, config.targetProbability, currentLevel]
  );

  // ---- Загрузка следующей категории (для уровня 1) ----
  const loadNextCategory = useCallback(() => {
    if (currentLevel !== 1) return; // для 2 и 3 категорий нет

    const nextIdx = currentCategoryIdx + 1;
    if (nextIdx >= categoriesForLevel.length) {
      // Все категории уровня 1 пройдены -> переход на следующий уровень
      setPhase('iti');
      clearTimer();
      timeoutRef.current = setTimeout(() => {
        const nextLevel = currentLevelIdx + 1;
        if (nextLevel < LEVELS.length) {
          setCurrentLevelIdx(nextLevel);
          setPhase('instructions');
          setCategoriesForLevel([]);
          setCurrentCategoryIdx(0);
          setCurrentCategory(null);
          setTrials([]);
          setTrialIndex(0);
          startExperimentRef.current = false;
        } else {
          // Завершение всего блока
          completeBlock();
        }
      }, config.itiDuration);
      return;
    }

    const category = categoriesForLevel[nextIdx];
    const newTrials = generateTrialsForCategory(category);
    setCurrentCategoryIdx(nextIdx);
    setCurrentCategory(category);
    setTrials(newTrials);
    setTrialIndex(0);
    responseReceivedRef.current = false;
    categoryStartTimeRef.current = Date.now();
    setPhase('category'); // показываем экран категории
  }, [currentLevel, currentCategoryIdx, categoriesForLevel, generateTrialsForCategory, config.itiDuration, currentLevelIdx, clearTimer]);

  // ---- Запуск текущей пробы ----
  const runTrial = useCallback(() => {
    if (trialIndex >= trials.length) {
      // Завершили текущую категорию
      if (currentLevel === 1) {
        loadNextCategory();
      } else {
        // Для уровней 2 и 3: после завершения trials – переход на следующий уровень
        setPhase('iti');
        clearTimer();
        timeoutRef.current = setTimeout(() => {
          const nextLevel = currentLevelIdx + 1;
          if (nextLevel < LEVELS.length) {
            setCurrentLevelIdx(nextLevel);
            setPhase('instructions');
            setCategoriesForLevel([]);
            setTrials([]);
            setTrialIndex(0);
            startExperimentRef.current = false;
          } else {
            completeBlock();
          }
        }, config.itiDuration);
      }
      return;
    }

    const trial = trials[trialIndex];
    setCurrentStimulus(trial.word);
    responseReceivedRef.current = false;
    stimulusStartTimeRef.current = Date.now();
    setPhase('stimulus');

    // Таймер на ответ
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      if (!responseReceivedRef.current && phase === 'stimulus') {
        // Нет ответа
        handleNoResponse(trial);
      }
    }, config.stimulusDuration);
  }, [trialIndex, trials, currentLevel, loadNextCategory, config.stimulusDuration, config.itiDuration, currentLevelIdx, clearTimer, phase]);

  // ---- Обработка ответа ----
  const saveResponse = useCallback((trial, reactionTime, responseType) => {
    if (responseReceivedRef.current) return;
    responseReceivedRef.current = true;
    clearTimer();

    const isCorrect = responseType === trial.correctResponse;
    const trialData = {
      experiment_block: parseInt(blockId),
      global_trial_number: blockDataRef.current.length + 1,
      level: currentLevel,
      category_index: currentCategoryIdx + 1,
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

    // Переход на ITI
    setPhase('iti');
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      setTrialIndex((prev) => prev + 1);
      runTrial();
    }, config.itiDuration);
  }, [blockId, currentLevel, currentCategoryIdx, config.itiDuration, clearTimer, runTrial]);

  const handleNoResponse = useCallback((trial) => {
    if (responseReceivedRef.current) return;
    responseReceivedRef.current = true;
    clearTimer();

    const trialData = {
      experiment_block: parseInt(blockId),
      global_trial_number: blockDataRef.current.length + 1,
      level: currentLevel,
      category_index: currentCategoryIdx + 1,
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

    setPhase('iti');
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      setTrialIndex((prev) => prev + 1);
      runTrial();
    }, config.itiDuration);
  }, [blockId, currentLevel, currentCategoryIdx, config.itiDuration, clearTimer, runTrial]);

  // ---- Завершение блока ----
  const completeBlock = useCallback(async () => {
    setIsSending(true);
    let sendSuccess = false;
    if (blockId) {
      try {
        const trialsData = blockDataRef.current.map((t) => ({
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
        const response = await api.post('/gonogo/trials/batch/', {
          block_id: blockId,
          trials: trialsData,
        });
        if (response.status === 201) sendSuccess = true;
      } catch (error) {
        console.error('Ошибка отправки данных Go/NoGo:', error);
      }
    }
    setIsSending(false);
    if (blockId) {
      try {
        await api.post('/block/complete/', { block_id: blockId });
      } catch (e) {
        console.warn('Не удалось завершить блок:', e);
      }
    }
    if (onBlockComplete) {
      const totalTrials = blockDataRef.current.length;
      const correctTrials = blockDataRef.current.filter((t) => t.is_correct).length;
      onBlockComplete({
        blockType: 'gonogo_task',
        totalTrials,
        completedTrials: totalTrials,
        accuracy: totalTrials ? correctTrials / totalTrials : 0,
        sendSuccess,
        blockId,
        participantId,
        levelsCompleted: LEVELS,
        categoriesPerLevel: LEVELS.map((lvl) => {
          if (lvl === 1) {
            return categoriesForLevel.map((c) => c.name);
          } else {
            return ['С ошибкой']; // упрощённо
          }
        }),
        trialsPerCategory: config.trialsPerCategory,
      });
    }
  }, [blockId, onBlockComplete, participantId, config.trialsPerCategory, categoriesForLevel]);

  // ---- Запуск уровня (начало после инструкции) ----
  const startLevel = useCallback(() => {
    if (currentLevel === 1) {
      // Выбрать 3 случайные категории (исключая "Прочее")
      const allCats = stimuli.words.categories;
      const categoryNames = Object.keys(allCats).filter((name) => name !== 'Прочее');
      const shuffledCats = shuffleArray(categoryNames);
      const selectedNames = shuffledCats.slice(0, config.numCategoriesToSelect);
      const selectedCategories = selectedNames.map((name) => ({
        name,
        words: allCats[name],
      }));
      setCategoriesForLevel(selectedCategories);
      setCurrentCategoryIdx(0);
      const firstCategory = selectedCategories[0];
      setCurrentCategory(firstCategory);
      const firstTrials = generateTrialsForCategory(firstCategory);
      setTrials(firstTrials);
      setTrialIndex(0);
      responseReceivedRef.current = false;
      categoryStartTimeRef.current = Date.now();
      setPhase('category');
    } else {
      // Уровни 2 и 3: генерируем trials без категории
      const dummyCategory = { name: currentLevel === 2 ? 'Фразы' : 'Предложения', words: [] };
      const newTrials = generateTrialsForCategory(dummyCategory);
      setCategoriesForLevel([]);
      setTrials(newTrials);
      setTrialIndex(0);
      responseReceivedRef.current = false;
      categoryStartTimeRef.current = Date.now();
      // Сразу запускаем первую пробу
      setPhase('stimulus');
      // Небольшая задержка, чтобы React отрендерил смену фазы
      setTimeout(() => {
        runTrial();
      }, 50);
    }
    startExperimentRef.current = true;
  }, [currentLevel, config.numCategoriesToSelect, generateTrialsForCategory, runTrial]);

  // ---- Обработка клавиш ----
  const handleKeyDown = useCallback(
    (e) => {
      const { code } = e;
      // Инструкции: пробел – начать уровень
      if (phase === 'instructions' && code === 'Space') {
        e.preventDefault();
        if (!startExperimentRef.current) {
          startLevel();
        }
        return;
      }
      // Экран категории (только уровень 1): пробел – начать пробы
      if (phase === 'category' && code === 'Space') {
        e.preventDefault();
        // Переход к первой пробе
        setPhase('stimulus');
        setTimeout(() => {
          runTrial();
        }, 50);
        return;
      }
      // Фаза стимула: принимаем ответы
      if (phase === 'stimulus' && !responseReceivedRef.current) {
        const yesKeys = config.keys.yes;
        const noKeys = config.keys.no;
        let response = null;
        if (yesKeys.includes(code)) response = 'yes';
        if (noKeys.includes(code)) response = 'no';
        if (response) {
          e.preventDefault();
          const reactionTime = Date.now() - stimulusStartTimeRef.current;
          const trial = trials[trialIndex];
          if (trial) {
            saveResponse(trial, reactionTime, response);
          }
        }
      }
    },
    [phase, startLevel, config.keys, trials, trialIndex, saveResponse, runTrial]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // ---- Рендер контента в зависимости от фазы ----
  const renderContent = () => {
    switch (phase) {
      case 'instructions':
        let instructionText;
        if (currentLevel === 1) {
          instructionText = (
            <>
              <p>
                В этом тесте вам будет показана категория – животные, растения, и т.д.
                Затем вам будут по одному показаны слова.
                Вам нужно определить, относится ли каждое слово к объявленной категории.
              </p>
              <p>
                Если да – <span className="instruction-right">нажмите <strong>→</strong></span>, если нет –{' '}
                <span className="instruction-left">нажмите <strong>←</strong></span>.
              </p>
              <p>
                Старайтесь отвечать как можно быстрее и правильно, не пропускать стимулы и сохранять внимание
                на протяжении всей последовательности; ошибки возможны — это нормально, продолжайте выполнение.
              </p>
              <p>
                <strong>Время теста составит примерно 5 минут.</strong>
              </p>
            </>
          );
        } else if (currentLevel === 2) {
          instructionText = (
            <>
              <p>
                В данном задании на экране будут показаны словосочетания и простые короткие предложения.
                Ваша задача — определить, содержит ли словосочетание или предложение ошибку (любую: орфографическую,
                грамматическую, пунктуационную и т.д.) или ошибок нет.
              </p>
              <p>
                <span className="instruction-right">Нажмите <strong>→</strong>, если ошибок нет</span>,{' '}
                <span className="instruction-left"> и <strong>←</strong>, если ошибка есть</span>.
              </p>
              <p>
                Старайтесь отвечать как можно быстрее и правильно, не пропускать стимулы и сохранять внимание
                на протяжении всей последовательности; ошибки возможны — это нормально, продолжайте выполнение.
              </p>
              <p>
                <strong>Время теста составит примерно 2 минуты.</strong>
              </p>
            </>
          );
        } else {
          instructionText = (
            <>
              <p>
                В данном задании на экране будут показаны предложения.
                Ваша задача — определить, содержит ли эти предложения ошибку (любую: орфографическую,
                грамматическую, пунктуационную и т.д.) или ошибок нет.
              </p>
              <p>
                <span className="instruction-right">Нажмите <strong>→</strong>, если ошибок нет</span>,{' '}
                <span className="instruction-left"> и <strong>←</strong>, если ошибка есть</span>.
              </p>
              <p>
                Старайтесь отвечать как можно быстрее и правильно, не пропускать стимулы и сохранять внимание
                на протяжении всей последовательности; ошибки возможны — это нормально, продолжайте выполнение.
              </p>
              <p>
                <strong>Время теста составит примерно 2 минуты.</strong>
              </p>
            </>
          );
        }
        return (
          <div className="gonogo-instructions">
            <h2>{config.name}</h2>
            {instructionText}
            <div className="instruction-keys">
              <div className="key-group">
                <span className="key key-left">←</span>
                <span className="key-label instruction-left">Стрелка влево</span>
              </div>
              <div className="key-group">
                <span className="key key-right">→</span>
                <span className="key-label instruction-right">Стрелка вправо</span>
              </div>
            </div>
            <div className="progress-indicator">
              Уровень {currentLevelIdx + 1} из {LEVELS.length}
            </div>
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
              {currentCategory?.name === 'Фрукты' && (
                <div
                  className="category-reminder"
                  style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#d9534f' }}
                >
                  ⚠️ ВАЖНО: ягоды (клубника, малина, черника и т.д.) НЕ относятся к фруктам.
                </div>
              )}
              <p className="space-message">[ПРОБЕЛ] начать тест</p>
            </div>
          </div>
        );

      case 'stimulus':
        return (
          <div className="gonogo-stimulus">
            <div className="word-text">{currentStimulus}</div>
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
      <div className="gonogo-content">{renderContent()}</div>
    </div>
  );
};

export default GoNoGoTask;