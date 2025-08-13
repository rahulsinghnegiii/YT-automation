import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Set up api defaults
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Check if user is authenticated on app load
  useEffect(() => {
    const checkAuth = async () => {
      console.log('🔐 Checking authentication...', { hasToken: !!token });
      
      if (token) {
        try {
          console.log('🔐 Making auth check request to /auth/me');
          const response = await api.get('/auth/me');
          console.log('🔐 Auth check response:', response.data);
          
          setUser(response.data.data.user);
          console.log('🔐 User authenticated:', response.data.data.user);
        } catch (error) {
          console.error('🔐 Auth check failed:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
          });
          // Clear invalid tokens
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          delete api.defaults.headers.common['Authorization'];
          console.log('🔐 Cleared invalid token from storage');
        }
      }
      setLoading(false);
      console.log('🔐 Auth check completed');
    };

    checkAuth();
  }, [token]);

  const login = async (username, password) => {
    console.log('🔐 Attempting login...', { username });
    
    // Try direct fetch first (for better CORS control)
    try {
      console.log('🔐 Trying direct fetch to backend...');
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Important for CORS
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('🔐 Direct login response:', data);
      
      if (data.success && data.data?.token) {
        localStorage.setItem('token', data.data.token);
        setToken(data.data.token);
        setUser(data.data.user);
        
        if (data.mock) {
          console.log('🔧 Using mock authentication mode');
          toast.success('Login successful! (Mock Mode)');
        } else {
          console.log('🔐 Real authentication successful');
          toast.success('Login successful!');
        }
        
        return { success: true };
      } else {
        const message = data.error || 'Login failed';
        toast.error(message);
        return { success: false, error: message };
      }
    } catch (fetchError) {
      console.warn('🔐 Direct fetch failed:', fetchError.message);
      console.log('🔄 Falling back to axios API call...');
      
      // Fallback to axios
      try {
        const response = await api.post('/auth/login', { username, password });
        console.log('🔐 Axios login response:', response.data);
        
        if (response.data.success && response.data.data?.token) {
          localStorage.setItem('token', response.data.data.token);
          setToken(response.data.data.token);
          setUser(response.data.data.user);
          
          if (response.data.mock) {
            console.log('🔧 Using mock authentication mode');
            toast.success('Login successful! (Mock Mode)');
          } else {
            console.log('🔐 Real authentication successful');
            toast.success('Login successful!');
          }
          
          return { success: true };
        } else {
          const message = response.data.error || 'Login failed';
          toast.error(message);
          return { success: false, error: message };
        }
      } catch (axiosError) {
        console.error('🔐 Both login methods failed:', {
          fetchError: fetchError.message,
          axiosError: axiosError.message
        });
        
        // If all else fails, try mock mode fallback in development
        if (process.env.NODE_ENV === 'development') {
          console.log('🔧 Attempting development mock fallback...');
          const mockToken = 'mock-token-' + Date.now();
          const mockUser = {
            id: 1,
            username: username,
            email: `${username}@example.com`,
            role: 'admin',
            lastLogin: new Date().toISOString()
          };
          
          localStorage.setItem('token', mockToken);
          setToken(mockToken);
          setUser(mockUser);
          
          toast.success('Login successful! (Development Mock Mode)');
          console.log('🔧 Development mock fallback activated');
          return { success: true };
        }
        
        const message = 'Unable to connect to server. Please check if the backend is running.';
        toast.error(message);
        return { success: false, error: message };
      }
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
    toast.success('Logged out successfully');
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
