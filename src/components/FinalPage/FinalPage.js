import './FinalPage.css';

const FinalPage = ({ onSubmit, isSubmitting = false }) => {
  const handleReturn = () => {
    onSubmit({ completed: true, timestamp: new Date().toISOString() });
  };

  return (
    <div className="final-page">
      <div className="final-container">
        <div className="simple-message">
          <div className="success-icon"><div className="checkmark">✓</div></div>
          <h1 className="thank-you-title">Эксперимент завершен</h1>
          <p className="thank-you-text">Спасибо за ваше участие! Ваши данные сохранены и будут использованы для анализа.</p>
          <div className="simple-info"><p>Все данные анонимны и обрабатываются конфиденциально.</p></div>
        </div>
        <div className="simple-actions">
          <button onClick={handleReturn} className="submit-btn" disabled={isSubmitting}>
            {isSubmitting ? <><span className="spinner"></span>Загрузка...</> : 'Вернуться на главную страницу'}
          </button>
        </div>
        <div className="simple-footer">
          <p>Вы можете закрыть эту страницу.<br />При возникновении вопросов: example@gmail.com</p>
        </div>
      </div>
    </div>
  );
};

export default FinalPage;