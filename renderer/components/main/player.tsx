import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  IconArrowsShuffle2,
  IconBrandLastfm,
  IconCheck,
  IconClock,
  IconHeart,
  IconInfoCircle,
  IconList,
  IconListTree,
  IconMessage,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconPlus,
  IconRepeat,
  IconRipple,
  IconVinyl,
  IconVolume,
  IconVolumeOff,
  IconX,
} from "@tabler/icons-react";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Howl } from "howler";
import { FixedSizeList as List } from "react-window";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Lyrics from "@/components/main/lyrics";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  convertTime,
  isSyncedLyrics,
  parseLyrics,
  updateDiscordState,
  useAudioMetadata,
} from "@/lib/helpers";
import { Song, usePlayer } from "@/context/playerContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  initializeLastFMWithSession,
  scrobbleTrack,
  updateNowPlaying,
  isAuthenticated,
} from "@/lib/lastfm";
import AutoSizer from "react-virtualized-auto-sizer";
import ErrorBoundary from "@/components/ErrorBoundary";

const NotificationToast = ({ success, message }: { success: boolean; message: string }) => (
  <div className="flex w-fit items-center gap-2 text-xs">
    {success ? (
      <IconCheck className="text-green-400" stroke={2} size={16} />
    ) : (
      <IconX className="text-red-500" stroke={2} size={16} />
    )}
    {message}
  </div>
);

function getAlbumCoverUrl(song: Song | undefined): string {
  const cover = song?.album?.cover;
  if (!cover) return "/coverArt.png";
  if (cover.includes("://")) return cover;
  return `wora://${cover}`;
}

const QueuePanel = memo(({ queue, history, currentIndex, onSongSelect }: {
  queue: Song[];
  history: Song[];
  currentIndex: number;
  onSongSelect: (song: Song) => void;
}) => {
  const ITEM_HEIGHT = 80;

  const VirtualizedSongListItem = ({ index, style, data }: {
    index: number;
    style: React.CSSProperties;
    data: { songs: Song[]; onSongSelect: (song: Song) => void }
  }) => {
    const song = data.songs[index];

    return (
      <div style={style}>
        <li
          className="flex w-full items-center gap-4 overflow-hidden cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 rounded-lg p-2 transition-colors"
          onClick={() => data.onSongSelect(song)}
        >
          <div className="relative min-h-14 min-w-14 overflow-hidden rounded-lg shadow-lg">
            <Image
              alt={song.name || "Track"}
              src={getAlbumCoverUrl(song)}
              fill
              priority={false}
              className="object-cover"
            />
          </div>
          <div className="w-4/5 overflow-hidden">
            <p className="truncate text-sm font-medium">{song.name}</p>
            <p className="truncate opacity-50">{song.artist}</p>
          </div>
        </li>
      </div>
    );
  };

  const queueSongs = queue.slice(currentIndex + 1);
  const historySongs = [...history].reverse();

  return (
    <div className="wora-border relative h-full w-full rounded-2xl bg-white/70 backdrop-blur-xl dark:bg-black/70 pointer-events-auto">
      <div className="h-utility w-full max-w-3xl px-6 pt-6 pointer-events-auto">
        <Tabs
          defaultValue="queue"
          className="flex h-full w-full flex-col gap-4 mask-b-from-70% pointer-events-auto"
        >
          <TabsList className="w-full pointer-events-auto">
            <TabsTrigger value="queue" className="w-full gap-2 cursor-pointer pointer-events-auto">
              <IconListTree stroke={2} size={15} /> Queue
            </TabsTrigger>
            <TabsTrigger value="history" className="w-full gap-2 cursor-pointer pointer-events-auto">
              <IconClock stroke={2} size={15} /> History
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="queue"
            className="flex-1 min-h-0 pointer-events-auto"
          >
            {queueSongs.length > 0 ? (
              <ErrorBoundary>
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      height={height}
                      width={width}
                      itemCount={queueSongs.length}
                      itemSize={ITEM_HEIGHT}
                      itemData={{ songs: queueSongs, onSongSelect }}
                      className="no-scrollbar pointer-events-auto"
                    >
                      {VirtualizedSongListItem}
                    </List>
                  )}
                </AutoSizer>
              </ErrorBoundary>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm opacity-50 pointer-events-none">
                Queue is empty
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="history"
            className="flex-1 min-h-0 pointer-events-auto"
          >
            {historySongs.length > 0 ? (
              <ErrorBoundary>
                <AutoSizer>
                  {({ height, width }) => (
                    <List
                      height={height}
                      width={width}
                      itemCount={historySongs.length}
                      overscanCount={5}
                      itemSize={ITEM_HEIGHT}
                      itemData={{ songs: historySongs, onSongSelect }}
                      className="no-scrollbar pointer-events-auto"
                    >
                      {VirtualizedSongListItem}
                    </List>
                  )}
                </AutoSizer>
              </ErrorBoundary>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm opacity-50 pointer-events-none">
                No playback history
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export const Player = () => {
  // Player state
  const [seekPosition, setSeekPosition] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [previousVolume, setPreviousVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [currentLyric, setCurrentLyric] = useState(null);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isFavourite, setIsFavourite] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [isClient, setIsClient] = useState(false);
  const [lastFmSettings, setLastFmSettings] = useState({
    lastFmUsername: null,
    lastFmSessionKey: null,
    enableLastFm: false,
    scrobbleThreshold: 50,
  });
  const [lastFmStatus, setLastFmStatus] = useState({
    isScrobbled: false,
    isNowPlaying: false,
    scrobbleTimerStarted: false,
    error: null,
    lastFmActive: false,
  });
  const scrobbleTimeout = useRef<NodeJS.Timeout | null>(null);

  // References
  const soundRef = useRef<Howl | null>(null);
  const seekUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  const volumeSliderRef = useRef<HTMLDivElement | null>(null);

  // Get player context and song metadata
  const {
    song,
    nextSong,
    previousSong,
    queue,
    history,
    currentIndex,
    repeat,
    shuffle,
    toggleShuffle,
    toggleRepeat,
    jumpToSong,
    isPlaying,
    setIsPlaying,
  } = usePlayer();

  const { metadata, lyrics, favourite } = useAudioMetadata(song?.filePath);

  // Load Last.fm settings
  useEffect(() => {
    const loadLastFmSettings = async () => {
      try {
        const settings = await window.ipc.invoke("getLastFmSettings");
        setLastFmSettings(settings);

        // Initialize Last.fm with session key if available
        if (settings.lastFmSessionKey && settings.enableLastFm) {
          initializeLastFMWithSession(
            settings.lastFmSessionKey,
            settings.lastFmUsername || "",
          );
          setLastFmStatus((prev) => ({ ...prev, lastFmActive: true }));
          console.log("[Last.fm] Initialized with session key");
        } else {
          // Clear Last.fm status if disabled or no session
          setLastFmStatus((prev) => ({
            ...prev,
            lastFmActive: false,
            isScrobbled: false,
            isNowPlaying: false,
          }));
          console.log("[Last.fm] Disabled or no session key");
        }
      } catch (error) {
        console.error("[Last.fm] Error loading settings:", error);
      }
    };

    // Load settings initially
    loadLastFmSettings();

    // Set up listener for Last.fm settings changes
    const removeListener = window.ipc.on(
      "lastFmSettingsChanged",
      loadLastFmSettings,
    );

    return () => {
      removeListener();
    };
  }, []);

  // Reset scrobble status when song changes
  useEffect(() => {
    setLastFmStatus({
      isScrobbled: false,
      isNowPlaying: false,
      scrobbleTimerStarted: false,
      error: null,
      lastFmActive: lastFmStatus.lastFmActive,
    });

    if (scrobbleTimeout.current) {
      clearInterval(scrobbleTimeout.current);
      scrobbleTimeout.current = null;
    }
  }, [song]);

  // Last.fm scrobble handler
  const handleScrobble = useCallback(() => {
    if (
      !song ||
      !lastFmSettings.enableLastFm ||
      lastFmStatus.isScrobbled ||
      !isAuthenticated()
    ) {
      // Skip scrobble checks without verbose logging
      return;
    }

    // Clear existing timer if any
    if (scrobbleTimeout.current) {
      clearInterval(scrobbleTimeout.current);
      scrobbleTimeout.current = null;
    }

    const scrobbleIfThresholdReached = () => {
      if (!soundRef.current || lastFmStatus.isScrobbled) return;

      const duration = soundRef.current.duration();
      const currentPosition = soundRef.current.seek();
      const playedPercentage = (currentPosition / duration) * 100;

      // Only log in development
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[Last.fm] Position: ${playedPercentage.toFixed(1)}%, threshold: ${lastFmSettings.scrobbleThreshold}%`,
        );
      }

      if (playedPercentage >= lastFmSettings.scrobbleThreshold) {
        // Clear the interval immediately to prevent multiple scrobbles
        if (scrobbleTimeout.current) {
          clearInterval(scrobbleTimeout.current);
          scrobbleTimeout.current = null;
        }

        // Set scrobbled status immediately to prevent race conditions
        setLastFmStatus((prev) => ({ ...prev, isScrobbled: true }));

        // Minimal logging for production, log to file only for important events
        try {
          window.ipc.send("lastfm:log", {
            level: "info",
            message: `Scrobbling track: ${song.artist} - ${song.name} (${playedPercentage.toFixed(1)}%)`,
          });
        } catch (err) {
          // Silent error in production
        }

        // Scrobble the track
        scrobbleTrack(song)
          .then((success) => {
            if (!success) {
              setLastFmStatus((prev) => ({
                ...prev,
                error: "Failed to scrobble track",
                isScrobbled: false, // Reset scrobbled state to allow retrying
              }));
            }
          })
          .catch((err) => {
            // Log only the error message, not the entire error object
            try {
              window.ipc.send("lastfm:log", {
                level: "error",
                message: `Scrobble error: ${err?.message || "Unknown error"}`,
              });
            } catch (logErr) {
              // Silent fail in production
            }

            setLastFmStatus((prev) => ({
              ...prev,
              error: "Error scrobbling track",
              isScrobbled: false, // Reset scrobbled state to allow retrying
            }));
          });
      }
    };

    // Set timer to check scrobble threshold
    const checkInterval = 2000; // Check every 2 seconds
    scrobbleTimeout.current = setInterval(
      scrobbleIfThresholdReached,
      checkInterval,
    );

    return () => {
      if (scrobbleTimeout.current) {
        clearInterval(scrobbleTimeout.current);
        scrobbleTimeout.current = null;
      }
    };
  }, [song, lastFmSettings, lastFmStatus.isScrobbled]);

  // Player control functions - Define handlePlayPause earlier to avoid reference error
  const handlePlayPause = useCallback(() => {
    if (!soundRef.current) return;

    if (soundRef.current.playing()) {
      soundRef.current.pause();
    } else {
      soundRef.current.play();
    }
  }, []);

  const handleSeek = useCallback((value: number[]) => {
    if (!soundRef.current) return;

    soundRef.current.seek(value[0]);
    setSeekPosition(value[0]);
  }, []);

  const handleVolume = useCallback((value: number[]) => {
    // Store previous volume before muting (only if not currently muted)
    if (!isMuted && value[0] > 0.01) {
      setPreviousVolume(value[0]);
    }

    setIsMuted(value[0] === 0);
    setVolume(value[0]);
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    if (!isMuted) {
      // Store current volume before muting
      if (volume > 0.01) {
        setPreviousVolume(volume);
      }

      setVolume(0);
      setIsMuted(true);

      // Directly apply mute to audio
      if (soundRef.current) {
        soundRef.current.mute(true);
      }
    } else {
      // Restore previous volume or default to 50%
      const restoreVolume = previousVolume > 0.05 ? previousVolume : 0.5;
      setVolume(restoreVolume);
      setPreviousVolume(restoreVolume); // Update previousVolume to the restored value
      setIsMuted(false);

      // Directly apply volume and unmute to audio to avoid desync
      if (soundRef.current) {
        soundRef.current.volume(restoreVolume);
        soundRef.current.mute(false);
      }
    }
  }, [isMuted, volume, previousVolume]);

  const handleVolumeWheel = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.05 : 0.05; // Scroll down decreases, scroll up increases
    const newVolume = Math.max(0, Math.min(1, Math.round((volume + delta) * 100) / 100));
    console.log(`Volume changed: ${newVolume}`);
    handleVolume([newVolume]);
  }, [volume, handleVolume]);

  const toggleFavourite = useCallback((id: number) => {
    if (!id) return;

    window.ipc.send("addToFavourites", id);
    setIsFavourite((prev) => !prev);
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle keyboard shortcuts if we're not focused on an input element
    if (event.target instanceof HTMLElement &&
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
      return;
    }

    // Spacebar for play/pause (prevent page scroll)
    if (event.code === 'Space') {
      event.preventDefault();
      handlePlayPause();
      return;
    }

    // Like/Dislike Song: Alt + Shift + B
    if (event.altKey && event.shiftKey && event.code === 'KeyB') {
      // No preventDefault needed for this combo
      if (song?.id) {
        toggleFavourite(song.id);
      }
      return;
    }

    // Shuffle: Alt + S (Mac) | Ctrl/Cmd + S (Windows)
    if (((event.altKey && navigator.platform.includes('Mac')) ||
      (event.ctrlKey && !navigator.platform.includes('Mac'))) &&
      event.code === 'KeyS') {
      event.preventDefault(); // Prevent browser save dialog
      toggleShuffle();
      return;
    }

    // Repeat: Alt + R (Mac) | Ctrl/Cmd + R (Windows)
    if (((event.altKey && navigator.platform.includes('Mac')) ||
      (event.ctrlKey && !navigator.platform.includes('Mac'))) &&
      event.code === 'KeyR') {
      event.preventDefault(); // Prevent browser refresh
      toggleRepeat();
      return;
    }

    // Mute/Unmute: M
    if (event.code === 'KeyM') {
      // No preventDefault needed for M key
      toggleMute();
      return;
    }

    // Go to Previous: Up Arrow
    if (event.code === 'ArrowUp') {
      event.preventDefault(); // Prevent page scroll
      previousSong();
      return;
    }

    // Go to Next: Down Arrow
    if (event.code === 'ArrowDown') {
      event.preventDefault(); // Prevent page scroll
      nextSong();
      return;
    }
  }, [handlePlayPause, song, toggleFavourite, toggleShuffle, toggleRepeat, toggleMute, previousSong, nextSong]);

  const handleLyricClick = useCallback((time: number) => {
    if (!soundRef.current) return;

    soundRef.current.seek(time);
    setSeekPosition(time);
  }, []);

  const toggleLyrics = useCallback(() => {
    setShowLyrics((prev) => !prev);
  }, []);

  const toggleQueue = useCallback(() => {
    setShowQueue((prev) => !prev);
  }, []);

  const addSongToPlaylist = useCallback(
    (playlistId: number, songId: number) => {
      window.ipc
        .invoke("addSongToPlaylist", { playlistId, songId })
        .then((response) => {
          toast(
            <NotificationToast
              success={response === true}
              message={
                response === true
                  ? "Song added to playlist"
                  : "Song already exists in playlist"
              }
            />,
          );
        })
        .catch(() => {
          toast(
            <NotificationToast
              success={false}
              message="Failed to add song to playlist"
            />,
          );
        });
    },
    [],
  );

  const handleSongSelect = useCallback((selectedSong: Song) => {
    // Find the song in the current queue and jump to it
    const songIndex = queue.findIndex(song => song.id === selectedSong.id);
    if (songIndex !== -1) {
      // Use the jumpToSong function which preserves history
      jumpToSong(songIndex);
    }
  }, [queue, jumpToSong]);

  // Enable client-side rendering
  useEffect(() => {
    setIsClient(true);

    // Load playlists once on component mount
    window.ipc
      .invoke("getAllPlaylists")
      .then(setPlaylists)
      .catch((err) => console.error("Failed to load playlists:", err));

    // Clean up on unmount
    return () => {
      if (seekUpdateInterval.current) {
        clearInterval(seekUpdateInterval.current);
      }

      if (scrobbleTimeout.current) {
        clearInterval(scrobbleTimeout.current);
      }
    };
  }, []);

  // Setup volume slider wheel event
  useEffect(() => {
    const volumeSlider = volumeSliderRef.current;
    if (!volumeSlider) return;

    volumeSlider.addEventListener('wheel', handleVolumeWheel, { passive: false });

    return () => {
      volumeSlider.removeEventListener('wheel', handleVolumeWheel);
    };
  }, [handleVolumeWheel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Update favorite status when song changes
  useEffect(() => {
    if (song) {
      setIsFavourite(favourite);
    }
  }, [song, favourite]);

  // Reset scrobble status when song changes
  useEffect(() => {
    setLastFmStatus({
      isScrobbled: false,
      isNowPlaying: false,
      scrobbleTimerStarted: false,
      error: null,
      lastFmActive: lastFmStatus.lastFmActive,
    });

    if (scrobbleTimeout.current) {
      clearInterval(scrobbleTimeout.current);
    }
  }, [song]);

  // Start scrobble timer when playing
  useEffect(() => {
    if (
      isPlaying &&
      song &&
      lastFmSettings.enableLastFm &&
      !lastFmStatus.scrobbleTimerStarted &&
      isAuthenticated()
    ) {
      // Send now playing update to Last.fm
      console.log("[Last.fm] Sending now playing update");
      updateNowPlaying(song)
        .then((success) => {
          setLastFmStatus((prev) => ({
            ...prev,
            isNowPlaying: success,
            scrobbleTimerStarted: true,
            error: success ? null : "Failed to update now playing",
          }));
          console.log("[Last.fm] Now playing update success:", success);
        })
        .catch((err) => {
          console.error("[Last.fm] Now playing error:", err);
          setLastFmStatus((prev) => ({
            ...prev,
            error: "Error updating now playing",
          }));
        });

      // Start scrobble timer
      handleScrobble();
    }
  }, [
    isPlaying,
    song,
    lastFmSettings,
    lastFmStatus.scrobbleTimerStarted,
    handleScrobble,
  ]);

  // Initialize or update audio when song changes
  useEffect(() => {
    // Clean up previous audio and intervals
    if (soundRef.current) {
      soundRef.current.unload();
    }

    if (seekUpdateInterval.current) {
      clearInterval(seekUpdateInterval.current);
    }

    // Reset seek position immediately when song changes
    setSeekPosition(0);

    // No song to play, exit early
    if (!song?.filePath) return;

    // Create new Howl instance
    const sound = new Howl({
      src: [`wora://${encodeURIComponent(song.filePath)}`],
      format: [song.filePath.split(".").pop()],
      html5: true,
      autoplay: true,
      preload: true,
      volume: isMuted ? 0 : volume,
      onload: () => {
        setSeekPosition(0);
        setIsPlaying(true);
        updateDiscordState(1, song);
        window.ipc.send("update-window", [true, song?.artist, song?.name]);
      },
      onloaderror: (error) => {
        console.error("Error loading audio:", error);
        setIsPlaying(false);
        toast(
          <NotificationToast success={false} message="Failed to load audio" />,
        );
      },
      onend: () => {
        setIsPlaying(false);
        window.ipc.send("update-window", [false, null, null]);
        if (!repeat) {
          nextSong();
        }
      },
      onplay: () => {
        setIsPlaying(true);
        window.ipc.send("update-window", [true, song?.artist, song?.name]);
      },
      onpause: () => {
        setIsPlaying(false);
        window.ipc.send("update-window", [false, false, false]);
      },
    });

    soundRef.current = sound;

    // Set up seek position updater
    seekUpdateInterval.current = setInterval(() => {
      if (sound.playing()) {
        setSeekPosition(sound.seek());
      }
    }, 100);

    // Clean up on unmount or when song changes
    return () => {
      sound.unload();
      if (seekUpdateInterval.current) {
        clearInterval(seekUpdateInterval.current);
      }
    };
  }, [song, nextSong]); // Removed volume and isMuted from dependencies

  // Handle lyrics updates
  useEffect(() => {
    if (!lyrics || !song || !isPlaying) return;

    // Only parse lyrics if they exist and are synced
    if (!isSyncedLyrics(lyrics)) return;

    const parsedLyrics = parseLyrics(lyrics);
    let lyricUpdateInterval: NodeJS.Timeout;

    const updateCurrentLyric = () => {
      if (!soundRef.current?.playing()) return;

      const currentSeek = soundRef.current.seek();
      const currentLyricLine = parsedLyrics.find((line, index) => {
        const nextLine = parsedLyrics[index + 1];
        return (
          currentSeek >= line.time && (!nextLine || currentSeek < nextLine.time)
        );
      });

      setCurrentLyric(currentLyricLine || null);
    };

    // Update lyrics less frequently than seek position (better performance)
    lyricUpdateInterval = setInterval(updateCurrentLyric, 500);

    return () => clearInterval(lyricUpdateInterval);
  }, [song, lyrics, isPlaying]);

  // Setup MediaSession API for media controls
  useEffect(() => {
    if (!song || !("mediaSession" in navigator)) return;

    const updateMediaSessionMetadata = async () => {
      if ("mediaSession" in navigator && song) {
        const toDataURL = (
          url: string,
          callback: (dataUrl: string) => void,
        ) => {
          const xhr = new XMLHttpRequest();
          xhr.onload = () => {
            const reader = new FileReader();
            reader.onloadend = () => callback(reader.result as string);
            reader.readAsDataURL(xhr.response);
          };
          xhr.open("GET", url);
          xhr.responseType = "blob";
          xhr.send();
        };

        const coverUrl = song.album?.cover
          ? song.album.cover.startsWith("/") || song.album.cover.includes("://")
            ? song.album.cover
            : `wora://${song.album.cover}`
          : "/coverArt.png";

        toDataURL(coverUrl, (dataUrl) => {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: song?.name || "Unknown Title",
            artist: song?.artist || "Unknown Artist",
            album: song?.album?.name || "Unknown Album",
            artwork: [{ src: dataUrl }],
          });

          // Set application name for Windows Media Controller
          if ("mediaSession" in navigator) {
            // @ts-ignore - applicationName is not in the official type definitions but works in Windows
            navigator.mediaSession.metadata.applicationName = "Wora";
          }

          navigator.mediaSession.setActionHandler("play", handlePlayPause);
          navigator.mediaSession.setActionHandler("pause", handlePlayPause);
          navigator.mediaSession.setActionHandler(
            "previoustrack",
            previousSong,
          );
          navigator.mediaSession.setActionHandler("nexttrack", nextSong);
          navigator.mediaSession.setActionHandler("seekbackward", () => {
            if (soundRef.current) {
              soundRef.current.seek(Math.max(0, soundRef.current.seek() - 10));
            }
          });
          navigator.mediaSession.setActionHandler("seekforward", () => {
            if (soundRef.current) {
              soundRef.current.seek(
                Math.min(
                  soundRef.current.duration(),
                  soundRef.current.seek() + 10,
                ),
              );
            }
          });
        });
      }
    };

    updateMediaSessionMetadata();

    const removeMediaControlListener = window.ipc.on(
      "media-control",
      (command) => {
        switch (command) {
          case "play-pause":
            handlePlayPause();
            break;
          case "previous":
            previousSong();
            break;
          case "next":
            nextSong();
            break;
          default:
            break;
        }
      },
    );

    return () => {
      removeMediaControlListener();
    };
  }, [song, previousSong, nextSong]);

  // Apply volume and mute settings when they change
  useEffect(() => {
    if (!soundRef.current) return;

    // When unmuting, set volume first, then unmute
    if (!isMuted) {
      soundRef.current.volume(volume);
      soundRef.current.mute(false);
    } else {
      soundRef.current.mute(true);
    }
  }, [volume, isMuted]);

  // Apply repeat setting when it changes
  useEffect(() => {
    if (soundRef.current) {
      soundRef.current.loop(repeat);
    }
  }, [repeat]);

  // Server-side rendering placeholder
  if (!isClient) {
    return (
      <div className="wora-border h-28 w-full overflow-hidden rounded-2xl p-6">
        <div className="relative flex h-full w-full items-center">
          {/* Empty placeholder to prevent hydration errors */}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="absolute top-0 right-0 w-full">
        {showLyrics && lyrics && (
          <Lyrics
            lyrics={parseLyrics(lyrics)}
            currentLyric={currentLyric}
            onLyricClick={handleLyricClick}
            isSyncedLyrics={isSyncedLyrics(lyrics)}
          />
        )}
      </div>

      <div className="!absolute top-0 right-0 w-96">
        {showQueue && <QueuePanel queue={queue} history={history} currentIndex={currentIndex} onSongSelect={handleSongSelect} />}
      </div>

      <div className="wora-border h-28 w-full overflow-hidden rounded-2xl p-6">
        <div className="relative flex h-full w-full items-center">
          <TooltipProvider>
            <div className="absolute left-0 flex w-1/4 items-center justify-start gap-4 overflow-hidden">
              {song ? (
                <ContextMenu>
                  <ContextMenuTrigger>
                    <Link
                      href={song.album?.id ? `/albums/${song.album.id}` : "#"}
                    >
                      <div className="relative min-h-17 min-w-17 overflow-hidden rounded-lg shadow-lg transition">
                        <Image
                          alt="Album Cover"
                          src={`wora://${song?.album.cover}`}
                          fill
                          priority={true}
                          className="object-cover object-center"
                        />
                      </div>
                    </Link>
                  </ContextMenuTrigger>

                  <ContextMenuContent className="w-64">
                    <Link href={`/albums/${song.album?.id}`}>
                      <ContextMenuItem className="flex items-center gap-2">
                        <IconVinyl stroke={2} size={14} />
                        Go to Album
                      </ContextMenuItem>
                    </Link>
                    <ContextMenuSub>
                      <ContextMenuSubTrigger className="flex items-center gap-2">
                        <IconPlus stroke={2} size={14} />
                        Add to Playlist
                      </ContextMenuSubTrigger>
                      <ContextMenuSubContent className="w-52">
                        {playlists.map((playlist) => (
                          <ContextMenuItem
                            key={playlist.id}
                            onClick={() =>
                              addSongToPlaylist(playlist.id, song.id)
                            }
                          >
                            <p className="w-full truncate">{playlist.name}</p>
                          </ContextMenuItem>
                        ))}
                      </ContextMenuSubContent>
                    </ContextMenuSub>
                  </ContextMenuContent>
                </ContextMenu>
              ) : (
                <div className="relative min-h-17 min-w-17 overflow-hidden rounded-lg shadow-lg">
                  <Image
                    alt="Album Cover"
                    src="/coverArt.png"
                    fill
                    priority={true}
                    className="object-cover"
                  />
                </div>
              )}

              <div className="w-full">
                <p className="truncate text-sm font-medium">
                  {song ? song.name : "Echoes of Emptiness"}
                </p>
                <Link
                  href={
                    song ? `/artists/${encodeURIComponent(song.artist)}` : "#"
                  }
                >
                  <p className="cursor-pointer truncate opacity-50 hover:underline hover:opacity-80">
                    {song ? song.artist : "The Void Ensemble"}
                  </p>
                </Link>
              </div>
            </div>

            <div className="absolute right-0 left-0 mx-auto flex h-full w-2/4 flex-col items-center justify-between gap-4">
              <div className="flex h-full w-full items-center justify-center gap-8">
                {metadata?.format?.lossless && (
                  <div className="flex">
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger>
                        <IconRipple
                          stroke={2}
                          className="w-3.5 cursor-pointer"
                        />
                      </TooltipTrigger>
                      <TooltipContent side="left" sideOffset={25}>
                        Lossless [{metadata.format.bitsPerSample}/
                        {(metadata.format.sampleRate / 1000).toFixed(1)}kHz]
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )}
                <Button
                  variant="ghost"
                  onClick={toggleShuffle}
                  className="relative opacity-100!"
                >
                  {!shuffle ? (
                    <IconArrowsShuffle2
                      stroke={2}
                      size={16}
                      className="wora-transition opacity-30! hover:opacity-100!"
                    />
                  ) : (
                    <div>
                      <IconArrowsShuffle2 stroke={2} size={16} />
                      <div className="absolute -top-2 right-0 left-0 mx-auto h-[1.5px] w-2/3 rounded-full bg-black dark:bg-white"></div>
                    </div>
                  )}
                </Button>

                <Button variant="ghost" onClick={previousSong}>
                  <IconPlayerSkipBack
                    stroke={2}
                    className="fill-black dark:fill-white"
                    size={15}
                  />
                </Button>

                <Button variant="ghost" onClick={handlePlayPause}>
                  {!isPlaying ? (
                    <IconPlayerPlay
                      stroke={2}
                      className="h-6 w-6 fill-black dark:fill-white"
                    />
                  ) : (
                    <IconPlayerPause
                      stroke={2}
                      className="h-6 w-6 fill-black dark:fill-white"
                    />
                  )}
                </Button>

                <Button variant="ghost" onClick={nextSong}>
                  <IconPlayerSkipForward
                    stroke={2}
                    className="h-4 w-4 fill-black dark:fill-white"
                  />
                </Button>

                <Button
                  variant="ghost"
                  onClick={toggleRepeat}
                  className="relative opacity-100!"
                >
                  {!repeat ? (
                    <IconRepeat
                      stroke={2}
                      size={15}
                      className="wora-transition opacity-30! hover:opacity-100!"
                    />
                  ) : (
                    <div>
                      <IconRepeat stroke={2} size={15} />
                      <div className="absolute -top-2 right-0 left-0 mx-auto h-[1.5px] w-2/3 rounded-full bg-black dark:bg-white"></div>
                    </div>
                  )}
                </Button>

                {lastFmSettings.enableLastFm &&
                  lastFmSettings.lastFmSessionKey &&
                  lastFmStatus.lastFmActive && (
                    <div className="absolute left-28">
                      <Tooltip delayDuration={0}>
                        <TooltipTrigger>
                          <IconBrandLastfm
                            stroke={2}
                            size={14}
                            className={`w-3.5 text-red-500 ${lastFmStatus.isScrobbled ? "" : lastFmStatus.isNowPlaying ? "animate-pulse" : "opacity-30"}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="left" sideOffset={25}>
                          {lastFmStatus.error ? (
                            <p className="text-red-500">
                              Error: {lastFmStatus.error}
                            </p>
                          ) : lastFmStatus.isScrobbled ? (
                            <p>Scrobbled to Last.fm</p>
                          ) : lastFmStatus.isNowPlaying ? (
                            <p>
                              Now playing on Last.fm
                              <br />
                              Will scrobble at{" "}
                              {lastFmSettings.scrobbleThreshold}%
                            </p>
                          ) : (
                            <p>
                              Will scrobble at{" "}
                              {lastFmSettings.scrobbleThreshold}%
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}

                <div className="flex">
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        className="opacity-100! flex justify-center items-center"
                        onClick={() => toggleFavourite(song?.id)}
                        disabled={!song}
                      >
                        <IconHeart
                          stroke={2}
                          className={`w-3.5 text-red-500 ${isFavourite ? "fill-red-500" : "fill-none"}`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right" sideOffset={25}>
                      <p>
                        {!isFavourite
                          ? "Add to Favorites"
                          : "Remove from Favorites"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="relative flex h-full w-96 items-center px-4">
                <p className="absolute -left-8">{convertTime(seekPosition)}</p>
                <Slider
                  value={[seekPosition]}
                  onValueChange={handleSeek}
                  max={soundRef.current?.duration() || 0}
                  step={0.01}
                />
                <p className="absolute -right-8">
                  {convertTime(soundRef.current?.duration() || 0)}
                </p>
              </div>
            </div>

            <div className="absolute right-0 flex w-1/4 items-center justify-end gap-10">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={toggleMute}
                  className="opacity-100!"
                >
                  {!isMuted ? (
                    <IconVolume
                      stroke={2}
                      size={17.5}
                      className="wora-transition opacity-30! hover:opacity-100!"
                    />
                  ) : (
                    <IconVolumeOff
                      stroke={2}
                      size={17.5}
                      className="wora-transition opacity-30! hover:opacity-100!"
                    />
                  )}
                </Button>
                <Slider
                  ref={volumeSliderRef}
                  onValueChange={handleVolume}
                  value={[volume]}
                  max={1}
                  step={0.01}
                  className="w-24"
                />
              </div>

              <div className="flex items-center gap-4">
                {lyrics ? (
                  <Button variant="ghost" onClick={toggleLyrics}>
                    <IconMessage stroke={2} size={15} />
                  </Button>
                ) : (
                  <IconMessage
                    className="cursor-not-allowed text-red-500 opacity-75"
                    stroke={2}
                    size={15}
                  />
                )}

                <Dialog>
                  <DialogTrigger
                    className={
                      song
                        ? "opacity-30 duration-500 hover:opacity-100 cursor-pointer"
                        : "cursor-not-allowed text-red-500 opacity-75"
                    }
                    disabled={!song}
                  >
                    <IconInfoCircle stroke={2} size={15} />
                  </DialogTrigger>

                  {song && (
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Track Information</DialogTitle>
                        <DialogDescription>
                          Details for your currently playing song
                        </DialogDescription>
                      </DialogHeader>

                      <div className="flex gap-4 overflow-hidden text-xs">
                        {/* Album cover */}
                        <div className="h-full">
                          <div className="relative h-36 w-36 overflow-hidden rounded-xl">
                            <Image
                              alt={song.name || "Album"}
                              src={`wora://${song?.album.cover}`}
                              fill
                              className="object-cover"
                              quality={25}
                            />
                          </div>
                        </div>

                        {/* Track details */}
                        <div className="flex h-full w-full flex-col gap-0.5">
                          <p className="mb-4 truncate">
                            → {metadata?.common?.title} [
                            {metadata?.format?.codec || "Unknown"}]
                          </p>

                          <p className="truncate">
                            <span className="opacity-50">Artist:</span>{" "}
                            {metadata?.common?.artist || "Unknown"}
                          </p>

                          <p className="truncate">
                            <span className="opacity-50">Album:</span>{" "}
                            {metadata?.common?.album || "Unknown"}
                          </p>

                          <p className="truncate">
                            <span className="opacity-50">Codec:</span>{" "}
                            {metadata?.format?.codec || "Unknown"}
                          </p>

                          <p className="truncate">
                            <span className="opacity-50">Sample:</span>{" "}
                            {metadata?.format?.lossless
                              ? `Lossless [${metadata.format.bitsPerSample}/${(metadata.format.sampleRate / 1000).toFixed(1)}kHz]`
                              : "Lossy Audio"}
                          </p>

                          <p className="truncate">
                            <span className="opacity-50">Duration:</span>{" "}
                            {convertTime(soundRef.current?.duration() || 0)}
                          </p>

                          <p className="truncate">
                            <span className="opacity-50">Genre:</span>{" "}
                            {metadata?.common?.genre?.[0] || "Unknown"}
                          </p>

                          {lastFmSettings.enableLastFm &&
                            lastFmStatus.lastFmActive && (
                              <p className="truncate">
                                <span className="opacity-50">Last.fm:</span>{" "}
                                {lastFmStatus.error ? (
                                  <span className="text-red-500">
                                    Error: {lastFmStatus.error}
                                  </span>
                                ) : lastFmStatus.isScrobbled ? (
                                  "Scrobbled"
                                ) : lastFmStatus.isNowPlaying ? (
                                  <>
                                    Now playing (will scrobble at{" "}
                                    {lastFmSettings.scrobbleThreshold}%)
                                  </>
                                ) : (
                                  <>
                                    Waiting to scrobble at{" "}
                                    {lastFmSettings.scrobbleThreshold}%
                                  </>
                                )}
                              </p>
                            )}
                        </div>
                      </div>
                    </DialogContent>
                  )}
                </Dialog>

                <Button variant="ghost" onClick={toggleQueue}>
                  <IconList stroke={2} size={15} />
                </Button>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export default Player;
