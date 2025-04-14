import { Song } from "@/context/playerContext";
import { API_BASE_URL } from "./apiConfig";

// Session information
let sessionKey: string | null = null;
let username: string | null = null;
let isLoggedIn: boolean = false;

// Base URL for API calls - use the apiConfig for proper URL resolution
const LASTFM_API_BASE = `${API_BASE_URL}/api/lastfm`;

// Debug logging
const enableDebug = true;
const logLastFm = (message: string, data?: any) => {
  if (enableDebug) {
    console.log(`[Last.fm Client] ${message}`, data || "");
  }
};

/**
 * Authenticate with Last.fm through our backend API
 * @param username Last.fm username
 * @param password Last.fm password
 */
export const initializeLastFM = async (
  user: string,
  password: string,
): Promise<boolean> => {
  try {
    logLastFm(`Authenticating user: ${user}`);

    const response = await fetch(`${LASTFM_API_BASE}/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: user, password }),
    });

    const data = await response.json();

    if (!data.success) {
      logLastFm("Authentication error:", data.error);
      return false;
    }

    // Store the session key
    sessionKey = data.session?.key;
    username = user;
    isLoggedIn = !!sessionKey;

    logLastFm(`Authentication successful for ${user}`, {
      sessionKeyLength: sessionKey ? sessionKey.length : 0,
    });

    return isLoggedIn;
  } catch (error) {
    logLastFm("Error initializing Last.fm:", error);
    return false;
  }
};

/**
 * Initialize Last.fm with an existing session key (from database)
 */
export const initializeLastFMWithSession = (
  existingSessionKey: string,
  existingUsername: string,
): void => {
  sessionKey = existingSessionKey;
  username = existingUsername;
  isLoggedIn = !!existingSessionKey;
  logLastFm(`Initialized with existing session for ${existingUsername}`, {
    isLoggedIn,
  });
};

/**
 * Get the current session key (for saving to database)
 */
export const getSessionKey = (): string | null => {
  return sessionKey;
};

/**
 * Get the current username
 */
export const getUsername = (): string | null => {
  return username;
};

/**
 * Check if user is logged in
 */
export const isAuthenticated = (): boolean => {
  return isLoggedIn;
};

/**
 * Logout from Last.fm
 */
export const logout = (): void => {
  sessionKey = null;
  username = null;
  isLoggedIn = false;
  logLastFm("User logged out");
};

/**
 * Update the "Now Playing" status on Last.fm
 * @param song The currently playing song
 */
export const updateNowPlaying = async (song: any): Promise<boolean> => {
  if (!sessionKey || !song) {
    logLastFm("Cannot update now playing - no session key or song", {
      hasSessionKey: !!sessionKey,
      hasSong: !!song,
    });
    return false;
  }

  try {
    logLastFm(`Updating now playing: "${song.artist} - ${song.name}"`);

    const payload = {
      sessionKey,
      artist: song.artist,
      track: song.name,
      album: song.album?.name,
      duration: song.duration
        ? Math.round(song.duration).toString()
        : undefined,
    };

    const response = await fetch(`${LASTFM_API_BASE}/now-playing`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.success) {
      logLastFm("Error updating now playing:", data.error);
      return false;
    }

    logLastFm("Now playing updated successfully");
    return true;
  } catch (error) {
    logLastFm("Error updating now playing status:", error);
    return false;
  }
};

/**
 * Scrobble a track to Last.fm
 * @param song The song to scrobble
 */
export const scrobbleTrack = async (song: any): Promise<boolean> => {
  if (!sessionKey || !song) {
    logLastFm("Cannot scrobble - no session key or song", {
      hasSessionKey: !!sessionKey,
      hasSong: !!song,
    });
    return false;
  }

  try {
    logLastFm(`Scrobbling track: "${song.artist} - ${song.name}"`);

    const timestamp = Math.floor(Date.now() / 1000);

    const payload = {
      sessionKey,
      artist: song.artist,
      track: song.name,
      album: song.album?.name,
      timestamp: timestamp.toString(),
      duration: song.duration
        ? Math.round(song.duration).toString()
        : undefined,
    };

    const response = await fetch(`${LASTFM_API_BASE}/scrobble`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!data.success) {
      logLastFm("Error scrobbling track:", data.error);
      return false;
    }

    logLastFm("Track scrobbled successfully");
    return true;
  } catch (error) {
    logLastFm("Error scrobbling track:", error);
    return false;
  }
};

/**
 * Get user info from LastFM
 */
export const getUserInfo = async (): Promise<any | null> => {
  if (!sessionKey || !username) {
    logLastFm("Cannot get user info - not authenticated");
    return null;
  }

  try {
    logLastFm(`Getting user info for: ${username}`);

    const url = new URL(`${LASTFM_API_BASE}/user-info`);
    url.searchParams.append("username", username);
    url.searchParams.append("sessionKey", sessionKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!data.success) {
      logLastFm("Error getting user info:", data.error);
      return null;
    }

    logLastFm("User info retrieved successfully");
    return data.user || null;
  } catch (error) {
    logLastFm("Failed to get user info:", error);
    return null;
  }
};

/**
 * Get track info from LastFM
 */
export const getTrackInfo = async (
  artist: string,
  track: string,
): Promise<any | null> => {
  try {
    const url = new URL(`${LASTFM_API_BASE}/track-info`);
    url.searchParams.append("artist", artist);
    url.searchParams.append("track", track);

    if (username) {
      url.searchParams.append("username", username);
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!data.success) {
      return null;
    }

    return data.track || null;
  } catch (error) {
    console.error("Failed to get track info:", error);
    return null;
  }
};

/**
 * Love a track on LastFM
 */
export const loveTrack = async (
  artist: string,
  track: string,
): Promise<boolean> => {
  if (!sessionKey) return false;

  try {
    const response = await fetch(`${LASTFM_API_BASE}/track-info`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionKey,
        artist,
        track,
        action: "love",
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error("Failed to love track:", error);
    return false;
  }
};

/**
 * Unlove a track on LastFM
 */
export const unloveTrack = async (
  artist: string,
  track: string,
): Promise<boolean> => {
  if (!sessionKey) return false;

  try {
    const response = await fetch(`${LASTFM_API_BASE}/track-info`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionKey,
        artist,
        track,
        action: "unlove",
      }),
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error("Failed to unlove track:", error);
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
  if (!sessionKey) return false;

  try {
    const info = await getTrackInfo(artist, track);
    return info?.userloved === "1";
  } catch (error) {
    console.error("Failed to check if track is loved:", error);
    return false;
  }
};
