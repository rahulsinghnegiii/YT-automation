import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [websocketsDisabled, setWebsocketsDisabled] = useState(false);
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    // Check if websockets are disabled in development
    const enableWebsockets = process.env.REACT_APP_ENABLE_WEBSOCKETS !== 'false';
    
    if (!enableWebsockets) {
      console.log('🔒 WebSockets disabled in development mode');
      setWebsocketsDisabled(true);
      return;
    }

    if (isAuthenticated && user) {
      console.log('🔗 Attempting to connect to WebSocket server...');
      const newSocket = io('http://168.119.110.41:3000', {
        auth: {
          token: localStorage.getItem('token'),
        },
        timeout: 5000, // 5 second connection timeout
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error);
        setConnected(false);
      });

      // Listen for system metrics updates
      newSocket.on('metrics_update', (data) => {
        setMetrics(data);
      });

      // Listen for job updates
      newSocket.on('job_update', (data) => {
        toast.success(`Job ${data.id} status: ${data.status}`);
      });

      // Listen for upload progress
      newSocket.on('upload_progress', (data) => {
        toast.loading(`Upload progress: ${data.progress}%`, {
          id: `upload-${data.uploadId}`,
        });
      });

      // Listen for upload completion
      newSocket.on('upload_complete', (data) => {
        toast.success(`Upload completed: ${data.filename}`, {
          id: `upload-${data.uploadId}`,
        });
      });

      // Listen for errors
      newSocket.on('error', (data) => {
        toast.error(`Error: ${data.message}`);
      });

      // Listen for system alerts
      newSocket.on('system_alert', (data) => {
        const { level, message } = data;
        if (level === 'error') {
          toast.error(message);
        } else if (level === 'warning') {
          toast(message, { icon: '⚠️' });
        } else {
          toast.success(message);
        }
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
        setSocket(null);
        setConnected(false);
      };
    }
  }, [isAuthenticated, user]);

  const value = {
    socket,
    connected,
    metrics,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
