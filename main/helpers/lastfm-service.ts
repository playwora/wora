import { ipcMain } from "electron";
import fetch from "node-fetch";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import * as electronLog from "electron-log";

const lastFmLogger = electronLog.create({ logId: "lastfm" });
lastFmLogger.transports.file.fileName = "lastfm.log";
lastFmLogger.transports.file.level = "info";

const logLastFm = (
  message: string,
  data?: any,
  level: "info" | "error" | "warn" = "info",
) => {
  const shouldLogToConsole = process.env.NODE_ENV !== "production";
  switch (level) {
    case "error":
      lastFmLogger.error(message, data);
      if (shouldLogToConsole) console.error(`[LastFm] ${message}`, data || "");
      break;
    case "warn":
      lastFmLogger.warn(message, data);
      if (shouldLogToConsole) console.warn(`[LastFm] ${message}`, data || "");
      break;
    default:
      lastFmLogger.info(message, data);
      if (shouldLogToConsole) console.log(`[LastFm] ${message}`, data || "");
  }
};

const API_URL = "https://ws.audioscrobbler.com/2.0/";

const apiCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;

const loadEnvVariables = () => {
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (!fs.existsSync(envPath)) return false;

    logLastFm(`Loading environment variables from ${envPath}`);
    const envContent = fs.readFileSync(envPath, "utf-8");

    envContent.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (
          value.length > 0 &&
          value.charAt(0) === '"' &&
          value.charAt(value.length - 1) === '"'
        ) {
          value = value.replace(/^"|"$/g, "");
        }
        process.env[key] = value;
      }
    });
    return true;
  } catch (error) {
    logLastFm("Error loading environment variables", error, "error");
    return false;
  }
};

if (process.env.NODE_ENV !== "production") {
  loadEnvVariables();
}

const DEV_API_KEY = process.env.LASTFM_API_KEY || "";
const DEV_API_SECRET = process.env.LASTFM_API_SECRET || "";

if (process.env.NODE_ENV !== "production") {
  if (!DEV_API_KEY || !DEV_API_SECRET) {
    logLastFm(
      "WARNING: Last.fm API credentials not found in environment variables",
      null,
      "warn",
    );
  }
}

const useBackend = process.env.NODE_ENV === "production" || 
                   process.env.USE_BACKEND === "true" ||
                   (!DEV_API_KEY || !DEV_API_SECRET);

// Get the backend URL based on environment
const getBackendUrl = (): string => {
  return process.env.NODE_ENV === "production"
    ? "https://wora-ten.vercel.app"
    : "http://localhost:3000";
};

/**
 * Forward Last.fm requests to the Vercel backend
 */
const forwardToBackend = async (
  endpoint: string,
  method: string = "GET",
  body?: any,
) => {
  try {
    const baseUrl = getBackendUrl();
    const url = `${baseUrl}/api/lastfm/${endpoint}`;

    const options: any = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (body && method === "POST") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    return await response.json();
  } catch (error) {
    logLastFm("Error forwarding request to backend", error, "error");
    return {
      success: false,
      error: "Failed to communicate with the backend API",
    };
  }
};

/**
 * Generate a signature for Last.fm API
 */
const generateSignature = (params: Record<string, string>): string => {
  // Remove format and callback parameters
  const filteredParams = { ...params };
  delete filteredParams.format;
  delete filteredParams.callback;

  // Sort parameters alphabetically by name
  const sortedKeys = Object.keys(filteredParams).sort();

  // Concatenate parameters
  let signatureStr = "";
  for (const key of sortedKeys) {
    signatureStr += key + filteredParams[key];
  }

  // Append secret
  signatureStr += DEV_API_SECRET;

  // Create MD5 hash
  return crypto.createHash("md5").update(signatureStr).digest("hex");
};

/**
 * Make a direct request to Last.fm API
 */
const makeLastFmRequest = async (
  params: Record<string, string>,
  isAuthRequest: boolean = false,
): Promise<any> => {
  try {
    // Always add these parameters
    const requestParams: Record<string, string> = {
      ...params,
      api_key: DEV_API_KEY,
      format: "json",
    };

    // If this is an authenticated request, add signature
    if (isAuthRequest) {
      requestParams.api_sig = generateSignature(requestParams);
    }

    // Build query string
    const queryString = Object.entries(requestParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&");

    // Make the request
    const url = `${API_URL}?${queryString}`;

    const response = await fetch(url, {
      method: "POST",
    });

    const data = await response.json();

    // Check for errors
    if (data.error) {
      logLastFm(`API Error ${data.error}: ${data.message}`, null, "error");
      return {
        success: false,
        error: data.message,
        code: data.error,
      };
    }

    return data;
  } catch (error) {
    logLastFm("Error making Last.fm API request", error, "error");
    return {
      success: false,
      error: "Error making Last.fm API request",
    };
  }
};

/**
 * Generate MD5 hash for password authentication
 */
const getMD5Auth = (username: string, password: string): string => {
  const authString = username.toLowerCase() + password;
  return crypto.createHash("md5").update(authString).digest("hex");
};

/**
 * Initialize Last.fm IPC handlers
 */
export const initializeLastFmHandlers = () => {
  // Handler for log messages from renderer process - simplified to avoid duplicate logging
  ipcMain.on("lastfm:log", (_, data) => {
    const { level, message } = data;
    if (!level || !message) return;

    // Just pass to the right logger method
    switch (level) {
      case "error":
        lastFmLogger.error(message);
        break;
      case "warn":
        lastFmLogger.warn(message);
        break;
      default:
        lastFmLogger.info(message);
    }
  });

  // Handle authentication requests
  ipcMain.handle(
    "lastfm:authenticate",
    async (_, username: string, password: string) => {
      try {
        // In production, use the backend API
        if (useBackend) {
          const response = await forwardToBackend("auth", "POST", {
            username,
            password,
          });

          if (!response.success) {
            logLastFm("Authentication error", response.error, "error");
          }
          return response;
        }
        // In development, call Last.fm API directly
        else {
          // Use the mobile session API for desktop auth
          const params = {
            method: "auth.getMobileSession",
            username: username,
            password: password,
          };

          const response = await makeLastFmRequest(params, true);

          if (response.error) {
            return {
              success: false,
              error: response.error,
            };
          }

          // Return success with session
          return {
            success: true,
            session: response.session,
          };
        }
      } catch (error) {
        logLastFm("Error in authentication", error, "error");
        return {
          success: false,
          error: "Internal error during authentication",
        };
      }
    },
  );

  // Handle "now playing" updates
  ipcMain.handle("lastfm:updateNowPlaying", async (_, data) => {
    try {
      const { sessionKey, artist, track, album, duration } = data;

      if (!sessionKey || !artist || !track) {
        return { success: false, error: "Missing required parameters" };
      }

      // Use backend or direct API based on environment
      if (useBackend) {
        const response = await forwardToBackend("now-playing", "POST", data);
        if (!response.success) {
          logLastFm("Error updating now playing", response.error, "error");
        }
        return response;
      } else {
        // Call Last.fm API directly
        const params: Record<string, string> = {
          method: "track.updateNowPlaying",
          artist,
          track,
          sk: sessionKey,
        };

        // Add optional parameters if available
        if (album) params.album = album;
        if (duration) params.duration = duration;

        const response = await makeLastFmRequest(params, true);

        if (response.error) {
          return {
            success: false,
            error: response.message || "Failed to update now playing",
          };
        }

        return {
          success: true,
        };
      }
    } catch (error) {
      logLastFm("Error in updateNowPlaying", error, "error");
      return {
        success: false,
        error: "Internal error updating now playing status",
      };
    }
  });

  // Handle track scrobbling - simplified error handling
  ipcMain.handle("lastfm:scrobbleTrack", async (_, data) => {
    try {
      const { sessionKey, artist, track, album, timestamp, duration } = data;

      if (!sessionKey || !artist || !track) {
        return { success: false, error: "Missing required parameters" };
      }

      // Use backend or direct API based on environment
      if (useBackend) {
        const response = await forwardToBackend("scrobble", "POST", data);
        if (!response.success) {
          logLastFm("Error scrobbling track", response.error, "error");
        }
        return response;
      } else {
        // Call Last.fm API directly
        const params: Record<string, string> = {
          method: "track.scrobble",
          artist,
          track,
          timestamp: timestamp || Math.floor(Date.now() / 1000).toString(),
          sk: sessionKey,
        };

        // Add optional parameters if available
        if (album) params.album = album;
        if (duration) params.duration = duration;

        const response = await makeLastFmRequest(params, true);

        if (response.error) {
          return {
            success: false,
            error: response.message || "Failed to scrobble track",
          };
        }

        return {
          success: true,
        };
      }
    } catch (error) {
      logLastFm("Error in scrobbleTrack", error, "error");
      return { success: false, error: "Internal error scrobbling track" };
    }
  });

  // Handle get user info - simplified
  ipcMain.handle("lastfm:getUserInfo", async (_, username, sessionKey) => {
    try {
      if (!username) {
        return { success: false, error: "Username is required" };
      }

      // Use backend or direct API based on environment
      if (useBackend) {
        const response = await forwardToBackend(
          `user-info?username=${encodeURIComponent(username)}&sessionKey=${encodeURIComponent(sessionKey || "")}`,
        );

        if (!response.success) {
          logLastFm("Error getting user info", response.error, "error");
        }
        return response;
      } else {
        // Call Last.fm API directly
        const params: Record<string, string> = {
          method: "user.getInfo",
          user: username,
        };

        // Add session key if available for private data
        if (sessionKey) params.sk = sessionKey;

        const response = await makeLastFmRequest(params, !!sessionKey);

        if (response.error) {
          return {
            success: false,
            error: response.message || "Failed to get user info",
          };
        }

        return {
          success: true,
          user: response.user,
        };
      }
    } catch (error) {
      logLastFm("Error in getUserInfo", error, "error");
      return { success: false, error: "Internal error getting user info" };
    }
  });

  // Handle get track info - simplified
  ipcMain.handle("lastfm:getTrackInfo", async (_, artist, track, username) => {
    try {
      if (!artist || !track) {
        return { success: false, error: "Artist and track are required" };
      }

      // Use backend or direct API based on environment
      if (useBackend) {
        // Create query string
        let query = `artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(track)}`;
        if (username) {
          query += `&username=${encodeURIComponent(username)}`;
        }

        // Forward track info request to backend
        const response = await forwardToBackend(`track-info?${query}`);
        if (!response.success) {
          logLastFm("Error getting track info", response.error, "error");
        }
        return response;
      } else {
        // Call Last.fm API directly
        const params: Record<string, string> = {
          method: "track.getInfo",
          artist,
          track,
        };

        // Add username if available for loved status
        if (username) params.username = username;

        const response = await makeLastFmRequest(params, false);

        if (response.error) {
          return {
            success: false,
            error: response.message || "Failed to get track info",
          };
        }

        return {
          success: true,
          track: response.track,
        };
      }
    } catch (error) {
      logLastFm("Error in getTrackInfo", error, "error");
      return { success: false, error: "Internal error getting track info" };
    }
  });

  // Handle get artist info
  ipcMain.handle("lastfm:getArtistInfo", async (_, artist) => {
    try {
      if (!artist) {
        return { success: false, error: "Artist name is required" };
      }

      // Use backend or direct API based on environment
      if (useBackend) {
        const query = `artist=${encodeURIComponent(artist)}`;
        const response = await forwardToBackend(`artist-info?${query}`);
        if (!response.success) {
          logLastFm("Error getting artist info", response.error, "error");
        }
        return response;
      } else {
        const params: Record<string, string> = {
          method: "artist.getInfo",
          artist,
          autocorrect: "1",
        };

        const response = await makeLastFmRequest(params, false);

        if (response.error) {
          return {
            success: false,
            error: response.message || "Failed to get artist info",
          };
        }

        return {
          success: true,
          artist: response.artist,
        };
      }
    } catch (error) {
      logLastFm("Error in getArtistInfo", error, "error");
      return { success: false, error: "Internal error getting artist info" };
    }
  });

  // Handle get artist top tracks
  ipcMain.handle("lastfm:getArtistTopTracks", async (_, artist) => {
    try {
      if (!artist) {
        return { success: false, error: "Artist name is required" };
      }

      // Use backend or direct API based on environment
      if (useBackend) {
        const query = `artist=${encodeURIComponent(artist)}`;
        const response = await forwardToBackend(`artist-top-tracks?${query}`);
        if (!response.success) {
          logLastFm("Error getting artist top tracks", response.error, "error");
        }
        return response;
      } else {
        const params: Record<string, string> = {
          method: "artist.getTopTracks",
          artist,
          limit: "10",
          autocorrect: "1",
        };

        const response = await makeLastFmRequest(params, false);

        if (response.error) {
          return {
            success: false,
            error: response.message || "Failed to get top tracks",
          };
        }

        return {
          success: true,
          toptracks: response.toptracks,
        };
      }
    } catch (error) {
      logLastFm("Error in getArtistTopTracks", error, "error");
      return { success: false, error: "Internal error getting top tracks" };
    }
  });

  // Handle get similar artists
  ipcMain.handle("lastfm:getSimilarArtists", async (_, artist) => {
    try {
      if (!artist) {
        return { success: false, error: "Artist name is required" };
      }

      // Use backend or direct API based on environment
      if (useBackend) {
        const query = `artist=${encodeURIComponent(artist)}`;
        const response = await forwardToBackend(`similar-artists?${query}`);
        if (!response.success) {
          logLastFm("Error getting similar artists", response.error, "error");
        }
        return response;
      } else {
        const params: Record<string, string> = {
          method: "artist.getSimilar",
          artist,
          limit: "6",
          autocorrect: "1",
        };

        const response = await makeLastFmRequest(params, false);

        if (response.error) {
          return {
            success: false,
            error: response.message || "Failed to get similar artists",
          };
        }

        return {
          success: true,
          similarartists: response.similarartists,
        };
      }
    } catch (error) {
      logLastFm("Error in getSimilarArtists", error, "error");
      return { success: false, error: "Internal error getting similar artists" };
    }
  });

  // Handle love/unlove track - simplified
  ipcMain.handle("lastfm:loveTrack", async (_, data) => {
    try {
      const { sessionKey, artist, track, love } = data;

      if (!sessionKey || !artist || !track || love === undefined) {
        return { success: false, error: "Missing required parameters" };
      }

      const action = love ? "love" : "unlove";

      // Use backend or direct API based on environment
      if (useBackend) {
        const response = await forwardToBackend("track-action", "POST", {
          sessionKey,
          artist,
          track,
          action,
        });

        if (!response.success) {
          logLastFm(`Error ${action} track`, response.error, "error");
        }
        return response;
      } else {
        // Call Last.fm API directly
        const params: Record<string, string> = {
          method: `track.${action}`,
          artist,
          track,
          sk: sessionKey,
        };

        const response = await makeLastFmRequest(params, true);

        if (response.error) {
          return {
            success: false,
            error: response.message || `Failed to ${action} track`,
          };
        }

        return {
          success: true,
        };
      }
    } catch (error) {
      logLastFm("Error in loveTrack", error, "error");
      return {
        success: false,
        error: `Internal error processing track love/unlove`,
      };
    }
  });

  // Log initialization only in development
  if (process.env.NODE_ENV !== "production") {
    logLastFm(
      `Using ${useBackend ? "backend API" : "direct API calls"} for Last.fm`,
    );
  }
};
