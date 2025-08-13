// Mock data for /api/assets endpoints
const mockAssets = [
  {
    id: 1,
    filename: "epic_music_track.mp3",
    originalPath: "/uploads/epic_music_track.mp3",
    processedPath: "/processed/epic_music_track_processed.mp3",
    type: "audio",
    status: "uploaded",
    source: "youtube",
    fileSize: 8734567,
    metadata: {
      title: "Epic Cinematic Music Track",
      duration: 245,
      sourceUrl: "https://youtube.com/watch?v=epic123",
      genre: "cinematic",
      artist: "AI Generated",
      description: "Powerful orchestral music track perfect for trailers and dramatic scenes"
    },
    processingMetadata: {
      effects: ["reverb", "compression", "eq"],
      bitrate: 320,
      sampleRate: 44100
    },
    uploadMetadata: {
      platform: "youtube",
      videoId: "epic123abc",
      uploadedAt: "2025-08-10T14:30:00.000Z",
      views: 15420,
      likes: 892
    },
    createdAt: "2025-08-10T10:15:00.000Z",
    updatedAt: "2025-08-10T15:45:00.000Z",
    jobs: [
      {
        id: 1,
        type: "signal_morphology",
        status: "completed",
        progress: 100,
        startedAt: "2025-08-10T11:00:00.000Z",
        completedAt: "2025-08-10T11:15:00.000Z",
        result: {
          outputPath: "/processed/epic_music_track_processed.mp3",
          effects: ["reverb", "compression"]
        }
      }
    ],
    uploads: [
      {
        id: 1,
        platform: "youtube",
        status: "completed",
        externalId: "epic123abc",
        externalUrl: "https://youtube.com/watch?v=epic123abc",
        uploadedAt: "2025-08-10T14:30:00.000Z"
      }
    ]
  },
  {
    id: 2,
    filename: "ambient_soundscape.wav",
    originalPath: "/uploads/ambient_soundscape.wav",
    processedPath: null,
    type: "audio",
    status: "processing",
    source: "url",
    fileSize: 25643890,
    metadata: {
      title: "Ambient Forest Soundscape",
      duration: 600,
      sourceUrl: "https://example.com/sounds/forest.wav",
      genre: "ambient",
      description: "Relaxing forest sounds with birds and water"
    },
    processingMetadata: null,
    uploadMetadata: null,
    createdAt: "2025-08-11T08:20:00.000Z",
    updatedAt: "2025-08-11T09:00:00.000Z",
    jobs: [
      {
        id: 2,
        type: "signal_morphology",
        status: "running",
        progress: 65,
        startedAt: "2025-08-11T08:45:00.000Z",
        completedAt: null,
        result: null
      }
    ],
    uploads: []
  },
  {
    id: 3,
    filename: "podcast_episode_01.mp3",
    originalPath: "/uploads/podcast_episode_01.mp3",
    processedPath: "/processed/podcast_episode_01_enhanced.mp3",
    type: "audio",
    status: "processed",
    source: "youtube",
    fileSize: 45678901,
    metadata: {
      title: "Tech Talk Podcast Episode 1",
      duration: 3600,
      sourceUrl: "https://youtube.com/watch?v=podcast001",
      genre: "podcast",
      description: "Discussion about AI and machine learning trends"
    },
    processingMetadata: {
      effects: ["noise_reduction", "voice_enhancement", "normalization"],
      bitrate: 192,
      sampleRate: 44100
    },
    uploadMetadata: null,
    createdAt: "2025-08-09T16:30:00.000Z",
    updatedAt: "2025-08-09T17:45:00.000Z",
    jobs: [
      {
        id: 3,
        type: "semantic_enrichment",
        status: "completed",
        progress: 100,
        startedAt: "2025-08-09T17:00:00.000Z",
        completedAt: "2025-08-09T17:30:00.000Z",
        result: {
          outputPath: "/processed/podcast_episode_01_enhanced.mp3",
          transcription: "Welcome to our tech talk podcast..."
        }
      }
    ],
    uploads: []
  },
  {
    id: 4,
    filename: "game_music_loop.ogg",
    originalPath: "/uploads/game_music_loop.ogg",
    processedPath: null,
    type: "audio",
    status: "failed",
    source: "url",
    fileSize: 3456789,
    metadata: {
      title: "8-bit Game Background Music",
      duration: 120,
      sourceUrl: "https://gamedev.com/sounds/loop.ogg",
      genre: "chiptune",
      description: "Retro-style game music loop"
    },
    processingMetadata: null,
    uploadMetadata: null,
    createdAt: "2025-08-08T12:00:00.000Z",
    updatedAt: "2025-08-08T12:30:00.000Z",
    jobs: [
      {
        id: 4,
        type: "signal_morphology",
        status: "failed",
        progress: 0,
        startedAt: "2025-08-08T12:15:00.000Z",
        completedAt: "2025-08-08T12:16:00.000Z",
        result: null,
        errorMessage: "Unsupported audio format: OGG Vorbis not supported"
      }
    ],
    uploads: []
  },
  {
    id: 5,
    filename: "classical_piano.mp3",
    originalPath: "/uploads/classical_piano.mp3",
    processedPath: "/processed/classical_piano_remastered.mp3",
    type: "audio",
    status: "uploaded",
    source: "youtube",
    fileSize: 12345678,
    metadata: {
      title: "Chopin Nocturne in E-flat Major",
      duration: 285,
      sourceUrl: "https://youtube.com/watch?v=chopin123",
      genre: "classical",
      composer: "Frédéric Chopin",
      performer: "AI Piano",
      description: "Beautiful classical piano piece"
    },
    processingMetadata: {
      effects: ["remastering", "stereo_widening", "eq"],
      bitrate: 320,
      sampleRate: 48000
    },
    uploadMetadata: {
      platform: "youtube",
      videoId: "chopin123def",
      uploadedAt: "2025-08-07T20:00:00.000Z",
      views: 8750,
      likes: 445
    },
    createdAt: "2025-08-07T18:00:00.000Z",
    updatedAt: "2025-08-07T20:30:00.000Z",
    jobs: [
      {
        id: 5,
        type: "signal_morphology",
        status: "completed",
        progress: 100,
        startedAt: "2025-08-07T18:30:00.000Z",
        completedAt: "2025-08-07T19:15:00.000Z",
        result: {
          outputPath: "/processed/classical_piano_remastered.mp3",
          effects: ["remastering", "stereo_widening"]
        }
      }
    ],
    uploads: [
      {
        id: 2,
        platform: "youtube",
        status: "completed",
        externalId: "chopin123def",
        externalUrl: "https://youtube.com/watch?v=chopin123def",
        uploadedAt: "2025-08-07T20:00:00.000Z"
      }
    ]
  }
];

const mockAssetsPaginated = (page = 1, limit = 20, status = null, type = null) => {
  let filteredAssets = [...mockAssets];
  
  // Apply filters
  if (status) {
    filteredAssets = filteredAssets.filter(asset => asset.status === status);
  }
  if (type) {
    filteredAssets = filteredAssets.filter(asset => asset.type === type);
  }
  
  const total = filteredAssets.length;
  const offset = (page - 1) * limit;
  const paginatedAssets = filteredAssets.slice(offset, offset + limit);
  
  return {
    success: true,
    data: {
      assets: paginatedAssets,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    }
  };
};

const mockAssetById = (id) => {
  const asset = mockAssets.find(a => a.id === parseInt(id));
  if (!asset) {
    return {
      success: false,
      error: 'Asset not found'
    };
  }
  
  return {
    success: true,
    data: asset
  };
};

const mockDashboardStats = {
  success: true,
  data: {
    assets: {
      total: 5,
      downloaded: 1,
      processed: 1,
      uploaded: 2,
      failed: 1
    },
    uploads: {
      total: 2,
      thisWeek: 2
    },
    system: {
      cpu: 45.2,
      memory: 67.8,
      disk: 52.1,
      processes: 178,
      uptime: 86400
    },
    storage: {
      uploads: {
        fileCount: 5,
        totalSize: 95859825,
        sizeFormatted: "91.4 MB"
      },
      processed: {
        fileCount: 3,
        totalSize: 67834521,
        sizeFormatted: "64.7 MB"
      },
      downloads: {
        fileCount: 2,
        totalSize: 15728640,
        sizeFormatted: "15.0 MB"
      }
    },
    recentActivity: [
      {
        id: 1,
        type: "signal_morphology",
        status: "completed",
        assetName: "epic_music_track.mp3",
        createdAt: "2025-08-10T11:15:00.000Z"
      },
      {
        id: 2,
        type: "semantic_enrichment",
        status: "running",
        assetName: "ambient_soundscape.wav",
        createdAt: "2025-08-11T08:45:00.000Z"
      }
    ]
  }
};

module.exports = {
  mockAssets,
  mockAssetsPaginated,
  mockAssetsData: mockAssetsPaginated, // Alias for backward compatibility
  mockAssetById,
  mockDashboardStats
};
