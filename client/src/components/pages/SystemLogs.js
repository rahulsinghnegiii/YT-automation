import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Grid,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Pagination,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';

const SystemLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);

  const fetchLogs = useCallback(async () => {
    console.log('📋 Fetching system logs...', { level, page });
    try {
      const params = new URLSearchParams();
      if (level) params.append('level', level);
      params.append('limit', '50');
      params.append('page', page.toString());

      const url = `/api/system/logs?${params}`;
      console.log('📋 System logs URL:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      console.log('📋 System logs response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('📋 System logs error response:', errorText);
        throw new Error(`Failed to fetch logs: ${response.status}`);
      }

      const data = await response.json();
      console.log('📋 System logs data:', data);
      
      setLogs(data.data.logs);
      setTotal(data.data.total);
      
      console.log('📋 System logs processed:', {
        logsCount: data.data.logs?.length || 0,
        total: data.data.total
      });
    } catch (error) {
      console.error('📋 Error fetching logs:', {
        message: error.message,
        level,
        page
      });
      toast.error('Failed to fetch system logs');
    } finally {
      setLoading(false);
    }
  }, [level, page]);

  const downloadLogs = async () => {
    try {
      const response = await fetch('/api/system/logs?download=true', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to download logs');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `system-logs-${new Date().toISOString().split('T')[0]}.log`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Logs downloaded successfully');
    } catch (error) {
      console.error('Error downloading logs:', error);
      toast.error('Failed to download logs');
    }
  };

  const toggleAutoRefresh = () => {
    if (autoRefresh) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
      setAutoRefresh(false);
    } else {
      const interval = setInterval(fetchLogs, 5000); // Refresh every 5 seconds
      setRefreshInterval(interval);
      setAutoRefresh(true);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [refreshInterval]);

  const getLogLevelIcon = (logLevel) => {
    switch (logLevel) {
      case 'error':
        return <ErrorIcon color="error" />;
      case 'warn':
        return <WarningIcon color="warning" />;
      case 'info':
        return <InfoIcon color="info" />;
      case 'debug':
        return <SuccessIcon color="success" />;
      default:
        return <InfoIcon />;
    }
  };

  const getLogLevelColor = (logLevel) => {
    switch (logLevel) {
      case 'error':
        return 'error';
      case 'warn':
        return 'warning';
      case 'info':
        return 'info';
      case 'debug':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Logs
      </Typography>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
              <FormControl variant="outlined" sx={{ minWidth: 120 }}>
                <InputLabel>Log Level</InputLabel>
                <Select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  label="Log Level"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                  <MenuItem value="warn">Warning</MenuItem>
                  <MenuItem value="info">Info</MenuItem>
                  <MenuItem value="debug">Debug</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchLogs}
                disabled={loading}
              >
                Refresh
              </Button>

              <Button
                variant={autoRefresh ? "contained" : "outlined"}
                onClick={toggleAutoRefresh}
                color={autoRefresh ? "secondary" : "primary"}
              >
                {autoRefresh ? 'Stop Auto Refresh' : 'Auto Refresh'}
              </Button>

              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={downloadLogs}
              >
                Download
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Log Statistics
              </Typography>
              <Box display="flex" flexDirection="column" gap={1}>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Total Entries:</Typography>
                  <Typography variant="body2" fontWeight="bold">{total}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Current Filter:</Typography>
                  <Chip 
                    label={level || 'All'} 
                    size="small" 
                    color={level ? getLogLevelColor(level) : 'default'}
                  />
                </Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Auto Refresh:</Typography>
                  <Chip 
                    label={autoRefresh ? 'ON' : 'OFF'} 
                    size="small" 
                    color={autoRefresh ? 'success' : 'default'}
                  />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {loading ? (
        <Box display="flex" justifyContent="center" p={4}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell width="120px">Level</TableCell>
                  <TableCell width="180px">Timestamp</TableCell>
                  <TableCell>Message</TableCell>
                  <TableCell width="150px">Meta</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      <Alert severity="info">No logs found for the selected criteria</Alert>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getLogLevelIcon(log.level)}
                          <Chip 
                            label={log.level?.toUpperCase() || 'INFO'} 
                            size="small"
                            color={getLogLevelColor(log.level)}
                          />
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {formatTimestamp(log.timestamp)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          fontFamily="monospace"
                          sx={{ 
                            wordBreak: 'break-word',
                            maxWidth: '400px'
                          }}
                        >
                          {log.message}
                        </Typography>
                        {log.stack && (
                          <Typography 
                            variant="caption" 
                            color="text.secondary"
                            sx={{ 
                              display: 'block',
                              mt: 1,
                              fontFamily: 'monospace',
                              wordBreak: 'break-all'
                            }}
                          >
                            {log.stack}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.meta && typeof log.meta === 'object' && (
                          <Box>
                            {Object.entries(log.meta).map(([key, value]) => (
                              <Typography 
                                key={key} 
                                variant="caption" 
                                display="block"
                                sx={{ fontFamily: 'monospace' }}
                              >
                                {key}: {JSON.stringify(value)}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <Box display="flex" justifyContent="center" mt={3}>
            <Pagination
              count={Math.ceil(total / 50)}
              page={page}
              onChange={(e, newPage) => setPage(newPage)}
              color="primary"
            />
          </Box>
        </>
      )}
    </Box>
  );
};

export default SystemLogs;
