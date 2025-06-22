import { and, eq, like, sql } from "drizzle-orm";
import { albums, songs, settings, playlistSongs, playlists } from "./schema";
import fs from "fs";
import { parseFile, selectCover } from "music-metadata";
import path from "path";
import { BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { sqlite } from "./createDB";
import { app } from 'electron';

const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, { schema });

const APP_DATA = app.getPath('userData');
const ART_DIR = path.join(APP_DATA, 'utilities/uploads/covers');

const audioExtensions = [
  ".mp3", ".mpeg", ".opus", ".ogg", ".oga", ".wav", ".aac",
  ".caf", ".m4a", ".m4b", ".mp4", ".weba", ".webm", ".dolby", ".flac"
];

const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"];

function findFirstImageInDirectory(dir: string): string | null {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isFile() && imageExtensions.includes(path.extname(file).toLowerCase())) {
      return filePath;
    }
  }
  return null;
}

function readFilesRecursively(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(readFilesRecursively(filePath));
    } else if (audioExtensions.includes(path.extname(filePath).toLowerCase())) {
      results.push(filePath);
    }
  });
  return results;
}

export const getLibraryStats = async () => {
  const songCount = await db.select({ count: sql`count(*)` }).from(songs);
  const albumCount = await db.select({ count: sql`count(*)` }).from(albums);
  const playlistCount = await db.select({ count: sql`count(*)` }).from(playlists);

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

export const getSongs = async () => {
  return await db.select().from(songs).orderBy(songs.name);
};

export const getAlbums = async (page: number, limit: number = 15) => {
  return await db
    .select()
    .from(albums)
    .orderBy(albums.name)
    .limit(limit)
    .offset((page - 1) * limit);
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
    where: and(eq(playlistSongs.playlistId, 1), eq(playlistSongs.songId, song.id)),
  });

  return !!isFavourite;
};

export const addToFavourites = async (songId: number) => {
  const existingEntry = await db
    .select()
    .from(playlistSongs)
    .where(and(eq(playlistSongs.playlistId, 1), eq(playlistSongs.songId, songId)));

  if (!existingEntry[0]) {
    await db.insert(playlistSongs).values({
      playlistId: 1,
      songId,
    });
  } else {
    await db
      .delete(playlistSongs)
      .where(and(eq(playlistSongs.playlistId, 1), eq(playlistSongs.songId, songId)));
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

  return { searchAlbums, searchPlaylists, searchSongs };
};

export const addSongToPlaylist = async (playlistId: number, songId: number) => {
  const checkIfExists = await db.query.playlistSongs.findFirst({
    where: and(eq(playlistSongs.playlistId, playlistId), eq(playlistSongs.songId, songId)),
  });

  if (checkIfExists) return false;

  await db.insert(playlistSongs).values({
    playlistId,
    songId,
  });

  return true;
};

export const removeSongFromPlaylist = async (playlistId: number, songId: number) => {
  await db
    .delete(playlistSongs)
    .where(and(eq(playlistSongs.playlistId, playlistId), eq(playlistSongs.songId, songId)));

  return true;
};

export const getRandomLibraryItems = async () => {
  const randomAlbums = await db
    .select()
    .from(albums)
    .orderBy(sql`RANDOM()`)
    .limit(10);

  const randomSongs = await db.query.songs.findMany({
    with: { album: true },
    limit: 10,
    orderBy: sql`RANDOM()`,
  });

  return {
    albums: randomAlbums,
    songs: randomSongs,
  };
};

export const initializeData = async (musicFolder: string) => {
  const currentFiles = readFilesRecursively(musicFolder);
  const dbFiles = await db.select().from(songs);

  const deletedFiles = dbFiles.filter(
    (dbFile) => !currentFiles.includes(dbFile.filePath)
  );

  if (deletedFiles.length > 0) {
    await db.transaction(async (tx) => {
      for (const file of deletedFiles) {
        await tx.delete(playlistSongs).where(eq(playlistSongs.songId, file.id));
        await tx.delete(songs).where(eq(songs.filePath, file.filePath));
      }
    });
  }

  for (const file of currentFiles) {
    const dbFile = dbFiles.find((dbFile) => dbFile.filePath === file);
    const metadata = await parseFile(file, {
      skipPostHeaders: true,
    });

    let artPath;

    const albumFolder = path.dirname(file);
    const albumImage = findFirstImageInDirectory(albumFolder);

    if (albumImage) {
      const imageData = fs.readFileSync(albumImage);
      const imageExt = path.extname(albumImage).slice(1);
      const hash = require('crypto').createHash('md5').update(imageData).digest('hex');
      artPath = path.join(ART_DIR, `${hash}.${imageExt}`);

      if (!fs.existsSync(artPath)) {
        await fs.promises.mkdir(ART_DIR, { recursive: true });
        await fs.promises.writeFile(artPath, imageData);
      }
    } else {
      const cover = selectCover(metadata.common.picture);

      if (cover) {
        const hash = require('crypto').createHash('md5').update(cover.data).digest('hex');
        artPath = path.join(ART_DIR, `${hash}.${cover.format.split('/')[1]}`);

        if (!fs.existsSync(artPath)) {
          await fs.promises.mkdir(ART_DIR, { recursive: true });
          await fs.promises.writeFile(artPath, cover.data);
        }
      }
    }

    let albumsFound = await db
      .select()
      .from(albums)
      .where(eq(albums.name, metadata.common.album));

    let album = albumsFound[0];

    if (!album) {
      const [newAlbum] = await db
        .insert(albums)
        .values({
          name: metadata.common.album,
          artist:
            metadata.common.albumartist ||
            metadata.common.artist ||
            "Various Artists",
          year: metadata.common.year,
          cover: artPath,
        })
        .returning();

      album = newAlbum;
    } else {
      // @hiaaryan: Update Album if Artist or Cover is different
      if (
        album.artist !==
        (metadata.common.albumartist || metadata.common.artist) ||
        album.year !== metadata.common.year ||
        album.cover !== artPath
      ) {
        await db
          .update(albums)
          .set({
            artist:
              metadata.common.albumartist ||
              metadata.common.artist ||
              "Various Artists",
            year: metadata.common.year,
            cover: artPath,
          })
          .where(eq(albums.id, album.id));
      }
    }

    if (!dbFile) {
      // @hiaaryan: Add New File
      await db.insert(songs).values({
        filePath: file,
        name: metadata.common.title,
        artist: metadata.common.artist,
        duration: Math.round(metadata.format.duration),
        albumId: album.id,
      });
    } else if (
      dbFile.name !== metadata.common.title ||
      dbFile.artist !== metadata.common.artist ||
      dbFile.duration !== Math.round(metadata.format.duration) ||
      dbFile.albumId !== album.id
    ) {
      // @hiaaryan: Update File
      await db
        .update(songs)
        .set({
          name: metadata.common.title,
          artist: metadata.common.artist,
          duration: Math.round(metadata.format.duration),
          albumId: album.id,
        })
        .where(eq(songs.filePath, file));
    }
  }

  // @hiaryan: Detect Empty Albums
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

  // @hiaaryan: Create Default Playlist
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
    await db
      .update(settings)
      .set({ musicFolder })
      .where(eq(settings.id, 1));
  } else {
    await db.insert(settings).values({ musicFolder });
  }
};