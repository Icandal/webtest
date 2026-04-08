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
  const letters = ['A', 'M', 'O', 'T'];

  // Очистка всех таймаутов
  const clearAllTimeouts = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

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

        // Старт эксперимента
        if (displayPhase === 'instructions' && !isRunningRef.current) {
          isRunningRef.current = true;
          startExperiment();
        }
        // Ответ во время показа буквы
        else if (displayPhase === 'stimulus') {
          const lastTrial = experimentDataRef.current[experimentDataRef.current.length - 1];
          if (lastTrial && !lastTrial.responded) {
            // Регистрируем ответ
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
            setResponseFeedback('✓ Ответ зарегистрирован');

            // Сбрасываем старые таймауты (включая тот, что должен был переключить на fixation)
            clearAllTimeouts();

            // Переключаемся на крестик
            setDisplayPhase('fixation');

            // Через fixationDuration переходим в ITI, затем следующий триал
            timeoutRef.current = setTimeout(() => {
              setDisplayPhase('iti');
              timeoutRef.current = setTimeout(() => {
                nextTrial();
              }, NBACK_CONFIG.itiDuration);
            }, NBACK_CONFIG.fixationDuration);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [displayPhase]);

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

    clearAllTimeouts();
    // Таймаут: если за время stimulusDuration не было ответа, переходим к крестику
    timeoutRef.current = setTimeout(() => {
      // Если мы всё ещё на фазе стимула (значит, ответа не было)
      if (displayPhase === 'stimulus') {
        setDisplayPhase('fixation');
        timeoutRef.current = setTimeout(() => {
          setDisplayPhase('iti');
          timeoutRef.current = setTimeout(() => {
            nextTrial();
          }, NBACK_CONFIG.itiDuration);
        }, NBACK_CONFIG.fixationDuration);
      }
    }, NBACK_CONFIG.stimulusDuration);
  };

  const nextTrial = () => {
    clearAllTimeouts();
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

  const getInstructionText = (level) => {
    if (level === 1) {
      return (
        <>
          <p>
            <strong>Тест 2 (1‑back):</strong> Вам будут по одному предъявляться буквы,
            и ваша задача — сравнивать текущую букву с той, которая была показана перед ней.
            При совпадении, нажмите «Пробел», если не совпадают — ничего не нажимайте.
          </p>
          <p>
            Например, в последовательности А‑<span style={{color: 'green'}}>В</span>‑Б‑
            <span style={{color: 'green'}}>В</span> есть совпадение (выделено зелёным),
            а в А‑В‑Б‑А – нет.
          </p>
          <p>Отвечайте нажатием пробела сразу при появлении буквы, во время крестика (+) только готовьтесь.</p>
          <p>Старайтесь отвечать как можно быстрее и точнее...</p>
        </>
      );
    } else if (level === 2) {
      return (
        <>
          <p>
            <strong>Тест 2 (2‑back):</strong> Вам будут по одному предъявляться буквы,
            и ваша задача — сравнивать текущую букву с той, которая была показана два шага назад.
          </p>
          <p>
            Например, в последовательности А‑<span style={{color: 'green'}}>В</span>‑Б‑
            <span style={{color: 'green'}}>В</span> есть совпадение (выделено зелёным),
            а в А‑В‑Б‑А – нет.
          </p>
          <p>Отвечайте нажатием пробела сразу при появлении буквы, во время крестика (+) только готовьтесь.</p>
          <p>Старайтесь отвечать как можно быстрее и точнее...</p>
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
              <p>◉ Отвечайте во время показа буквы</p>
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