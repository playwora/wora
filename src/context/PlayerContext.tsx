import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Song, PlayerState, LyricLine } from '../types';
import { getCurrentLyric, getNextLyric } from '../lib/lyrics';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PlayerContextType extends PlayerState {
  setSong: (song: Song) => Promise<void>;
  setQueueAndPlay: (
    songs: Song[],
    startIndex?: number,
    shuffle?: boolean
  ) => Promise<void>;
  nextSong: () => Promise<void>;
  previousSong: () => Promise<void>;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  playNext: (song: Song) => Promise<void>;
  addToQueue: (song: Song) => void;
  jumpToSong: (songIndex: number) => Promise<void>;
  setIsPlaying: (isPlaying: boolean) => Promise<void>;
  seekTo: (time: number) => Promise<void>;
  getCurrentTime: () => Promise<number>;
  getCurrentLyric: (lyrics: LyricLine[]) => LyricLine | null;
  getNextLyric: (lyrics: LyricLine[]) => LyricLine | null;
}

const initialPlayerState: PlayerState = {
  song: null,
  queue: [],
  originalQueue: [],
  history: [],
  currentIndex: 0,
  repeat: false,
  shuffle: false,
  isPlaying: false,
  seek: 0,
};

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// Cache for song lookups
const songCache = new Map<number, Song>();

// Helper function to find song index by ID
function findSongIndexById(songs: Song[], id: number): number {
  for (let i = 0; i < songs.length; i++) {
    if (songs[i].id === id) return i;
  }
  return -1;
}

// Helper to save preferences
const savePreferences = async (repeat: boolean, shuffle: boolean) => {
  try {
    await AsyncStorage.setItem('player_repeat', JSON.stringify(repeat));
    await AsyncStorage.setItem('player_shuffle', JSON.stringify(shuffle));
  } catch (error) {
    console.error('Error saving preferences:', error);
  }
};

// Helper to load preferences
const loadPreferences = async (): Promise<{ repeat: boolean; shuffle: boolean }> => {
  try {
    const repeat = await AsyncStorage.getItem('player_repeat');
    const shuffle = await AsyncStorage.getItem('player_shuffle');
    return {
      repeat: repeat ? JSON.parse(repeat) : false,
      shuffle: shuffle ? JSON.parse(shuffle) : false,
    };
  } catch (error) {
    console.error('Error loading preferences:', error);
    return { repeat: false, shuffle: false };
  }
};

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [playerState, setPlayerState] = useState<PlayerState>(initialPlayerState);
  const soundRef = useRef<Audio.Sound | null>(null);
  const playbackStatusRef = useRef<AVPlaybackStatus | null>(null);

  // Load saved preferences on mount
  useEffect(() => {
    const loadPrefs = async () => {
      const prefs = await loadPreferences();
      setPlayerState(prev => ({ ...prev, repeat: prefs.repeat, shuffle: prefs.shuffle }));
    };
    loadPrefs();

    // Cleanup on unmount
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      songCache.clear();
    };
  }, []);

  // Save preferences when they change
  useEffect(() => {
    savePreferences(playerState.repeat, playerState.shuffle);
  }, [playerState.repeat, playerState.shuffle]);

  // Setup audio mode
  useEffect(() => {
    const setupAudioMode = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInSilentModeIOS: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.error('Error setting up audio mode:', error);
      }
    };

    setupAudioMode();
  }, []);

  // Handle playback status updates
  useEffect(() => {
    if (!soundRef.current) return;

    const subscription = soundRef.current.setOnPlaybackStatusUpdate(
      (status: AVPlaybackStatus) => {
        playbackStatusRef.current = status;
        
        if (status.isLoaded) {
          setPlayerState(prev => ({
            ...prev,
            isPlaying: status.isPlaying,
            seek: status.positionMillis / 1000,
          }));

          // Handle song completion
          if (status.didJustFinish && !status.isLooping) {
            handleSongEnd();
          }
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, [playerState.queue, playerState.currentIndex, playerState.repeat]);

  const handleSongEnd = useCallback(async () => {
    if (playerState.repeat) {
      // Repeat current song
      await playCurrentSong();
    } else if (playerState.queue.length > 0) {
      // Play next song
      await nextSong();
    }
  }, [playerState.repeat, playerState.queue.length]);

  const playCurrentSong = useCallback(async () => {
    if (playerState.queue.length === 0 || playerState.currentIndex >= playerState.queue.length) {
      return;
    }

    const currentSong = playerState.queue[playerState.currentIndex];
    
    try {
      // Unload previous sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      // Load new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: currentSong.filePath },
        { shouldPlay: true, volume: 1.0 }
      );

      soundRef.current = sound;

      // Set the song in state
      setPlayerState(prev => ({
        ...prev,
        song: currentSong,
        isPlaying: true,
      }));

      // Setup playback status listener
      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        playbackStatusRef.current = status;
        if (status.isLoaded) {
          setPlayerState(prev => ({
            ...prev,
            isPlaying: status.isPlaying,
            seek: status.positionMillis / 1000,
          }));

          if (status.didJustFinish && !status.isLooping) {
            handleSongEnd();
          }
        }
      });

    } catch (error) {
      console.error('Error playing song:', error);
    }
  }, [playerState.queue, playerState.currentIndex, handleSongEnd]);

  const setSong = useCallback(async (song: Song) => {
    // Update cache
    songCache.set(song.id, song);

    setPlayerState(prev => ({
      ...prev,
      song,
      queue: [song],
      originalQueue: [song],
      currentIndex: 0,
    }));

    await playCurrentSong();
  }, [playCurrentSong]);

  const setQueueAndPlay = useCallback(async (
    songs: Song[],
    startIndex: number = 0,
    shuffle: boolean = false
  ) => {
    // Update cache
    songs.forEach(song => {
      songCache.set(song.id, song);
    });

    const queue = shuffle ? shuffleArray([...songs]) : [...songs];

    setPlayerState(prev => ({
      ...prev,
      queue,
      originalQueue: [...songs],
      currentIndex: startIndex,
      shuffle: prev.shuffle !== shuffle ? shuffle : prev.shuffle,
    }));

    await playCurrentSong();
  }, [playCurrentSong]);

  const nextSong = useCallback(async () => {
    if (playerState.queue.length === 0) return;

    let nextIndex = playerState.currentIndex + 1;

    if (playerState.shuffle) {
      // For shuffle, pick a random song from the original queue
      const originalQueue = playerState.originalQueue.length > 0 
        ? playerState.originalQueue 
        : playerState.queue;
      
      if (originalQueue.length > 1) {
        let newIndex;
        do {
          newIndex = Math.floor(Math.random() * originalQueue.length);
        } while (newIndex === playerState.currentIndex && originalQueue.length > 1);
        
        nextIndex = newIndex;
      }
    } else if (nextIndex >= playerState.queue.length) {
      nextIndex = 0; // Loop to beginning
    }

    setPlayerState(prev => ({
      ...prev,
      currentIndex: nextIndex,
      history: [...prev.history, prev.song].filter(Boolean) as Song[],
    }));

    await playCurrentSong();
  }, [playerState.queue, playerState.currentIndex, playerState.shuffle, playerState.originalQueue, playCurrentSong]);

  const previousSong = useCallback(async () => {
    if (playerState.history.length === 0) return;

    const previousSong = playerState.history[playerState.history.length - 1];
    const previousIndex = findSongIndexById(playerState.queue, previousSong.id);

    if (previousIndex !== -1) {
      setPlayerState(prev => ({
        ...prev,
        currentIndex: previousIndex,
        history: prev.history.slice(0, -1),
      }));

      await playCurrentSong();
    }
  }, [playerState.history, playerState.queue, playCurrentSong]);

  const toggleRepeat = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      repeat: !prev.repeat,
    }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setPlayerState(prev => ({
      ...prev,
      shuffle: !prev.shuffle,
    }));
  }, []);

  const playNext = useCallback(async (song: Song) => {
    // Add current song to history
    const newHistory = playerState.song ? [...playerState.history, playerState.song] : playerState.history;

    // Find the song in the queue
    const songIndex = findSongIndexById(playerState.queue, song.id);

    if (songIndex !== -1) {
      setPlayerState(prev => ({
        ...prev,
        currentIndex: songIndex,
        history: newHistory,
      }));

      await playCurrentSong();
    } else {
      // Song not in queue, add it and play
      await setSong(song);
    }
  }, [playerState.queue, playerState.song, playerState.history, playCurrentSong, setSong]);

  const addToQueue = useCallback((song: Song) => {
    // Update cache
    songCache.set(song.id, song);

    setPlayerState(prev => ({
      ...prev,
      queue: [...prev.queue, song],
      originalQueue: [...prev.originalQueue, song],
    }));
  }, []);

  const jumpToSong = useCallback(async (songIndex: number) => {
    if (songIndex < 0 || songIndex >= playerState.queue.length) return;

    setPlayerState(prev => ({
      ...prev,
      currentIndex: songIndex,
    }));

    await playCurrentSong();
  }, [playerState.queue.length, playCurrentSong]);

  const setIsPlaying = useCallback(async (isPlaying: boolean) => {
    if (soundRef.current) {
      if (isPlaying) {
        await soundRef.current.playAsync();
      } else {
        await soundRef.current.pauseAsync();
      }
    }

    setPlayerState(prev => ({
      ...prev,
      isPlaying,
    }));
  }, []);

  const seekTo = useCallback(async (time: number) => {
    if (soundRef.current) {
      await soundRef.current.setPositionAsync(time * 1000);
    }

    setPlayerState(prev => ({
      ...prev,
      seek: time,
    }));
  }, []);

  const getCurrentTime = useCallback(async (): Promise<number> => {
    if (soundRef.current) {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        return status.positionMillis / 1000;
      }
    }
    return playerState.seek;
  }, [playerState.seek]);

  const getCurrentLyric = useCallback((lyrics: LyricLine[]): LyricLine | null => {
    return getCurrentLyric(lyrics, playerState.seek);
  }, [playerState.seek]);

  const getNextLyric = useCallback((lyrics: LyricLine[]): LyricLine | null => {
    return getNextLyric(lyrics, playerState.seek);
  }, [playerState.seek]);

  const value: PlayerContextType = {
    ...playerState,
    setSong,
    setQueueAndPlay,
    nextSong,
    previousSong,
    toggleRepeat,
    toggleShuffle,
    playNext,
    addToQueue,
    jumpToSong,
    setIsPlaying,
    seekTo,
    getCurrentTime,
    getCurrentLyric,
    getNextLyric,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
};

// Helper function to shuffle array
export function shuffleArray(array: any[]): any[] {
  const newArray = array.slice();
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};

export default PlayerProvider;
