import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.response.use(
  response => response,
  error => {
    if (!error.response) {
      return Promise.reject(new Error('Сервер недоступен. Проверьте подключение.'));
    }
    return Promise.reject(error);
  }
);

export const nbackApi = {
  sendBatchData: async (trialsData) => {
    try {
      const payload = {
        trials: trialsData.trials || [],
        block_id: trialsData.blockId || trialsData.block_id,
        n_level: trialsData.nLevel || trialsData.n_level || 1,
      };
      const response = await api.post('/nback/trials/batch/', payload);
      return { success: true, data: response.data, count: payload.trials.length };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  },
  createBlockConfig: async (blockId, config) => {
    try {
      const response = await api.post('/nback/block/config/', { block_id: blockId, ...config });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  },
  completeBlock: async (blockId) => {
    try {
      const response = await api.post('/block/complete/', { block_id: blockId });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  },
};

export const participantApi = {
  register: async (participantId, sessionNumber) => {
    try {
      const response = await api.post('/register/', { participant_id: participantId, session_number: sessionNumber });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  },
  startSession: async (participantId) => {
    try {
      const response = await api.post('/session/start/', { participant_id: participantId });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  },
  createBlock: async (sessionId, blockNumber = 1, taskType = null) => {
    try {
      const body = { session_id: sessionId, block_number: blockNumber };
      if (taskType) body.task_type = taskType;
      const response = await api.post('/block/create/', body);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  },
  completeSession: async (sessionId) => {
    try {
      const response = await api.post('/session/complete/', { session_id: sessionId });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  },
};

export const flankerApi = {
  sendBatchData: async (trialsData) => {
    try {
      const response = await api.post('/trials/batch/', { trials: trialsData });
      return { success: true, data: response.data, count: trialsData.length };
    } catch (error) {
      return { success: false, error: error.response?.data || error.message };
    }
  },
};

export const healthCheck = async () => {
  try {
    const response = await api.get('/health/');
    return { success: true, data: response.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const checkApiAvailability = async () => {
  try {
    const response = await api.get('/health/', { timeout: 5000 });
    return { available: true, responseTime: response.duration };
  } catch (error) {
    return { available: false, error: error.message };
  }
};

export default api;