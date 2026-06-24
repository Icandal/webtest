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

  useEffect(() => {
    const savedConsent = localStorage.getItem('informedConsent');
    if (savedConsent === 'true') {
      setConsentGiven(true);
      setShowRegistration(true);
    }
  }, []);

  const handleConsent = () => {
    localStorage.setItem('informedConsent', 'true');
    setConsentGiven(true);
    setShowRegistration(true);
  };

  const handleDecline = () => {
    localStorage.removeItem('informedConsent');
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
      } else {
        console.error('Ошибка соединения:', error);
        alert('Не удалось связаться с сервером. Проверьте интернет-соединение.');
        return;
      }
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
    if (window.confirm('Вы уверены, что хотите начать эксперимент заново? Все текущие данные будут удалены.')) {
      localStorage.removeItem('informedConsent');
      localStorage.removeItem('participantId');
      localStorage.removeItem('sessionNumber');
      localStorage.removeItem('currentStage');
      window.location.reload();
    }
  };

  const showResetButton = experimentStarted || showRegistration || consentGiven;

  return (
    <>
      {showResetButton && (
        <button className="reset-experiment-btn" onClick={resetExperiment} title="Начать эксперимент заново">
          🔄 Новый эксперимент
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
            localStorage.removeItem('currentStage');
          }}
        />
      )}
    </>
  );
};

export default App;