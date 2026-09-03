import axios from 'axios';
import { LyricLine } from '../types';
import {
  savePlaylistLyrics,
  getCachedLyrics,
  getAllCachedLyricsForPlaylist,
  deleteCachedLyrics,
  clearPlaylistLyricsCache,
} from '../database';

/**
 * Fetch lyrics from LRCLIB API
 */
export const fetchLyricsFromAPI = async (
  query: string,
  duration: number
): Promise<string | null> => {
  try {
    const response = await axios.get('https://lrclib.net/api/search', {
      params: { q: query },
      timeout: 10000,
    });

    const songs = response.data;

    // Filter songs that match duration (+/- 5 seconds) and have lyrics
    const matchedSongs = songs.filter(
      (song: any) =>
        Math.abs(song.duration - duration) <= 5 &&
        (song.syncedLyrics !== null || song.plainLyrics !== null)
    );

    if (matchedSongs.length === 0) {
      return null;
    }

    // Prefer synced lyrics
    matchedSongs.sort((a: any, b: any) => {
      if (a.syncedLyrics && !b.syncedLyrics) {
        return -1;
      } else if (!a.syncedLyrics && b.syncedLyrics) {
        return 1;
      }
      return 0;
    });

    // Return synced lyrics if available, otherwise plain lyrics
    if (matchedSongs[0].syncedLyrics) {
      return matchedSongs[0].syncedLyrics;
    } else if (matchedSongs[0].plainLyrics) {
      return matchedSongs[0].plainLyrics;
    }

    return null;
  } catch (error) {
    console.error('Error fetching lyrics from API:', error);
    return null;
  }
};

/**
 * Parse lyrics string into LyricLine array
 */
export const parseLyrics = (lyrics: string): LyricLine[] => {
  return lyrics
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => {
      // Match synced lyrics format: [00:00.00] Lyric text
      const match = line.match(/^\[(\d{2}):(\d{2}\.\d{2})\] (.*)$/);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseFloat(match[2]);
        const time = minutes * 60 + seconds - 1; // Subtract 1 second for sync
        let text = match[3].trim();
        if (text === '') {
          text = '...';
        }
        return { time, text };
      }
      return null;
    })
    .filter(line => line !== null) as LyricLine[];
};

/**
 * Check if lyrics string is synced (has timestamps)
 */
export const isSyncedLyrics = (lyrics: string): boolean => {
  return /\\[\\d{2}:\\d{2}\\.\\d{2}\\]/.test(lyrics);
};

/**
 * Parse plain lyrics (without timestamps) into LyricLine array
 */
export const parsePlainLyrics = (lyrics: string): LyricLine[] => {
  return lyrics
    .split('\n')
    .filter(line => line.trim() !== '')
    .map((line, index) => ({
      time: index * 5, // Arbitrary time spacing for unsynced lyrics
      text: line.trim(),
    }));
};

/**
 * Get lyrics for a song, either from cache or API
 */
export const getLyrics = async (
  songName: string,
  artist: string,
  duration: number,
  songId: number,
  playlistId?: number
): Promise<{ lyrics: LyricLine[]; isSynced: boolean; isCached: boolean }> => {
  // Try to get from cache first if playlistId is provided
  if (playlistId) {
    const cachedLyrics = await getCachedLyrics(playlistId, songId);
    if (cachedLyrics) {
      return { lyrics: cachedLyrics, isSynced: true, isCached: true };
    }
  }

  // Fetch from API
  const query = `${songName} ${artist}`;
  const rawLyrics = await fetchLyricsFromAPI(query, duration);

  if (rawLyrics) {
    const isSynced = isSyncedLyrics(rawLyrics);
    const lyrics = isSynced ? parseLyrics(rawLyrics) : parsePlainLyrics(rawLyrics);

    // Cache the lyrics if playlistId is provided
    if (playlistId) {
      await savePlaylistLyrics(playlistId, songId, lyrics, isSynced);
    }

    return { lyrics, isSynced, isCached: false };
  }

  // Return empty lyrics if not found
  return { lyrics: [], isSynced: false, isCached: false };
};

/**
 * Save lyrics for a song in a playlist (for offline viewing)
 */
export const saveLyricsForSong = async (
  playlistId: number,
  songId: number,
  lyrics: LyricLine[],
  isSynced: boolean = true
): Promise<void> => {
  await savePlaylistLyrics(playlistId, songId, lyrics, isSynced);
};

/**
 * Get all cached lyrics for a playlist
 */
export const getCachedLyricsForPlaylist = async (
  playlistId: number
): Promise<Map<number, LyricLine[]>> => {
  return await getAllCachedLyricsForPlaylist(playlistId);
};

/**
 * Check if lyrics are cached for a specific song in a playlist
 */
export const areLyricsCached = async (
  playlistId: number,
  songId: number
): Promise<boolean> => {
  const lyrics = await getCachedLyrics(playlistId, songId);
  return lyrics !== null;
};

/**
 * Remove cached lyrics for a song in a playlist
 */
export const removeCachedLyrics = async (
  playlistId: number,
  songId: number
): Promise<void> => {
  await deleteCachedLyrics(playlistId, songId);
};

/**
 * Clear all cached lyrics for a playlist
 */
export const clearLyricsCacheForPlaylist = async (
  playlistId: number
): Promise<void> => {
  await clearPlaylistLyricsCache(playlistId);
};

/**
 * Pre-cache lyrics for all songs in a playlist
 * This is useful when a user wants to view lyrics offline
 */
export const cachePlaylistLyrics = async (
  playlistId: number,
  songs: { id: number; name: string; artist: string; duration: number }[]
): Promise<{ success: number; failed: number }> => {
  let success = 0;
  let failed = 0;

  for (const song of songs) {
    try {
      const { lyrics, isSynced } = await getLyrics(
        song.name,
        song.artist,
        song.duration,
        song.id,
        playlistId
      );

      if (lyrics.length > 0) {
        await savePlaylistLyrics(playlistId, song.id, lyrics, isSynced);
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Error caching lyrics for song ${song.id}:`, error);
      failed++;
    }
  }

  return { success, failed };
};

/**
 * Get the current lyric line based on playback time
 */
export const getCurrentLyric = (
  lyrics: LyricLine[],
  currentTime: number
): LyricLine | null => {
  if (lyrics.length === 0) return null;

  // Find the last lyric line that has a time <= currentTime
  let currentLine = null;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (lyrics[i].time <= currentTime) {
      currentLine = lyrics[i];
      break;
    }
  }

  // If we're past all lyrics, return the last one
  if (!currentLine && lyrics.length > 0) {
    return lyrics[lyrics.length - 1];
  }

  return currentLine;
};

/**
 * Get the next lyric line based on playback time
 */
export const getNextLyric = (
  lyrics: LyricLine[],
  currentTime: number
): LyricLine | null => {
  if (lyrics.length === 0) return null;

  // Find the first lyric line that has a time > currentTime
  for (let i = 0; i < lyrics.length; i++) {
    if (lyrics[i].time > currentTime) {
      return lyrics[i];
    }
  }

  return null;
};
