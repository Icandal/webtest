import React, { useEffect, useState } from 'react';
import './App.css';
import Registration from './components/Registration/Registration';
import ExperimentFlow from './components/ExperimentFlow/ExperimentFlow';
import FinalPage from './components/FinalPage/FinalPage';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const App = () => {
  const [backendStatus, setBackendStatus] = useState('Проверка...');
  const [currentView, setCurrentView] = useState('registration');
  const [participantData, setParticipantData] = useState(null);
  const [experimentData, setExperimentData] = useState(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  useEffect(() => {
    checkBackendConnection();
    checkSavedSession();
  }, []);

  const checkBackendConnection = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health/`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors'
      });
      if (response.ok) {
        setBackendStatus('✅ Сервер доступен');
      } else {
        setBackendStatus('⚠️ Сервер отвечает с ошибкой');
      }
    } catch (error) {
      setBackendStatus('❌ Сервер недоступен');
    }
  };

  const checkSavedSession = () => {
    const savedParticipantId = localStorage.getItem('participant_id');
    const savedId = localStorage.getItem('participant_db_id');
    const savedSession = localStorage.getItem('session_number');

    if (savedParticipantId && savedSession) {
      const shouldRestore = window.confirm(
        `Найдена предыдущая сессия:\nУчастник: ${savedParticipantId}, Сессия: ${savedSession}\n\nПродолжить эту сессию?`
      );
      if (shouldRestore) {
        setParticipantData({
          id: savedId || savedParticipantId,
          participant_id: savedParticipantId,
          session_number: savedSession
        });
        setCurrentView('experiment');
      } else {
        localStorage.clear();
      }
    }
    setIsCheckingSession(false);
  };

  const handleRegistrationSubmit = async (formData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
          participant_id: formData.id,
          session_number: formData.sessionNumber,
        })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('participant_id', formData.id);
        localStorage.setItem('participant_db_id', data.participant_id);
        localStorage.setItem('session_number', formData.sessionNumber);
        localStorage.setItem('session_token', data.session_token);

        setParticipantData({
          id: data.participant_id,
          participant_id: formData.id,
          session_number: formData.sessionNumber,
          session_token: data.session_token
        });
        setCurrentView('experiment');
      } else {
        showMessage(`Ошибка регистрации: ${response.status}`, 'error');
      }
    } catch (error) {
      showMessage(`Ошибка соединения: ${error.message}`, 'error');
    }
  };

  const handleExperimentComplete = (data) => {
    setExperimentData(data);
    setCurrentView('final');
  };

  const handleFinalPageSubmit = async (finalData) => {
    setIsSubmittingFeedback(true);
    try {
      // Здесь можно отправить данные опросника, если необходимо
      showMessage('Результаты успешно сохранены!', 'success');
    } catch (error) {
      showMessage('Произошла ошибка при завершении', 'error');
    } finally {
      localStorage.removeItem('participant_db_id');
      localStorage.removeItem('session_number');
      localStorage.removeItem('session_token');
      setTimeout(() => {
        setIsSubmittingFeedback(false);
        setParticipantData(null);
        setExperimentData(null);
        setCurrentView('registration');
      }, 2000);
    }
  };

  const showMessage = (message, type) => {
    setSuccessMessage(message);
    setShowSuccessMessage(true);
    setTimeout(() => setShowSuccessMessage(false), 3000);
  };

  const handleRestart = () => {
    if (window.confirm('Вы уверены, что хотите начать заново?')) {
      localStorage.clear();
      setParticipantData(null);
      setExperimentData(null);
      setCurrentView('registration');
      checkBackendConnection();
      showMessage('Эксперимент сброшен. Начните новую сессию.', 'info');
    }
  };

  const renderContent = () => {
    if (isCheckingSession) {
      return (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Проверка сохраненной сессии...</p>
        </div>
      );
    }

    switch (currentView) {
      case 'registration':
        return <Registration onSubmit={handleRegistrationSubmit} />;
      case 'experiment':
        return (
          <div className="experiment-wrapper">
            <div className="experiment-controls">
              <button className="restart-btn" onClick={handleRestart}>↻ Начать заново</button>
              <div className="participant-info">
                Участник: {participantData?.participant_id} | Сессия: {participantData?.session_number}
              </div>
            </div>
            <ExperimentFlow
              participantData={participantData}
              onExperimentComplete={handleExperimentComplete}
            />
          </div>
        );
      case 'final':
        return (
          <div className="final-wrapper">
            <FinalPage
              onSubmit={handleFinalPageSubmit}
              isSubmitting={isSubmittingFeedback}
            />
          </div>
        );
      default:
        return <Registration onSubmit={handleRegistrationSubmit} />;
    }
  };

  return (
    <div className="App">
      {currentView === 'registration' && !isCheckingSession && (
        <header className="App-header">
          <h1>Экспериментальная среда - LLM</h1>
          <div className="status-info">
            <span className={`status-indicator ${backendStatus.includes('✅') ? 'online' : backendStatus.includes('⚠️') ? 'warning' : 'offline'}`}>●</span>
            {backendStatus}
            <button className="refresh-btn" onClick={checkBackendConnection} title="Проверить соединение">⟳</button>
          </div>
        </header>
      )}

      {showSuccessMessage && (
        <div className={`success-message ${successMessage.includes('Ошибка') ? 'error' : 'success'}`}>
          {successMessage}
        </div>
      )}

      <main className={`main-content ${currentView !== 'registration' ? 'full-height' : ''}`}>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;