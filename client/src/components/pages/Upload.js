import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  TextField,
  Grid,
  Alert,
  LinearProgress,
  Chip,
  List,
  ListItem,
  IconButton,
  Tab,
  Tabs,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  CloudUpload,
  Link as LinkIcon,
  FileUpload,
  VideoFile,
  AudioFile,
  Close,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import api from '../../utils/api';
import toast from 'react-hot-toast';

const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`upload-tabpanel-${index}`}
    aria-labelledby={`upload-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const Upload = () => {
  const [tabValue, setTabValue] = useState(0);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [urlInput, setUrlInput] = useState('');
  const [batchConfig, setBatchConfig] = useState('');
  const [batchDialog, setBatchDialog] = useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      title: file.name.replace(/\.[^/.]+$/, ""),
      description: '',
      tags: [],
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.flac', '.m4a', '.aac'],
      'video/*': ['.mp4', '.avi', '.mov', '.mkv'],
      'text/*': ['.txt', '.md'],
    },
    multiple: true,
  });

  const removeFile = (fileId) => {
    setFiles(files.filter(f => f.id !== fileId));
  };

  const updateFileMetadata = (fileId, field, value) => {
    setFiles(files.map(f => 
      f.id === fileId 
        ? { ...f, [field]: field === 'tags' ? value.split(',').map(t => t.trim()) : value }
        : f
    ));
  };

  const uploadFiles = async () => {
    if (files.length === 0) {
      toast.error('No files selected');
      return;
    }

    setUploading(true);
    
    try {
      for (const fileData of files) {
        const formData = new FormData();
        formData.append('file', fileData.file);
        formData.append('title', fileData.title);
        formData.append('description', fileData.description);
        formData.append('tags', JSON.stringify(fileData.tags));

        await api.post('/api/upload/single', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(prev => ({
              ...prev,
              [fileData.id]: progress,
            }));
          },
        });

        toast.success(`Uploaded: ${fileData.file.name}`);
      }

      setFiles([]);
      setUploadProgress({});
      toast.success('All files uploaded successfully!');
    } catch (error) {
      toast.error('Upload failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploading(false);
    }
  };

  const uploadFromUrl = async () => {
    if (!urlInput.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    setUploading(true);
    try {
      await api.post('/api/upload/url', {
        url: urlInput.trim(),
      });
      toast.success('URL upload initiated');
      setUrlInput('');
    } catch (error) {
      toast.error('URL upload failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setUploading(false);
    }
  };

  const uploadBatch = async () => {
    if (!batchConfig.trim()) {
      toast.error('Please enter batch configuration');
      return;
    }

    try {
      const config = JSON.parse(batchConfig);
      setUploading(true);
      
      await api.post('/api/upload/batch', config);
      toast.success('Batch upload initiated');
      setBatchConfig('');
      setBatchDialog(false);
    } catch (error) {
      if (error instanceof SyntaxError) {
        toast.error('Invalid JSON configuration');
      } else {
        toast.error('Batch upload failed: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('audio/')) return <AudioFile />;
    if (file.type.startsWith('video/')) return <VideoFile />;
    return <FileUpload />;
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Upload Assets
      </Typography>

      <Card>
        <Tabs
          value={tabValue}
          onChange={(e, newValue) => setTabValue(newValue)}
          aria-label="upload tabs"
        >
          <Tab label="File Upload" />
          <Tab label="URL Upload" />
          <Tab label="Batch Upload" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card
                {...getRootProps()}
                sx={{
                  border: '2px dashed',
                  borderColor: isDragActive ? 'primary.main' : 'grey.300',
                  bgcolor: isDragActive ? 'action.hover' : 'background.paper',
                  p: 4,
                  textAlign: 'center',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'action.hover',
                  },
                }}
              >
                <input {...getInputProps()} />
                <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  or click to select files
                </Typography>
                <Button variant="outlined">
                  Select Files
                </Button>
                <Typography variant="caption" display="block" mt={2}>
                  Supported: MP3, WAV, FLAC, MP4, AVI, TXT
                </Typography>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Selected Files ({files.length})
              </Typography>
              
              {files.length > 0 && (
                <Box mb={2}>
                  <Button
                    variant="contained"
                    onClick={uploadFiles}
                    disabled={uploading}
                    startIcon={<CloudUpload />}
                    fullWidth
                  >
                    {uploading ? 'Uploading...' : `Upload ${files.length} Files`}
                  </Button>
                </Box>
              )}

              <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                {files.map((fileData) => (
                  <ListItem key={fileData.id} divider>
                    <Box width="100%">
                      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getFileIcon(fileData.file)}
                          <Typography variant="body2" fontWeight="medium">
                            {fileData.file.name}
                          </Typography>
                          <Chip 
                            label={`${(fileData.file.size / 1024 / 1024).toFixed(2)} MB`}
                            size="small"
                          />
                        </Box>
                        <IconButton
                          size="small"
                          onClick={() => removeFile(fileData.id)}
                          color="error"
                        >
                          <Close />
                        </IconButton>
                      </Box>
                      
                      {uploadProgress[fileData.id] && (
                        <Box mb={1}>
                          <LinearProgress 
                            variant="determinate" 
                            value={uploadProgress[fileData.id]} 
                          />
                          <Typography variant="caption">
                            {uploadProgress[fileData.id]}% uploaded
                          </Typography>
                        </Box>
                      )}

                      <TextField
                        fullWidth
                        size="small"
                        label="Title"
                        value={fileData.title}
                        onChange={(e) => updateFileMetadata(fileData.id, 'title', e.target.value)}
                        margin="dense"
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="Description"
                        value={fileData.description}
                        onChange={(e) => updateFileMetadata(fileData.id, 'description', e.target.value)}
                        margin="dense"
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="Tags (comma-separated)"
                        value={fileData.tags.join(', ')}
                        onChange={(e) => updateFileMetadata(fileData.id, 'tags', e.target.value)}
                        margin="dense"
                      />
                    </Box>
                  </ListItem>
                ))}
              </List>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Media URL"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/audio.mp3 or YouTube URL"
                helperText="Enter a direct media URL or YouTube video URL"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="contained"
                onClick={uploadFromUrl}
                disabled={uploading || !urlInput.trim()}
                startIcon={<LinkIcon />}
                sx={{ height: 56 }}
              >
                {uploading ? 'Processing...' : 'Upload from URL'}
              </Button>
            </Grid>
          </Grid>
          
          <Alert severity="info" sx={{ mt: 2 }}>
            URL uploads support direct media links and YouTube videos. 
            The system will automatically extract audio from video content.
          </Alert>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6">
              Batch Upload Configuration
            </Typography>
            <Button
              variant="outlined"
              onClick={() => setBatchDialog(true)}
            >
              Load Template
            </Button>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={10}
            label="Batch Configuration (JSON)"
            value={batchConfig}
            onChange={(e) => setBatchConfig(e.target.value)}
            placeholder={`{
  "sources": [
    {
      "type": "url",
      "url": "https://example.com/playlist.m3u8",
      "title": "Playlist 1"
    },
    {
      "type": "directory",
      "path": "/path/to/audio/files",
      "recursive": true
    }
  ],
  "processing": {
    "auto_process": true,
    "target_format": "mp3",
    "quality": "high"
  }
}`}
          />

          <Box mt={2}>
            <Button
              variant="contained"
              onClick={uploadBatch}
              disabled={uploading || !batchConfig.trim()}
              startIcon={<CloudUpload />}
            >
              {uploading ? 'Processing...' : 'Start Batch Upload'}
            </Button>
          </Box>

          <Alert severity="info" sx={{ mt: 2 }}>
            Batch upload supports multiple sources including URLs, playlists, and local directories.
            Configure processing options to automatically transform uploaded content.
          </Alert>
        </TabPanel>
      </Card>

      {/* Batch Template Dialog */}
      <Dialog open={batchDialog} onClose={() => setBatchDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Batch Upload Templates</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Select a template to get started with batch uploads:
          </Typography>
          
          <Button
            fullWidth
            variant="outlined"
            onClick={() => {
              setBatchConfig(JSON.stringify({
                sources: [
                  {
                    type: "url",
                    url: "https://example.com/audio.mp3",
                    title: "Sample Audio",
                    tags: ["ambient", "music"]
                  }
                ],
                processing: {
                  auto_process: true,
                  target_format: "mp3",
                  quality: "high"
                }
              }, null, 2));
              setBatchDialog(false);
            }}
            sx={{ mb: 1 }}
          >
            Single URL Template
          </Button>
          
          <Button
            fullWidth
            variant="outlined"
            onClick={() => {
              setBatchConfig(JSON.stringify({
                sources: [
                  {
                    type: "youtube_playlist",
                    url: "https://youtube.com/playlist?list=...",
                    max_items: 10
                  }
                ],
                processing: {
                  extract_audio: true,
                  format: "mp3",
                  quality: "192kbps"
                }
              }, null, 2));
              setBatchDialog(false);
            }}
            sx={{ mb: 1 }}
          >
            YouTube Playlist Template
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBatchDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Upload;
