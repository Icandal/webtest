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
    stimulusDuration: 4000,   // 4 секунды (изменено)
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

// Псевдослучайная генерация с перемешиванием пулов
const generateTrialsWithShuffledPools = (targetWords, distractorPool, trialsCount, targetProb, level) => {
  let shuffledTargets = shuffleArray([...targetWords]);
  let shuffledDistractors = shuffleArray([...distractorPool]);
  let targetIdx = 0, distractorIdx = 0;
  const trials = [];
  for (let i = 0; i < trialsCount; i++) {
    const isTarget = Math.random() < targetProb;
    let word;
    if (isTarget) {
      word = shuffledTargets[targetIdx % shuffledTargets.length];
      targetIdx++;
      if (targetIdx % shuffledTargets.length === 0) shuffledTargets = shuffleArray([...targetWords]);
    } else {
      word = shuffledDistractors[distractorIdx % shuffledDistractors.length];
      distractorIdx++;
      if (distractorIdx % shuffledDistractors.length === 0) shuffledDistractors = shuffleArray([...distractorPool]);
    }
    let correctResponse;
    if (level === 1) {
      correctResponse = isTarget ? 'yes' : 'no';   // принадлежит категории → ДА (правая)
    } else {
      correctResponse = isTarget ? 'no' : 'yes';   // ошибка есть → НЕТ (левая)
    }
    trials.push({
      trialNumberInCategory: i + 1,
      category: (level === 1 ? (isTarget ? 'target' : 'distractor') : (isTarget ? 'incorrect' : 'correct')),
      word,
      isTarget,
      correctResponse,
    });
  }
  return trials;
};

const GoNoGoTask = ({ blockId, participantId, onBlockComplete }) => {
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const currentLevel = LEVELS[currentLevelIdx];
  const config = LEVEL_CONFIGS[currentLevel];

  const [phase, setPhase] = useState('instructions');
  const [categoriesForLevel, setCategoriesForLevel] = useState([]);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [currentStimulus, setCurrentStimulus] = useState('');
  const [isSending, setIsSending] = useState(false);

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
  const trialShouldRunRef = useRef(false);

  const runTrialRef = useRef(null);
  const completeCategoryOrLevelRef = useRef(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { categoriesForLevelRef.current = categoriesForLevel; }, [categoriesForLevel]);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const generateTrials = useCallback((categoryName = null) => {
    const trialsCount = config.trialsPerCategory;
    const targetProb = config.targetProbability;
    if (currentLevel === 1) {
      const category = categoriesForLevelRef.current.find(c => c.name === categoryName);
      if (!category) return [];
      const targetWords = category.words || [];
      const allCategories = stimuli.words.categories;
      const otherWords = Object.keys(allCategories)
        .filter(cat => cat !== category.name)
        .flatMap(cat => allCategories[cat] || []);
      const distractorPool = otherWords.length ? otherWords : ['ОШИБКА'];
      return generateTrialsWithShuffledPools(targetWords, distractorPool, trialsCount, targetProb, 1);
    } else {
      let targetWords = [], distractorPool = [];
      if (currentLevel === 2) {
        targetWords = stimuli.phrases.incorrect || [];
        distractorPool = stimuli.phrases.correct || [];
      } else {
        targetWords = stimuli.sentences.incorrect || [];
        distractorPool = stimuli.sentences.correct || [];
      }
      if (!targetWords.length) targetWords = ['ОШИБКА'];
      if (!distractorPool.length) distractorPool = ['ОШИБКА'];
      return generateTrialsWithShuffledPools(targetWords, distractorPool, trialsCount, targetProb, currentLevel);
    }
  }, [config.trialsPerCategory, config.targetProbability, currentLevel]);

  const completeCategoryOrLevel = useCallback(() => {
    clearTimer();
    if (currentLevel === 1) {
      const nextIdx = currentCategoryIdxRef.current + 1;
      if (nextIdx < categoriesForLevelRef.current.length) {
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
    }
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
      completeBlock();
    }
  }, [currentLevelIdx, generateTrials, clearTimer, currentLevel]);

  const runTrial = useCallback(() => {
    clearTimer();
    if (trialIndexRef.current >= trialsRef.current.length) {
      completeCategoryOrLevel();
      return;
    }
    const trial = trialsRef.current[trialIndexRef.current];
    setCurrentStimulus(trial.word);
    responseReceivedRef.current = false;
    stimulusStartTimeRef.current = Date.now();
    setPhase('stimulus');
    timeoutRef.current = setTimeout(() => {
      if (!responseReceivedRef.current && phaseRef.current === 'stimulus') {
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
  }, [blockId, currentLevel, config.stimulusDuration, config.itiDuration, clearTimer, completeCategoryOrLevel]);

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

  const startLevel = useCallback(() => {
    if (currentLevel === 1) {
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
      const dummyCategoryName = currentLevel === 2 ? 'Фразы' : 'Предложения';
      const trials = generateTrials(dummyCategoryName);
      trialsRef.current = trials;
      trialIndexRef.current = 0;
      categoryStartTimeRef.current = Date.now();
      responseReceivedRef.current = false;
      setPhase('stimulus');
      trialShouldRunRef.current = true;
    }
    startExperimentRef.current = true;
  }, [currentLevel, config.numCategoriesToSelect, generateTrials]);

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

  useEffect(() => { runTrialRef.current = runTrial; }, [runTrial]);
  useEffect(() => { completeCategoryOrLevelRef.current = completeCategoryOrLevel; }, [completeCategoryOrLevel]);

  useEffect(() => {
    if (phase === 'stimulus' && trialShouldRunRef.current) {
      trialShouldRunRef.current = false;
      runTrialRef.current();
    }
  }, [phase]);

  const handleKeyDown = useCallback((e) => {
    const { code } = e;
    if (phase === 'instructions' && code === 'Space') {
      e.preventDefault();
      if (!startExperimentRef.current) startLevel();
      return;
    }
    if (phase === 'category' && code === 'Space') {
      e.preventDefault();
      setPhase('stimulus');
      trialShouldRunRef.current = true;
      return;
    }
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

  const renderContent = () => {
    if (phase === 'instructions') {
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
              Если да – <span className="instruction-right">нажмите <strong>→</strong> (стрелка вправо на клавиатуре)</span>, если нет –{' '}
              <span className="instruction-left">нажмите <strong>←</strong> (стрелка влево на клавиатуре)</span>.
            </p>
            <p>
              Старайтесь отвечать как можно быстрее и правильно, не пропускать стимулы и сохранять внимание
              на протяжении всей последовательности; ошибки возможны — это нормально, продолжайте выполнение.
            </p>
            <p><strong>Время теста составит примерно 5 минут.</strong></p>
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
              <span className="instruction-right">Нажмите <strong>→</strong> (стрелка вправо)</span>, если ошибок нет (ДА),{' '}
              <span className="instruction-left"> и <strong>←</strong> (стрелка влево)</span>, если ошибка есть (НЕТ).
            </p>
            <p>
              Старайтесь отвечать как можно быстрее и правильно, не пропускать стимулы и сохранять внимание
              на протяжении всей последовательности; ошибки возможны — это нормально, продолжайте выполнение.
            </p>
            <p><strong>Время теста составит примерно 2 минуты.</strong></p>
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
              <span className="instruction-right">Нажмите <strong>→</strong> (стрелка вправо)</span>, если ошибок нет (ДА),{' '}
              <span className="instruction-left"> и <strong>←</strong> (стрелка влево)</span>, если ошибка есть (НЕТ).
            </p>
            <p>
              Старайтесь отвечать как можно быстрее и правильно, не пропускать стимулы и сохранять внимание
              на протяжении всей последовательности; ошибки возможны — это нормально, продолжайте выполнение.
            </p>
            <p><strong>Время теста составит примерно 2.5 минуты.</strong></p>
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
              <span className="key-label instruction-left">Стрелка влево (НЕТ)</span>
            </div>
            <div className="key-group">
              <span className="key key-right">→</span>
              <span className="key-label instruction-right">Стрелка вправо (ДА)</span>
            </div>
          </div>
          <div className="progress-indicator">
            Уровень {currentLevelIdx + 1} из {LEVELS.length}
          </div>
          <p className="space-message">[ПРОБЕЛ] начать уровень</p>
          {isSending && <p>Отправка...</p>}
        </div>
      );
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