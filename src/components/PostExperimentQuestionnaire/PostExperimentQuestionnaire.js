import { useState, useEffect, useRef, useCallback } from 'react';
import './PostExperimentQuestionnaire.css';
import api from '../utils/api';

const BLOCK1_QUESTIONS = [
  'Я использую ИИ, чтобы лучше понять материал при подготовке к занятиям.',
  'Я использую ИИ, чтобы получить краткое объяснение или резюме сложного академического текста.',
  'Я использую ИИ, чтобы получить идеи для структуры или аргументов при написании учебной работы.',
  'Я использую ИИ, чтобы проверить и улучшить формулировки в написанном мной тексте.',
  'Я использую ИИ, чтобы составить план выполнения учебного задания.',
  'Я использую ИИ, чтобы сгенерировать тренировочные вопросы для подготовки к проверке знаний.',
  'Я использую ИИ, чтобы получить простое объяснение непонятного понятия или термина.',
  'Я использую ИИ, чтобы кратко обобщить большой объем информации.',
  'Я использую ИИ, чтобы получить идеи для учебного проекта или задания.',
  'Я использую ИИ, чтобы задать дополнительные вопросы и проверить, правильно ли я понимаю изучаемый материал.',
  'Я использую ИИ, чтобы быстрее разобраться в новой теме.',
  'Я использую ИИ, чтобы найти разные способы решения учебной задачи.',
  'Я использую ИИ, чтобы уточнить значение новых терминов и понятий.',
  'Я использую ИИ, чтобы упростить сложный материал и сделать его более понятным.',
  'Я использую ИИ, чтобы подготовиться к обсуждению темы на занятии.',
  'Я использую ИИ, чтобы сформулировать вопросы по теме, которую я изучаю.',
  'Я использую ИИ, чтобы проверить, правильно ли я понял содержание учебного материала.',
  'Я использую ИИ, чтобы систематизировать информацию по изучаемой теме.',
  'Я использую ИИ, чтобы получить дополнительные пояснения по сложным вопросам.',
  'Я использую ИИ, чтобы лучше организовать свою учебную работу.'
];

const BLOCK2_QUESTIONS = [
  'Я использую ИИ, чтобы получить советы по планированию своего дня.',
  'Я использую ИИ, чтобы быстрее найти информацию по интересующей меня теме.',
  'Я использую ИИ, чтобы получить идеи для досуга или развлечений.',
  'Я использую ИИ, чтобы написать сообщение или письмо более ясно и грамотно.',
  'Я использую ИИ, чтобы получить рекомендации по фильмам, книгам или музыке.',
  'Я использую ИИ, чтобы узнать больше о событиях или новостях.',
  'Я использую ИИ, чтобы лучше понять сложную информацию из интернета.',
  'Я использую ИИ, чтобы найти новые идеи для хобби или личных проектов.',
  'Я использую ИИ, чтобы получить советы по решению повседневных задач.',
  'Я использую ИИ, чтобы сэкономить время при поиске информации.',
  'Я использую ИИ, чтобы помочь мне принять решение в повседневных ситуациях.',
  'Я использую ИИ, чтобы узнать альтернативные точки зрения по интересующему вопросу.',
  'Я использую ИИ, чтобы сформулировать свои мысли более четко.',
  'Я использую ИИ, чтобы получить краткое объяснение новой для меня темы.',
  'Я использую ИИ, чтобы придумать идеи для путешествий или поездок.',
  'Я использую ИИ, чтобы найти новые способы провести свободное время.',
  'Я использую ИИ, чтобы получить рекомендации по покупкам или выбору товаров.',
  'Я использую ИИ, чтобы получить советы по организации личных дел.',
  'Я использую ИИ, чтобы быстро разобраться в новой информации.',
  'Я использую ИИ, чтобы задать вопросы и получить дополнительные объяснения по интересующей теме.'
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
      } catch (e) { }
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
            <p>
              В следующих слайдах вам будет предложено ответить на несколько простых вопросов о ваших привычках
              и опыте использования современных продуктов искусственного интеллекта (ИИ), включая языковые модели
              и интеллектуальные сервисы, такие как <b> ChatGPT, DeepSeek, GigaChat, Google Gemini, Microsoft Copilot,
              Claude, Perplexity, </b> а также голосовые ассистенты (например,<b> Siri, Alexa, Алиса, Google Assistant</b>)
              и другие подобные решения. Пожалуйста, отвечайте честно и внимательно, выбирая вариант, который
              наиболее точно отражает ваш опыт.
            </p>
            <p>
              Ответ будет записываться с помощью слайдера. Перемещайте ползунок вправо, если вы согласны
              с утверждением, и влево — если не согласны. Этот этап займёт не более 5 минут.
            </p>
            <p>Помните, все ответы анонимны.</p> 
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
              <div className="slider-labels">
                <span className="slider-label-left">Не согласен</span>
                <span className="slider-label-right">Согласен</span>
              </div>
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