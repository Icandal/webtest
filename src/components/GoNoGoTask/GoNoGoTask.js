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
    keys: { yes: ['ArrowRight'], no: ['ArrowLeft'] }
  },
  2: {
    name: 'Тест 4 - Предложения с ошибками',
    sourceType: 'phrases',
    trialsPerCategory: 30,
    categoryDuration: 1000,
    stimulusDuration: 5000,
    itiDuration: 250,
    categories: [
      {
        name: 'С ошибкой',
        words: stimuli.phrases.incorrect
      }
    ],
    nonCategoryWords: stimuli.phrases.correct,
    targetProbability: 0.5,
    keys: { yes: ['ArrowRight'], no: ['ArrowLeft'] }
  },
  3: {
    name: 'Тест 5 - Сложные предложения',
    sourceType: 'sentences',
    trialsPerCategory: 30,
    categoryDuration: 1000,
    stimulusDuration: 5000,
    itiDuration: 250,
    categories: [
      {
        name: 'С ошибкой',
        words: stimuli.sentences.incorrect
      }
    ],
    nonCategoryWords: stimuli.sentences.correct,
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
  const [currentTrialIndex, setCurrentTrialIndex] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [readyForTrial, setReadyForTrial] = useState(false);

  const timeoutRef = useRef(null);
  const phaseRef = useRef(currentPhase);
  const trialsRef = useRef(trialsForCurrentCategory);
  const categoryStartTimeRef = useRef(null);
  const stimulusStartTimeRef = useRef(null);
  const responseReceivedRef = useRef(false);
  const experimentStartedRef = useRef(false);
  const blockDataRef = useRef([]);
  const currentLevelRef = useRef(currentLevelIndex);

  const runTrialRef = useRef(null);
  const nextTrialRef = useRef(null);
  const handleNoResponseRef = useRef(null);
  const saveResponseRef = useRef(null);
  const completeCategoryRef = useRef(null);
  const completeLevelRef = useRef(null);
  const completeBlockRef = useRef(null);

  useEffect(() => { phaseRef.current = currentPhase; }, [currentPhase]);
  useEffect(() => { trialsRef.current = trialsForCurrentCategory; }, [trialsForCurrentCategory]);
  useEffect(() => { currentLevelRef.current = currentLevelIndex; }, [currentLevelIndex]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const selectRandomCategories = (pool, count) => {
    const keys = Object.keys(pool).filter(key => key !== 'Прочее');
    if (count >= keys.length) {
      return keys.map(key => ({ name: key, words: pool[key] }));
    }
    const shuffled = [...keys].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(key => ({ name: key, words: pool[key] }));
  };

  // Генерация trials для одной категории со случайными стимулами и дистракторами
  const generateTrialsForCategory = useCallback((category) => {
    const trials = [];
    const targetWords = category.words || [];
    const effectiveTargetWords = targetWords.length > 0 ? targetWords : ['?'];

    // Для уровня 1: пул дистракторов (слова из других категорий + "Прочее")
    let distractorPool = [];
    if (config.sourceType === 'words') {
      const allCategories = Object.keys(stimuli.words.categories).filter(k => k !== 'Прочее');
      const otherCategoryWords = allCategories
        .filter(catName => catName !== category.name)
        .flatMap(catName => stimuli.words.categories[catName] || []);
      const otherWords = stimuli.words.categories['Прочее'] || [];
      distractorPool = [...otherCategoryWords, ...otherWords];
      if (distractorPool.length === 0) distractorPool = ['?'];
    } else {
      // Для уровней 2 и 3: дистракторы — это правильные фразы/предложения
      const distractors = config.nonCategoryWords || [];
      distractorPool = distractors.length > 0 ? distractors : ['?'];
    }

    for (let i = 0; i < config.trialsPerCategory; i++) {
      const isTarget = Math.random() < config.targetProbability;
      let word;
      if (isTarget) {
        // Случайный выбор из слов категории (таргет)
        word = effectiveTargetWords[Math.floor(Math.random() * effectiveTargetWords.length)];
      } else {
        // Случайный выбор из пула дистракторов
        word = distractorPool[Math.floor(Math.random() * distractorPool.length)];
      }

      let correctResponse;
      if (currentLevel === 1) {
        correctResponse = isTarget ? 'yes' : 'no';
      } else {
        // Для уровней 2 и 3: "да" (правая стрелка) = ошибок нет (т.е. non-target по isTarget)
        // но у нас isTarget означает "принадлежит категории 'С ошибкой'", значит правильный ответ: нет (левая)
        // однако правильнее: correctResponse = isTarget ? 'no' : 'yes';
        // Оставляем логику как в исходном коде
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
  }, [config.trialsPerCategory, config.targetProbability, config.sourceType, config.nonCategoryWords, currentLevel]);

  const loadCategory = useCallback((index) => {
    const categories = currentLevelCategories;
    if (index >= categories.length) {
      completeLevelRef.current();
      return;
    }
    const category = categories[index];
    const trials = generateTrialsForCategory(category);
    setCurrentCategoryIndex(index);
    setCurrentCategory(category);
    setTrialsForCurrentCategory(trials);
    setCurrentTrialIndex(0);
    setCurrentWord('');
    setReadyForTrial(false);
    responseReceivedRef.current = false;
    clearTimer();
    categoryStartTimeRef.current = Date.now();

    if (currentLevel !== 1) {
      setCurrentPhase('stimulus');
      setTimeout(() => setReadyForTrial(true), 50);
    } else {
      setCurrentPhase('category');
    }
  }, [currentLevelCategories, generateTrialsForCategory, clearTimer, currentLevel]);

  useEffect(() => {
    if (currentPhase === 'stimulus' && readyForTrial && trialsRef.current.length > 0) {
      runTrialRef.current(0);
    }
  }, [currentPhase, readyForTrial]);

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
    timeoutRef.current = setTimeout(nextTrialRef.current, config.itiDuration);
  }, [blockId, currentLevel, currentCategoryIndex, config.itiDuration, clearTimer]);

  const handleNoResponse = useCallback((trial) => {
    const isCorrect = !trial.isTarget;
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
      is_correct: isCorrect,
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
    timeoutRef.current = setTimeout(nextTrialRef.current, config.itiDuration);
  }, [blockId, currentLevel, currentCategoryIndex, config.itiDuration, clearTimer]);

  const nextTrial = useCallback(() => {
    clearTimer();
    const nextIndex = currentTrialIndex + 1;
    if (nextIndex < config.trialsPerCategory) {
      setCurrentTrialIndex(nextIndex);
      runTrialRef.current(nextIndex);
    } else {
      completeCategoryRef.current();
    }
  }, [currentTrialIndex, config.trialsPerCategory, clearTimer]);

  const completeCategory = useCallback(() => {
    clearTimer();
    setReadyForTrial(false);
    setCurrentPhase('iti');
    timeoutRef.current = setTimeout(() => loadCategory(currentCategoryIndex + 1), config.itiDuration);
  }, [currentCategoryIndex, config.itiDuration, loadCategory, clearTimer]);

  const completeLevel = useCallback(() => {
    clearTimer();
    const nextLevelIndex = currentLevelIndex + 1;
    if (nextLevelIndex < LEVELS.length) {
      setCurrentLevelIndex(nextLevelIndex);
      setCurrentPhase('instructions');
      experimentStartedRef.current = false;
      setCurrentCategoryIndex(0);
      setCurrentCategory(null);
      setTrialsForCurrentCategory([]);
      setCurrentTrialIndex(0);
      setCurrentWord('');
      responseReceivedRef.current = false;
      setCurrentLevelCategories([]);
      setReadyForTrial(false);
    } else {
      completeBlockRef.current();
    }
  }, [currentLevelIndex, clearTimer]);

  const completeBlock = useCallback(async () => {
    setIsSending(true);
    let sendSuccess = false;
    if (blockId) {
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
        const response = await api.post('/gonogo/trials/batch/', {
          block_id: blockId,
          trials: trialsData
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
        categoriesPerLevel: LEVELS.map(lvl => {
          if (lvl === 1) {
            return currentLevelCategories.map(c => c.name);
          } else {
            return LEVEL_CONFIGS[lvl].categories.map(c => c.name);
          }
        }),
        trialsPerCategory: config.trialsPerCategory,
      });
    }
  }, [blockId, onBlockComplete, participantId, config.trialsPerCategory, currentLevelCategories]);

  const startCurrentLevel = useCallback(() => {
    if (currentLevel === 1 && config.sourceType === 'words') {
      const selected = selectRandomCategories(stimuli.words.categories, config.numCategoriesToSelect);
      setCurrentLevelCategories(selected);
    } else {
      setCurrentLevelCategories(LEVEL_CONFIGS[currentLevel].categories || []);
    }
    experimentStartedRef.current = true;
  }, [currentLevel, config]);

  useEffect(() => {
    if (experimentStartedRef.current && currentLevelCategories.length > 0) {
      loadCategory(0);
    }
  }, [currentLevelCategories, loadCategory]);

  const handleKeyDown = useCallback((e) => {
    const { code } = e;
    if (currentPhase === 'instructions' && code === 'Space') {
      e.preventDefault();
      if (!experimentStartedRef.current) startCurrentLevel();
      return;
    }
    if (currentPhase === 'category' && code === 'Space') {
      e.preventDefault();
      setReadyForTrial(false);
      setCurrentPhase('stimulus');
      setTimeout(() => setReadyForTrial(true), 50);
      return;
    }
    if (currentPhase === 'stimulus' && !responseReceivedRef.current) {
      const yesKeys = config.keys.yes || [];
      const noKeys = config.keys.no || [];
      let responseType = null;
      if (yesKeys.includes(code)) {
        responseType = 'yes';
      } else if (noKeys.includes(code)) {
        responseType = 'no';
      }
      if (responseType) {
        e.preventDefault();
        const reactionTime = Date.now() - stimulusStartTimeRef.current;
        const trial = trialsRef.current[currentTrialIndex];
        if (trial) saveResponseRef.current(trial, reactionTime, responseType);
      }
    }
  }, [currentPhase, currentTrialIndex, startCurrentLevel, config]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  useEffect(() => { runTrialRef.current = runTrial; }, [runTrial]);
  useEffect(() => { nextTrialRef.current = nextTrial; }, [nextTrial]);
  useEffect(() => { handleNoResponseRef.current = handleNoResponse; }, [handleNoResponse]);
  useEffect(() => { saveResponseRef.current = saveResponse; }, [saveResponse]);
  useEffect(() => { completeCategoryRef.current = completeCategory; }, [completeCategory]);
  useEffect(() => { completeLevelRef.current = completeLevel; }, [completeLevel]);
  useEffect(() => { completeBlockRef.current = completeBlock; }, [completeBlock]);

  const renderPhaseContent = () => {
    switch (currentPhase) {
      case 'instructions':
        let instructionText = '';
        if (currentLevel === 1) {
          instructionText = (
            <>
              <p>В этом тесте вам будет показана категория – животные, растения, и т.д.
                Затем вам будут по одному показаны слова.
                Вам нужно определить, относится ли каждое слово к объявленной категории.</p>
              <p>Если да – <span className="instruction-right">нажмите <strong>→</strong></span>, если нет – <span className="instruction-left">нажмите <strong>←</strong></span>.</p>
              <p>Старайтесь отвечать как можно быстрее и правильно, не пропускать стимулы и сохранять внимание на протяжении всей последовательности; ошибки возможны — это нормально, продолжайте выполнение.</p>
              <p><strong>Время теста составит примерно 5 минут.</strong></p>
            </>
          );
        } else if (currentLevel === 2) {
          instructionText = (
            <>
              <p>В данном задании на экране будут показаны словосочетания и простые короткие предложения. Ваша задача — определить, содержит ли словосочетание или предложение ошибку (любую: орфографическую, грамматическую, пунктуационную и т.д.) или ошибок нет.</p>
              <p><span className="instruction-right">Нажмите <strong>→</strong>, если ошибок нет</span>, <span className="instruction-left"> и <strong>←</strong>, если ошибка есть</span>.</p>
              <p>Старайтесь отвечать как можно быстрее и правильно, не пропускать стимулы и сохранять внимание на протяжении всей последовательности; ошибки возможны — это нормально, продолжайте выполнение.</p>
              <p><strong>Время теста составит примерно 2 минуты.</strong></p>
            </>
          );
        } else {
          instructionText = (
            <>
              <p>В данном задании на экране будут показаны предложения. Ваша задача — определить, содержит ли эти предложения ошибку (любую: орфографическую, грамматическую, пунктуационную и т.д.) или ошибок нет.</p>
              <p><span className="instruction-right">Нажмите <strong>→</strong>, если ошибок нет</span>, <span className="instruction-left"> и <strong>←</strong>, если ошибка есть</span>.</p>
              <p>Старайтесь отвечать как можно быстрее и правильно, не пропускать стимулы и сохранять внимание на протяжении всей последовательности; ошибки возможны — это нормально, продолжайте выполнение.</p>
              <p><strong>Время теста составит примерно 2 минуты.</strong></p>
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
              {currentCategory?.name === 'Фрукты' && (
                <div className="category-reminder" style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#d9534f' }}>
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
      <div className="gonogo-content">
        {renderPhaseContent()}
      </div>
    </div>
  );
};

export default GoNoGoTask;