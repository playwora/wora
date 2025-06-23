import { and, eq, like, sql, or, exists } from "drizzle-orm";
import { albums, songs, settings, playlistSongs, playlists } from "./schema";
import fs from "fs";
import { parseFile, selectCover } from "music-metadata";
import path from "path";
import { BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { sqlite } from "./createDB";
import { app } from "electron";

export const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, {
  schema,
});

const APP_DATA = app.getPath("userData");
const ART_DIR = path.join(APP_DATA, "utilities/uploads/covers");

const audioExtensions = [
  ".mp3",
  ".mpeg",
  ".opus",
  ".ogg",
  ".oga",
  ".wav",
  ".aac",
  ".caf",
  ".m4a",
  ".m4b",
  ".mp4",
  ".weba",
  ".webm",
  ".dolby",
  ".flac",
];

const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"];

// Image cache to avoid redundant processing
const processedImages = new Map();

// Function to check if a file is an audio file
function isAudioFile(filePath: string): boolean {
  return audioExtensions.includes(path.extname(filePath).toLowerCase());
}

function findFirstImageInDirectory(dir: string): string | null {
  if (processedImages.has(dir)) {
    return processedImages.get(dir);
  }

  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (
        stat.isFile() &&
        imageExtensions.includes(path.extname(file).toLowerCase())
      ) {
        processedImages.set(dir, filePath);
        return filePath;
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }

  processedImages.set(dir, null);
  return null;
}

// More efficient file reader that uses batch processing
function readFilesRecursively(dir: string, batch = 100): string[] {
  let results: string[] = [];
  let stack = [dir];
  let count = 0;

  while (stack.length > 0 && count < batch) {
    const currentDir = stack.pop();
    try {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const itemPath = path.join(currentDir, item);
        try {
          const stat = fs.statSync(itemPath);

          if (stat.isDirectory()) {
            stack.push(itemPath);
          } else if (isAudioFile(itemPath)) {
            results.push(itemPath);
            count++;
            if (count >= batch) break;
          }
        } catch (err) {
          console.error(`Error accessing ${itemPath}:`, err);
        }
      }
    } catch (err) {
      console.error(`Error reading directory ${currentDir}:`, err);
    }
  }

  return results;
}

// Full recursive scan, but optimized to handle large directories better
function scanEntireLibrary(dir: string): string[] {
  let results: string[] = [];

  try {
    const items = fs.readdirSync(dir);

    // Process directories in chunks to avoid memory issues with very large libraries
    const chunkSize = 50; // Increased from 10 for better performance
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);

      // Process each item in the chunk
      for (const item of chunk) {
        const itemPath = path.join(dir, item);
        try {
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            // Recursive scan but append results directly instead of creating many arrays
            results.push(...scanEntireLibrary(itemPath));
          } else if (isAudioFile(itemPath)) {
            results.push(itemPath);
          }
        } catch (err) {
          console.error(`Error accessing ${itemPath}:`, err);
        }
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }

  return results;
}

export const getLibraryStats = async () => {
  const songCount = await db.select({ count: sql`count(*)` }).from(songs);
  const albumCount = await db.select({ count: sql`count(*)` }).from(albums);
  const playlistCount = await db
    .select({ count: sql`count(*)` })
    .from(playlists);

  return {
    songs: songCount[0].count,
    albums: albumCount[0].count,
    playlists: playlistCount[0].count,
  };
};

export const getSettings = async () => {
  const settings = await db.select().from(schema.settings).limit(1);
  return settings[0];
};

export const updateSettings = async (data: any) => {
  const currentSettings = await db.select().from(settings);

  if (currentSettings[0].profilePicture) {
    try {
      fs.unlinkSync(currentSettings[0].profilePicture);
    } catch (error) {
      console.error("Error deleting old profile picture:", error);
    }
  }

  await db.update(settings).set({
    name: data.name,
    profilePicture: data.profilePicture,
  });

  return true;
};

export const getSongs = async (page: number = 1, limit: number = 30) => {
  return await db.query.songs.findMany({
    with: { album: true },
    limit: limit,
    offset: (page - 1) * limit,
    orderBy: (songs, { asc }) => [asc(songs.name)],
  });
};

export const getAlbums = async (page: number, limit: number = 15) => {
  // Get albums with pagination
  const albumsResult = await db
    .select()
    .from(albums)
    .orderBy(albums.name)
    .limit(limit)
    .offset((page - 1) * limit);

  // Get durations for these albums
  const albumsWithDuration = await Promise.all(
    albumsResult.map(async (album) => {
      // Get total duration from songs in this album
      const durationResult = await db
        .select({ totalDuration: sql`SUM(${songs.duration})` })
        .from(songs)
        .where(eq(songs.albumId, album.id));

      return {
        ...album,
        duration: durationResult[0]?.totalDuration || 0,
      };
    }),
  );

  return albumsWithDuration;
};

export const getPlaylists = async () => {
  return await db.select().from(playlists);
};

export const createPlaylist = async (data: any) => {
  let description: string;
  let cover: string;

  if (data.description) {
    description = data.description;
  } else {
    description = "An epic playlist created by you.";
  }

  if (data.cover) {
    cover = data.cover;
  } else {
    cover = null;
  }

  const playlist = await db.insert(playlists).values({
    name: data.name,
    description: description,
    cover: cover,
  });

  return playlist;
};

export const deletePlaylist = async (data: any) => {
  await db.transaction(async (tx) => {
    // 1) Remove all links in playlistSongs
    await tx
      .delete(playlistSongs)
      .where(eq(playlistSongs.playlistId, data.id));

    // 2) Now delete the playlist
    const result = await tx
      .delete(playlists)
      .where(eq(playlists.id, data.id));

    if ("changes" in result && result.changes === 0) {
      throw new Error(`Playlist ${data.id} not found`);
    }
  });

  return { message: `Playlist ${data.id} deleted successfully` };
};

export const updatePlaylist = async (data: any) => {
  let description: string;
  let cover: string;

  if (data.data.description) {
    description = data.data.description;
  } else {
    description = "An epic playlist created by you.";
  }

  if (data.cover) {
    cover = data.data.cover;
  } else {
    cover = "/cover.png";
  }

  const playlist = await db
    .update(playlists)
    .set({
      name: data.data.name,
      description: description,
      cover: cover,
    })
    .where(eq(playlists.id, data.id));

  return playlist;
};

export const getAlbumWithSongs = async (id: number) => {
  const albumWithSongs = await db.query.albums.findFirst({
    where: eq(albums.id, id),
    with: {
      songs: {
        with: { album: true },
      },
    },
  });

  if (albumWithSongs) {
    // Calculate total duration from all songs in this album
    const totalDuration = albumWithSongs.songs.reduce(
      (total, song) => total + (song.duration || 0),
      0,
    );

    return {
      ...albumWithSongs,
      duration: totalDuration,
    };
  }

  return albumWithSongs;
};

export const getPlaylistWithSongs = async (id: number) => {
  const playlistWithSongs = await db.query.playlists.findFirst({
    where: eq(playlists.id, id),
    with: {
      songs: {
        with: {
          song: {
            with: { album: true },
          },
        },
      },
    },
  });

  return {
    ...playlistWithSongs,
    songs: playlistWithSongs.songs.map((playlistSong) => ({
      ...playlistSong.song,
      album: playlistSong.song.album,
    })),
  };
};

export const isSongFavorite = async (file: string) => {
  const song = await db.query.songs.findFirst({
    where: eq(songs.filePath, file),
  });

  if (!song) return false;

  const isFavourite = await db.query.playlistSongs.findFirst({
    where: and(
      eq(playlistSongs.playlistId, 1),
      eq(playlistSongs.songId, song.id),
    ),
  });

  return !!isFavourite;
};

export const addToFavourites = async (songId: number) => {
  const existingEntry = await db
    .select()
    .from(playlistSongs)
    .where(
      and(eq(playlistSongs.playlistId, 1), eq(playlistSongs.songId, songId)),
    );

  if (!existingEntry[0]) {
    await db.insert(playlistSongs).values({
      playlistId: 1,
      songId,
    });
  } else {
    await db
      .delete(playlistSongs)
      .where(
        and(eq(playlistSongs.playlistId, 1), eq(playlistSongs.songId, songId)),
      );
  }
};

export const searchDB = async (query: string) => {
  const lowerSearch = query.toLowerCase();

  const searchAlbums = await db.query.albums.findMany({
    where: like(albums.name, `%${lowerSearch}%`),
    limit: 5,
  });

  const searchPlaylists = await db.query.playlists.findMany({
    where: like(playlists.name, `%${lowerSearch}%`),
    limit: 5,
  });

  const searchSongs = await db.query.songs.findMany({
    where: like(songs.name, `%${lowerSearch}%`),
    with: {
      album: {
        columns: {
          id: true,
          cover: true,
        },
      },
    },
    limit: 5,
  });

  // Search for artists by querying unique artist names from the albums table
  const searchArtists = await db.query.albums.findMany({
    where: like(albums.artist, `%${lowerSearch}%`),
    columns: {
      artist: true,
    },
    limit: 5,
  });

  // Remove duplicate artists by name
  const uniqueArtists = Array.from(
    new Set(searchArtists.map((a) => a.artist)),
  ).map((name) => ({
    name,
  }));

  return {
    searchAlbums,
    searchPlaylists,
    searchSongs,
    searchArtists: uniqueArtists,
  };
};

export const addSongToPlaylist = async (playlistId: number, songId: number) => {
  const checkIfExists = await db.query.playlistSongs.findFirst({
    where: and(
      eq(playlistSongs.playlistId, playlistId),
      eq(playlistSongs.songId, songId),
    ),
  });

  if (checkIfExists) return false;

  await db.insert(playlistSongs).values({
    playlistId,
    songId,
  });

  return true;
};

export const removeSongFromPlaylist = async (
  playlistId: number,
  songId: number,
) => {
  await db
    .delete(playlistSongs)
    .where(
      and(
        eq(playlistSongs.playlistId, playlistId),
        eq(playlistSongs.songId, songId),
      ),
    );

  return true;
};

export const getRandomLibraryItems = async () => {
  const randomAlbums = await db
    .select()
    .from(albums)
    .orderBy(sql`RANDOM()`)
    .limit(10);

  // Add duration calculation for albums
  const albumsWithDuration = await Promise.all(
    randomAlbums.map(async (album) => {
      // Get total duration from songs in this album
      const durationResult = await db
        .select({ totalDuration: sql`SUM(${songs.duration})` })
        .from(songs)
        .where(eq(songs.albumId, album.id));

      return {
        ...album,
        duration: durationResult[0]?.totalDuration || 0,
      };
    }),
  );

  const randomSongs = await db.query.songs.findMany({
    with: { album: true },
    limit: 10,
    orderBy: sql`RANDOM()`,
  });

  return {
    albums: albumsWithDuration,
    songs: randomSongs,
  };
};

// Added incremental loading support
export const initializeData = async (
  musicFolder: string,
  incremental = false,
) => {
  if (!fs.existsSync(musicFolder)) {
    console.error("Music folder does not exist:", musicFolder);
    return false;
  }

  try {
    // Add default playlist if it doesn't exist
    const defaultPlaylist = await db
      .select()
      .from(playlists)
      .where(eq(playlists.id, 1));

    if (!defaultPlaylist[0]) {
      await db.insert(playlists).values({
        name: "Favourites",
        cover: null,
        description: "Songs liked by you.",
      });
    }

    // Update settings
    const existingSettings = await db
      .select()
      .from(settings)
      .where(eq(settings.id, 1));

    if (existingSettings[0]) {
      await db.update(settings).set({ musicFolder }).where(eq(settings.id, 1));
    } else {
      await db.insert(settings).values({ musicFolder });
    }

    // Create art directory if it doesn't exist
    if (!fs.existsSync(ART_DIR)) {
      await fs.promises.mkdir(ART_DIR, { recursive: true });
    }

    // First pass: Just load metadata or do a full scan based on incremental flag
    await processLibrary(musicFolder, incremental);

    return true;
  } catch (error) {
    console.error("Error initializing data:", error);
    return false;
  }
};

// Batch process files to reduce memory usage and improve UI responsiveness
async function processLibrary(musicFolder: string, incremental = false) {
  const startTime = Date.now();
  const dbFilePaths = await getAllFilePathsFromDb();

  if (incremental) {
    console.log("Starting incremental library scan...");

    // Scan only the immediate music folder first to reduce initial delay
    const initialBatch = scanImmediateDirectory(musicFolder);
    const batchSize = 100; // Increased from 50 for better throughput

    // Process the initial batch right away for quick UI updates
    await processBatch(initialBatch, dbFilePaths);

    // Process the rest of the library in the background
    setTimeout(async () => {
      // Use a more efficient scanning algorithm for the full scan
      const allFiles = scanEntireLibrary(musicFolder);
      console.log(`Found ${allFiles.length} files in music library`);

      // Skip files we've already processed in the initial batch
      for (let i = initialBatch.length; i < allFiles.length; i += batchSize) {
        const batch = allFiles.slice(i, i + batchSize);
        await processBatch(batch, dbFilePaths);

        // Yield to UI thread periodically but not too often (increased from 10ms)
        if (i % (batchSize * 5) === 0) {
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
      }

      // Final cleanup - remove orphaned records
      await cleanupOrphanedRecords(allFiles);

      console.log(
        `Library processing completed in ${(Date.now() - startTime) / 1000} seconds`,
      );
    }, 1000); // Reduced from 2000ms for faster startup
  } else {
    // Do full scan immediately if not incremental
    const allFiles = scanEntireLibrary(musicFolder);
    console.log(`Found ${allFiles.length} files in music library`);

    // Process in larger batches since we're not concerned about UI responsiveness
    const batchSize = 300; // Increased from 200 for better throughput

    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize);
      await processBatch(batch, dbFilePaths);

      // Still yield occasionally to prevent potential lockups
      if (i % (batchSize * 3) === 0) {
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }

    await cleanupOrphanedRecords(allFiles);
    console.log(
      `Library processing completed in ${(Date.now() - startTime) / 1000} seconds`,
    );
  }
}

// Helper function to get all file paths from database
async function getAllFilePathsFromDb(): Promise<Set<string>> {
  const dbFiles = await db.select().from(songs);
  return new Set(dbFiles.map((file) => file.filePath));
}

// Scan only the immediate directory for quick initial loading
function scanImmediateDirectory(dir: string): string[] {
  let results: string[] = [];

  try {
    const items = fs.readdirSync(dir);

    // First collect all audio files in the current directory
    for (const item of items) {
      const itemPath = path.join(dir, item);
      try {
        const stat = fs.statSync(itemPath);
        if (!stat.isDirectory() && isAudioFile(itemPath)) {
          results.push(itemPath);
        }
      } catch (err) {
        console.error(`Error accessing ${itemPath}:`, err);
      }
    }

    // Then check immediate subdirectories (but not recursively)
    for (const item of items) {
      const itemPath = path.join(dir, item);
      try {
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory()) {
          const subItems = fs.readdirSync(itemPath);
          for (const subItem of subItems) {
            const subItemPath = path.join(itemPath, subItem);
            try {
              const subStat = fs.statSync(subItemPath);
              if (!subStat.isDirectory() && isAudioFile(subItemPath)) {
                results.push(subItemPath);
              }
            } catch (err) {
              console.error(`Error accessing ${subItemPath}:`, err);
            }
          }
        }
      } catch (err) {
        console.error(`Error accessing ${itemPath}:`, err);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }

  return results;
}

async function processBatch(files: string[], dbFilePaths: Set<string>) {
  const albumCache = new Map();

  for (const file of files) {
    try {
      if (!dbFilePaths.has(file)) {
        // New file - add to database
        await processAudioFile(file, albumCache);
      }
    } catch (error) {
      console.error(`Error processing file ${file}:`, error);
    }
  }
}

async function processAudioFile(file: string, albumCache: Map<string, any>) {
  try {
    // Use more efficient metadata parsing with stripped options
    const metadata = await parseFile(file, {
      skipPostHeaders: true,
      skipCovers: false, // Still need covers
      duration: true,
      includeChapters: false,
    });

    // Skip files with insufficient metadata
    if (!metadata.common.title) {
      return;
    }

    const albumFolder = path.dirname(file);
    let artPath = null;

    // Try to find album art in efficient order: cache first, then folder, then embedded
    // Only process art if we need to show it (reduces I/O operations)
    if (albumCache.has(`${albumFolder}-art`)) {
      // Reuse already processed art path from cache
      artPath = albumCache.get(`${albumFolder}-art`);
    } else {
      // First check for external images as they're typically higher quality
      const albumImage = findFirstImageInDirectory(albumFolder);

      if (albumImage) {
        artPath = await processAlbumArt(albumImage);
      } else if (
        metadata.common.picture &&
        metadata.common.picture.length > 0
      ) {
        // Fall back to embedded art if available
        const cover = selectCover(metadata.common.picture);
        if (cover) {
          artPath = await processEmbeddedArt(cover);
        }
      }

      // Cache the art path for this folder to avoid redundant processing
      albumCache.set(`${albumFolder}-art`, artPath);
    }

    // Get or create album with better caching
    let album;
    const albumKey = `${metadata.common.album || "Unknown Album"}-${metadata.common.artist || "Unknown Artist"}`;

    if (albumCache.has(albumKey)) {
      album = albumCache.get(albumKey);
    } else {
      // Optimize the database lookup for album
      const albumsFound = await db
        .select()
        .from(albums)
        .where(eq(albums.name, metadata.common.album || "Unknown Album"));

      if (albumsFound.length > 0) {
        album = albumsFound[0];

        // Update album if needed (only when data differs)
        const albumArtist =
          metadata.common.albumartist ||
          metadata.common.artist ||
          "Various Artists";
        if (
          album.artist !== albumArtist ||
          album.year !== metadata.common.year ||
          (artPath && album.cover !== artPath)
        ) {
          await db
            .update(albums)
            .set({
              artist: albumArtist,
              year: metadata.common.year,
              cover: artPath || album.cover,
            })
            .where(eq(albums.id, album.id));

          // Update cached version
          album.artist = albumArtist;
          album.year = metadata.common.year;
          album.cover = artPath || album.cover;
        }
      } else {
        // Create new album with a single transaction
        const [newAlbum] = await db
          .insert(albums)
          .values({
            name: metadata.common.album || "Unknown Album",
            artist:
              metadata.common.albumartist ||
              metadata.common.artist ||
              "Various Artists",
            year: metadata.common.year,
            cover: artPath,
          })
          .returning();

        album = newAlbum;
      }

      albumCache.set(albumKey, album);
    }

    // Add the song using pre-calculated values to avoid repeated operations
    await db.insert(songs).values({
      filePath: file,
      name: metadata.common.title,
      artist: metadata.common.artist || "Unknown Artist",
      duration: Math.round(metadata.format.duration || 0),
      albumId: album.id,
    });
  } catch (error) {
    console.error(`Error processing audio file ${file}:`, error);
  }
}

async function processAlbumArt(imagePath: string): Promise<string> {
  try {
    // Use a shorter hash method for faster processing
    const crypto = require("crypto");
    const imageExt = path.extname(imagePath).slice(1);

    // Generate hash from filename and modified time instead of reading the whole file
    // This is much faster for large image files
    const stats = fs.statSync(imagePath);
    const hashInput = `${imagePath}-${stats.size}-${stats.mtimeMs}`;
    const hash = crypto.createHash("md5").update(hashInput).digest("hex");

    const artPath = path.join(ART_DIR, `${hash}.${imageExt}`);

    // If the processed file already exists, return its path immediately
    if (fs.existsSync(artPath)) {
      return artPath;
    }

    // Only read the file if we need to process it
    const imageData = fs.readFileSync(imagePath);

    // For common image formats that don't need processing, just copy the file
    if (imageExt.match(/^(jpe?g|png|webp)$/i)) {
      await fs.promises.writeFile(artPath, imageData);
      return artPath;
    }

    // For other formats, we might want to convert them (implementation depends on available modules)
    // For now, just save as is
    await fs.promises.writeFile(artPath, imageData);
    return artPath;
  } catch (error) {
    console.error("Error processing album art:", error);
    return null;
  }
}

async function processEmbeddedArt(cover: any): Promise<string> {
  try {
    // If we don't have cover data, return early
    if (!cover || !cover.data) {
      return null;
    }

    // Generate a hash based on a small sample of the image data
    // Using the full data can be slow for large embedded images
    const sampleSize = Math.min(cover.data.length, 4096); // Sample first 4KB
    const sampleBuffer = cover.data.slice(0, sampleSize);

    const crypto = require("crypto");
    const hash = crypto.createHash("md5").update(sampleBuffer).digest("hex");

    const format = cover.format ? cover.format.split("/")[1] || "jpg" : "jpg";

    const artPath = path.join(ART_DIR, `${hash}.${format}`);

    // Skip writing if it already exists
    if (fs.existsSync(artPath)) {
      return artPath;
    }

    // Write the full image data
    await fs.promises.writeFile(artPath, cover.data);
    return artPath;
  } catch (error) {
    console.error("Error processing embedded art:", error);
    return null;
  }
}

async function cleanupOrphanedRecords(currentFiles: string[]) {
  // Create a set of current file paths for faster lookups
  const currentFilesSet = new Set(currentFiles);

  // Get all songs from the database
  const dbFiles = await db.select().from(songs);

  // Find songs that no longer exist
  const deletedFiles = dbFiles.filter(
    (dbFile) => !currentFilesSet.has(dbFile.filePath),
  );

  if (deletedFiles.length > 0) {
    console.log(`Removing ${deletedFiles.length} orphaned song records`);

    // Delete in batches to avoid locking the database for too long
    const batchSize = 50;
    for (let i = 0; i < deletedFiles.length; i += batchSize) {
      const batch = deletedFiles.slice(i, i + batchSize);

      await db.transaction(async (tx) => {
        for (const file of batch) {
          await tx
            .delete(playlistSongs)
            .where(eq(playlistSongs.songId, file.id));
          await tx.delete(songs).where(eq(songs.id, file.id));
        }
      });
    }
  }

  // Clean up empty albums
  const allAlbums = await db.select().from(albums);

  for (const album of allAlbums) {
    const songsInAlbum = await db
      .select()
      .from(songs)
      .where(eq(songs.albumId, album.id));

    if (songsInAlbum.length === 0) {
      await db.delete(albums).where(eq(albums.id, album.id));
    }
  }
}

// Migrate database to add columns that might be missing
export const migrateDatabase = async () => {
  try {
    console.log("Checking database schema for migrations...");

    // Check if LastFM columns exist in settings table
    const tableInfo = sqlite
      .prepare("PRAGMA table_info(settings)")
      .all() as Array<{ name: string }>;
    const columnNames = tableInfo.map((col) => col.name);

    const missingColumns = [];

    // Check for lastFmUsername column
    if (!columnNames.includes("lastFmUsername")) {
      missingColumns.push("lastFmUsername TEXT");
    }

    // Check for lastFmSessionKey column
    if (!columnNames.includes("lastFmSessionKey")) {
      missingColumns.push("lastFmSessionKey TEXT");
    }

    // Check for enableLastFm column
    if (!columnNames.includes("enableLastFm")) {
      missingColumns.push("enableLastFm INTEGER DEFAULT 0");
    }

    // Check for scrobbleThreshold column
    if (!columnNames.includes("scrobbleThreshold")) {
      missingColumns.push("scrobbleThreshold INTEGER DEFAULT 50");
    }

    // Add missing columns if any
    if (missingColumns.length > 0) {
      console.log(
        `Adding ${missingColumns.length} missing columns to settings table...`,
      );

      for (const columnDef of missingColumns) {
        const alterSql = `ALTER TABLE settings ADD COLUMN ${columnDef}`;
        sqlite.exec(alterSql);
        console.log(`Added column: ${columnDef}`);
      }

      console.log("Database migration completed successfully.");
    } else {
      console.log("Database schema is up to date, no migration needed.");
    }

    return true;
  } catch (error) {
    console.error("Error during database migration:", error);
    return false;
  }
};

// Helper function to send messages to the renderer process
function sendToRenderer(channel: string, data: any) {
  try {
    // Check if we have access to the webContents
    const { BrowserWindow } = require("electron");
    const win = BrowserWindow.getAllWindows()[0];
    if (win && win.webContents) {
      win.webContents.send(channel, data);
    }
  } catch (error) {
    console.error(`Failed to send message to renderer: ${error}`);
  }
}

export const getArtistWithAlbums = async (artist: string) => {
  try {
    if (!artist) {
      console.log("Missing artist name in getArtistWithAlbums");
      return {
        name: "Unknown Artist",
        albums: [],
        albumsWithSongs: [],
        songs: [],
      };
    }

    // Get all albums by this artist
    const artistAlbums = await db
      .select()
      .from(albums)
      .where(eq(albums.artist, artist))
      .orderBy(albums.year);

    // Get all songs by this artist (across all albums)
    const artistSongs = await db.query.songs.findMany({
      where: eq(songs.artist, artist),
      with: {
        album: true,
      },
      orderBy: (songs, { asc }) => [asc(songs.name)],
    });

    // Group songs by albums for better organization
    const albumsWithSongs = await Promise.all(
      artistAlbums.map(async (album) => {
        const albumSongs = await db.query.songs.findMany({
          where: eq(songs.albumId, album.id),
          with: {
            album: true,
          },
          orderBy: (songs, { asc }) => [asc(songs.name)],
        });

        return {
          ...album,
          songs: albumSongs,
        };
      }),
    );

    return {
      name: artist,
      albums: artistAlbums,
      albumsWithSongs: albumsWithSongs,
      songs: artistSongs,
    };
  } catch (error) {
    console.error(`Error in getArtistWithAlbums for "${artist}":`, error);
    return {
      name: artist || "Unknown Artist",
      albums: [],
      albumsWithSongs: [],
      songs: [],
    };
  }
};

export const searchSongs = async (query: string) => {
  if (!query || query.trim() === "") {
    return [];
  }

  // Normalize the search query
  const searchTerm = `%${query.toLowerCase().trim()}%`;

  // Efficiently search for songs matching the query across name, artist and album name
  const searchResults = await db.query.songs.findMany({
    where: or(
      like(songs.name, searchTerm),
      like(songs.artist, searchTerm),
      // Join with albums to search by album name
      exists(
        db
          .select()
          .from(albums)
          .where(
            and(eq(albums.id, songs.albumId), like(albums.name, searchTerm)),
          ),
      ),
    ),
    with: {
      album: true,
    },
    // Limit to a reasonable number to avoid performance issues
    limit: 100,
    orderBy: (songs, { asc }) => [asc(songs.name)],
  });

  return searchResults;
};

export const getAlbumsWithDuration = async (
  page: number = 1,
  limit: number = 15,
) => {
  // Get albums with pagination, including a more efficient duration calculation
  const albumsResult = await db
    .select()
    .from(albums)
    .orderBy(albums.name)
    .limit(limit)
    .offset((page - 1) * limit);

  // Get durations for these albums in a single batch query for better performance
  const albumIds = albumsResult.map((album) => album.id);

  // If no albums were found, return empty array
  if (albumIds.length === 0) {
    return [];
  }

  // Query total durations for all albums in a single database call
  const durationResults = await db
    .select({
      albumId: songs.albumId,
      totalDuration: sql`SUM(${songs.duration})`,
    })
    .from(songs)
    .where(sql`${songs.albumId} IN (${albumIds.join(",")})`)
    .groupBy(songs.albumId);

  // Create a duration lookup map for efficient access
  const durationMap = new Map();
  durationResults.forEach((result) => {
    durationMap.set(result.albumId, result.totalDuration || 0);
  });

  // Map the albums with their durations
  const albumsWithDurations = albumsResult.map((album) => {
    return {
      ...album,
      duration: durationMap.get(album.id) || 0,
    };
  });

  return albumsWithDurations;
};

// Add these functions at the end of the file

// LastFM related functions
export const updateLastFmSettings = async (data: {
  lastFmUsername: string;
  lastFmSessionKey: string;
  enableLastFm: boolean;
  scrobbleThreshold: number;
}) => {
  try {
    const currentSettings = await db.select().from(settings);

    if (currentSettings.length === 0) {
      // Create new settings if none exist
      await db.insert(settings).values({
        lastFmUsername: data.lastFmUsername,
        lastFmSessionKey: data.lastFmSessionKey,
        enableLastFm: data.enableLastFm,
        scrobbleThreshold: data.scrobbleThreshold || 50,
      });
    } else {
      // Update existing settings
      await db
        .update(settings)
        .set({
          lastFmUsername: data.lastFmUsername,
          lastFmSessionKey: data.lastFmSessionKey,
          enableLastFm: data.enableLastFm,
          scrobbleThreshold: data.scrobbleThreshold || 50,
        })
        .where(eq(settings.id, currentSettings[0].id));
    }

    return true;
  } catch (error) {
    console.error("Error updating LastFM settings:", error);
    return false;
  }
};

export const getLastFmSettings = async () => {
  try {
    const settingsRow = await db
      .select({
        lastFmUsername: settings.lastFmUsername,
        lastFmSessionKey: settings.lastFmSessionKey,
        enableLastFm: settings.enableLastFm,
        scrobbleThreshold: settings.scrobbleThreshold,
      })
      .from(settings)
      .limit(1);

    if (settingsRow.length === 0) {
      return {
        lastFmUsername: null,
        lastFmSessionKey: null,
        enableLastFm: false,
        scrobbleThreshold: 50,
      };
    }

    return settingsRow[0];
  } catch (error) {
    console.error("Error getting LastFM settings:", error);
    return {
      lastFmUsername: null,
      lastFmSessionKey: null,
      enableLastFm: false,
      scrobbleThreshold: 50,
    };
  }
};
