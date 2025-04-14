// Last.fm Client for Electron - uses IPC to securely communicate with the backend API

// Types
interface Song {
  id?: number;
  name: string;
  artist: string;
  album?: {
    id?: number;
    name: string;
    artist?: string;
    cover?: string;
  };
  duration?: number;
}

// Cache interface
interface LastFmUserCache {
  user: any;
  username: string;
  sessionKey: string;
  timestamp: number;
  expiry: number;
}

// Internal state
let sessionKey: string | null = null;
let username: string | null = null;
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Simplified logging with log levels
const logLastFm = (
  message: string,
  data?: any,
  level: "info" | "error" | "warn" = "info",
) => {
  // Only log to console in development
  const isDev = process.env.NODE_ENV !== "production";

  // Format the message
  const formattedMessage = `[Last.fm] ${message}`;

  // Log to console in development
  if (isDev) {
    switch (level) {
      case "error":
        console.error(formattedMessage, data || "");
        break;
      case "warn":
        console.warn(formattedMessage, data || "");
        break;
      default:
        console.log(formattedMessage, data || "");
    }
  }

  // Always send to main process for file logging in production
  if (window.ipc && window.ipc.send) {
    try {
      window.ipc.send("lastfm:log", {
        level,
        message: data
          ? `${formattedMessage}: ${typeof data === "object" ? JSON.stringify(data) : data}`
          : formattedMessage,
      });
    } catch (err) {
      // Only log failed IPC in development
      if (isDev) console.error("Failed to send log to main process", err);
    }
  }
};

/**
 * Store user info in cache
 */
const cacheUserInfo = (user: any): void => {
  if (!username || !sessionKey || !user) return;

  try {
    const cacheData: LastFmUserCache = {
      user,
      username: username,
      sessionKey: sessionKey,
      timestamp: Date.now(),
      expiry: Date.now() + CACHE_EXPIRY_MS,
    };

    localStorage.setItem("lastfm_user_cache", JSON.stringify(cacheData));
    logLastFm("User info cached successfully");
  } catch (error) {
    // Silent fail - caching is non-critical
    logLastFm("Failed to cache user info", error, "warn");
  }
};

/**
 * Get cached user info
 */
const getCachedUserInfo = (): any | null => {
  try {
    const cacheJson = localStorage.getItem("lastfm_user_cache");
    if (!cacheJson) return null;

    const cache: LastFmUserCache = JSON.parse(cacheJson);

    // Check if cache is expired or belongs to a different user/session
    if (
      cache.expiry < Date.now() ||
      cache.username !== username ||
      cache.sessionKey !== sessionKey
    ) {
      localStorage.removeItem("lastfm_user_cache");
      return null;
    }

    logLastFm("Using cached user info");
    return cache.user;
  } catch (error) {
    // If any error occurs reading cache, ignore and return null
    localStorage.removeItem("lastfm_user_cache");
    return null;
  }
};

/**
 * Clear the user info cache
 */
const clearUserCache = (): void => {
  try {
    localStorage.removeItem("lastfm_user_cache");
  } catch (error) {
    // Silent fail
  }
};

/**
 * Initialize Last.fm with username and password
 */
export const initializeLastFM = async (
  lastfmUsername: string,
  password: string,
): Promise<boolean> => {
  try {
    const response = await window.ipc.invoke(
      "lastfm:authenticate",
      lastfmUsername,
      password,
    );

    if (response.success && response.session) {
      sessionKey = response.session.key;
      username = response.session.name;
      logLastFm(`Authentication successful`);
      return true;
    } else {
      logLastFm("Authentication failed", response.error, "error");
      return false;
    }
  } catch (error) {
    logLastFm("Error initializing", error, "error");
    return false;
  }
};

/**
 * Initialize Last.fm with existing session key
 */
export const initializeLastFMWithSession = (
  key: string,
  user: string,
): void => {
  sessionKey = key;
  username = user;
};

/**
 * Check if Last.fm is authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!sessionKey;
};

/**
 * Get the current session key
 */
export const getSessionKey = (): string | null => {
  return sessionKey;
};

/**
 * Clear the Last.fm session
 */
export const logout = (): void => {
  sessionKey = null;
  username = null;
  clearUserCache();
};

/**
 * Update Now Playing status on Last.fm
 */
export const updateNowPlaying = async (song: Song): Promise<boolean> => {
  if (!sessionKey) {
    return false;
  }

  try {
    const response = await window.ipc.invoke("lastfm:updateNowPlaying", {
      sessionKey,
      artist: song.artist,
      track: song.name,
      album: song.album?.name,
      duration: song.duration
        ? Math.floor(song.duration).toString()
        : undefined,
    });

    if (!response.success) {
      logLastFm("Failed to update now playing", response.error, "warn");
    }
    return response.success;
  } catch (error) {
    logLastFm("Error updating now playing", error, "error");
    return false;
  }
};

/**
 * Scrobble a track to Last.fm
 */
export const scrobbleTrack = async (song: Song): Promise<boolean> => {
  if (!sessionKey) {
    return false;
  }

  try {
    const response = await window.ipc.invoke("lastfm:scrobbleTrack", {
      sessionKey,
      artist: song.artist,
      track: song.name,
      album: song.album?.name,
      timestamp: Math.floor(Date.now() / 1000).toString(),
      duration: song.duration
        ? Math.floor(song.duration).toString()
        : undefined,
    });

    if (!response.success) {
      logLastFm("Failed to scrobble track", response.error, "warn");
    }
    return response.success;
  } catch (error) {
    logLastFm("Error scrobbling track", error, "error");
    return false;
  }
};

/**
 * Get user information from Last.fm
 */
export const getUserInfo = async (): Promise<any> => {
  if (!username || !sessionKey) {
    return null;
  }

  // First, try to get user info from cache
  const cachedUserInfo = getCachedUserInfo();
  if (cachedUserInfo) {
    return cachedUserInfo;
  }

  // If cache miss or expired, fetch from API
  try {
    const response = await window.ipc.invoke(
      "lastfm:getUserInfo",
      username,
      sessionKey,
    );

    if (response.success) {
      // Cache the successful response for future use
      cacheUserInfo(response.user);
      return response.user;
    } else {
      logLastFm("Failed to get user info", response.error, "warn");
      return null;
    }
  } catch (error) {
    logLastFm("Error getting user info", error, "error");
    return null;
  }
};

/**
 * Get track information from Last.fm
 */
export const getTrackInfo = async (
  artist: string,
  track: string,
): Promise<any> => {
  try {
    const response = await window.ipc.invoke(
      "lastfm:getTrackInfo",
      artist,
      track,
      username,
    );

    if (response.success) {
      return response.track;
    }
    return null;
  } catch (error) {
    logLastFm("Error getting track info", error, "error");
    return null;
  }
};

/**
 * Love a track on Last.fm
 */
export const loveTrack = async (
  artist: string,
  track: string,
): Promise<boolean> => {
  if (!sessionKey) return false;

  try {
    const response = await window.ipc.invoke("lastfm:loveTrack", {
      sessionKey,
      artist,
      track,
      love: true,
    });

    return response.success;
  } catch (error) {
    logLastFm("Error loving track", error, "error");
    return false;
  }
};

/**
 * Unlove a track on Last.fm
 */
export const unloveTrack = async (
  artist: string,
  track: string,
): Promise<boolean> => {
  if (!sessionKey) return false;

  try {
    const response = await window.ipc.invoke("lastfm:loveTrack", {
      sessionKey,
      artist,
      track,
      love: false,
    });

    return response.success;
  } catch (error) {
    logLastFm("Error unloving track", error, "error");
    return false;
  }
};

/**
 * Check if a track is loved by the user
 */
export const isTrackLoved = async (
  artist: string,
  track: string,
): Promise<boolean> => {
  try {
    const trackInfo = await getTrackInfo(artist, track);
    return trackInfo && trackInfo.userloved === "1";
  } catch (error) {
    logLastFm("Error checking if track is loved", error, "error");
    return false;
  }
};
