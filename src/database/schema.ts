// Database schema for Wora Mobile
// This mirrors the desktop version's schema with additions for offline lyrics

export const SCHEMA_VERSION = 1;

// SQL for creating tables
export const DATABASE_SCHEMA = `
  -- Settings table
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    profilePicture TEXT,
    musicFolder TEXT,
    lastFmUsername TEXT,
    lastFmSessionKey TEXT,
    enableLastFm INTEGER DEFAULT 0,
    scrobbleThreshold INTEGER DEFAULT 50
  );

  -- Albums table
  CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    artist TEXT,
    year INTEGER,
    cover TEXT
  );

  -- Songs table
  CREATE TABLE IF NOT EXISTS songs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filePath TEXT UNIQUE,
    name TEXT,
    artist TEXT,
    duration INTEGER,
    albumId INTEGER,
    FOREIGN KEY (albumId) REFERENCES albums(id)
  );

  -- Playlists table
  CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    cover TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Playlist-Song relationship table
  CREATE TABLE IF NOT EXISTS playlistSongs (
    playlistId INTEGER NOT NULL,
    songId INTEGER NOT NULL,
    addedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlistId, songId),
    FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
  );

  -- Offline lyrics cache table
  CREATE TABLE IF NOT EXISTS playlistLyricsCache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlistId INTEGER NOT NULL,
    songId INTEGER NOT NULL,
    lyrics TEXT NOT NULL,  -- JSON string of LyricLine[]
    isSynced INTEGER DEFAULT 0,
    fetchedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE,
    UNIQUE (playlistId, songId)
  );

  -- Favorites table
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    songId INTEGER NOT NULL UNIQUE,
    addedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
  );

  -- Create indexes for better performance
  CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(albumId);
  CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
  CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist);
  CREATE INDEX IF NOT EXISTS idx_playlist_songs ON playlistSongs(playlistId, songId);
  CREATE INDEX IF NOT EXISTS idx_playlist_lyrics ON playlistLyricsCache(playlistId, songId);
`;

// Table names
export const TABLE_NAMES = {
  SETTINGS: 'settings',
  ALBUMS: 'albums',
  SONGS: 'songs',
  PLAYLISTS: 'playlists',
  PLAYLIST_SONGS: 'playlistSongs',
  PLAYLIST_LYRICS_CACHE: 'playlistLyricsCache',
  FAVORITES: 'favorites',
} as const;
