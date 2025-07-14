const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { Asset, ProcessingJob } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadsDir = path.join(__dirname, '../../uploads');
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      cb(null, uploadsDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}_${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept audio and video files
    const allowedMimes = [
      'audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/flac', 'audio/ogg',
      'video/mp4', 'video/avi', 'video/mov', 'video/mkv', 'video/webm'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio and video files are allowed.'));
    }
  }
});

// Single file upload
router.post('/single', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { originalname, filename, path: filePath, size, mimetype } = req.file;
    const { title, description, tags, generateMetadata = true } = req.body;

    // Determine file type
    const type = mimetype.startsWith('audio/') ? 'audio' : 'video';

    // Create asset record
    const asset = await Asset.create({
      filename: originalname,
      originalPath: filePath,
      type,
      format: path.extname(originalname).toLowerCase(),
      size,
      metadata: {
        title: title || originalname,
        description: description || '',
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        uploadedBy: req.user.username,
        uploadedAt: new Date().toISOString(),
        originalMimetype: mimetype
      },
      status: 'downloaded'
    });

    // Create processing job if metadata generation requested
    if (generateMetadata) {
      await ProcessingJob.create({
        assetId: asset.id,
        type: 'semantic',
        status: 'pending'
      });
    }

    logger.info(`📁 File uploaded: ${originalname} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        asset: {
          id: asset.id,
          filename: asset.filename,
          type: asset.type,
          size: asset.size,
          status: asset.status
        }
      }
    });

  } catch (error) {
    logger.error('File upload error:', error);
    
    // Clean up uploaded file if asset creation failed
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        logger.error('Failed to cleanup uploaded file:', cleanupError);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to upload file'
    });
  }
});

// Multiple files upload
router.post('/multiple', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const { generateMetadata = true } = req.body;
    const uploadedAssets = [];

    for (const file of req.files) {
      const { originalname, filename, path: filePath, size, mimetype } = file;
      const type = mimetype.startsWith('audio/') ? 'audio' : 'video';

      try {
        // Create asset record
        const asset = await Asset.create({
          filename: originalname,
          originalPath: filePath,
          type,
          format: path.extname(originalname).toLowerCase(),
          size,
          metadata: {
            title: originalname,
            description: '',
            tags: [],
            uploadedBy: req.user.username,
            uploadedAt: new Date().toISOString(),
            originalMimetype: mimetype
          },
          status: 'downloaded'
        });

        // Create processing job if metadata generation requested
        if (generateMetadata) {
          await ProcessingJob.create({
            assetId: asset.id,
            type: 'semantic',
            status: 'pending'
          });
        }

        uploadedAssets.push({
          id: asset.id,
          filename: asset.filename,
          type: asset.type,
          size: asset.size,
          status: asset.status
        });

        logger.info(`📁 File uploaded: ${originalname} by ${req.user.username}`);

      } catch (error) {
        logger.error(`Failed to process uploaded file ${originalname}:`, error);
        
        // Clean up file if asset creation failed
        try {
          await fs.unlink(filePath);
        } catch (cleanupError) {
          logger.error('Failed to cleanup uploaded file:', cleanupError);
        }
      }
    }

    res.json({
      success: true,
      message: `${uploadedAssets.length} files uploaded successfully`,
      data: {
        assets: uploadedAssets,
        failed: req.files.length - uploadedAssets.length
      }
    });

  } catch (error) {
    logger.error('Multiple file upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload files'
    });
  }
});

// URL-based upload (for YouTube links, etc.)
router.post('/url', async (req, res) => {
  try {
    const { url, title, description, tags } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'URL is required'
      });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format'
      });
    }

    // Create asset record for URL-based download
    const asset = await Asset.create({
      filename: title || 'URL Download',
      originalPath: '', // Will be set after download
      sourceUrl: url,
      type: 'audio', // Default, will be determined after download
      metadata: {
        title: title || '',
        description: description || '',
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        uploadedBy: req.user.username,
        uploadedAt: new Date().toISOString(),
        sourceUrl: url
      },
      status: 'downloaded'
    });

    // Create download job
    await ProcessingJob.create({
      assetId: asset.id,
      type: 'download',
      status: 'pending'
    });

    logger.info(`🔗 URL queued for download: ${url} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'URL queued for download',
      data: {
        asset: {
          id: asset.id,
          filename: asset.filename,
          sourceUrl: asset.sourceUrl,
          status: asset.status
        }
      }
    });

  } catch (error) {
    logger.error('URL upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to queue URL for download'
    });
  }
});

// Batch upload from URLs
router.post('/batch-urls', async (req, res) => {
  try {
    const { urls, generateMetadata = true } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'URLs array is required'
      });
    }

    if (urls.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 50 URLs allowed per batch'
      });
    }

    const queuedAssets = [];

    for (const urlData of urls) {
      const { url, title, description, tags } = urlData;

      if (!url) continue;

      try {
        // Validate URL
        new URL(url);

        // Create asset record
        const asset = await Asset.create({
          filename: title || 'Batch Download',
          originalPath: '',
          sourceUrl: url,
          type: 'audio',
          metadata: {
            title: title || '',
            description: description || '',
            tags: tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim())) : [],
            uploadedBy: req.user.username,
            uploadedAt: new Date().toISOString(),
            sourceUrl: url
          },
          status: 'downloaded'
        });

        // Create download job
        await ProcessingJob.create({
          assetId: asset.id,
          type: 'download',
          status: 'pending'
        });

        // Create semantic enrichment job if requested
        if (generateMetadata) {
          await ProcessingJob.create({
            assetId: asset.id,
            type: 'semantic',
            status: 'pending'
          });
        }

        queuedAssets.push({
          id: asset.id,
          filename: asset.filename,
          sourceUrl: asset.sourceUrl,
          status: asset.status
        });

        logger.info(`🔗 Batch URL queued: ${url} by ${req.user.username}`);

      } catch (error) {
        logger.error(`Failed to queue URL ${url}:`, error);
      }
    }

    res.json({
      success: true,
      message: `${queuedAssets.length} URLs queued for download`,
      data: {
        assets: queuedAssets,
        failed: urls.length - queuedAssets.length
      }
    });

  } catch (error) {
    logger.error('Batch URL upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to queue URLs for download'
    });
  }
});

// Upload progress (for file uploads)
router.get('/progress/:assetId', async (req, res) => {
  try {
    const asset = await Asset.findByPk(req.params.assetId, {
      include: [{ model: ProcessingJob, as: 'jobs' }]
    });

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    const progress = {
      assetId: asset.id,
      filename: asset.filename,
      status: asset.status,
      processingProgress: asset.processingProgress,
      jobs: asset.jobs.map(job => ({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        errorMessage: job.errorMessage
      }))
    };

    res.json({
      success: true,
      data: progress
    });

  } catch (error) {
    logger.error('Upload progress error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upload progress'
    });
  }
});

// Delete uploaded asset
router.delete('/:assetId', async (req, res) => {
  try {
    const asset = await Asset.findByPk(req.params.assetId);

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }

    // Delete associated files
    if (asset.originalPath) {
      try {
        await fs.unlink(asset.originalPath);
      } catch (error) {
        logger.warn(`Failed to delete file ${asset.originalPath}:`, error);
      }
    }

    if (asset.processedPath) {
      try {
        await fs.unlink(asset.processedPath);
      } catch (error) {
        logger.warn(`Failed to delete processed file ${asset.processedPath}:`, error);
      }
    }

    // Delete database record (cascade will handle related records)
    await asset.destroy();

    logger.info(`🗑️ Asset deleted: ${asset.filename} by ${req.user.username}`);

    res.json({
      success: true,
      message: 'Asset deleted successfully'
    });

  } catch (error) {
    logger.error('Delete asset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete asset'
    });
  }
});

module.exports = router;
