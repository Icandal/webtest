// App.js (исправленный)
import React, { useState, useEffect } from 'react';
import './App.css';
import InformedConsentPopup from './components/InformedConsentPopup/InformedConsentPopup';
import FlankerTask from './components/FlankerTask/FlankerTask';
import NBackTask from './components/NBackTask/NBackTask';
import GoNoGoTask from './components/GoNoGoTask/GoNoGoTask';
import PostExperimentQuestionnaire from './components/PostExperimentQuestionnaire/PostExperimentQuestionnaire';

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
  const [isSavingRegistration, setIsSavingRegistration] = useState(false);

  const [customParticipantId, setCustomParticipantId] = useState('');
  const [sessionNumber, setSessionNumber] = useState('1');
  const [fatigueRating, setFatigueRating] = useState(50);

  // Загрузка сохранённых данных при старте
  useEffect(() => {
    const savedConsent = localStorage.getItem('informedConsent');
    if (savedConsent === 'true') {
      setConsentGiven(true);
      const savedId = localStorage.getItem('participantId');
      if (savedId) {
        // Если ID есть – сразу переходим к этапам без регистрации
        setParticipantId(savedId);
        const savedStage = localStorage.getItem('currentStage');
        if (savedStage !== null) {
          setCurrentStage(parseInt(savedStage, 10));
        }
      } else {
        // Согласие есть, но ID нет – показываем регистрацию
        setShowRegistration(true);
      }
    }
  }, []);

  const handleConsent = () => {
    localStorage.setItem('informedConsent', 'true');
    setConsentGiven(true);
    setShowRegistration(true); // Всегда показываем регистрацию после согласия
  };

  const handleDecline = () => {
    localStorage.removeItem('informedConsent');
    setConsentGiven(false);
    setExperimentCompleted(true);
  };

  // Сброс всех данных (для отладки)
  const handleResetData = () => {
    localStorage.clear();
    window.location.reload();
  };

  const handleRegister = async () => {
    let finalId = customParticipantId.trim();
    if (!finalId) {
      finalId = generateParticipantId();
    }
    if (!/^[a-zA-Z0-9_\-]{1,50}$/.test(finalId)) {
      setRegistrationError('ID может содержать только буквы, цифры, дефис и подчёркивание (1-50 символов)');
      return;
    }
    const sessionNum = parseInt(sessionNumber, 10);
    if (isNaN(sessionNum) || sessionNum < 1 || sessionNum > 10) {
      setRegistrationError('Номер сессии должен быть от 1 до 10');
      return;
    }

    setRegistrationError('');
    setIsSavingRegistration(true);

    try {
      // Отправка регистрационных данных на сервер
      const response = await fetch('/api/participant/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_id: finalId,
          session_number: sessionNum,
          fatigue_rating: fatigueRating,
        }),
      });
      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`);
      }
      const result = await response.json();
      console.log('Регистрация успешна:', result);
    } catch (error) {
      console.error('Ошибка при отправке регистрации:', error);
      setRegistrationError('Не удалось сохранить данные на сервере. Проверьте соединение.');
      setIsSavingRegistration(false);
      return;
    }

    // Сохраняем в localStorage только после успешной отправки
    localStorage.setItem('participantId', finalId);
    localStorage.setItem('currentStage', '0');
    setParticipantId(finalId);
    setShowRegistration(false);
    setCurrentStage(0);
    setIsSavingRegistration(false);
  };

  const handleBlockComplete = (result) => {
    const nextStage = currentStage + 1;
    if (nextStage < STAGES.length) {
      setCurrentStage(nextStage);
      localStorage.setItem('currentStage', nextStage.toString());
    } else {
      setExperimentCompleted(true);
      localStorage.removeItem('currentStage');
    }
  };

  // --- Отрисовка ---
  if (experimentCompleted) {
    return (
      <div className="app-container">
        <div className="completion-message">
          <h2>Благодарим за участие!</h2>
          <p>Ваши ответы сохранены. Вы можете закрыть окно браузера.</p>
          <button className="restart-btn" onClick={handleResetData} style={{ marginTop: '20px' }}>
            Начать заново (очистить данные)
          </button>
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
          <p>Пожалуйста, введите данные для начала эксперимента</p>

          <div className="registration-field">
            <label>ID участника (псевдоним, оставьте пустым для автогенерации)</label>
            <input
              type="text"
              value={customParticipantId}
              onChange={(e) => setCustomParticipantId(e.target.value)}
              placeholder="Например: Student_2025"
              disabled={isSavingRegistration}
            />
          </div>

          <div className="registration-field">
            <label>Номер сессии (1–10)</label>
            <input
              type="number"
              min="1"
              max="10"
              value={sessionNumber}
              onChange={(e) => setSessionNumber(e.target.value)}
              disabled={isSavingRegistration}
            />
          </div>

          <div className="registration-field">
            <label>Насколько вы чувствуете себя уставшим?</label>
            <div className="slider-container">
              <div className="slider-labels-multi">
                <span>Совсем не устал</span>
                <span>Немного устал</span>
                <span>Умеренно</span>
                <span>Сильно устал</span>
                <span>Очень сильно устал</span>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                value={fatigueRating}
                onChange={(e) => setFatigueRating(parseInt(e.target.value, 10))}
                className="slider"
                disabled={isSavingRegistration}
              />
              <div className="current-value-label">
                {fatigueRating <= 20 && "Совсем не устал"}
                {fatigueRating > 20 && fatigueRating <= 40 && "Немного устал"}
                {fatigueRating > 40 && fatigueRating <= 60 && "Умеренно"}
                {fatigueRating > 60 && fatigueRating <= 80 && "Сильно устал"}
                {fatigueRating > 80 && "Очень сильно устал"}
              </div>
            </div>
          </div>

          {registrationError && <div className="error-message">{registrationError}</div>}
          <button
            className="start-btn"
            onClick={handleRegister}
            disabled={isSavingRegistration}
          >
            {isSavingRegistration ? 'Сохранение...' : 'Начать эксперимент'}
          </button>
          <div className="form-footer">
            <p>Нажимая "Начать эксперимент", вы подтверждаете своё участие</p>
          </div>
          <button
            className="restart-btn"
            onClick={handleResetData}
            style={{ marginTop: '15px', background: '#ff6b6b' }}
          >
            Сбросить все данные
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