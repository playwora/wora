import path from "path";
import { Menu, Tray, app, dialog, ipcMain, shell } from "electron";
import serve from "electron-serve";
import { createWindow } from "./helpers";
import { protocol } from "electron";
import {
  addSongToPlaylist,
  addToFavourites,
  createPlaylist,
  db,
  getAlbumWithSongs,
  getAlbums,
  getArtistWithAlbums,
  getLastFmSettings,
  getLibraryStats,
  getPlaylistWithSongs,
  getPlaylists,
  getRandomLibraryItems,
  getSettings,
  initializeData,
  isSongFavorite,
  migrateDatabase,
  removeSongFromPlaylist,
  searchDB,
  searchSongs,
  updateLastFmSettings,
  deletePlaylist,
  updatePlaylist,
  updateSettings,
  getSongs,
  getAlbumsWithDuration,
} from "./helpers/db/connectDB";
import { initDatabase } from "./helpers/db/createDB";
import { parseFile } from "music-metadata";
import fs from "fs";
import { Client } from "@xhayper/discord-rpc";
import { eq, sql } from "drizzle-orm";
import { albums } from "./helpers/db/schema";
import { initializeLastFmHandlers } from "./helpers/lastfm-service";
import * as electronLog from "electron-log";

// Configure application logging for production
electronLog.transports.file.level = "info";
const logger = electronLog.default;

// Log application startup
logger.info(`Wora starting up - ${new Date().toISOString()}`);
logger.info(`Node environment: ${process.env.NODE_ENV}`);
logger.info(`Electron version: ${process.versions.electron}`);
logger.info(`Chrome version: ${process.versions.chrome}`);
logger.info(`OS: ${process.platform} ${process.arch}`);

const isProd = process.env.NODE_ENV === "production";

// Set the app user model id for Windows
if (process.platform === "win32") {
  app.setAppUserModelId("com.hiaaryan.wora");
}

if (isProd) {
  logger.info("Running in production mode");
  serve({ directory: "app" });
} else {
  logger.info("Running in development mode");
  app.setPath("userData", `${app.getPath("userData")}`);
}

let mainWindow: any;
let settings: any;

// Global cache for frequently accessed data
const dataCache = {
  libraryStats: null,
  randomItems: null,
  lastUpdated: 0,
};

// @hiaaryan: Initialize Database on Startup with optimized loading
const initializeLibrary = async () => {
  try {
    // Initialize SQLite database
    await initDatabase();

    // Run database migrations for schema updates
    await migrateDatabase();

    // Only load essential data at startup (settings)
    settings = await getSettings();

    if (settings) {
      // Start a non-blocking initialization of the music library
      // This allows the app UI to load while data is being processed
      setTimeout(() => {
        initializeData(settings.musicFolder, true)
          .then(() => {
            // Pre-cache some common data for faster access
            Promise.all([getLibraryStats(), getRandomLibraryItems()]).then(
              ([stats, randomItems]) => {
                dataCache.libraryStats = stats;
                dataCache.randomItems = randomItems;
                dataCache.lastUpdated = Date.now();

                // Notify renderer that library is fully loaded
                if (mainWindow) {
                  mainWindow.webContents.send("library-initialized");
                }
              },
            );
          })
          .catch((err) => {
            console.error("Error initializing music library:", err);
          });
      }, 1000); // Delay initialization to prioritize app UI loading
    }
  } catch (error) {
    console.error("Error initializing library:", error);
  }
};

(async () => {
  await app.whenReady();
  await initializeLibrary();

  // Initialize Last.fm IPC handlers
  initializeLastFmHandlers();

  // @hiaaryan: Using Depreciated API [Seeking Not Supported with Net]
  protocol.registerFileProtocol("wora", (request, callback) => {
    callback({ path: decodeURIComponent(request.url.replace("wora://", "")) });
  });

  mainWindow = createWindow("main", {
    width: 1500,
    height: 900,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 20, y: 20 },
    transparent: true,
    frame: false,
    icon: path.join(__dirname, "resources/icon.icns"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
    },
  });

  ipcMain.on("quitApp", async () => {
    return app.quit();
  });

  ipcMain.on("minimizeWindow", async () => {
    return mainWindow.minimize();
  });

  ipcMain.on("maximizeWindow", async (_, isMaximized: boolean) => {
    if (isMaximized) {
      return mainWindow.maximize(isMaximized);
    } else {
      return mainWindow.unmaximize();
    }
  });

  if (settings) {
    if (isProd) {
      await mainWindow.loadURL("app://./home");
    } else {
      const port = process.argv[2];
      await mainWindow.loadURL(`http://localhost:${port}/home`);
    }
  } else {
    if (isProd) {
      await mainWindow.loadURL("app://./setup");
    } else {
      const port = process.argv[2];
      await mainWindow.loadURL(`http://localhost:${port}/setup`);
    }
  }
})();

// @hiaaryan: Initialize Discord RPC
const client = new Client({
  clientId: "1243707416588320800",
});

ipcMain.on(
  "set-rpc-state",
  async (_, { details, state, seek, duration, cover }) => {
    let startTimestamp, endTimestamp;

    if (duration && seek) {
      const now = Math.ceil(Date.now());
      startTimestamp = now - seek * 1000;
      endTimestamp = now + (duration - seek) * 1000;
    }

    const setActivity = {
      details,
      state,
      largeImageKey: cover,
      instance: false,
      type: 2,
      startTimestamp: startTimestamp,
      endTimestamp: endTimestamp,
      buttons: [
        { label: "Support Project", url: "https://github.com/hiaaryan/wora" },
      ],
    };

    if (!client.isConnected) {
      try {
        await client.login();
      } catch (error) {
        console.error("Error logging into Discord:", error);
      }
    }

    if (client.isConnected) {
      client.user.setActivity(setActivity);
    }
  },
);

// @hiaaryan: Called to Rescan Library
ipcMain.handle("rescanLibrary", async () => {
  await initializeLibrary();
});

// @hiaaryan: Called to Set Music Folder
ipcMain.handle("scanLibrary", async () => {
  const diag = await dialog
    .showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
    })
    .then(async (result) => {
      if (result.canceled) {
        return result;
      }

      await initializeData(result.filePaths[0]);
    })
    .catch((err) => {
      console.log(err);
    });

  return diag;
});

// @hiaaryan: Set Tray for Wora
let tray = null;
app.whenReady().then(() => {
  const trayIconPath = !isProd
    ? path.join(__dirname, `../renderer/public/assets/TrayTemplate.png`)
    : path.join(__dirname, `../app/assets/TrayTemplate.png`);
  tray = new Tray(trayIconPath);
  const contextMenu = Menu.buildFromTemplate([
    { label: "About", type: "normal", role: "about" },
    { type: "separator" },
    {
      label: "GitHub",
      type: "normal",
      click: () => {
        shell.openExternal("https://github.com/hiaaryan/wora");
      },
    },
    {
      label: "Discord",
      type: "normal",
      click: () => {
        shell.openExternal("https://discord.gg/CrAbAYMGCe");
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      type: "normal",
      role: "quit",
      accelerator: "Cmd+Q",
    },
  ]);
  tray.setToolTip("Wora");
  tray.setContextMenu(contextMenu);
});

// Use cached data when available for frequently accessed endpoints
ipcMain.handle("getLibraryStats", async () => {
  // Check if we have fresh cached data (less than 5 minutes old)
  if (dataCache.libraryStats && Date.now() - dataCache.lastUpdated < 300000) {
    return dataCache.libraryStats;
  }

  // Otherwise get fresh data and update cache
  const stats = await getLibraryStats();
  dataCache.libraryStats = stats;
  dataCache.lastUpdated = Date.now();
  return stats;
});

ipcMain.handle("getRandomLibraryItems", async () => {
  // Check if we have fresh cached data (less than 5 minutes old)
  if (dataCache.randomItems && Date.now() - dataCache.lastUpdated < 300000) {
    return dataCache.randomItems;
  }

  // Otherwise get fresh data and update cache
  const libraryItems = await getRandomLibraryItems();
  dataCache.randomItems = libraryItems;
  dataCache.lastUpdated = Date.now();
  return libraryItems;
});

// @hiaaryan: IPC Handlers from Renderer
ipcMain.handle("getAlbums", async (_, page) => {
  return await getAlbums(page);
});

// Page state reset handlers
ipcMain.on("resetAlbumsPageState", () => {
  // Notify renderer to reset albums page state
  mainWindow.webContents.send("resetAlbumsState");
});

ipcMain.on("resetSongsPageState", () => {
  // Notify renderer to reset songs page state
  mainWindow.webContents.send("resetSongsState");
});

ipcMain.on("resetPlaylistsPageState", () => {
  // Notify renderer to reset playlists page state
  mainWindow.webContents.send("resetPlaylistsState");
});

ipcMain.on("resetHomePageState", () => {
  // Notify renderer to reset home page state
  mainWindow.webContents.send("resetHomeState");
});

ipcMain.handle("getAllPlaylists", async () => {
  const playlists = await getPlaylists();
  return playlists;
});

ipcMain.handle("getAlbumWithSongs", async (_, id: number) => {
  const albumWithSongs = await getAlbumWithSongs(id);
  return albumWithSongs;
});

ipcMain.handle("getPlaylistWithSongs", async (_, id: number) => {
  const playlistWithSongs = await getPlaylistWithSongs(id);
  return playlistWithSongs;
});

ipcMain.handle("getSongMetadata", async (_, file: string) => {
  const metadata = await parseFile(file, {
    skipPostHeaders: true,
    skipCovers: true,
  });

  const favourite = await isSongFavorite(file);

  return { metadata, favourite };
});

ipcMain.on("addToFavourites", async (_, id: number) => {
  return addToFavourites(id);
});

ipcMain.handle("search", async (_, query: string) => {
  const results = await searchDB(query);
  return results;
});

ipcMain.handle("createPlaylist", async (_, data: any) => {
  const playlist = await createPlaylist(data);
  // Invalidate cache when data changes
  dataCache.lastUpdated = 0;
  return playlist;
});

ipcMain.handle("deletePlaylist", async (_, data: any) => {
  try {
    const result = await deletePlaylist(data);
    return result;
  } catch (error) {
    throw error;
  }
});

ipcMain.handle("updatePlaylist", async (_, data: any) => {
  const playlist = await updatePlaylist(data);
  // Invalidate cache when data changes
  dataCache.lastUpdated = 0;
  return playlist;
});

ipcMain.handle("addSongToPlaylist", async (_, data: any) => {
  const add = await addSongToPlaylist(data.playlistId, data.songId);
  // Invalidate cache when data changes
  dataCache.lastUpdated = 0;
  return add;
});

ipcMain.handle("removeSongFromPlaylist", async (_, data: any) => {
  const remove = await removeSongFromPlaylist(data.playlistId, data.songId);
  // Invalidate cache when data changes
  dataCache.lastUpdated = 0;
  return remove;
});

ipcMain.handle("getSettings", async () => {
  const settings = await getSettings();
  return settings;
});

ipcMain.handle("updateSettings", async (_, data: any) => {
  const settings = await updateSettings(data);
  mainWindow.webContents.send("confirmSettingsUpdate", settings);
  return settings;
});

ipcMain.handle("uploadProfilePicture", async (_, file) => {
  const uploadsDir = path.join(
    app.getPath("userData"),
    "utilities/uploads/profile",
  );
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileName = `profile_${Date.now()}${path.extname(file.name)}`;
  const filePath = path.join(uploadsDir, fileName);

  fs.writeFileSync(filePath, Buffer.from(file.data));

  return filePath;
});

ipcMain.handle("uploadPlaylistCover", async (_, file) => {
  const uploadsDir = path.join(
    app.getPath("userData"),
    "utilities/uploads/playlists",
  );
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileName = `playlists_${Date.now()}${path.extname(file.name)}`;
  const filePath = path.join(uploadsDir, fileName);

  fs.writeFileSync(filePath, Buffer.from(file.data));

  return filePath;
});

ipcMain.handle("getActionsData", async () => {
  const isNotMac = process.platform !== "darwin";
  const appVersion = app.getVersion();

  return { isNotMac, appVersion };
});

ipcMain.handle("getArtistWithAlbums", async (_, artist: string) => {
  const artistData = await getArtistWithAlbums(artist);
  return artistData;
});

// New handler to get all songs for shuffle feature
ipcMain.handle("getAllSongs", async () => {
  try {
    console.log("Getting all songs for shuffle...");

    // Get all songs with their album information in a single query for better performance
    const songsWithAlbums = await db.query.songs.findMany({
      with: {
        album: true, // This fetches the full album data for each song
      },
      orderBy: sql`RANDOM()`, // Randomize the songs to make shuffling more natural
    });

    // Transform the data to match the expected format in the frontend
    const formattedSongs = songsWithAlbums.map((song) => {
      return {
        id: song.id,
        name: song.name || "Unknown Title",
        artist: song.artist || "Unknown Artist",
        duration: song.duration || 0,
        filePath: song.filePath,
        album: song.album
          ? {
              id: song.album.id,
              name: song.album.name || "Unknown Album",
              artist: song.album.artist || "Unknown Artist",
              cover: song.album.cover || null,
              year: song.album.year,
            }
          : {
              id: null,
              name: "Unknown Album",
              artist: "Unknown Artist",
              cover: null,
              year: null,
            },
      };
    });

    console.log(
      `Returning ${formattedSongs.length} songs with complete album data`,
    );
    return formattedSongs;
  } catch (error) {
    console.error("Error in getAllSongs:", error);
    return [];
  }
});

// New handler to get songs with pagination
ipcMain.handle("getSongs", async (_, page: number = 1) => {
  try {
    console.log(`Getting songs for page ${page}...`);
    const songsWithAlbums = await getSongs(page);
    return songsWithAlbums;
  } catch (error) {
    console.error("Error in getSongs:", error);
    return [];
  }
});

// Handler for searching songs with the new searchSongs function
ipcMain.handle("searchSongs", async (_, query: string) => {
  try {
    console.log(`Searching songs with query: "${query}"`);
    const results = await searchSongs(query);
    console.log(`Found ${results.length} song matches`);
    return results;
  } catch (error) {
    console.error("Error in searchSongs:", error);
    return [];
  }
});

// Handler for getting albums with calculated durations
ipcMain.handle("getAlbumsWithDuration", async (_, page: number = 1) => {
  try {
    console.log(`Getting albums with durations for page ${page}...`);
    const albumsWithDurations = await getAlbumsWithDuration(page);
    console.log(`Found ${albumsWithDurations.length} albums with durations`);
    return albumsWithDurations;
  } catch (error) {
    console.error("Error in getAlbumsWithDuration:", error);
    return [];
  }
});

// Add LastFM handlers after existing handlers

// Get LastFM settings
ipcMain.handle("getLastFmSettings", async () => {
  try {
    const lastFmSettings = await getLastFmSettings();
    return lastFmSettings;
  } catch (error) {
    console.error("Error in getLastFmSettings:", error);
    return {
      lastFmUsername: null,
      lastFmSessionKey: null,
      enableLastFm: false,
      scrobbleThreshold: 50,
    };
  }
});

// Update LastFM settings
ipcMain.handle("updateLastFmSettings", async (_, data) => {
  try {
    const result = await updateLastFmSettings(data);

    // Notify all renderer processes that Last.fm settings have changed
    if (mainWindow) {
      mainWindow.webContents.send("lastFmSettingsChanged", data);
    }

    return result;
  } catch (error) {
    console.error("Error in updateLastFmSettings:", error);
    return false;
  }
});

app.on("window-all-closed", () => {
  app.quit();
});
