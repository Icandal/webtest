import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import InformedConsentPopup from './components/InformedConsentPopup';
import FlankerTask from './components/FlankerTask';
import NBackTask from './components/NBackTask';
import GoNoGoTask from './components/GoNoGoTask';
import PostExperimentQuestionnaire from './components/PostExperimentQuestionnaire';

const STAGES = [
  { id: 'flanker', title: 'Тест 1: Фланкер', component: FlankerTask },
  { id: 'nback', title: 'Тест 2: N-назад', component: NBackTask },
  { id: 'gonogo', title: 'Тесты 3-5: Go/No-Go', component: GoNoGoTask },
  { id: 'questionnaire', title: 'Опросник', component: PostExperimentQuestionnaire },
];

const generateParticipantId = () => {
  return 'P_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
};

const App = () => {
  const [consentGiven, setConsentGiven] = useState(false);
  const [participantId, setParticipantId] = useState(null);
  const [currentStage, setCurrentStage] = useState(0);
  const [experimentCompleted, setExperimentCompleted] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [customParticipantId, setCustomParticipantId] = useState('');

  useEffect(() => {
    const savedConsent = localStorage.getItem('informedConsent');
    if (savedConsent === 'true') {
      setConsentGiven(true);
      const savedParticipantId = localStorage.getItem('participantId');
      if (savedParticipantId) {
        setParticipantId(savedParticipantId);
        const savedStage = localStorage.getItem('currentStage');
        if (savedStage !== null && !experimentCompleted) {
          setCurrentStage(parseInt(savedStage, 10));
        }
      } else {
        setShowRegistration(true);
      }
    }
  }, [experimentCompleted]);

  const handleConsent = () => {
    localStorage.setItem('informedConsent', 'true');
    setConsentGiven(true);
    setShowRegistration(true);
  };

  const handleDecline = () => {
    localStorage.removeItem('informedConsent');
    setConsentGiven(false);
    setExperimentCompleted(true);
  };

  const handleRegister = () => {
    let finalId = customParticipantId.trim();
    if (!finalId) {
      finalId = generateParticipantId();
    }
    if (!/^[a-zA-Z0-9_\-]{1,50}$/.test(finalId)) {
      setRegistrationError('ID может содержать только буквы, цифры, дефис и подчёркивание (1-50 символов)');
      return;
    }
    setParticipantId(finalId);
    localStorage.setItem('participantId', finalId);
    localStorage.setItem('currentStage', '0');
    setShowRegistration(false);
    setCurrentStage(0);
  };

  const handleBlockComplete = useCallback((result) => {
    const nextStage = currentStage + 1;
    if (nextStage < STAGES.length) {
      setCurrentStage(nextStage);
      localStorage.setItem('currentStage', nextStage.toString());
    } else {
      setExperimentCompleted(true);
      localStorage.removeItem('currentStage');
    }
  }, [currentStage]);

  if (experimentCompleted) {
    return (
      <div className="app-container">
        <div className="completion-message">
          <h2>Благодарим за участие!</h2>
          <p>Ваши ответы сохранены. Вы можете закрыть окно браузера.</p>
        </div>
      </div>
    );
  }

  if (!consentGiven) {
    return <InformedConsentPopup onConsent={handleConsent} onDecline={handleDecline} />;
  }

  if (showRegistration) {
    return (
      <div className="app-container">
        <div className="registration-form">
          <h2>Регистрация участника</h2>
          <p>
            Пожалуйста, введите ваш идентификатор (можно псевдоним) или оставьте поле пустым для автоматической генерации.
          </p>
          <div className="registration-field">
            <label>Ваш ID:</label>
            <input
              type="text"
              value={customParticipantId}
              onChange={(e) => setCustomParticipantId(e.target.value)}
              placeholder="Например: Student_2025"
              autoFocus
            />
          </div>
          {registrationError && <div className="error-message">{registrationError}</div>}
          <button className="start-btn" onClick={handleRegister}>
            Начать эксперимент
          </button>
        </div>
      </div>
    );
  }

  const CurrentComponent = STAGES[currentStage].component;
  const blockId = `${participantId}_${STAGES[currentStage].id}_${Date.now()}`;

  return (
    <div className="app-container">
      <div className="experiment-progress">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${((currentStage + 1) / STAGES.length) * 100}%` }}
          />
        </div>
        <p className="progress-text">
          Этап {currentStage + 1} из {STAGES.length}: {STAGES[currentStage].title}
        </p>
      </div>
      <CurrentComponent
        blockId={blockId}
        participantId={participantId}
        onBlockComplete={handleBlockComplete}
      />
    </div>
  );
};

export default App;