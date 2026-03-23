import React, { useState, useEffect, useRef, useCallback } from 'react';
import './FlankerTask.css';
import api from '../utils/api';

const FLANKER_CONFIG = {
  trialsPerBlock: 200,
  stimulusDuration: 50,
  fixationDuration: 1200,
  itiDuration: 250,
  stimuli: [
    { type: 'congruent', stimulus: '←←←←←', correctResponse: 'left' },
    { type: 'congruent', stimulus: '→→→→→', correctResponse: 'right' },
    { type: 'incongruent', stimulus: '←←→←←', correctResponse: 'right' },
    { type: 'incongruent', stimulus: '→→←→→', correctResponse: 'left' },
  ],
  keys: {
    left: ['ArrowLeft', 'a', 'A'],
    right: ['ArrowRight', 'd', 'D']
  }
};

const FlankerTask = ({ blockId, participantId, onBlockComplete }) => {
  const [currentTrial, setCurrentTrial] = useState(0);
  const [trials, setTrials] = useState([]);
  const [currentPhase, setCurrentPhase] = useState('instructions');
  const [currentStimulus, setCurrentStimulus] = useState('');
  const [showSpaceMessage, setShowSpaceMessage] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);

  const trialStartRef = useRef(null);
  const stimulusShownRef = useRef(null);
  const fixationShownRef = useRef(null);
  const blockDataRef = useRef([]);
  const timeoutRef = useRef(null);
  const responseReceivedRef = useRef(false);
  const containerRef = useRef(null);

  const generateTrials = useCallback(() => {
    const generatedTrials = [];
    for (let i = 0; i < FLANKER_CONFIG.trialsPerBlock; i++) {
      const stimulusIndex = Math.floor(Math.random() * FLANKER_CONFIG.stimuli.length);
      const stimulus = FLANKER_CONFIG.stimuli[stimulusIndex];
      generatedTrials.push({
        trialNumber: i + 1,
        trialType: stimulus.type,
        stimulus: stimulus.stimulus,
        correctResponse: stimulus.correctResponse,
      });
    }
    setTrials(generatedTrials);
  }, []);

  useEffect(() => {
    generateTrials();
  }, [generateTrials]);

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
    if (currentPhase === 'instructions' && !getFullscreenElement() && !showFullscreenPrompt) {
      const timer = setTimeout(() => setShowFullscreenPrompt(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [currentPhase, getFullscreenElement, showFullscreenPrompt]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const content = containerRef.current.querySelector('.flanker-content');
        if (content) {
          const containerHeight = containerRef.current.clientHeight;
          const contentHeight = content.clientHeight;
          content.style.marginTop = containerHeight > contentHeight ? `${(containerHeight - contentHeight) / 2}px` : '0';
        }
      }
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const sendBatchData = async () => {
    try {
      const trialsData = blockDataRef.current.map(t => ({
        experiment_block: t.experiment_block,
        trial_number: t.trial_number,
        stimulus: t.stimulus,
        response: t.response,
        correct_response: t.correct_response,
        is_correct: t.is_correct,
        reaction_time: t.reaction_time,
        client_start_time: t.client_start_time,
        client_stimulus_time: t.client_stimulus_time,
        client_fixation_time: t.client_fixation_time,
        client_response_time: t.client_response_time,
      }));
      const response = await api.post('/trials/batch/', {
        block_id: blockId,
        trials: trialsData
      });
      return response.status === 201;
    } catch (error) {
      console.error('Ошибка отправки данных Flanker:', error);
      return false;
    }
  };

  const completeBlock = useCallback(async () => {
    if (blockDataRef.current.length > 0) await sendBatchData();
    if (blockId) {
      try {
        await api.post('/block/complete/', { block_id: blockId });
      } catch (error) { console.error('Ошибка завершения блока Flanker:', error); }
    }
    if (onBlockComplete) {
      onBlockComplete({
        blockType: 'flanker_task',
        totalTrials: trials.length,
        completedTrials: blockDataRef.current.length,
        accuracy: blockDataRef.current.filter(t => t.is_correct).length / blockDataRef.current.length,
      });
    }
  }, [blockId, onBlockComplete, trials.length]);

  const saveTrialData = useCallback((trialData, responseMade, responseTime, clientResponseTime) => {
    return {
      experiment_block: parseInt(blockId),
      trial_number: trialData.trialNumber,
      stimulus: trialData.stimulus,
      response: responseMade,
      correct_response: trialData.correctResponse,
      is_correct: responseMade === trialData.correctResponse,
      reaction_time: responseTime,
      client_start_time: trialStartRef.current,
      client_stimulus_time: stimulusShownRef.current,
      client_fixation_time: fixationShownRef.current,
      client_response_time: clientResponseTime,
    };
  }, [blockId]);

  const handleNoResponse = useCallback((trialIndex, trialData) => {
    blockDataRef.current.push(saveTrialData(trialData, null, null, null));
    responseReceivedRef.current = false;
    const nextTrial = trialIndex + 1;
    if (nextTrial < trials.length) {
      setCurrentTrial(nextTrial);
      setCurrentPhase('iti');
      setCurrentStimulus('');
      timeoutRef.current = setTimeout(() => startTrial(nextTrial), FLANKER_CONFIG.itiDuration);
    } else {
      setCurrentPhase('iti');
      timeoutRef.current = setTimeout(completeBlock, FLANKER_CONFIG.itiDuration);
    }
  }, [trials.length, completeBlock, saveTrialData]);

  const handleResponse = useCallback((responseMade, trialIndex, trialData, responseTime) => {
    const clientResponseTime = Date.now();
    blockDataRef.current.push(saveTrialData(trialData, responseMade, responseTime, clientResponseTime));
    responseReceivedRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const nextTrial = trialIndex + 1;
    if (nextTrial < trials.length) {
      setCurrentTrial(nextTrial);
      setCurrentPhase('iti');
      setCurrentStimulus('');
      timeoutRef.current = setTimeout(() => startTrial(nextTrial), FLANKER_CONFIG.itiDuration);
    } else {
      setCurrentPhase('iti');
      timeoutRef.current = setTimeout(completeBlock, FLANKER_CONFIG.itiDuration);
    }
  }, [trials.length, completeBlock, saveTrialData]);

  const startTrial = useCallback((trialIndex) => {
    if (trialIndex >= trials.length) {
      completeBlock();
      return;
    }
    const trialData = trials[trialIndex];
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    responseReceivedRef.current = false;
    trialStartRef.current = Date.now();
    setCurrentPhase('stimulus');
    setCurrentStimulus(trialData.stimulus);
    stimulusShownRef.current = Date.now();
    timeoutRef.current = setTimeout(() => {
      setCurrentPhase('fixation');
      setCurrentStimulus('+');
      fixationShownRef.current = Date.now();
      timeoutRef.current = setTimeout(() => {
        if (!responseReceivedRef.current) handleNoResponse(trialIndex, trialData);
      }, FLANKER_CONFIG.fixationDuration);
    }, FLANKER_CONFIG.stimulusDuration);
  }, [trials, completeBlock, handleNoResponse]);

  const handleKeyPress = useCallback((event) => {
    const { code, key } = event;
    if (code === 'F11') {
      event.preventDefault();
      toggleFullscreen();
    }
    if (code === 'Escape' && isFullscreen && currentPhase === 'instructions') {
      exitFullscreen();
    }
    if (currentPhase === 'instructions' && code === 'Space') {
      event.preventDefault();
      startTrial(0);
    }
    if (currentPhase === 'fixation' && trials[currentTrial]) {
      const isLeftKey = FLANKER_CONFIG.keys.left.includes(key);
      const isRightKey = FLANKER_CONFIG.keys.right.includes(key);
      if (isLeftKey || isRightKey) {
        event.preventDefault();
        const responseTime = Date.now() - fixationShownRef.current;
        const responseMade = isLeftKey ? 'left' : 'right';
        handleResponse(responseMade, currentTrial, trials[currentTrial], responseTime);
      }
    }
  }, [currentPhase, currentTrial, trials, startTrial, handleResponse, toggleFullscreen, exitFullscreen, isFullscreen]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  useEffect(() => {
    if (currentPhase === 'instructions') {
      const interval = setInterval(() => setShowSpaceMessage(prev => !prev), 1000);
      return () => clearInterval(interval);
    }
  }, [currentPhase]);

  const renderPhaseContent = () => {
    if (currentPhase === 'instructions') {
      return (
        <div className="flanker-instructions">
          <h3>Flanker Task</h3>
          <p>Определите направление <strong>центральной стрелки</strong></p>
          <div className="instruction-keys">
            <div className="key-group"><span className="key">←</span><span className="key">A</span><span className="key-label">Стрелка влево</span></div>
            <div className="key-group"><span className="key">→</span><span className="key">D</span><span className="key-label">Стрелка вправо</span></div>
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
        </div>
      );
    }
    if (currentPhase === 'fixation') {
      return (
        <div className="flanker-fixation">
          <div className="fixation-cross">{currentStimulus}</div>
        </div>
      );
    }
    if (currentPhase === 'stimulus') {
      return (
        <div className="flanker-stimulus">
          <div className="stimulus">{currentStimulus}</div>
        </div>
      );
    }
    if (currentPhase === 'iti') {
      return <div className="flanker-iti"></div>;
    }
    return null;
  };

  return (
    <div className="flanker-task" ref={containerRef}>
      <div className="flanker-content">
        {renderPhaseContent()}
      </div>
    </div>
  );
};

export default FlankerTask;