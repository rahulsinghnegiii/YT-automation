import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Delete,
  Download,
  Edit,
  AudioFile,
  VideoFile,
  InsertDriveFile,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const Assets = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [editDialog, setEditDialog] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const response = await api.get('/api/assets');
      console.log('🗂️ Assets API response:', response.data);
      // Handle the nested structure: { success: true, data: { assets: [...], pagination: {...} } }
      const assetsData = response.data.data?.assets || response.data.assets || response.data;
      if (Array.isArray(assetsData)) {
        setAssets(assetsData);
      } else {
        console.warn('⚠️ Expected array but got:', typeof assetsData, assetsData);
        setAssets([]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch assets:', error);
      toast.error('Failed to fetch assets');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (assetIds) => {
    try {
      if (Array.isArray(assetIds)) {
        await Promise.all(assetIds.map(id => api.delete(`/api/assets/${id}`)));
      } else {
        await api.delete(`/api/assets/${assetIds}`);
      }
      toast.success('Asset(s) deleted successfully');
      fetchAssets();
      setSelectedAssets([]);
      setDeleteDialog(false);
    } catch (error) {
      toast.error('Failed to delete asset(s)');
    }
  };

  const handleDownload = async (asset) => {
    try {
      const response = await api.get(`/api/assets/${asset.id}/download`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', asset.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error('Failed to download asset');
    }
  };

  const handleUpdateAsset = async () => {
    try {
      await api.put(`/api/assets/${editAsset.id}`, {
        title: editAsset.title,
        description: editAsset.description,
        tags: editAsset.tags,
      });
      toast.success('Asset updated successfully');
      setEditDialog(false);
      fetchAssets();
    } catch (error) {
      toast.error('Failed to update asset');
    }
  };

  const getFileIcon = (type, format) => {
    if (type === 'audio') return <AudioFile />;
    if (type === 'video') return <VideoFile />;
    return <InsertDriveFile />;
  };

  const getStatusChip = (status) => {
    const statusColors = {
      'uploaded': 'primary',
      'processing': 'warning',
      'processed': 'success',
      'error': 'error',
    };
    return (
      <Chip 
        label={status} 
        color={statusColors[status] || 'default'} 
        size="small"
      />
    );
  };

  const columns = [
    {
      field: 'filename',
      headerName: 'File',
      width: 250,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" gap={1}>
          {getFileIcon(params.row.type, params.row.format)}
          <Box>
            <Typography variant="body2" fontWeight="medium">
              {params.row.title || params.row.filename}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {params.row.filename}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 100,
    },
    {
      field: 'format',
      headerName: 'Format',
      width: 100,
    },
    {
      field: 'size',
      headerName: 'Size',
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2">
          {(params.value / 1024 / 1024).toFixed(2)} MB
        </Typography>
      ),
    },
    {
      field: 'duration',
      headerName: 'Duration',
      width: 120,
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value ? `${Math.floor(params.value / 60)}:${(params.value % 60).toString().padStart(2, '0')}` : 'N/A'}
        </Typography>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => getStatusChip(params.value),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 150,
      renderCell: (params) => (
        <Typography variant="body2">
          {new Date(params.value).toLocaleDateString()}
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
          <IconButton
            size="small"
            onClick={() => handleDownload(params.row)}
            title="Download"
          >
            <Download />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => {
              setEditAsset(params.row);
              setEditDialog(true);
            }}
            title="Edit"
          >
            <Edit />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.id)}
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
          Assets Management
        </Typography>
        <Box>
          <Button
            variant="contained"
            color="error"
            disabled={selectedAssets.length === 0}
            onClick={() => setDeleteDialog(true)}
            sx={{ mr: 1 }}
          >
            Delete Selected ({selectedAssets.length})
          </Button>
        </Box>
      </Box>

      <Card>
        <CardContent>
          <DataGrid
            rows={assets}
            columns={columns}
            loading={loading}
            checkboxSelection
            disableRowSelectionOnClick
            onRowSelectionModelChange={setSelectedAssets}
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

      {/* Edit Asset Dialog */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Asset</DialogTitle>
        <DialogContent>
          {editAsset && (
            <Box mt={2}>
              <TextField
                fullWidth
                label="Title"
                value={editAsset.title || ''}
                onChange={(e) => setEditAsset({ ...editAsset, title: e.target.value })}
                margin="normal"
              />
              <TextField
                fullWidth
                label="Description"
                value={editAsset.description || ''}
                onChange={(e) => setEditAsset({ ...editAsset, description: e.target.value })}
                margin="normal"
                multiline
                rows={3}
              />
              <TextField
                fullWidth
                label="Tags (comma-separated)"
                value={editAsset.tags?.join(', ') || ''}
                onChange={(e) => setEditAsset({ 
                  ...editAsset, 
                  tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                })}
                margin="normal"
                helperText="Enter tags separated by commas"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(false)}>Cancel</Button>
          <Button onClick={handleUpdateAsset} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {selectedAssets.length} selected asset(s)? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button 
            onClick={() => handleDelete(selectedAssets)} 
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Assets;
