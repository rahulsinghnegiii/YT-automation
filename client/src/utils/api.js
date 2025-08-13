import axios from 'axios';

// Set the base URL for API requests
const API_URL = 
  process.env.REACT_APP_API_URL || 
  process.env.REACT_APP_API_BASE_URL ||
  'http://localhost:3000';

const FALLBACK_URLS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080'
];

console.log('🔧 API Configuration:');
console.log('- Primary API_URL:', API_URL);
console.log('- REACT_APP_API_URL:', process.env.REACT_APP_API_URL);
console.log('- REACT_APP_API_BASE_URL:', process.env.REACT_APP_API_BASE_URL);
console.log('- Fallback URLs:', FALLBACK_URLS);
console.log('- NODE_ENV:', process.env.NODE_ENV);

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  timeout: process.env.NODE_ENV === 'development' ? 30000 : 10000, // 30s in dev, 10s in prod
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    console.log('🚀 API Request:', {
      method: config.method?.toUpperCase(),
      url: config.url,
      fullUrl: `${config.baseURL}${config.url}`,
      hasToken: !!token,
      headers: config.headers,
      data: config.data
    });
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('❌ API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('❌ API Response Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      message: error.message,
      data: error.response?.data,
      networkError: !error.response
    });
    
    if (error.response?.status === 401) {
      console.log('🔐 Unauthorized - removing token and redirecting to login');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
