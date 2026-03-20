import { useState } from 'react';
import FlankerTask from '../FlankerTask/FlankerTask';
import NBackTask from '../NBackTask/NBackTask';
import './ExperimentBlock.css';

const ExperimentBlock = ({ blockNumber, onComplete, participantId, blockId }) => {
  const [experimentData, setExperimentData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFlankerComplete = async (flankerData) => {
    setLoading(true);
    setError(null);

    try {
      const completeData = {
        blockNumber: blockNumber,
        participantId: participantId,
        blockId: blockId,
        data: flankerData,
        timestamp: new Date().toISOString(),
      };

      setExperimentData(completeData);

      if (onComplete) {
        await onComplete(completeData);
      }
    } catch (err) {
      console.error('Error completing Flanker task:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNBackComplete = async (nbackData) => {
    setLoading(true);
    setError(null);

    try {
      const completeData = {
        blockNumber: blockNumber,
        participantId: participantId,
        blockId: blockId,
        data: nbackData,
        timestamp: new Date().toISOString(),
      };

      setExperimentData(completeData);

      if (onComplete) {
        await onComplete(completeData);
      }
    } catch (err) {
      console.error('Error completing N-back task:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderStubBlock = () => (
    <div className="experiment-stub">
      <h3>Блок {blockNumber}</h3>
      <p>Эксперимент {blockNumber}</p>
      <button
        className="complete-btn"
        onClick={() => {
          const stubData = {
            blockNumber: blockNumber,
            participantId: participantId,
            blockId: blockId,
            data: { type: `stub_block_${blockNumber}` },
            timestamp: new Date().toISOString(),
          };
          onComplete(stubData);
        }}
      >
        Завершить блок
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="experiment-loading">
        <div className="loading-spinner"></div>
        <p>Сохранение данных...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="experiment-error">
        <h3>Ошибка</h3>
        <p>{error}</p>
        <button onClick={() => setError(null)}>Попробовать снова</button>
      </div>
    );
  }

  switch (blockNumber) {
    case 1:
      return (
        <FlankerTask
          blockId={blockId}
          participantId={participantId}
          onBlockComplete={handleFlankerComplete}
        />
      );
    case 2:
      return (
        <NBackTask
          blockId={blockId}
          participantId={participantId}
          onBlockComplete={handleNBackComplete}
        />
      );
    default:
      return renderStubBlock();
  }
};

export default ExperimentBlock;