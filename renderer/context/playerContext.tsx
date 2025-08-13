import { shuffleArray } from "@/lib/helpers";
import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
  useCallback,
  useMemo,
} from "react";

export interface Song {
  id: number;
  name: string;
  artist: string;
  duration: number;
  filePath: string;
  album: {
    id: number;
    name: string;
    artist: string;
    cover: string;
  };
}

interface PlayerState {
  song: Song | null;
  queue: Song[];
  originalQueue: Song[];
  history: Song[];
  currentIndex: number;
  repeat: boolean;
  shuffle: boolean;
  isPlaying: boolean;
}

interface PlayerContextType extends PlayerState {
  setSong: (song: Song) => void;
  setQueueAndPlay: (
    songs: Song[],
    startIndex?: number,
    shuffle?: boolean,
  ) => void;
  nextSong: () => void;
  previousSong: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  playNext: (song: Song) => void;
  addToQueue: (song: Song) => void;
  jumpToSong: (songIndex: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
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
};

// Helper to safely access localStorage (only in browser)
const getStorageItem = (key: string): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem(key);
  }
  return null;
};

const setStorageItem = (key: string, value: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(key, value);
  }
};

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// Cache for song lookups to avoid repeated array searches
const songCache = new Map<number, Song>();

// Helper function to efficiently find song index by ID
function findSongIndexById(songs: Song[], id: number): number {
  for (let i = 0; i < songs.length; i++) {
    if (songs[i].id === id) return i;
  }
  return -1;
}

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [playerState, setPlayerState] = useState<PlayerState>(() => {
    // Initialize state with stored preferences - wrapped in a function for lazy initial state
    const savedRepeat = getStorageItem("repeat");
    const savedShuffle = getStorageItem("shuffle");

    return {
      ...initialPlayerState,
      repeat: savedRepeat ? JSON.parse(savedRepeat) : false,
      shuffle: savedShuffle ? JSON.parse(savedShuffle) : false,
    };
  });

  // Save preferences when they change but batch the saves to reduce writes
  useEffect(() => {
    // Only run in browser environment
    if (typeof window === "undefined") return;

    const savePreferences = () => {
      setStorageItem("repeat", JSON.stringify(playerState.repeat));
      setStorageItem("shuffle", JSON.stringify(playerState.shuffle));
    };

    const timeoutId = setTimeout(savePreferences, 300);
    return () => clearTimeout(timeoutId);
  }, [playerState.repeat, playerState.shuffle]);

  // Clear song cache when component unmounts
  useEffect(() => {
    return () => {
      songCache.clear();
    };
  }, []);

  const setQueueAndPlay = useCallback(
    (songs: Song[], startIndex: number = 0, shuffle: boolean = false) => {
      // Update cache with new songs for faster lookups
      songs.forEach((song) => {
        songCache.set(song.id, song);
      });

      // Ensure all songs have proper album data with covers preserved
      const processedSongs = songs.map((song) => {
        // Make sure album is defined
        const album = song.album || {
          id: null,
          name: "Unknown Album",
          artist: "Unknown Artist",
          cover: null,
        };

        return {
          ...song,
          album: {
            ...album,
            // Ensure cover path is properly formatted
            cover: album.cover || null,
          },
        };
      });

      let shuffledQueue = [...processedSongs];
      if (shuffle) {
        shuffledQueue = shuffleArray([...processedSongs]);
      }

      setPlayerState({
        ...initialPlayerState,
        queue: shuffledQueue,
        originalQueue: processedSongs,
        currentIndex: startIndex,
        song: shuffledQueue[startIndex],
        shuffle,
      });
    },
    [],
  );

  const nextSong = useCallback(() => {
    setPlayerState((prevState) => {
      const { currentIndex, queue, repeat, history } = prevState;

      if (repeat) {
        // Just replay current song without state change
        return { ...prevState };
      } else {
        const nextIndex = currentIndex + 1;
        if (nextIndex < queue.length) {
          // Add current song to history and move to next
          return {
            ...prevState,
            currentIndex: nextIndex,
            history:
              currentIndex >= 0 && queue[currentIndex]
                ? [...history, queue[currentIndex]]
                : history,
            song: queue[nextIndex],
          };
        }
        return prevState; // No more songs in queue
      }
    });
  }, []);

  const previousSong = useCallback(() => {
    setPlayerState((prevState) => {
      const { queue, repeat, history } = prevState;

      if (repeat) {
        // Just replay current song without state change
        return { ...prevState };
      } else if (history.length > 0) {
        // Get last song from history
        const previous = history[history.length - 1];
        // Find index efficiently using ID instead of indexOf (which is O(n))
        const prevIndex = findSongIndexById(queue, previous.id);

        return {
          ...prevState,
          history: history.slice(0, -1),
          song: previous,
          currentIndex: prevIndex >= 0 ? prevIndex : prevState.currentIndex,
        };
      }
      return prevState;
    });
  }, []);

  const toggleRepeat = useCallback(() => {
    setPlayerState((prevState) => ({
      ...prevState,
      repeat: !prevState.repeat,
      // Disable shuffle if turning on repeat
      shuffle: !prevState.repeat ? false : prevState.shuffle,
    }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setPlayerState((prevState) => {
      const newShuffle = !prevState.shuffle;
      const currentSong = prevState.song;

      if (!currentSong) return prevState;

      let newQueue;
      let newIndex;

      if (newShuffle) {
        // Create a new shuffled queue but keep current song as first
        const otherSongs = prevState.originalQueue.filter(
          (song) => song.id !== currentSong.id,
        );

        // Ensure all songs have complete album data including cover paths
        const songWithCompleteData = {
          ...currentSong,
          album: {
            ...currentSong.album,
            cover: currentSong.album?.cover || null,
          },
        };

        // Make sure each shuffled song has its complete album data
        const shuffledOtherSongs = shuffleArray([...otherSongs]).map(
          (song) => ({
            ...song,
            album: {
              ...song.album,
              cover: song.album?.cover || null,
            },
          }),
        );

        newQueue = [songWithCompleteData, ...shuffledOtherSongs];
        newIndex = 0; // Current song is now first
      } else {
        // Restore original queue with complete album data
        newQueue = prevState.originalQueue.map((song) => ({
          ...song,
          album: {
            ...song.album,
            cover: song.album?.cover || null,
          },
        }));

        // Find index efficiently using ID
        newIndex = findSongIndexById(newQueue, currentSong.id);
        if (newIndex < 0) newIndex = 0;
      }

      return {
        ...prevState,
        shuffle: newShuffle,
        queue: newQueue,
        currentIndex: newIndex,
        // Disable repeat if enabling shuffle
        repeat: newShuffle ? false : prevState.repeat,
      };
    });
  }, []);

  const playNext = useCallback((song: Song) => {
    // Add to cache for faster lookups
    songCache.set(song.id, song);

    // Ensure song has complete album data
    const songWithCompleteData = {
      ...song,
      album: {
        ...song.album,
        cover: song.album?.cover || null,
      },
    };

    setPlayerState((prevState) => {
      const { currentIndex, queue, originalQueue } = prevState;
      const insertIndex = currentIndex + 1;

      // Insert efficiently without creating unnecessary copies
      const newQueue = [
        ...queue.slice(0, insertIndex),
        songWithCompleteData,
        ...queue.slice(insertIndex),
      ];

      const originalInsertIndex =
        findSongIndexById(
          originalQueue,
          currentIndex >= 0 && currentIndex < queue.length
            ? queue[currentIndex].id
            : -1,
        ) + 1;

      const newOriginalQueue = [
        ...originalQueue.slice(0, originalInsertIndex),
        songWithCompleteData,
        ...originalQueue.slice(originalInsertIndex),
      ];

      return {
        ...prevState,
        queue: newQueue,
        originalQueue: newOriginalQueue,
      };
    });
  }, []);

  const addToQueue = useCallback((song: Song) => {
    // Add to cache for faster lookups
    songCache.set(song.id, song);

    // Ensure song has complete album data
    const songWithCompleteData = {
      ...song,
      album: {
        ...song.album,
        cover: song.album?.cover || null,
      },
    };

    setPlayerState((prevState) => ({
      ...prevState,
      queue: [...prevState.queue, songWithCompleteData],
      originalQueue: [...prevState.originalQueue, songWithCompleteData],
    }));
  }, []);

  const jumpToSong = useCallback((songIndex: number) => {
    setPlayerState((prevState) => {
      const { queue, currentIndex, song: currentSong, history } = prevState;

      if (songIndex < 0 || songIndex >= queue.length) {
        return prevState; // Invalid index
      }

      // Add current song to history if we have one and we're jumping to a different song
      const newHistory = currentSong && currentIndex !== songIndex
        ? [...history, currentSong]
        : history;

      return {
        ...prevState,
        currentIndex: songIndex,
        song: queue[songIndex],
        history: newHistory,
      };
    });
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<PlayerContextType>(
    () => ({
      ...playerState,
      setSong: (song: Song) => {
        songCache.set(song.id, song);

        // Ensure song has complete album data
        const songWithCompleteData = {
          ...song,
          album: {
            ...song.album,
            cover: song.album?.cover || null,
          },
        };

        setPlayerState((prev) => ({ ...prev, song: songWithCompleteData }));
      },
      setQueueAndPlay,
      nextSong,
      previousSong,
      toggleRepeat,
      toggleShuffle,
      playNext,
      addToQueue,
      jumpToSong,
      setIsPlaying: (isPlaying: boolean) => {
        setPlayerState((prev) => ({ ...prev, isPlaying }));
      },
    }),
    [
      playerState,
      setQueueAndPlay,
      nextSong,
      previousSong,
      toggleRepeat,
      toggleShuffle,
      playNext,
      addToQueue,
      jumpToSong,
    ],
  );

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = (): PlayerContextType => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
};
