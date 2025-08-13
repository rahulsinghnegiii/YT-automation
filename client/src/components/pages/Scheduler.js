import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Switch,
  FormControlLabel,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
} from '@mui/material';
import {
  PlayArrow,
  Settings,
  Refresh,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const Scheduler = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configDialog, setConfigDialog] = useState(false);
  const [config, setConfig] = useState({
    harvestInterval: 6,
    processingInterval: 2,
    uploadInterval: 8,
    metadataRefreshDays: 30,
  });

  useEffect(() => {
    fetchSchedulerStatus();
    fetchConfig();
  }, []);

  const fetchSchedulerStatus = async () => {
    console.log('📊 Fetching scheduler status...');
    try {
      const response = await api.get('/api/scheduler/status');
      console.log('📊 Scheduler status response:', response.data);
      
      if (response.data.success) {
        setJobs(response.data.data || []);
        console.log('📊 Jobs loaded:', response.data.data || []);
      } else {
        console.error('📊 Scheduler status failed:', response.data);
        toast.error('Failed to fetch scheduler status');
      }
    } catch (error) {
      console.error('📊 Scheduler status error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      toast.error('Failed to fetch scheduler status');
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    console.log('⚙️ Fetching scheduler config...');
    try {
      const response = await api.get('/api/scheduler/config');
      console.log('⚙️ Config response:', response.data);
      
      if (response.data.success) {
        const configData = response.data.data || {
          harvestInterval: 6,
          processingInterval: 2,
          uploadInterval: 8,
          metadataRefreshDays: 30,
        };
        setConfig(configData);
        console.log('⚙️ Config loaded:', configData);
      }
    } catch (error) {
      console.error('⚙️ Failed to fetch config:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
    }
  };

  const handleJobToggle = async (jobName, enabled) => {
    console.log(`🔄 ${enabled ? 'Starting' : 'Stopping'} job:`, jobName);
    try {
      const action = enabled ? 'start' : 'stop';
      const response = await api.post(`/api/scheduler/jobs/${jobName}/${action}`);
      console.log(`🔄 Job ${action} response:`, response.data);
      
      toast.success(`Job ${enabled ? 'started' : 'stopped'} successfully`);
      fetchSchedulerStatus();
    } catch (error) {
      console.error(`🔄 Job ${enabled ? 'start' : 'stop'} error:`, {
        jobName,
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      toast.error(`Failed to ${enabled ? 'start' : 'stop'} job`);
    }
  };

  const handleTriggerJob = async (jobName) => {
    console.log('⚡ Triggering job:', jobName);
    try {
      const response = await api.post(`/api/scheduler/jobs/${jobName}/trigger`);
      console.log('⚡ Job trigger response:', response.data);
      
      toast.success('Job triggered successfully');
      fetchSchedulerStatus();
    } catch (error) {
      console.error('⚡ Job trigger error:', {
        jobName,
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      toast.error('Failed to trigger job');
    }
  };

  const handleSaveConfig = async () => {
    try {
      const response = await api.put('/api/scheduler/config', config);
      if (response.data.success) {
        toast.success('Configuration saved successfully');
        setConfigDialog(false);
        fetchSchedulerStatus();
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Config save error:', error);
      toast.error('Failed to save configuration');
    }
  };

  const getStatusChip = (running) => (
    <Chip 
      label={running ? 'Running' : 'Stopped'} 
      color={running ? 'success' : 'default'} 
      size="small"
    />
  );

  const getJobDescription = (name) => {
    const descriptions = {
      'harvest': 'Automatically harvest content from configured sources',
      'processing': 'Process uploaded assets through morphology and enrichment',
      'upload': 'Upload processed content to YouTube and other platforms',
      'metadata': 'Refresh metadata for existing uploads',
      'maintenance': 'System cleanup and maintenance tasks',
    };
    return descriptions[name] || 'Scheduled system job';
  };

  const columns = [
    {
      field: 'name',
      headerName: 'Job Name',
      width: 150,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {getJobDescription(params.value)}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'running',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => getStatusChip(params.value),
    },
    {
      field: 'schedule',
      headerName: 'Schedule',
      width: 200,
      renderCell: (params) => (
        <Typography variant="body2" fontFamily="monospace">
          {params.value || 'N/A'}
        </Typography>
      ),
    },
    {
      field: 'lastRun',
      headerName: 'Last Run',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value ? new Date(params.value).toLocaleString() : 'Never'}
        </Typography>
      ),
    },
    {
      field: 'nextRun',
      headerName: 'Next Run',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value ? new Date(params.value).toLocaleString() : 'N/A'}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 250,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <FormControlLabel
            control={
              <Switch
                checked={params.row.running}
                onChange={(e) => handleJobToggle(params.row.name, e.target.checked)}
                size="small"
              />
            }
            label=""
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleTriggerJob(params.row.name)}
            startIcon={<PlayArrow />}
            sx={{ ml: 1 }}
          >
            Trigger
          </Button>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Task Scheduler
        </Typography>
        <Box>
          <Button
            variant="outlined"
            onClick={fetchSchedulerStatus}
            startIcon={<Refresh />}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            onClick={() => setConfigDialog(true)}
            startIcon={<Settings />}
          >
            Configure
          </Button>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        The scheduler manages automated tasks for content harvesting, processing, and uploading.
        Jobs run according to their configured schedules and can be manually triggered when needed.
      </Alert>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Scheduled Jobs
          </Typography>
          <DataGrid
            rows={jobs}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            getRowId={(row) => row.name}
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10 },
              },
            }}
            sx={{ height: 400 }}
          />
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Asset Harvesting
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Runs every {config.harvestInterval} hours
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => handleTriggerJob('harvest')}
                startIcon={<PlayArrow />}
              >
                Trigger Now
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Content Processing
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Runs every {config.processingInterval} hours
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => handleTriggerJob('processing')}
                startIcon={<PlayArrow />}
              >
                Trigger Now
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                YouTube Upload
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Runs every {config.uploadInterval} hours
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => handleTriggerJob('upload')}
                startIcon={<PlayArrow />}
              >
                Trigger Now
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Maintenance
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Runs daily at 3:00 AM
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => handleTriggerJob('maintenance')}
                startIcon={<PlayArrow />}
              >
                Trigger Now
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Configuration Dialog */}
      <Dialog open={configDialog} onClose={() => setConfigDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Scheduler Configuration</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Harvest Interval (hours)"
                value={config.harvestInterval}
                onChange={(e) => setConfig({ ...config, harvestInterval: parseInt(e.target.value) })}
                helperText="How often to harvest new content from sources"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Processing Interval (hours)"
                value={config.processingInterval}
                onChange={(e) => setConfig({ ...config, processingInterval: parseInt(e.target.value) })}
                helperText="How often to process uploaded assets"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Upload Interval (hours)"
                value={config.uploadInterval}
                onChange={(e) => setConfig({ ...config, uploadInterval: parseInt(e.target.value) })}
                helperText="How often to upload processed content"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="number"
                label="Metadata Refresh (days)"
                value={config.metadataRefreshDays}
                onChange={(e) => setConfig({ ...config, metadataRefreshDays: parseInt(e.target.value) })}
                helperText="How often to refresh metadata for uploads"
              />
            </Grid>
          </Grid>
          
          <Alert severity="warning" sx={{ mt: 2 }}>
            Changing these intervals will affect the scheduler immediately. 
            Make sure the intervals are appropriate for your system's capacity.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialog(false)}>Cancel</Button>
          <Button onClick={handleSaveConfig} variant="contained">Save Configuration</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Scheduler;
