import React, { useState, useEffect, useRef } from 'react';
import './NBackTask.css';
import { nbackApi } from '../utils/api';

const NBACK_CONFIG = {
  trialsPerLevel: 50,
  stimulusDuration: 800,
  fixationDuration: 1500,
  itiDuration: 200,
  nLevels: [1, 2],
};

const NBackTask = ({ blockId, participantId, onBlockComplete }) => {
  const [displayPhase, setDisplayPhase] = useState('instructions');
  const [displayLetter, setDisplayLetter] = useState('');
  const [displayLevel, setDisplayLevel] = useState(1);
  const [displayTrial, setDisplayTrial] = useState(1);
  const [showSpaceMessage, setShowSpaceMessage] = useState(true);
  const [responseFeedback, setResponseFeedback] = useState('');
  const [isSendingData, setIsSendingData] = useState(false);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);

  const experimentDataRef = useRef([]);
  const isRunningRef = useRef(false);
  const timeoutRef = useRef(null);
  const historyRef = useRef([]);
  const currentTrialRef = useRef(1);
  const currentLevelRef = useRef(0);
  const letters = ['A', 'B', 'C', 'D'];

  useEffect(() => {
    if (blockId) {
      createNBackConfig();
    }
  }, [blockId]);

  useEffect(() => {
    if (displayPhase === 'instructions') {
      const interval = setInterval(() => setShowSpaceMessage(prev => !prev), 1000);
      return () => clearInterval(interval);
    }
  }, [displayPhase]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (displayPhase === 'instructions' && !isRunningRef.current) {
          isRunningRef.current = true;
          startExperiment();
        } else if (displayPhase === 'fixation') {
          setResponseFeedback('✓ Ответ зарегистрирован');
          const lastTrialIndex = experimentDataRef.current.length - 1;
          if (lastTrialIndex >= 0) {
            const trialData = experimentDataRef.current[lastTrialIndex];
            trialData.response = 'target';
            trialData.client_response_time = Date.now();
            trialData.responded = true;
            if (trialData.is_target) {
              trialData.is_correct = true;
              trialData.is_hit = true;
            } else {
              trialData.is_correct = false;
              trialData.is_false_alarm = true;
            }
          }
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setDisplayPhase('iti');
          timeoutRef.current = setTimeout(nextTrial, NBACK_CONFIG.itiDuration);
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [displayPhase]);

  const createNBackConfig = async () => {
    try {
      const config = {
        n_level: NBACK_CONFIG.nLevels[0],
        trials_per_block: NBACK_CONFIG.trialsPerLevel * NBACK_CONFIG.nLevels.length,
        stimulus_duration: NBACK_CONFIG.stimulusDuration,
        fixation_duration: NBACK_CONFIG.fixationDuration,
        iti_duration: NBACK_CONFIG.itiDuration,
        stimulus_type: 'letter',
        target_stimuli: letters,
        non_target_stimuli: letters,
        target_probability: 0.3,
      };
      await nbackApi.createBlockConfig(blockId, config);
    } catch (error) {}
  };

  const startExperiment = () => {
    currentTrialRef.current = 1;
    setDisplayTrial(1);
    setDisplayLevel(NBACK_CONFIG.nLevels[currentLevelRef.current]);
    setCurrentLevelIndex(currentLevelRef.current);
    runTrial();
  };

  const runTrial = () => {
    setResponseFeedback('');
    const nLevel = NBACK_CONFIG.nLevels[currentLevelRef.current];
    const isTarget = Math.random() < 0.3 && historyRef.current.length >= nLevel;
    let randomLetter;
    if (isTarget) {
      const nBackIndex = historyRef.current.length - nLevel;
      randomLetter = historyRef.current[nBackIndex];
    } else {
      randomLetter = letters[Math.floor(Math.random() * letters.length)];
    }
    historyRef.current.push(randomLetter);
    if (historyRef.current.length > 10) historyRef.current.shift();

    setDisplayLetter(randomLetter);
    setDisplayPhase('stimulus');

    const startTime = Date.now();
    const stimulusTime = startTime + 100;
    const fixationTime = stimulusTime + NBACK_CONFIG.stimulusDuration;

    experimentDataRef.current.push({
      trial_number: experimentDataRef.current.length + 1,
      n_level: nLevel,
      stimulus: randomLetter,
      is_target: isTarget,
      correct_response: isTarget ? 'target' : 'no_response',
      client_start_time: startTime,
      client_stimulus_time: stimulusTime,
      client_fixation_time: fixationTime,
      responded: false,
      response: null,
      stimulus_type: 'letter',
    });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setDisplayPhase('fixation');
      timeoutRef.current = setTimeout(() => {
        if (displayPhase === 'fixation') setDisplayPhase('iti');
        timeoutRef.current = setTimeout(nextTrial, NBACK_CONFIG.itiDuration);
      }, NBACK_CONFIG.fixationDuration);
    }, NBACK_CONFIG.stimulusDuration);
  };

  const nextTrial = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const nextTrialNum = currentTrialRef.current + 1;
    if (nextTrialNum <= NBACK_CONFIG.trialsPerLevel) {
      currentTrialRef.current = nextTrialNum;
      setDisplayTrial(nextTrialNum);
      runTrial();
    } else {
      completeLevel();
    }
  };

  const completeLevel = () => {
    const nextLevel = currentLevelRef.current + 1;
    if (nextLevel < NBACK_CONFIG.nLevels.length) {
      currentLevelRef.current = nextLevel;
      currentTrialRef.current = 1;
      historyRef.current = [];
      setTimeout(() => {
        setDisplayPhase('instructions');
        setDisplayLevel(NBACK_CONFIG.nLevels[nextLevel]);
        setDisplayTrial(1);
        setCurrentLevelIndex(nextLevel);
        setDisplayLetter('');
        isRunningRef.current = false;
      }, 2000);
    } else {
      finishBlock();
    }
  };

  const sendDataToServer = async () => {
    if (!blockId) return false;
    setIsSendingData(true);
    try {
      const trialsToSend = experimentDataRef.current.map((trial, index) => ({
        trial_number: trial.trial_number || index + 1,
        n_level: trial.n_level || 1,
        stimulus: trial.stimulus || '',
        response: trial.response || null,
        correct_response: trial.correct_response || (trial.is_target ? 'target' : 'no_response'),
        is_target: trial.is_target || false,
        is_correct: trial.is_correct || null,
        client_start_time: trial.client_start_time || Date.now(),
        client_stimulus_time: trial.client_stimulus_time || Date.now(),
        client_response_time: trial.client_response_time || null,
        client_fixation_time: trial.client_fixation_time || Date.now(),
        stimulus_type: trial.stimulus_type || 'letter',
        responded: trial.responded || false,
      }));
      const dataToSend = { trials: trialsToSend, block_id: blockId, n_level: NBACK_CONFIG.nLevels[currentLevelRef.current] || 1 };
      const result = await nbackApi.sendBatchData(dataToSend);
      return result.success;
    } catch (error) {
      setResponseFeedback(`❌ Ошибка: ${error.message}`);
      return false;
    } finally {
      setIsSendingData(false);
    }
  };

  const finishBlock = async () => {
    const sendSuccess = await sendDataToServer();
    if (onBlockComplete) {
      onBlockComplete({
        blockType: 'nback_task',
        totalTrials: experimentDataRef.current.length,
        data: experimentDataRef.current,
        nLevelsCompleted: NBACK_CONFIG.nLevels,
        sendSuccess,
        blockId,
        participantId,
      });
    }
  };

  // Функция для получения текста инструкции в зависимости от уровня
  const getInstructionText = (level) => {
    if (level === 1) {
      return (
        <>
          <p><strong>Тест 2 (1‑back):</strong> Вам будут по одному предъявляться буквы, и ваша задача — сравнивать текущую букву с той, которая была показана перед ней. При совпадении, нажмите «Пробел», если не совпадают — ничего не нажимайте.</p>
          <p>Старайтесь отвечать как можно быстрее и точнее, не пропускать стимулы и сохранять внимание на протяжении всей последовательности; ошибки возможны — это нормально, продолжайте выполнение.</p>
        </>
      );
    } else if (level === 2) {
      return (
        <>
          <p><strong>Тест 2 (2‑back):</strong> Вам будут по одному предъявляться буквы, и ваша задача — сравнивать текущую букву с той, которая была показана два шага назад. Например, в последовательности А‑В‑Б‑В есть совпадение, а в А‑В‑Б‑А – нет. При совпадении, нажмите «Пробел», если не совпадают — ничего не нажимайте.</p>
          <p>Старайтесь отвечать как можно быстрее и точнее, не пропускать стимулы и сохранять внимание на протяжении всей последовательности; ошибки возможны — это нормально, продолжайте выполнение.</p>
        </>
      );
    }
    return null;
  };

  return (
    <div className="nback-task">
      <div className="nback-content">
        {displayPhase === 'instructions' && (
          <div className="nback-instructions">
            <h2>Тест 2</h2>
            <h3>Уровень: {displayLevel}-back</h3>
            {getInstructionText(displayLevel)}
            <div className="instruction-details">
              <p>◉ Триалов в уровне: {NBACK_CONFIG.trialsPerLevel}</p>
              <p>◉ Отвечайте во время показа знака "+"</p>
              <p>◉ Реагируйте только на точные совпадения</p>
              <p>◉ Всего уровней: {NBACK_CONFIG.nLevels.length}</p>
              <p>◉ Текущий уровень: {currentLevelIndex + 1} из {NBACK_CONFIG.nLevels.length}</p>
            </div>
            <div className="space-instruction">
              <p className="space-message" style={{ opacity: showSpaceMessage ? 1 : 0.3 }}>
                Нажмите <span className="space-key">ПРОБЕЛ</span> чтобы начать
              </p>
            </div>
            <div className="progress-indicator">Уровень {currentLevelIndex + 1} из {NBACK_CONFIG.nLevels.length}</div>
            {isSendingData && <div className="sending-data"><p>Отправка данных на сервер...</p><div className="spinner small"></div></div>}
          </div>
        )}
        {displayPhase === 'stimulus' && (
          <div className="nback-stimulus">
            <div className="stimulus-letter">{displayLetter}</div>
          </div>
        )}
        {displayPhase === 'fixation' && (
          <div className="nback-fixation">
            <div className="fixation-cross">+</div>
            {responseFeedback && <div className="response-feedback">{responseFeedback}</div>}
          </div>
        )}
        {displayPhase === 'iti' && <div className="nback-iti"></div>}
      </div>
    </div>
  );
};

export default NBackTask;