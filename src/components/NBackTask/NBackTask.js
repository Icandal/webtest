import React, { useState, useEffect, useRef, useCallback } from 'react';
import './NBackTask.css';
import { nbackApi } from '../utils/api';

const NBACK_CONFIG = {
  trialsPerLevel: 5, // 50 в реальном эксперименте
  stimulusDuration: 2000,
  fixationDuration: 2000,
  itiDuration: 0,
  nLevels: [1, 2],
};

const NBackTask = ({ blockId, participantId, onBlockComplete }) => {
  const [displayPhase, setDisplayPhase] = useState('instructions');
  const [displayLetter, setDisplayLetter] = useState('');
  const [displayLevel, setDisplayLevel] = useState(1);
  const [showSpaceMessage, setShowSpaceMessage] = useState(true);
  const [isSendingData, setIsSendingData] = useState(false);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);

  const experimentDataRef = useRef([]);
  const isRunningRef = useRef(false);
  const stimulusTimeoutRef = useRef(null);
  const fixationTimeoutRef = useRef(null);
  const itiTimeoutRef = useRef(null);
  const historyRef = useRef([]);
  const currentTrialRef = useRef(1);
  const currentLevelRef = useRef(0);
  const phaseRef = useRef(displayPhase);
  const letters = ['A', 'M', 'O', 'T'];

  // Следим за актуальной фазой
  useEffect(() => {
    phaseRef.current = displayPhase;
  }, [displayPhase]);

  const clearAllTimeouts = useCallback(() => {
    if (stimulusTimeoutRef.current) {
      clearTimeout(stimulusTimeoutRef.current);
      stimulusTimeoutRef.current = null;
    }
    if (fixationTimeoutRef.current) {
      clearTimeout(fixationTimeoutRef.current);
      fixationTimeoutRef.current = null;
    }
    if (itiTimeoutRef.current) {
      clearTimeout(itiTimeoutRef.current);
      itiTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (displayPhase === 'instructions') {
      const interval = setInterval(() => setShowSpaceMessage(prev => !prev), 1000);
      return () => clearInterval(interval);
    }
  }, [displayPhase]);

  const nextTrial = useCallback(() => {
    clearAllTimeouts();
    const nextTrialNum = currentTrialRef.current + 1;
    if (nextTrialNum <= NBACK_CONFIG.trialsPerLevel) {
      currentTrialRef.current = nextTrialNum;
      runTrial();
    } else {
      completeLevel();
    }
  }, [clearAllTimeouts]);

  const handleNoResponse = useCallback(() => {
    const lastTrial = experimentDataRef.current[experimentDataRef.current.length - 1];
    if (lastTrial && !lastTrial.responded) {
      lastTrial.response = null;
      lastTrial.responded = true;
      lastTrial.client_response_time = null;
      if (lastTrial.is_target) {
        lastTrial.is_correct = false;
        lastTrial.is_miss = true;
      } else {
        lastTrial.is_correct = true;
        lastTrial.is_correct_rejection = true;
      }
    }
    setDisplayPhase('fixation');
    fixationTimeoutRef.current = setTimeout(() => {
      setDisplayPhase('iti');
      itiTimeoutRef.current = setTimeout(() => {
        nextTrial();
      }, NBACK_CONFIG.itiDuration);
    }, NBACK_CONFIG.fixationDuration);
  }, [nextTrial]);

  const handleResponse = useCallback(() => {
    const lastTrial = experimentDataRef.current[experimentDataRef.current.length - 1];
    if (lastTrial && !lastTrial.responded) {
      lastTrial.response = 'target';
      lastTrial.client_response_time = Date.now();
      lastTrial.responded = true;
      if (lastTrial.is_target) {
        lastTrial.is_correct = true;
        lastTrial.is_hit = true;
      } else {
        lastTrial.is_correct = false;
        lastTrial.is_false_alarm = true;
      }
      clearAllTimeouts();
      setDisplayPhase('fixation');
      fixationTimeoutRef.current = setTimeout(() => {
        setDisplayPhase('iti');
        itiTimeoutRef.current = setTimeout(() => {
          nextTrial();
        }, NBACK_CONFIG.itiDuration);
      }, NBACK_CONFIG.fixationDuration);
    }
  }, [clearAllTimeouts, nextTrial]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (displayPhase === 'instructions' && !isRunningRef.current) {
          isRunningRef.current = true;
          startExperiment();
        } else if (displayPhase === 'stimulus') {
          handleResponse();
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [displayPhase, handleResponse]);

  const startExperiment = () => {
    currentTrialRef.current = 1;
    setDisplayLevel(NBACK_CONFIG.nLevels[currentLevelRef.current]);
    setCurrentLevelIndex(currentLevelRef.current);
    runTrial();
  };

  const runTrial = () => {
    clearAllTimeouts();
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
    const stimulusTime = startTime;
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

    stimulusTimeoutRef.current = setTimeout(() => {
      // Используем ref для проверки актуальной фазы
      if (phaseRef.current === 'stimulus') {
        handleNoResponse();
      }
    }, NBACK_CONFIG.stimulusDuration);
  };

  const completeLevel = () => {
    clearAllTimeouts();
    const nextLevel = currentLevelRef.current + 1;
    if (nextLevel < NBACK_CONFIG.nLevels.length) {
      currentLevelRef.current = nextLevel;
      currentTrialRef.current = 1;
      historyRef.current = [];
      setTimeout(() => {
        setDisplayPhase('instructions');
        setDisplayLevel(NBACK_CONFIG.nLevels[nextLevel]);
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
      console.error('Ошибка отправки NBack:', error);
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

  const getInstructionText = (level) => {
    if (level === 1) {
      return (
        <>
          <p>
            <strong>Тест 2:</strong> Вам будут по одному предъявляться буквы,
            и ваша задача — сравнивать текущую букву с той, которая была <b> показана перед ней. </b>
            При совпадении нажмите ПРОБЕЛ.
          </p>
          <p>
            Например, в последовательности А‑Б-<span style={{color: 'green'}}>В</span>-
            <span style={{color: 'green'}}>В</span> есть совпадение (выделено зелёным),
            а в А‑В‑Б‑А – нет.
          </p>
        </>
      );
    } else {
      return (
        <>
          <p>
            <strong>Тест 2:</strong> Вам будут по одному предъявляться буквы,
            и ваша задача — сравнивать текущую букву с той, которая была<b> показана два шага назад. </b>
            При совпадении нажмите ПРОБЕЛ.
          </p>
          <p>
            Например, в последовательности А‑<span style={{color: 'green'}}>В</span>‑Б‑
            <span style={{color: 'green'}}>В</span> есть совпадение (выделено зелёным),
            а в А‑В‑Б‑А – нет.
          </p>
        </>
      );
    }
  };

  return (
    <div className="nback-task">
      <div className="nback-content">
        {displayPhase === 'instructions' && (
          <div className="nback-instructions">
            <h2>Тест 2</h2>
            <h3>Сложность: {displayLevel}</h3>
            {getInstructionText(displayLevel)}
            <div className="instruction-details">
              <p>◉ Отвечайте как можно быстрее но правильно</p>
              <p>◉ Реагируйте только на точные совпадения</p>
              <p>◉ Если нет совпадения - ничего не нажимайте</p>
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
          </div>
        )}
        {displayPhase === 'iti' && <div className="nback-iti"></div>}
      </div>
    </div>
  );
};

export default NBackTask;