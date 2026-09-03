import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';
import { parseFile } from 'music-metadata';
import { Album, Song } from '../types';
import {
  insertAlbum,
  insertSong,
  getAlbums,
  getSongs,
} from '../database';

// Audio file extensions
const AUDIO_EXTENSIONS = [
  '.mp3', '.mpeg', '.opus', '.ogg', '.oga', '.wav', '.aac', '.caf',
  '.m4a', '.m4b', '.mp4', '.weba', '.webm', '.dolby', '.flac'
];

// Image extensions for album covers
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp'];

// Cache for processed directories
const processedImagesCache = new Map<string, string | null>();

/**
 * Check if a file path is an audio file
 */
export const isAudioFile = (filePath: string): boolean => {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  return AUDIO_EXTENSIONS.includes(ext);
};

/**
 * Find the first image in a directory for album cover
 */
export const findFirstImageInDirectory = async (dir: string): Promise<string | null> => {
  if (processedImagesCache.has(dir)) {
    return processedImagesCache.get(dir);
  }

  try {
    const files = await FileSystem.readDirectoryAsync(dir);
    for (const file of files) {
      const filePath = `${dir}/${file}`;
      const stat = await FileSystem.getInfoAsync(filePath);
      
      if (stat.isFile) {
        const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          processedImagesCache.set(dir, filePath);
          return filePath;
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  processedImagesCache.set(dir, null);
  return null;
};

/**
 * Extract metadata from an audio file
 */
export const extractMetadata = async (filePath: string): Promise<{
  name: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: number | null;
  duration: number;
  cover: string | null;
} | null> => {
  try {
    const metadata = await parseFile(filePath, {
      skipPostHeaders: true,
      skipCovers: false,
    });

    const common = metadata.common || {};
    const format = metadata.format || {};

    return {
      name: common.title || 'Unknown Title',
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      albumArtist: common.albumartist || common.artist || 'Unknown Artist',
      year: common.year || null,
      duration: Math.floor(format.duration || 0),
      cover: null, // We'll handle covers separately
    };
  } catch (error) {
    console.error('Error parsing metadata:', error);
    return null;
  }
};

/**
 * Scan a directory recursively for audio files
 */
export const scanDirectory = async (
  dir: string,
  batchSize: number = 50
): Promise<{ songs: Song[]; albums: Album[] }> => {
  const songs: Song[] = [];
  const albums: Album[] = [];
  const albumMap = new Map<string, Album>();

  try {
    const files = await FileSystem.readDirectoryAsync(dir);
    
    for (const file of files) {
      const filePath = `${dir}/${file}`;
      const stat = await FileSystem.getInfoAsync(filePath);

      if (stat.isDirectory) {
        // Recursively scan subdirectories
        const { songs: subSongs, albums: subAlbums } = await scanDirectory(
          filePath,
          batchSize
        );
        songs.push(...subSongs);
        subAlbums.forEach(album => {
          if (!albumMap.has(`${album.name}-${album.artist}`)) {
            albumMap.set(`${album.name}-${album.artist}`, album);
            albums.push(album);
          }
        });
      } else if (isAudioFile(filePath)) {
        // Process audio file
        const metadata = await extractMetadata(filePath);
        
        if (metadata) {
          // Create album key
          const albumKey = `${metadata.album}-${metadata.albumArtist}`;
          
          // Get or create album
          let album: Album;
          if (albumMap.has(albumKey)) {
            album = albumMap.get(albumKey)!;
          } else {
            // Look for cover in directory
            const cover = await findFirstImageInDirectory(dir);
            
            album = {
              name: metadata.album,
              artist: metadata.albumArtist,
              year: metadata.year,
              cover,
            };
            albumMap.set(albumKey, album);
            albums.push(album);
          }

          // Create song
          const song: Omit<Song, 'id'> = {
            filePath,
            name: metadata.name,
            artist: metadata.artist,
            duration: metadata.duration,
            albumId: null, // Will be set after album is inserted
          };
          songs.push(song as Song);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dir}:`, error);
  }

  return { songs, albums };
};

/**
 * Initialize the library by scanning the music folder
 */
export const initializeLibrary = async (musicFolder: string): Promise<void> => {
  console.log('Starting library initialization...');
  
  // Clear cache
  processedImagesCache.clear();

  // Scan for audio files
  const { songs, albums } = await scanDirectory(musicFolder);
  
  console.log(`Found ${albums.length} albums and ${songs.length} songs`);

  // Insert albums first
  for (const album of albums) {
    try {
      await insertAlbum(album);
    } catch (error) {
      console.error('Error inserting album:', error);
    }
  }

  // Get all albums to map names to IDs
  const allAlbums = await getAlbums(1, 10000);
  const albumNameMap = new Map<string, number>();
  allAlbums.forEach(album => {
    albumNameMap.set(`${album.name}-${album.artist}`, album.id);
  });

  // Insert songs with album IDs
  for (const song of songs) {
    try {
      const albumKey = `${song.name}-${song.artist}`;
      const albumId = albumNameMap.get(albumKey) || null;
      
      await insertSong({ ...song, albumId });
    } catch (error) {
      console.error('Error inserting song:', error);
    }
  }

  console.log('Library initialization complete');
};

/**
 * Request storage permissions and get music folder
 */
export const requestStoragePermission = async (): Promise<string | null> => {
  if (Platform.OS === 'android') {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        // For Android, we'll use the external storage
        return FileSystem.documentDirectory;
      }
      return null;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return null;
    }
  } else if (Platform.OS === 'ios') {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        return FileSystem.documentDirectory;
      }
      return null;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return null;
    }
  }
  
  return FileSystem.documentDirectory;
};

/**
 * Rescan the library
 */
export const rescanLibrary = async (musicFolder: string): Promise<void> => {
  // Clear existing data
  // Note: In a real implementation, you might want to keep user data like playlists
  await initializeLibrary(musicFolder);
};

/**
 * Get all songs from device media library (alternative approach)
 */
export const getDeviceSongs = async (): Promise<Song[]> => {
  const songs: Song[] = [];
  
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        const media = await MediaLibrary.getAssetsAsync({
          mediaType: 'audio',
          limit: 10000,
        });

        for (const asset of media.assets) {
          songs.push({
            id: asset.id,
            filePath: asset.uri,
            name: asset.filename || 'Unknown',
            artist: asset.artist || 'Unknown Artist',
            duration: Math.floor(asset.duration / 1000) || 0,
            albumId: null,
          });
        }
      }
    } catch (error) {
      console.error('Error getting device songs:', error);
    }
  }
  
  return songs;
};
