// Song type representing a music track
export interface Song {
  id: number;
  filePath: string;
  name: string;
  artist: string;
  duration: number;
  albumId: number | null;
  album?: Album;
}

// Album type
export interface Album {
  id: number;
  name: string;
  artist: string;
  year: number | null;
  cover: string | null;
  songs?: Song[];
}

// Playlist type
export interface Playlist {
  id: number;
  name: string;
  description: string;
  cover: string;
  songs?: Song[];
  createdAt?: string;
}

// Playlist-Song relationship
export interface PlaylistSong {
  playlistId: number;
  songId: number;
}

// Lyrics type
export interface LyricLine {
  time: number;
  text: string;
}

// Offline lyrics cache for playlists
export interface PlaylistLyricsCache {
  id: number;
  playlistId: number;
  songId: number;
  lyrics: string; // JSON string of LyricLine[]
  isSynced: boolean;
  fetchedAt: string;
}

// Settings type
export interface Settings {
  id: number;
  name: string;
  profilePicture: string | null;
  musicFolder: string | null;
  lastFmUsername: string | null;
  lastFmSessionKey: string | null;
  enableLastFm: boolean;
  scrobbleThreshold: number;
}

// Player state
export interface PlayerState {
  song: Song | null;
  queue: Song[];
  originalQueue: Song[];
  history: Song[];
  currentIndex: number;
  repeat: boolean;
  shuffle: boolean;
  isPlaying: boolean;
  seek: number;
}

// Library statistics
export interface LibraryStats {
  totalSongs: number;
  totalAlbums: number;
  totalArtists: number;
  totalPlaylists: number;
  totalDuration: number;
}

// Search result
export interface SearchResult {
  type: 'song' | 'album' | 'artist' | 'playlist';
  id: number;
  name: string;
  artist?: string;
  cover?: string;
  duration?: number;
}

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  Library: undefined;
  Playlists: undefined;
  Settings: undefined;
  AlbumDetail: { albumId: number };
  ArtistDetail: { artistName: string };
  PlaylistDetail: { playlistId: number };
  SongDetail: { songId: number };
  Setup: undefined;
  Search: undefined;
  NowPlaying: undefined;
  Lyrics: { songId: number; playlistId?: number };
};

export type BottomTabParamList = {
  Home: undefined;
  Library: undefined;
  Playlists: undefined;
  Settings: undefined;
};
