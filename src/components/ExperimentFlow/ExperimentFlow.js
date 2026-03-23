import React, { useState, useEffect } from 'react';
import FlankerTask from '../FlankerTask/FlankerTask';
import NBackTask from '../NBackTask/NBackTask';
import GoNoGoTask from '../GoNoGoTask/GoNoGoTask';
import PostExperimentQuestionnaire from '../PostExperimentQuestionnaire/PostExperimentQuestionnaire';
import { participantApi, nbackApi } from '../utils/api';
import './ExperimentFlow.css';

const ExperimentFlow = ({ participantData, onExperimentComplete }) => {
  const [experimentSessionId, setExperimentSessionId] = useState(null);
  const [currentBlockId, setCurrentBlockId] = useState(null);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [flankerCompleted, setFlankerCompleted] = useState(false);
  const [nbackCompleted, setNbackCompleted] = useState(false);
  const [gonogoCompleted, setGonogoCompleted] = useState(false);
  const [questionnaireCompleted, setQuestionnaireCompleted] = useState(false);

  const [flankerData, setFlankerData] = useState(null);
  const [nbackData, setNbackData] = useState(null);
  const [gonogoData, setGonogoData] = useState(null);
  const [questionnaireData, setQuestionnaireData] = useState(null);

  useEffect(() => {
    const initializeExperiment = async () => {
      setLoading(true);
      setError(null);
      try {
        const sessionResult = await participantApi.startSession(participantData.id);
        if (sessionResult.success) {
          setExperimentSessionId(sessionResult.data.session_id);
          const blockResult = await participantApi.createBlock(
            sessionResult.data.session_id,
            1,
            'flanker_task'
          );
          if (blockResult.success) {
            setCurrentBlockId(blockResult.data.block_id);
          } else {
            setCurrentBlockId(Date.now());
          }
        } else {
          setError('Не удалось начать сессию. Проверьте подключение к серверу.');
        }
      } catch (error) {
        setError('Ошибка соединения с сервером. Эксперимент продолжается в автономном режиме.');
      } finally {
        setSessionInitialized(true);
        setLoading(false);
      }
    };

    if (!sessionInitialized && !loading) {
      initializeExperiment();
    }
  }, [participantData.id, sessionInitialized, loading]);

  const handleFlankerComplete = async (blockData) => {
    setFlankerData(blockData);
    setFlankerCompleted(true);
    try {
      if (!experimentSessionId) {
        setCurrentBlockId(Date.now());
        return;
      }
      const blockResult = await participantApi.createBlock(
        experimentSessionId,
        2,
        'nback_task'
      );
      if (blockResult.success) {
        setCurrentBlockId(blockResult.data.block_id);
      } else {
        setCurrentBlockId(Date.now());
      }
    } catch (error) {
      setCurrentBlockId(Date.now());
    }
  };

  const handleNbackComplete = async (blockData) => {
    setNbackData(blockData);
    setNbackCompleted(true);
    if (blockData.blockId) {
      try {
        await nbackApi.completeBlock(blockData.blockId);
      } catch (error) {}
    }
    try {
      if (!experimentSessionId) {
        setCurrentBlockId(Date.now());
        return;
      }
      const blockResult = await participantApi.createBlock(
        experimentSessionId,
        3,
        'gonogo_task'
      );
      if (blockResult.success) {
        setCurrentBlockId(blockResult.data.block_id);
      } else {
        setCurrentBlockId(Date.now());
      }
    } catch (error) {
      setCurrentBlockId(Date.now());
    }
  };

  const handleGonogoComplete = async (blockData) => {
    setGonogoData(blockData);
    setGonogoCompleted(true);
    if (blockData.blockId) {
      try {
        // ✅ исправленный вызов завершения блока
        await fetch('/api/block/complete/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ block_id: blockData.blockId })
        });
      } catch (error) {}
    }
    try {
      if (!experimentSessionId) {
        setCurrentBlockId(Date.now());
        return;
      }
      const blockResult = await participantApi.createBlock(
        experimentSessionId,
        4,
        'post_experiment_questionnaire'
      );
      if (blockResult.success) {
        setCurrentBlockId(blockResult.data.block_id);
      } else {
        setCurrentBlockId(Date.now());
      }
    } catch (error) {
      setCurrentBlockId(Date.now());
    }
  };

  const handleQuestionnaireComplete = async (blockData) => {
    setQuestionnaireData(blockData);
    setQuestionnaireCompleted(true);
    if (blockData.blockId) {
      try {
        await fetch('/api/block/complete/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ block_id: blockData.blockId })
        });
      } catch (error) {}
    }
    completeExperiment();
  };

  const completeExperiment = async () => {
    try {
      if (experimentSessionId) {
        await participantApi.completeSession(experimentSessionId);
      }
    } catch (error) {}

    if (onExperimentComplete) {
      onExperimentComplete({
        participantId: participantData.id,
        participantData: participantData,
        blocksCompleted: 4,
        sessionId: experimentSessionId,
        flankerData,
        nbackData,
        gonogoData,
        questionnaireData,
        allData: {
          flanker: flankerData,
          nback: nbackData,
          gonogo: gonogoData,
          questionnaire: questionnaireData,
        },
      });
    }
  };

  return (
    <div className="experiment-flow">
      <div className="experiment-header">
        <h2>
          {!flankerCompleted
            ? 'Flanker Task'
            : !nbackCompleted
              ? 'N‑back Task'
              : !gonogoCompleted
                ? 'Go/No‑Go Task'
                : 'Завершающий опросник'}
        </h2>
        <p>Участник: {participantData.participant_id} | Сессия: {participantData.session_number}</p>
        <div className="progress-indicator">
          <div className="progress-steps">
            <span className={`step ${!flankerCompleted ? 'active' : 'completed'}`}>1. Flanker Task</span>
            <span className="step-arrow">→</span>
            <span className={`step ${flankerCompleted && !nbackCompleted ? 'active' : flankerCompleted ? 'completed' : ''}`}>2. N‑back Task</span>
            <span className="step-arrow">→</span>
            <span className={`step ${nbackCompleted && !gonogoCompleted ? 'active' : nbackCompleted ? 'completed' : ''}`}>3. Go/No‑Go Task</span>
            <span className="step-arrow">→</span>
            <span className={`step ${gonogoCompleted && !questionnaireCompleted ? 'active' : gonogoCompleted ? 'completed' : ''}`}>4. Опросник</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <p>Эксперимент продолжается в локальном режиме.</p>
        </div>
      )}

      {loading ? (
        <div className="initializing">
          <p>Инициализация эксперимента...</p>
          <div className="spinner"></div>
        </div>
      ) : sessionInitialized ? (
        <>
          {!flankerCompleted && (
            <FlankerTask
              blockId={currentBlockId}
              participantId={participantData.id}
              onBlockComplete={handleFlankerComplete}
            />
          )}
          {flankerCompleted && !nbackCompleted && (
            <NBackTask
              blockId={currentBlockId}
              participantId={participantData.id}
              onBlockComplete={handleNbackComplete}
            />
          )}
          {nbackCompleted && !gonogoCompleted && (
            <GoNoGoTask
              blockId={currentBlockId}
              participantId={participantData.id}
              onBlockComplete={handleGonogoComplete}
            />
          )}
          {gonogoCompleted && !questionnaireCompleted && (
            <PostExperimentQuestionnaire
              blockId={currentBlockId}
              participantId={participantData.id}
              onBlockComplete={handleQuestionnaireComplete}
            />
          )}
        </>
      ) : (
        <div className="initializing">
          <p>Подготовка...</p>
        </div>
      )}
    </div>
  );
};

export default ExperimentFlow;