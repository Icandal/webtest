import React, { useState, useEffect } from 'react';
import './App.css';
import InformedConsentPopup from './components/InformedConsentPopup/InformedConsentPopup';
import Registration from './components/Registration/Registration';
import ExperimentFlow from './components/ExperimentFlow/ExperimentFlow';
import api from './components/utils/api';

const App = () => {
  const [consentGiven, setConsentGiven] = useState(false);
  const [participantData, setParticipantData] = useState(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [experimentStarted, setExperimentStarted] = useState(false);

  // Защита от случайной перезагрузки страницы
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (experimentStarted) {
        e.preventDefault();
        e.returnValue = ''; // Это вызовет стандартный диалог браузера с предупреждением
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [experimentStarted]);

  const handleConsent = () => {
    setConsentGiven(true);
    setShowRegistration(true);
  };

  const handleDecline = () => {
    setConsentGiven(false);
    alert('Вы отказались от участия. Страница будет перезагружена.');
    window.location.reload();
  };

  const handleRegistrationSubmit = async (data) => {
    try {
      await api.post('/participant/register/', {
        participant_id: data.id,
        session_number: data.sessionNumber,
        fatigue_rating: data.fatigue_rating,
        specialization: data.specialization,
      });
    } catch (error) {
      if (error.response) {
        console.warn('Ошибка регистрации (сервер):', error.response.status, error.response.data);
        alert('Ошибка регистрации. Проверьте введенные данные.');
      } else {
        console.error('Ошибка соединения:', error);
        alert('Не удалось связаться с сервером. Проверьте интернет-соединение.');
      }
      return; 
    }

    setParticipantData({
      id: data.id,
      session_number: data.sessionNumber,
      fatigue_rating: data.fatigue_rating,
      specialization: data.specialization,
    });
    
    setShowRegistration(false);
    setExperimentStarted(true);
  };

  const resetExperiment = () => {
    if (window.confirm('Вы уверены, что хотите прервать текущую сессию? Все данные будут удалены.')) {
      window.location.reload(); // Полный сброс без сохранения данных
    }
  };

  const showResetButton = experimentStarted || showRegistration || consentGiven;

  return (
    <>
      {showResetButton && (
        <button className="reset-experiment-btn" onClick={resetExperiment} title="Начать эксперимент заново">
          🔄 Прервать эксперимент
        </button>
      )}
      {!consentGiven && <InformedConsentPopup onConsent={handleConsent} onDecline={handleDecline} />}
      {consentGiven && showRegistration && <Registration onSubmit={handleRegistrationSubmit} />}
      {experimentStarted && participantData && (
        <ExperimentFlow
          participantData={participantData}
          onExperimentComplete={(result) => {
            console.log('Эксперимент завершён', result);
            alert('Спасибо за участие! Эксперимент окончен.');
            window.location.reload(); // Возвращаем в самое начало
          }}
        />
      )}
    </>
  );
};

export default App;