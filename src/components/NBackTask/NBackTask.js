// NBackTask.js (исправленный с единой инструкцией и полноэкранным режимом)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './NBackTask.css';
import { nbackApi } from '../utils/api';

const NBACK_CONFIG = {
  trialsPerLevel: 50,
  stimulusDuration: 2000,
  fixationDuration: 2000,
  itiDuration: 0,
  nLevels: [1, 2],
};

const NBACK_KEYS = {
  target: ['ArrowRight'],
  nontarget: ['ArrowLeft']
};

const NBackTask = ({ blockId, participantId, onBlockComplete }) => {
  const [displayPhase, setDisplayPhase] = useState('instructions');
  const [displayLetter, setDisplayLetter] = useState('');
  const [displayLevel, setDisplayLevel] = useState(1);
  const [showSpaceMessage, setShowSpaceMessage] = useState(true);
  const [isSendingData, setIsSendingData] = useState(false);
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);

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

  const responseReceivedForCurrentTrial = () => {
    const last = experimentDataRef.current[experimentDataRef.current.length - 1];
    return last?.responded === true;
  };

  const handleResponse = useCallback((responseType) => {
    const lastTrial = experimentDataRef.current[experimentDataRef.current.length - 1];
    if (!lastTrial || lastTrial.responded) return;

    lastTrial.responded = true;
    lastTrial.response = responseType;
    lastTrial.client_response_time = Date.now();

    const isTarget = lastTrial.is_target;
    if (responseType === 'target') {
      lastTrial.is_correct = isTarget;
      if (isTarget) lastTrial.is_hit = true;
      else lastTrial.is_false_alarm = true;
    } else {
      lastTrial.is_correct = !isTarget;
      if (!isTarget) lastTrial.is_correct_rejection = true;
      else lastTrial.is_miss = true;
    }

    clearAllTimeouts();
    setDisplayPhase('fixation');
    fixationTimeoutRef.current = setTimeout(() => {
      setDisplayPhase('iti');
      itiTimeoutRef.current = setTimeout(() => {
        nextTrial();
      }, NBACK_CONFIG.itiDuration);
    }, NBACK_CONFIG.fixationDuration);
  }, [clearAllTimeouts, nextTrial]);

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

  const isFullscreenSupported = useCallback(() => {
    return document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled;
  }, []);

  const getFullscreenElement = useCallback(() => {
    return document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
  }, []);

  const safeRequestFullscreen = useCallback(async (element) => {
    if (!element || !isFullscreenSupported()) return false;
    try {
      const methods = ['requestFullscreen', 'mozRequestFullScreen', 'webkitRequestFullscreen', 'msRequestFullscreen'];
      const method = methods.find(m => element[m] !== undefined);
      if (!method) return false;
      const promise = element[method]();
      if (promise) await promise;
      return true;
    } catch (error) {
      setShowFullscreenPrompt(true);
      return false;
    }
  }, [isFullscreenSupported]);

  const enterFullscreen = useCallback(async () => {
    const success = await safeRequestFullscreen(document.documentElement);
    if (success) setShowFullscreenPrompt(false);
    return success;
  }, [safeRequestFullscreen]);

  const exitFullscreen = useCallback(() => {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (getFullscreenElement()) exitFullscreen();
    else enterFullscreen();
  }, [enterFullscreen, exitFullscreen, getFullscreenElement]);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!getFullscreenElement());
    const events = ['fullscreenchange', 'mozfullscreenchange', 'webkitfullscreenchange', 'msfullscreenchange'];
    events.forEach(event => document.addEventListener(event, handleFullscreenChange));
    return () => events.forEach(event => document.removeEventListener(event, handleFullscreenChange));
  }, [getFullscreenElement]);

  useEffect(() => {
    if (displayPhase === 'instructions' && !getFullscreenElement() && !showFullscreenPrompt) {
      const timer = setTimeout(() => setShowFullscreenPrompt(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [displayPhase, getFullscreenElement, showFullscreenPrompt]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      const { code } = e;

      if (code === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }

      if (code === 'Escape' && isFullscreen && displayPhase === 'instructions') {
        exitFullscreen();
      }

      if (code === 'Space' || code === ' ') {
        e.preventDefault();
        if (displayPhase === 'instructions' && !isRunningRef.current) {
          isRunningRef.current = true;
          startExperiment();
        } else if (displayPhase === 'stimulus' && !responseReceivedForCurrentTrial()) {
          handleResponse('target');
        }
        return;
      }

      if (displayPhase === 'stimulus' && !responseReceivedForCurrentTrial()) {
        if (NBACK_KEYS.target.includes(code)) {
          e.preventDefault();
          handleResponse('target');
        } else if (NBACK_KEYS.nontarget.includes(code)) {
          e.preventDefault();
          handleResponse('nontarget');
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [displayPhase, handleResponse, toggleFullscreen, exitFullscreen, isFullscreen]);

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
      correct_response: isTarget ? 'target' : 'nontarget',
      client_start_time: startTime,
      client_stimulus_time: stimulusTime,
      client_fixation_time: fixationTime,
      responded: false,
      response: null,
      stimulus_type: 'letter',
    });

    stimulusTimeoutRef.current = setTimeout(() => {
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
        correct_response: trial.correct_response || (trial.is_target ? 'target' : 'nontarget'),
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
            <strong>Тест 2:</strong> Вам будут по одному предъявляться буквы.
            Ваша задача — сравнивать текущую букву с той, которая была <b>показана перед ней</b>.
          </p>
          <p>Например, в последовательности А‑Б‑<span style={{color: 'green'}}>В</span>-<span style={{color: 'green'}}>В</span> есть совпадение, а в А‑В‑Б‑А – нет.</p>
        </>
      );
    } else {
      return (
        <>
          <p>
            <strong>Тест 2:</strong> Вам будут по одному предъявляться буквы.
            Ваша задача — сравнивать текущую букву с той, которая была <b>показана два шага назад</b>.
          </p>
          <p>Например, в последовательности А‑<span style={{color: 'green'}}>В</span>‑Б-<span style={{color: 'green'}}>В</span> есть совпадение, а в А‑В‑Б‑А – нет.</p>
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
              <p>◉ Отвечайте как можно быстрее, но правильно</p>
              <p>◉ <span className="instruction-right">Стрелка вправо →</span> – буква совпадает</p>
              <p>◉ <span className="instruction-left">Стрелка влево ←</span> – буква НЕ совпадает</p>
            </div>
            <div className="instruction-keys">
              <div className="key-group">
                <span className="key key-left">←</span>
                <span className="key-label instruction-left">Стрелка влево (не совпадает)</span>
              </div>
              <div className="key-group">
                <span className="key key-right">→</span>
                <span className="key-label instruction-right">Стрелка вправо (совпадает)</span>
              </div>
            </div>
            {showFullscreenPrompt && !isFullscreen && (
              <div className="fullscreen-prompt-overlay">
                <div className="fullscreen-prompt-content">
                  <p className="fullscreen-prompt-title">🔍 Рекомендуется полноэкранный режим</p>
                  <p className="fullscreen-prompt-text">Для лучшего погружения включите полноэкранный режим</p>
                  <div className="fullscreen-prompt-buttons">
                    <button className="fullscreen-prompt-btn primary" onClick={enterFullscreen}>Включить полноэкранный режим</button>
                    <button className="fullscreen-prompt-btn secondary" onClick={() => setShowFullscreenPrompt(false)}>Продолжить без полноэкранного режима</button>
                  </div>
                  <p className="fullscreen-prompt-hint">Или нажмите <strong>F11</strong> в любое время</p>
                </div>
              </div>
            )}
            <div className="space-instruction">
              <p className="space-message" style={{ opacity: showSpaceMessage ? 1 : 0.3 }}>
                Нажмите <span className="space-key">ПРОБЕЛ</span> чтобы начать
              </p>
            </div>
            <div className="fullscreen-controls">
              <button className="fullscreen-btn" onClick={toggleFullscreen} title={isFullscreen ? "Выйти из полноэкранного режима (F11)" : "Перейти в полноэкранный режим (F11)"}>
                {isFullscreen ? '✕ Выйти из полноэкранного' : '⛶ Переключить режим'}
              </button>
              <p className="fullscreen-hint">Для лучшего погружения рекомендуется использовать полноэкранный режим</p>
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