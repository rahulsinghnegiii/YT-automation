import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker as MuiDatePicker } from '@mui/x-date-pickers/DatePicker';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import api from '../../utils/api';
import dayjs from 'dayjs';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const Analytics = () => {
  const [timeRange, setTimeRange] = useState('7d');
  const [startDate, setStartDate] = useState(dayjs().subtract(7, 'day'));
  const [endDate, setEndDate] = useState(dayjs());
  const [data, setData] = useState({
    uploads: [],
    processing: [],
    storage: [],
    performance: [],
    assetTypes: [],
    statusDistribution: [],
  });

  const fetchAnalytics = useCallback(async () => {
    try {
      const params = {
        timeRange,
        startDate: startDate.format('YYYY-MM-DD'),
        endDate: endDate.format('YYYY-MM-DD'),
      };

      const response = await api.get('/api/analytics', { params });
      
      // Handle different response structures (mock vs real API)
      let analyticsData;
      if (response.data.success && response.data.data) {
        // Mock data structure: { success: true, data: { ... } }
        analyticsData = response.data.data;
      } else if (response.data.data) {
        // Real API structure: { data: { ... } }
        analyticsData = response.data.data;
      } else {
        // Direct data structure: { uploads: [], ... }
        analyticsData = response.data;
      }
      
      // Ensure all required properties exist with default values
      const safeData = {
        uploads: analyticsData.uploads || [],
        processing: analyticsData.processing || [],
        storage: analyticsData.storage || [],
        performance: analyticsData.performance || [],
        assetTypes: (analyticsData.assetTypes || []).map(item => ({
          name: item.name || item.type || 'Unknown',
          value: item.value || item.count || 0
        })),
        statusDistribution: analyticsData.statusDistribution || [],
      };
      
      setData(safeData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      // Set empty data structure on error to prevent crashes
      setData({
        uploads: [],
        processing: [],
        storage: [],
        performance: [],
        assetTypes: [],
        statusDistribution: [],
      });
    }
  }, [timeRange, startDate, endDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <Typography variant="h4" gutterBottom>
          Analytics & Reports
        </Typography>

        {/* Filters */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Time Range</InputLabel>
                  <Select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    label="Time Range"
                  >
                    <MenuItem value="1d">Last 24 Hours</MenuItem>
                    <MenuItem value="7d">Last 7 Days</MenuItem>
                    <MenuItem value="30d">Last 30 Days</MenuItem>
                    <MenuItem value="90d">Last 90 Days</MenuItem>
                    <MenuItem value="custom">Custom Range</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              {timeRange === 'custom' && (
                <>
                  <Grid item xs={12} sm={6} md={3}>
                    <MuiDatePicker
                      label="Start Date"
                      value={startDate}
                      onChange={(newValue) => setStartDate(newValue)}
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MuiDatePicker
                      label="End Date"
                      value={endDate}
                      onChange={(newValue) => setEndDate(newValue)}
                      renderInput={(params) => <TextField {...params} fullWidth />}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </CardContent>
        </Card>

        <Grid container spacing={3}>
          {/* Upload Trends */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Upload Activity
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.uploads}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => dayjs(value).format('MM/DD')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => dayjs(value).format('MMM DD, YYYY')}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Processing Performance */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Processing Performance
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.processing}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => dayjs(value).format('MM/DD')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => dayjs(value).format('MMM DD, YYYY')}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="avgDuration" 
                      stroke="#82ca9d" 
                      name="Avg Duration (min)"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="successRate" 
                      stroke="#ffc658" 
                      name="Success Rate %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Asset Types Distribution */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Asset Types Distribution
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.assetTypes}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {data.assetTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Storage Usage */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Storage Usage Over Time
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.storage}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => dayjs(value).format('MM/DD')}
                    />
                    <YAxis tickFormatter={formatBytes} />
                    <Tooltip 
                      labelFormatter={(value) => dayjs(value).format('MMM DD, YYYY')}
                      formatter={(value) => [formatBytes(value), 'Storage Used']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="used" 
                      stroke="#ff7300" 
                      fill="#ff7300" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Job Status Distribution */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Processing Job Status
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.statusDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* System Performance */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  System Performance Metrics
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.performance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(value) => dayjs(value).format('HH:mm')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => dayjs(value).format('MMM DD, HH:mm')}
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
                    <Line 
                      type="monotone" 
                      dataKey="activeJobs" 
                      stroke="#ffc658" 
                      name="Active Jobs"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};

export default Analytics;
