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
    console.log('App mounted, checking localStorage');
    const savedConsent = localStorage.getItem('informedConsent');
    console.log('savedConsent:', savedConsent);
    if (savedConsent === 'true') {
      setConsentGiven(true);
      const savedParticipantId = localStorage.getItem('participantId');
      const savedSessionNumber = localStorage.getItem('sessionNumber');
      console.log('savedParticipantId:', savedParticipantId, 'savedSessionNumber:', savedSessionNumber);
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
    console.log('handleConsent called');
    localStorage.setItem('informedConsent', 'true');
    setConsentGiven(true);
    setShowRegistration(true);
  };

  const handleDecline = () => {
    console.log('handleDecline called');
    localStorage.removeItem('informedConsent');
    setConsentGiven(false);
    alert('Вы отказались от участия. Страница будет перезагружена.');
    window.location.reload();
  };

  const handleRegistrationSubmit = async (data) => {
    console.log('Registration submitted:', data);
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

  console.log('Render: consentGiven=', consentGiven, 'showRegistration=', showRegistration, 'experimentStarted=', experimentStarted);

  if (!consentGiven) {
    console.log('Rendering InformedConsentPopup');
    return <InformedConsentPopup onConsent={handleConsent} onDecline={handleDecline} />;
  }

  if (showRegistration) {
    console.log('Rendering Registration');
    return <Registration onSubmit={handleRegistrationSubmit} />;
  }

  if (experimentStarted && participantData) {
    console.log('Rendering ExperimentFlow');
    return (
      <ExperimentFlow
        participantData={participantData}
        onExperimentComplete={(result) => {
          console.log('Эксперимент завершён', result);
          localStorage.removeItem('currentStage');
          localStorage.removeItem('participantId');
          localStorage.removeItem('sessionNumber');
          alert('Спасибо за участие! Эксперимент окончен.');
        }}
      />
    );
  }

  console.log('Returning null');
  return null;
};

export default App;