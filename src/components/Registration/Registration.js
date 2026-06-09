import React, { useState } from 'react';
import './Registration.css';

const Registration = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    id: '',
    sessionNumber: '1',
  });

  const [fatigueRating, setFatigueRating] = useState(50);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFatigueChange = (e) => {
    setFatigueRating(parseInt(e.target.value, 10));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newErrors = {};
    if (!formData.id.trim()) newErrors.id = 'Введите ID участника';
    if (!formData.sessionNumber.trim()) newErrors.sessionNumber = 'Введите номер сессии';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    try {
      if (onSubmit) {
        await onSubmit({
          ...formData,
          fatigue_rating: fatigueRating,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="registration-container">
      <div className="registration-card">
        <h2 className="registration-title">Регистрация участника</h2>
        <p className="registration-subtitle">Введите данные для начала эксперимента</p>

        <form onSubmit={handleSubmit} className="registration-form">
          <div className="form-group">
            <label htmlFor="id" className="form-label">
              ID участника *
            </label>
            <input
              type="text"
              id="id"
              name="id"
              value={formData.id}
              onChange={handleChange}
              className={`form-input ${errors.id ? 'error' : ''}`}
              placeholder="Например: participant_001"
              disabled={isLoading}
            />
            {errors.id && <span className="error-message">{errors.id}</span>}
            <div className="form-hint">
              Уникальный идентификатор участника
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="sessionNumber" className="form-label">
              Номер сессии *
            </label>
            <input
              type="number"
              id="sessionNumber"
              name="sessionNumber"
              value={formData.sessionNumber}
              onChange={handleChange}
              className={`form-input ${errors.sessionNumber ? 'error' : ''}`}
              min="1"
              max="10"
              disabled={isLoading}
            />
            {errors.sessionNumber && (
              <span className="error-message">{errors.sessionNumber}</span>
            )}
            <div className="form-hint">
              Номер экспериментальной сессии (от 1 до 10)
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Насколько вы чувствуете себя уставшим?</label>
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
                onChange={handleFatigueChange}
                className="slider"
                disabled={isLoading}
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

          <button
            type="submit"
            className={`submit-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading || !formData.id.trim() || !formData.sessionNumber.trim()}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Регистрация...
              </>
            ) : (
              'Начать эксперимент'
            )}
          </button>

          <div className="form-footer">
            <p className="footer-note">
              Нажимая "Начать эксперимент", вы соглашаетесь на участие в исследовании
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Registration;