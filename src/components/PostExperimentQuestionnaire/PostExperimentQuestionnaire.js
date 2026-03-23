import React, { useState, useEffect, useRef, useCallback } from 'react';
import './PostExperimentQuestionnaire.css';
import api from '../utils/api'; // ✅ импортируем единый клиент

const BLOCK1_QUESTIONS = [
  'Я использую большую языковую модель, чтобы лучше понять материал при подготовке к занятиям.',
  'Я использую большую языковую модель, чтобы получить краткое объяснение или резюме сложного академического текста.',
  'Я использую большую языковую модель, чтобы получить идеи для структуры или аргументов при написании учебной работы.',
  'Я использую большую языковую модель, чтобы проверить и улучшить формулировки в написанном мной тексте.',
  'Я использую большую языковую модель, чтобы составить план выполнения учебного задания.',
  'Я использую большую языковую модель, чтобы сгенерировать тренировочные вопросы для подготовки к проверке знаний.',
  'Я использую большую языковую модель, чтобы получить простое объяснение непонятного понятия или термина.',
  'Я использую большую языковую модель, чтобы кратко обобщить большой объем информации.',
  'Я использую большую языковую модель, чтобы получить идеи для учебного проекта или задания.',
  'Я использую большую языковую модель, чтобы задать дополнительные вопросы и проверить, правильно ли я понимаю изучаемый материал.',
  'Я использую большую языковую модель, чтобы быстрее разобраться в новой теме.',
  'Я использую большую языковую модель, чтобы найти разные способы решения учебной задачи.',
  'Я использую большую языковую модель, чтобы уточнить значение новых терминов и понятий.',
  'Я использую большую языковую модель, чтобы упростить сложный материал и сделать его более понятным.',
  'Я использую большую языковую модель, чтобы подготовиться к обсуждению темы на занятии.',
  'Я использую большую языковую модель, чтобы сформулировать вопросы по теме, которую я изучаю.',
  'Я использую большую языковую модель, чтобы проверить, правильно ли я понял содержание учебного материала.',
  'Я использую большую языковую модель, чтобы систематизировать информацию по изучаемой теме.',
  'Я использую большую языковую модель, чтобы получить дополнительные пояснения по сложным вопросам.',
  'Я использую большую языковую модель, чтобы лучше организовать свою учебную работу.'
];

const BLOCK2_QUESTIONS = [
  'Я использую большую языковую модель, чтобы получить советы по планированию своего дня.',
  'Я использую большую языковую модель, чтобы быстрее найти информацию по интересующей меня теме.',
  'Я использую большую языковую модель, чтобы получить идеи для досуга или развлечений.',
  'Я использую большую языковую модель, чтобы написать сообщение или письмо более ясно и грамотно.',
  'Я использую большую языковую модель, чтобы получить рекомендации по фильмам, книгам или музыке.',
  'Я использую большую языковую модель, чтобы узнать больше о событиях или новостях.',
  'Я использую большую языковую модель, чтобы лучше понять сложную информацию из интернета.',
  'Я использую большую языковую модель, чтобы найти новые идеи для хобби или личных проектов.',
  'Я использую большую языковую модель, чтобы получить советы по решению повседневных задач.',
  'Я использую большую языковую модель, чтобы сэкономить время при поиске информации.',
  'Я использую большую языковую модель, чтобы помочь мне принять решение в повседневных ситуациях.',
  'Я использую большую языковую модель, чтобы узнать альтернативные точки зрения по интересующему вопросу.',
  'Я использую большую языковую модель, чтобы сформулировать свои мысли более четко.',
  'Я использую большую языковую модель, чтобы получить краткое объяснение новой для меня темы.',
  'Я использую большую языковую модель, чтобы придумать идеи для путешествий или поездок.',
  'Я использую большую языковую модель, чтобы найти новые способы провести свободное время.',
  'Я использую большую языковую модель, чтобы получить рекомендации по покупкам или выбору товаров.',
  'Я использую большую языковую модель, чтобы получить советы по организации личных дел.',
  'Я использую большую языковую модель, чтобы быстро разобраться в новой информации.',
  'Я использую большую языковую модель, чтобы задать вопросы и получить дополнительные объяснения по интересующей теме.'
];

const BLOCK3_QUESTIONS = [
  'Я регулярно занимаюсь физической активностью (спорт, тренировки или активные прогулки).',
  'Я регулярно провожу время в общении или совместных занятиях с другими людьми.',
  'В свободное время я часто занимаюсь деятельностью, которая требует умственного напряжения (например, решение задач, изучение нового, интеллектуальные игры).',
  'Я регулярно читаю книги или другие длинные тексты для получения новой информации или удовольствия.'
];

const shuffleArray = (array) => {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const PostExperimentQuestionnaire = ({ blockId, participantId, onBlockComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [value, setValue] = useState(50);
  const [phase, setPhase] = useState('instructions');
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [isSending, setIsSending] = useState(false);

  const questionStartTimeRef = useRef(null);
  const blockDataRef = useRef([]);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const selected1 = shuffleArray(BLOCK1_QUESTIONS).slice(0, 10);
    const selected2 = shuffleArray(BLOCK2_QUESTIONS).slice(0, 10);
    const selected3 = [...BLOCK3_QUESTIONS];
    const combined = [...selected1, ...selected2, ...selected3];
    const finalShuffled = shuffleArray(combined);
    setShuffledQuestions(finalShuffled);
  }, []);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startQuestionnaire = () => {
    setPhase('question');
    questionStartTimeRef.current = Date.now();
    setValue(50);
  };

  const handleSliderChange = (e) => {
    setValue(parseInt(e.target.value, 10));
  };

  const handleNext = () => {
    if (phase !== 'question') return;

    const reactionTime = Date.now() - questionStartTimeRef.current;
    const question = shuffledQuestions[currentIndex];

    const responseData = {
      experiment_block: parseInt(blockId),
      trial_number: currentIndex + 1,
      question_text: question,
      response_value: value,
      reaction_time: reactionTime,
      client_time: Date.now(),
    };
    blockDataRef.current.push(responseData);

    if (currentIndex + 1 < shuffledQuestions.length) {
      setCurrentIndex(prev => prev + 1);
      setValue(50);
      questionStartTimeRef.current = Date.now();
    } else {
      setPhase('finished');
      completeBlock();
    }
  };

  const completeBlock = async () => {
    setIsSending(true);
    let sendSuccess = false;
    if (blockId) {
      try {
        const trialsData = blockDataRef.current.map(t => ({
          experiment_block: t.experiment_block,
          trial_number: t.trial_number,
          question_text: t.question_text,
          response_value: t.response_value,
          reaction_time: t.reaction_time,
          client_time: t.client_time,
        }));
        // ✅ Используем единый api клиент
        const response = await api.post('/questionnaire/trials/batch/', {
          block_id: blockId,
          trials: trialsData
        });
        if (response.status === 201) sendSuccess = true;
      } catch (error) {
        console.error('Ошибка сохранения данных опросника:', error);
      }
    }
    setIsSending(false);

    if (blockId) {
      try {
        await api.post('/block/complete/', { block_id: blockId });
      } catch (e) {}
    }

    if (onBlockComplete) {
      const totalQuestions = blockDataRef.current.length;
      const avgValue = totalQuestions > 0
        ? blockDataRef.current.reduce((acc, t) => acc + t.response_value, 0) / totalQuestions
        : 0;
      onBlockComplete({
        blockType: 'post_experiment_questionnaire',
        totalQuestions,
        avgResponse: avgValue,
        sendSuccess,
        blockId,
        participantId,
      });
    }
  };

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const renderPhaseContent = () => {
    switch (phase) {
      case 'instructions':
        return (
          <div className="questionnaire-instructions">
            <h2>Завершающий опросник</h2>
            <p>Вам будет предложено 24 вопроса о вашем опыте использования языковых моделей и общих привычках.</p>
            <p>Оцените, насколько вы согласны с каждым утверждением, перемещая ползунок от 1 (полностью не согласен) до 100 (полностью согласен).</p>
            <p>После ответа нажимайте кнопку "Далее".</p>
            <button className="start-btn" onClick={startQuestionnaire}>Начать</button>
          </div>
        );
      case 'question':
        return (
          <div className="questionnaire-question">
            <div className="question-counter">
              Вопрос {currentIndex + 1} из {shuffledQuestions.length}
            </div>
            <div className="question-text">
              {shuffledQuestions[currentIndex]}
            </div>
            <div className="slider-container">
              <input
                type="range"
                min="1"
                max="100"
                value={value}
                onChange={handleSliderChange}
                className="slider"
              />
            </div>
            <button className="next-btn" onClick={handleNext}>
              {currentIndex + 1 === shuffledQuestions.length ? 'Завершить' : 'Далее'}
            </button>
          </div>
        );
      case 'finished':
        return (
          <div className="questionnaire-finished">
            <h3>Опросник завершён</h3>
            {isSending && <p>Сохранение ответов...</p>}
            {!isSending && <p>Спасибо за ваши ответы!</p>}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="post-experiment-questionnaire">
      <div className="questionnaire-content">
        {renderPhaseContent()}
      </div>
    </div>
  );
};

export default PostExperimentQuestionnaire;