import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  Schedule as ScheduleIcon,
  Storage as StorageIcon,
  Api as ApiIcon,
  RestartAlt as RestartIcon,
  Delete as DeleteIcon,
  HealthAndSafety as HealthIcon,
} from '@mui/icons-material';
import { toast } from 'react-hot-toast';

const Configuration = () => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  const [maintenanceDialog, setMaintenanceDialog] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null);

  const [formData, setFormData] = useState({
    scheduler: {
      harvestInterval: '',
      processInterval: '',
      uploadInterval: ''
    },
    limits: {
      maxFileSize: '',
      maxConcurrentJobs: '',
      retentionDays: ''
    },
    features: {
      realTimeMonitoring: false,
      scheduler: false,
      analytics: false,
      notifications: false,
      youtubeUpload: false,
      openaiEnrichment: false
    }
  });

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/system/config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch configuration');

      const data = await response.json();
      setConfig(data.data);
      setFormData({
        scheduler: data.data.scheduler || {},
        limits: data.data.limits || {},
        features: data.data.features || {}
      });
    } catch (error) {
      console.error('Error fetching config:', error);
      toast.error('Failed to fetch configuration');
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthStatus = async () => {
    try {
      const response = await fetch('/api/system/health', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch health status');

      const data = await response.json();
      setHealthStatus(data.data);
    } catch (error) {
      console.error('Error fetching health status:', error);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/system/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save configuration');

      toast.success('Configuration saved successfully');
      fetchConfig();
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const performMaintenance = async (action) => {
    try {
      const response = await fetch(`/api/system/maintenance/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error(`Failed to execute ${action}`);

      const data = await response.json();
      toast.success(data.message);
      setMaintenanceDialog(false);
      
      // Refresh health status after maintenance
      setTimeout(fetchHealthStatus, 1000);
    } catch (error) {
      console.error('Error performing maintenance:', error);
      toast.error(`Failed to execute ${action}`);
    }
  };

  const handleInputChange = (category, field, value) => {
    setFormData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const getHealthStatusChip = (status) => {
    const colors = {
      healthy: 'success',
      degraded: 'warning',
      unhealthy: 'error'
    };
    return (
      <Chip 
        label={status?.toUpperCase() || 'UNKNOWN'} 
        color={colors[status] || 'default'}
        size="small"
      />
    );
  };

  const getServiceStatusChip = (status) => {
    return (
      <Chip 
        label={status} 
        color={status === 'healthy' ? 'success' : status === 'degraded' ? 'warning' : 'error'}
        size="small"
      />
    );
  };

  const maintenanceActions = [
    { id: 'restart-scheduler', label: 'Restart Scheduler', icon: <ScheduleIcon /> },
    { id: 'clear-cache', label: 'Clear Cache', icon: <DeleteIcon /> },
    { id: 'cleanup-logs', label: 'Cleanup Old Logs', icon: <DeleteIcon /> },
    { id: 'restart-monitoring', label: 'Restart Monitoring', icon: <RestartIcon /> },
  ];

  useEffect(() => {
    fetchConfig();
    fetchHealthStatus();
    
    // Refresh health status every 30 seconds
    const interval = setInterval(fetchHealthStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Configuration
      </Typography>

      <Grid container spacing={3}>
        {/* System Health */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <HealthIcon />
                <Typography variant="h6">System Health</Typography>
                <Button
                  size="small"
                  startIcon={<RefreshIcon />}
                  onClick={fetchHealthStatus}
                >
                  Refresh
                </Button>
              </Box>
              
              {healthStatus && (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box textAlign="center">
                      <Typography variant="body2" color="text.secondary">Overall Status</Typography>
                      {getHealthStatusChip(healthStatus.status)}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box textAlign="center">
                      <Typography variant="body2" color="text.secondary">Database</Typography>
                      {getServiceStatusChip(healthStatus.checks?.database)}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box textAlign="center">
                      <Typography variant="body2" color="text.secondary">Storage</Typography>
                      {getServiceStatusChip(healthStatus.checks?.storage)}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box textAlign="center">
                      <Typography variant="body2" color="text.secondary">External APIs</Typography>
                      {getServiceStatusChip(healthStatus.checks?.externalAPIs)}
                    </Box>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Scheduler Configuration */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <ScheduleIcon />
                <Typography variant="h6">Scheduler Settings</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Harvest Interval (Cron)"
                    value={formData.scheduler.harvestInterval || ''}
                    onChange={(e) => handleInputChange('scheduler', 'harvestInterval', e.target.value)}
                    helperText="Cron expression for asset harvesting"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Process Interval (Cron)"
                    value={formData.scheduler.processInterval || ''}
                    onChange={(e) => handleInputChange('scheduler', 'processInterval', e.target.value)}
                    helperText="Cron expression for processing jobs"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Upload Interval (Cron)"
                    value={formData.scheduler.uploadInterval || ''}
                    onChange={(e) => handleInputChange('scheduler', 'uploadInterval', e.target.value)}
                    helperText="Cron expression for uploads"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* System Limits */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <StorageIcon />
                <Typography variant="h6">System Limits</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Max File Size"
                    value={formData.limits.maxFileSize || ''}
                    onChange={(e) => handleInputChange('limits', 'maxFileSize', e.target.value)}
                    helperText="Maximum file size (e.g., 100MB)"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Max Concurrent Jobs"
                    value={formData.limits.maxConcurrentJobs || ''}
                    onChange={(e) => handleInputChange('limits', 'maxConcurrentJobs', e.target.value)}
                    helperText="Maximum number of concurrent processing jobs"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Log Retention Days"
                    value={formData.limits.retentionDays || ''}
                    onChange={(e) => handleInputChange('limits', 'retentionDays', e.target.value)}
                    helperText="Number of days to keep log files"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Feature Toggles */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <ApiIcon />
                <Typography variant="h6">Feature Configuration</Typography>
              </Box>
              <List>
                {Object.entries(formData.features).map(([key, value]) => (
                  <ListItem key={key}>
                    <ListItemText 
                      primary={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      secondary={getFeatureDescription(key)}
                    />
                    <ListItemSecondaryAction>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={value}
                            onChange={(e) => handleInputChange('features', key, e.target.checked)}
                            disabled={key === 'youtubeUpload' || key === 'openaiEnrichment'} // These are determined by API keys
                          />
                        }
                        label=""
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Maintenance Actions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <SecurityIcon />
                <Typography variant="h6">Maintenance Actions</Typography>
              </Box>
              <Grid container spacing={2}>
                {maintenanceActions.map((action) => (
                  <Grid item xs={12} sm={6} key={action.id}>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={action.icon}
                      onClick={() => {
                        setSelectedAction(action);
                        setMaintenanceDialog(true);
                      }}
                    >
                      {action.label}
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Save Button */}
        <Grid item xs={12}>
          <Box display="flex" justifyContent="center">
            <Button
              variant="contained"
              size="large"
              startIcon={<SaveIcon />}
              onClick={saveConfig}
              disabled={saving}
              sx={{ minWidth: 200 }}
            >
              {saving ? <CircularProgress size={24} /> : 'Save Configuration'}
            </Button>
          </Box>
        </Grid>
      </Grid>

      {/* Maintenance Confirmation Dialog */}
      <Dialog open={maintenanceDialog} onClose={() => setMaintenanceDialog(false)}>
        <DialogTitle>
          Confirm Maintenance Action
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action may temporarily disrupt system operations.
          </Alert>
          <Typography>
            Are you sure you want to execute: <strong>{selectedAction?.label}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMaintenanceDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => performMaintenance(selectedAction?.id)}
            variant="contained"
            color="warning"
          >
            Execute
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

function getFeatureDescription(key) {
  const descriptions = {
    realTimeMonitoring: 'Enable real-time system monitoring and WebSocket updates',
    scheduler: 'Enable automatic job scheduling',
    analytics: 'Enable analytics and reporting features',
    notifications: 'Enable email notifications (requires SMTP configuration)',
    youtubeUpload: 'YouTube upload capability (requires YouTube API credentials)',
    openaiEnrichment: 'AI-powered content enrichment (requires OpenAI API key)'
  };
  return descriptions[key] || '';
}

export default Configuration;
