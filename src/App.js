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
    // Показываем сообщение об отказе
    alert('Вы отказались от участия. Страница будет перезагружена.');
    window.location.reload();
  };

  const handleRegistrationSubmit = async (data) => {
    // data содержит { id, sessionNumber, fatigue_rating }
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

  if (!consentGiven) {
    return <InformedConsentPopup onConsent={handleConsent} onDecline={handleDecline} />;
  }

  if (showRegistration) {
    return <Registration onSubmit={handleRegistrationSubmit} />;
  }

  if (experimentStarted && participantData) {
    return (
      <ExperimentFlow
        participantData={participantData}
        onExperimentComplete={(result) => {
          console.log('Эксперимент завершён', result);
          localStorage.removeItem('currentStage');
          localStorage.removeItem('participantId');
          localStorage.removeItem('sessionNumber');
          // Можно показать финальное сообщение
          alert('Спасибо за участие! Эксперимент окончен.');
        }}
      />
    );
  }

  return null;
};

export default App;