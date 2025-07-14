import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Chip,
  Alert,
} from '@mui/material';
import {
  AudioFile,
  CloudUpload,
  SmartToy,
  TrendingUp,
  Storage,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '../../utils/api';
import { useSocket } from '../../contexts/SocketContext';

const StatCard = ({ title, value, icon, color = 'primary', trend }) => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" component="div">
            {value}
          </Typography>
          {trend && (
            <Box display="flex" alignItems="center" mt={1}>
              <TrendingUp 
                sx={{ 
                  fontSize: 16, 
                  color: trend > 0 ? 'success.main' : 'error.main',
                  mr: 0.5 
                }} 
              />
              <Typography 
                variant="body2" 
                color={trend > 0 ? 'success.main' : 'error.main'}
              >
                {trend > 0 ? '+' : ''}{trend}%
              </Typography>
            </Box>
          )}
        </Box>
        <Box
          sx={{
            bgcolor: `${color}.main`,
            color: 'white',
            borderRadius: 2,
            p: 1.5,
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const Overview = () => {
  const [stats, setStats] = useState(null);
  const [metricsHistory, setMetricsHistory] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { metrics, connected } = useSocket();

  useEffect(() => {
    const fetchData = async () => {
      console.log('📊 Fetching dashboard data...');
      try {
        console.log('📊 Making parallel API calls for dashboard data');
        const [statsRes, metricsRes, activityRes] = await Promise.all([
          api.get('/api/dashboard/stats'),
          api.get('/api/dashboard/metrics-history'),
          api.get('/api/dashboard/recent-activity'),
        ]);

        console.log('📊 Dashboard API responses:', {
          stats: statsRes.data,
          metrics: metricsRes.data,
          activity: activityRes.data
        });

        setStats(statsRes.data?.data || {});
        setMetricsHistory(Array.isArray(metricsRes.data?.data) ? metricsRes.data.data : []);
        setRecentActivity(Array.isArray(activityRes.data?.data) ? activityRes.data.data : []);
        
        console.log('📊 Dashboard data processed:', {
          statsCount: Object.keys(statsRes.data?.data || {}).length,
          metricsCount: Array.isArray(metricsRes.data?.data) ? metricsRes.data.data.length : 0,
          activityCount: Array.isArray(activityRes.data?.data) ? activityRes.data.data.length : 0
        });
      } catch (err) {
        console.error('📊 Dashboard fetch error:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });
        setError(err.response?.data?.error || 'Failed to fetch dashboard data');
        // Set default empty arrays to prevent map errors
        setStats({});
        setMetricsHistory([]);
        setRecentActivity([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard Overview
      </Typography>
      
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Assets"
            value={stats?.assets?.total || 0}
            icon={<AudioFile />}
            color="primary"
            trend={5.2}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Processing Jobs"
            value={stats?.recentActivity?.length || 0}
            icon={<SmartToy />}
            color="secondary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Uploads"
            value={stats?.uploads?.total || 0}
            icon={<CloudUpload />}
            color="success"
            trend={12.5}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Storage Used"
            value={stats?.storage?.downloads?.sizeFormatted || '0 B'}
            icon={<Storage />}
            color="warning"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Metrics (Last 24 Hours)
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metricsHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cpu" 
                    stroke="#8884d8" 
                    name="CPU %" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="memory" 
                    stroke="#82ca9d" 
                    name="Memory %" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Status
              </Typography>
              <Box mb={2}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="body2">Connection:</Typography>
                  <Chip 
                    label={connected ? 'Connected' : 'Disconnected'}
                    color={connected ? 'success' : 'error'}
                    size="small"
                  />
                </Box>
                {metrics && (
                  <>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">CPU Usage:</Typography>
                      <Typography variant="body2">{metrics.cpu?.toFixed(1)}%</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Memory Usage:</Typography>
                      <Typography variant="body2">{metrics.memory?.toFixed(1)}%</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Active Jobs:</Typography>
                      <Typography variant="body2">{metrics.activeJobs || 0}</Typography>
                    </Box>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                      <Typography variant="body2">Uptime:</Typography>
                      <Typography variant="body2">
                        {Math.floor(metrics.uptime / 3600)}h {Math.floor((metrics.uptime % 3600) / 60)}m
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>
              
              <Typography variant="h6" gutterBottom mt={3}>
                Recent Activity
              </Typography>
              <Box maxHeight={200} overflow="auto">
                {Array.isArray(recentActivity) && recentActivity.length > 0 ? (
                  recentActivity.map((activity, index) => (
                    <Box key={index} mb={1} p={1} bgcolor="background.paper" borderRadius={1}>
                      <Typography variant="body2" fontWeight="medium">
                        {activity.description || activity.action || 'Unknown activity'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Unknown time'}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No recent activity
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Overview;
