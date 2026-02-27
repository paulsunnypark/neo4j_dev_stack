import axios from 'axios';
import type { AxiosResponse, AxiosError } from 'axios';

// Ensure this matches the backend port or the Docker network configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DEFAULT_API_KEY = 'dev-secret-key-change-me';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': import.meta.env.VITE_API_KEY || DEFAULT_API_KEY,
  },
});

// Optional: Add interceptors for error logging or auth token refresh logic here
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const errorDetail = error.response?.data ?? error.message;
    console.error('API Error:', errorDetail);
    return Promise.reject(error);
  }
);
