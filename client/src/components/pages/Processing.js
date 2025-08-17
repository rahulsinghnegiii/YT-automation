import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  LinearProgress,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Refresh,
  Delete,
  Visibility,
  Settings,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const Processing = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [detailDialog, setDetailDialog] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [newJob, setNewJob] = useState({
    assetId: '',
    type: 'morphology',
    parameters: {},
  });
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    fetchJobs();
    fetchAssets();
    
    // Set up polling for job updates
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await api.get('/api/processing/jobs');
      console.log('🔄 Processing jobs API response:', response.data);
      // Handle the nested structure: { success: true, data: { jobs: [...], pagination: {...} } }
      const jobsData = response.data.data?.jobs || response.data.jobs || response.data;
      if (Array.isArray(jobsData)) {
        setJobs(jobsData);
      } else {
        console.warn('⚠️ Expected array but got:', typeof jobsData, jobsData);
        setJobs([]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch processing jobs:', error);
      toast.error('Failed to fetch processing jobs');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAssets = async () => {
    try {
      const response = await api.get('/api/assets');
      console.log('🗂️ Assets for processing API response:', response.data);
      // Handle the nested structure: { success: true, data: { assets: [...], pagination: {...} } }
      const assetsData = response.data.data?.assets || response.data.assets || response.data;
      if (Array.isArray(assetsData)) {
        setAssets(assetsData.filter(asset => asset.status === 'uploaded'));
      } else {
        console.warn('⚠️ Expected array but got:', typeof assetsData, assetsData);
        setAssets([]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch assets:', error);
      setAssets([]);
    }
  };

  const handleJobAction = async (jobId, action) => {
    try {
      await api.post(`/api/processing/jobs/${jobId}/${action}`);
      toast.success(`Job ${action} successful`);
      fetchJobs();
    } catch (error) {
      toast.error(`Failed to ${action} job`);
    }
  };

  const handleDeleteJob = async (jobId) => {
    try {
      await api.delete(`/api/processing/jobs/${jobId}`);
      toast.success('Job deleted successfully');
      fetchJobs();
    } catch (error) {
      console.error('Delete job error:', error);
      toast.error('Failed to delete job');
    }
  };

  const handleCreateJob = async () => {
    try {
      await api.post('/api/processing/start', newJob);
      toast.success('Processing job created successfully');
      setCreateDialog(false);
      setNewJob({
        assetId: '',
        type: 'morphology',
        parameters: {},
      });
      fetchJobs();
    } catch (error) {
      console.error('Create job error:', error);
      toast.error('Failed to create processing job');
    }
  };

  const getStatusChip = (status) => {
    const statusColors = {
      'pending': 'default',
      'running': 'warning',
      'completed': 'success',
      'failed': 'error',
      'cancelled': 'secondary',
    };
    return (
      <Chip 
        label={status} 
        color={statusColors[status] || 'default'} 
        size="small"
      />
    );
  };

  const getJobTypeDescription = (type) => {
    const descriptions = {
      'morphology': 'Signal Morphology - Transform audio characteristics',
      'enrichment': 'Semantic Enrichment - Add metadata and descriptions',
      'harvesting': 'Asset Harvesting - Extract content from sources',
      'upload': 'YouTube Upload - Upload processed content',
    };
    return descriptions[type] || type;
  };

  const columns = [
    {
      field: 'id',
      headerName: 'Job ID',
      width: 100,
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 150,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {getJobTypeDescription(params.value)}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'assetId',
      headerName: 'Asset',
      width: 200,
      renderCell: (params) => {
        const asset = assets.find(a => a.id === params.value);
        return (
          <Typography variant="body2">
            {asset?.filename || `Asset ${params.value}`}
          </Typography>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => getStatusChip(params.value),
    },
    {
      field: 'progress',
      headerName: 'Progress',
      width: 150,
      renderCell: (params) => (
        <Box width="100%">
          <LinearProgress 
            variant="determinate" 
            value={params.value || 0} 
            sx={{ mb: 0.5 }}
          />
          <Typography variant="caption">
            {params.value?.toFixed(1) || 0}%
          </Typography>
        </Box>
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2">
          {new Date(params.value).toLocaleString()}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (params) => (
        <Box>
          {params.row.status === 'pending' && (
            <IconButton
              size="small"
              onClick={() => handleJobAction(params.row.id, 'start')}
              title="Start"
              color="primary"
            >
              <PlayArrow />
            </IconButton>
          )}
          {params.row.status === 'running' && (
            <IconButton
              size="small"
              onClick={() => handleJobAction(params.row.id, 'pause')}
              title="Pause"
              color="warning"
            >
              <Pause />
            </IconButton>
          )}
          <IconButton
            size="small"
            onClick={() => {
              setSelectedJob(params.row);
              setDetailDialog(true);
            }}
            title="View Details"
          >
            <Visibility />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDeleteJob(params.row.id)}
            title="Delete"
            color="error"
          >
            <Delete />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">
          Processing Jobs
        </Typography>
        <Box>
          <Button
            variant="outlined"
            onClick={fetchJobs}
            startIcon={<Refresh />}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            onClick={() => setCreateDialog(true)}
            startIcon={<Settings />}
          >
            Create Job
          </Button>
        </Box>
      </Box>

      <Card>
        <CardContent>
          <DataGrid
            rows={jobs}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            pageSizeOptions={[25, 50, 100]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 25 },
              },
            }}
            sx={{ height: 600 }}
          />
        </CardContent>
      </Card>

      {/* Job Details Dialog */}
      <Dialog open={detailDialog} onClose={() => setDetailDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Job Details</DialogTitle>
        <DialogContent>
          {selectedJob && (
            <Box mt={2}>
              <Typography variant="h6" gutterBottom>
                Job #{selectedJob.id} - {selectedJob.type}
              </Typography>
              
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">Status:</Typography>
                {getStatusChip(selectedJob.status)}
              </Box>

              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">Progress:</Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={selectedJob.progress || 0} 
                  sx={{ mt: 1 }}
                />
                <Typography variant="caption">
                  {selectedJob.progress?.toFixed(1) || 0}%
                </Typography>
              </Box>

              <Box mb={2}>
                <Typography variant="body2" color="text.secondary">Created:</Typography>
                <Typography variant="body2">
                  {new Date(selectedJob.createdAt).toLocaleString()}
                </Typography>
              </Box>

              {selectedJob.startedAt && (
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">Started:</Typography>
                  <Typography variant="body2">
                    {new Date(selectedJob.startedAt).toLocaleString()}
                  </Typography>
                </Box>
              )}

              {selectedJob.completedAt && (
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">Completed:</Typography>
                  <Typography variant="body2">
                    {new Date(selectedJob.completedAt).toLocaleString()}
                  </Typography>
                </Box>
              )}

              {selectedJob.error && (
                <Box mb={2}>
                  <Alert severity="error">
                    <Typography variant="body2" fontWeight="medium">Error:</Typography>
                    <Typography variant="body2">{selectedJob.error}</Typography>
                  </Alert>
                </Box>
              )}

              {selectedJob.parameters && Object.keys(selectedJob.parameters).length > 0 && (
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Parameters:
                  </Typography>
                  <pre style={{ 
                    backgroundColor: '#f5f5f5', 
                    padding: 8, 
                    borderRadius: 4,
                    fontSize: '0.8rem',
                    overflow: 'auto'
                  }}>
                    {JSON.stringify(selectedJob.parameters, null, 2)}
                  </pre>
                </Box>
              )}

              {selectedJob.result && (
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Result:
                  </Typography>
                  <pre style={{ 
                    backgroundColor: '#f5f5f5', 
                    padding: 8, 
                    borderRadius: 4,
                    fontSize: '0.8rem',
                    overflow: 'auto'
                  }}>
                    {JSON.stringify(selectedJob.result, null, 2)}
                  </pre>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Job Dialog */}
      <Dialog open={createDialog} onClose={() => setCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create Processing Job</DialogTitle>
        <DialogContent>
          <Box mt={2}>
            <TextField
              fullWidth
              select
              label="Asset"
              value={newJob.assetId}
              onChange={(e) => setNewJob({ ...newJob, assetId: e.target.value })}
              margin="normal"
            >
              {assets.map((asset) => (
                <MenuItem key={asset.id} value={asset.id}>
                  {asset.filename}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              select
              label="Processing Type"
              value={newJob.type}
              onChange={(e) => setNewJob({ ...newJob, type: e.target.value })}
              margin="normal"
            >
              <MenuItem value="morphology">Signal Morphology</MenuItem>
              <MenuItem value="enrichment">Semantic Enrichment</MenuItem>
              <MenuItem value="upload">YouTube Upload</MenuItem>
            </TextField>

            <TextField
              fullWidth
              multiline
              rows={4}
              label="Parameters (JSON)"
              value={JSON.stringify(newJob.parameters, null, 2)}
              onChange={(e) => {
                try {
                  const params = JSON.parse(e.target.value);
                  setNewJob({ ...newJob, parameters: params });
                } catch (err) {
                  // Invalid JSON, keep the text but don't update parameters
                }
              }}
              margin="normal"
              helperText="Enter job-specific parameters in JSON format"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleCreateJob} 
            variant="contained"
            disabled={!newJob.assetId}
          >
            Create Job
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Processing;
