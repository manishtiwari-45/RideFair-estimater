import axios from 'axios';

const API_URL = 'https://ridefair-estimater.onrender.com';

const client = axios.create({
  baseURL: API_URL,
  timeout: 15000, // 15 s — Render free tier can cold-start slowly
});

export const getFairPrice = async (distance, hour, isWeekend) => {
  try {
    const res = await client.post('/predict-price', {
      distance_km: parseFloat(distance),
      hour:        parseInt(hour),
      is_weekend:  parseInt(isWeekend),
    });
    return res.data;
  } catch (err) {
    const detail = err.response?.data?.detail;
    return { error: detail || 'Could not reach the server. Is the backend running?' };
  }
};

export const detectScam = async (distance, price) => {
  try {
    const res = await client.post('/detect-scam', {
      distance_km: parseFloat(distance),
      price_asked: parseFloat(price),
    });
    return res.data;
  } catch (err) {
    const detail = err.response?.data?.detail;
    return { error: detail || 'Could not reach the server. Is the backend running?' };
  }
};

export const getHotspots = async () => {
  try {
    const res = await client.get('/hotspots');
    return res.data;
  } catch (err) {
    const detail = err.response?.data?.detail;
    return { error: detail || 'Could not load hotspot data.' };
  }
};
