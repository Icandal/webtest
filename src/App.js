import React, { useState, useEffect } from 'react';
import './App.css';
import InformedConsentPopup from './components/InformedConsentPopup/InformedConsentPopup';
import Registration from './components/Registration/Registration';
import ExperimentFlow from './components/ExperimentFlow/ExperimentFlow';

const App = () => {
  const [consentGiven, setConsentGiven] = useState(false);
  const [participantData, setParticipantData] = useState(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [experimentStarted, setExperimentStarted] = useState(false);

  useEffect(() => {
    const savedConsent = localStorage.getItem('informedConsent');
    if (savedConsent === 'true') {
      setConsentGiven(true);
      const savedParticipantId = localStorage.getItem('participantId');
      const savedSessionNumber = localStorage.getItem('sessionNumber');
      if (savedParticipantId && savedSessionNumber) {
        setParticipantData({
          id: savedParticipantId,
          session_number: savedSessionNumber,
        });
        setExperimentStarted(true);
      } else {
        setShowRegistration(true);
      }
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
    setParticipantData({
      id: data.id,
      session_number: data.sessionNumber,
      fatigue_rating: data.fatigue_rating,
    });
    localStorage.setItem('participantId', data.id);
    localStorage.setItem('sessionNumber', data.sessionNumber);
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

  // Отображаем кнопку сброса только когда эксперимент уже запущен
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