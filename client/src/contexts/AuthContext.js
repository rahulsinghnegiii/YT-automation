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
          localStorage.removeItem('token');
          setToken(null);
        }
      }
      setLoading(false);
      console.log('🔐 Auth check completed');
    };

    checkAuth();
  }, [token]);

  const login = async (username, password) => {
    console.log('🔐 Attempting direct login...', { username });
    try {
      const response = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      console.log('🔐 Direct login response:', data);
      
      if (data.success && data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        
        console.log('🔐 Login successful, user set:', data.user);
        toast.success('Login successful!');
        return { success: true };
      } else {
        const message = data.error || 'Login failed';
        toast.error(message);
        return { success: false, error: message };
      }
    } catch (error) {
      console.error('🔐 Login failed:', error);
      const message = 'Network error. Please try again.';
      toast.error(message);
      return { success: false, error: message };
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
