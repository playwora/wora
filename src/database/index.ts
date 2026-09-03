import SQLite from 'expo-sqlite';
import { DATABASE_SCHEMA, SCHEMA_VERSION, TABLE_NAMES } from './schema';
import {
  Song,
  Album,
  Playlist,
  PlaylistSong,
  Settings,
  PlaylistLyricsCache,
  LibraryStats,
  LyricLine,
} from '../types';

// Initialize database
let db: SQLite.WebSQLDatabase;

export const initDatabase = async (): Promise<SQLite.WebSQLDatabase> => {
  db = SQLite.openDatabase('wora.db');
  
  // Enable foreign key constraints
  await new Promise<void>((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'PRAGMA foreign_keys = ON;',
        [],
        () => resolve(),
        (_, error) => reject(error)
      );
    });
  });

  // Create tables
  await new Promise<void>((resolve, reject) => {
    db.transaction(tx => {
      const statements = DATABASE_SCHEMA.split(';').filter(s => s.trim());
      statements.forEach(statement => {
        tx.executeSql(statement, [], () => {}, (_, error) => {
          console.error('Error executing SQL:', error);
          return false;
        });
      });
      resolve();
    }, (_, error) => reject(error));
  });

  return db;
};

export const getDatabase = (): SQLite.WebSQLDatabase => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
};

// ============ Settings Operations ============

export const getSettings = async (): Promise<Settings | null> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM ${TABLE_NAMES.SETTINGS} LIMIT 1`,
        [],
        (_, { rows }) => {
          if (rows.length > 0) {
            resolve(rows.item(0));
          } else {
            resolve(null);
          }
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const updateSettings = async (settings: Partial<Settings>): Promise<Settings> => {
  const existingSettings = await getSettings();
  
  const updatedSettings = { ...existingSettings, ...settings };
  
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      if (existingSettings) {
        tx.executeSql(
          `UPDATE ${TABLE_NAMES.SETTINGS} SET name=?, profilePicture=?, musicFolder=?, lastFmUsername=?, lastFmSessionKey=?, enableLastFm=?, scrobbleThreshold=? WHERE id=?`,
          [
            updatedSettings.name,
            updatedSettings.profilePicture,
            updatedSettings.musicFolder,
            updatedSettings.lastFmUsername,
            updatedSettings.lastFmSessionKey,
            updatedSettings.enableLastFm ? 1 : 0,
            updatedSettings.scrobbleThreshold,
            updatedSettings.id
          ],
          (_, { rowsAffected }) => {
            if (rowsAffected > 0) {
              resolve(updatedSettings);
            } else {
              reject(new Error('Failed to update settings'));
            }
          },
          (_, error) => reject(error)
        );
      } else {
        tx.executeSql(
          `INSERT INTO ${TABLE_NAMES.SETTINGS} (name, profilePicture, musicFolder, lastFmUsername, lastFmSessionKey, enableLastFm, scrobbleThreshold) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            updatedSettings.name,
            updatedSettings.profilePicture,
            updatedSettings.musicFolder,
            updatedSettings.lastFmUsername,
            updatedSettings.lastFmSessionKey,
            updatedSettings.enableLastFm ? 1 : 0,
            updatedSettings.scrobbleThreshold || 50
          ],
          (_, { insertId }) => {
            resolve({ ...updatedSettings, id: insertId });
          },
          (_, error) => reject(error)
        );
      }
    });
  });
};

// ============ Album Operations ============

export const insertAlbum = async (album: Omit<Album, 'id'>): Promise<Album> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO ${TABLE_NAMES.ALBUMS} (name, artist, year, cover) VALUES (?, ?, ?, ?)`,
        [album.name, album.artist, album.year || null, album.cover || null],
        (_, { insertId }) => {
          resolve({ ...album, id: insertId });
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const getAlbums = async (page: number = 1, limit: number = 20): Promise<Album[]> => {
  const offset = (page - 1) * limit;
  
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM ${TABLE_NAMES.ALBUMS} ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?`,
        [limit, offset],
        (_, { rows }) => {
          const albums: Album[] = [];
          for (let i = 0; i < rows.length; i++) {
            albums.push(rows.item(i));
          }
          resolve(albums);
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const getAlbumById = async (id: number): Promise<Album | null> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM ${TABLE_NAMES.ALBUMS} WHERE id = ?`,
        [id],
        (_, { rows }) => {
          if (rows.length > 0) {
            resolve(rows.item(0));
          } else {
            resolve(null);
          }
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const getAlbumWithSongs = async (albumId: number): Promise<Album | null> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT a.*, s.id as songId, s.filePath, s.name as songName, s.artist as songArtist, s.duration as songDuration, s.albumId as songAlbumId FROM ${TABLE_NAMES.ALBUMS} a LEFT JOIN ${TABLE_NAMES.SONGS} s ON a.id = s.albumId WHERE a.id = ? ORDER BY s.name COLLATE NOCASE`,
        [albumId],
        (_, { rows }) => {
          if (rows.length === 0) {
            resolve(null);
            return;
          }
          
          const album = rows.item(0);
          const songs: Song[] = [];
          
          for (let i = 0; i < rows.length; i++) {
            const row = rows.item(i);
            if (row.songId) {
              songs.push({
                id: row.songId,
                filePath: row.filePath,
                name: row.songName,
                artist: row.songArtist,
                duration: row.songDuration,
                albumId: row.songAlbumId,
              });
            }
          }
          
          resolve({ ...album, songs });
        },
        (_, error) => reject(error)
      );
    });
  });
};

// ============ Song Operations ============

export const insertSong = async (song: Omit<Song, 'id'>): Promise<Song> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO ${TABLE_NAMES.SONGS} (filePath, name, artist, duration, albumId) VALUES (?, ?, ?, ?, ?)`,
        [song.filePath, song.name, song.artist, song.duration, song.albumId || null],
        (_, { insertId }) => {
          resolve({ ...song, id: insertId });
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const getSongs = async (page: number = 1, limit: number = 20): Promise<{ songs: Song[]; total: number }> => {
  const offset = (page - 1) * limit;
  
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Get total count
      tx.executeSql(
        `SELECT COUNT(*) as count FROM ${TABLE_NAMES.SONGS}`,
        [],
        (_, { rows }) => {
          const total = rows.item(0).count;
          
          // Get songs
          tx.executeSql(
            `SELECT s.*, a.name as albumName, a.artist as albumArtist, a.cover as albumCover, a.year as albumYear FROM ${TABLE_NAMES.SONGS} s LEFT JOIN ${TABLE_NAMES.ALBUMS} a ON s.albumId = a.id ORDER BY s.name COLLATE NOCASE LIMIT ? OFFSET ?`,
            [limit, offset],
            (_, { rows: songRows }) => {
              const songs: Song[] = [];
              for (let i = 0; i < songRows.length; i++) {
                const row = songRows.item(i);
                songs.push({
                  id: row.id,
                  filePath: row.filePath,
                  name: row.name,
                  artist: row.artist,
                  duration: row.duration,
                  albumId: row.albumId,
                  album: row.albumId ? {
                    id: row.albumId,
                    name: row.albumName,
                    artist: row.albumArtist,
                    cover: row.albumCover,
                    year: row.albumYear,
                  } : undefined,
                });
              }
              resolve({ songs, total });
            },
            (_, error) => reject(error)
          );
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const getSongById = async (id: number): Promise<Song | null> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT s.*, a.name as albumName, a.artist as albumArtist, a.cover as albumCover, a.year as albumYear FROM ${TABLE_NAMES.SONGS} s LEFT JOIN ${TABLE_NAMES.ALBUMS} a ON s.albumId = a.id WHERE s.id = ?`,
        [id],
        (_, { rows }) => {
          if (rows.length > 0) {
            const row = rows.item(0);
            resolve({
              id: row.id,
              filePath: row.filePath,
              name: row.name,
              artist: row.artist,
              duration: row.duration,
              albumId: row.albumId,
              album: row.albumId ? {
                id: row.albumId,
                name: row.albumName,
                artist: row.albumArtist,
                cover: row.albumCover,
                year: row.albumYear,
              } : undefined,
            });
          } else {
            resolve(null);
          }
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const searchSongs = async (query: string): Promise<Song[]> => {
  const searchTerm = `%${query}%`;
  
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT s.*, a.name as albumName, a.artist as albumArtist, a.cover as albumCover, a.year as albumYear FROM ${TABLE_NAMES.SONGS} s LEFT JOIN ${TABLE_NAMES.ALBUMS} a ON s.albumId = a.id WHERE s.name LIKE ? OR s.artist LIKE ? OR a.name LIKE ? ORDER BY s.name COLLATE NOCASE LIMIT 50`,
        [searchTerm, searchTerm, searchTerm],
        (_, { rows }) => {
          const songs: Song[] = [];
          for (let i = 0; i < rows.length; i++) {
            const row = rows.item(i);
            songs.push({
              id: row.id,
              filePath: row.filePath,
              name: row.name,
              artist: row.artist,
              duration: row.duration,
              albumId: row.albumId,
              album: row.albumId ? {
                id: row.albumId,
                name: row.albumName,
                artist: row.albumArtist,
                cover: row.albumCover,
                year: row.albumYear,
              } : undefined,
            });
          }
          resolve(songs);
        },
        (_, error) => reject(error)
      );
    });
  });
};

// ============ Playlist Operations ============

export const createPlaylist = async (playlist: Omit<Playlist, 'id' | 'createdAt'>): Promise<Playlist> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO ${TABLE_NAMES.PLAYLISTS} (name, description, cover) VALUES (?, ?, ?)`,
        [playlist.name, playlist.description, playlist.cover],
        (_, { insertId }) => {
          resolve({ ...playlist, id: insertId, createdAt: new Date().toISOString() });
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const getPlaylists = async (): Promise<Playlist[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM ${TABLE_NAMES.PLAYLISTS} ORDER BY name COLLATE NOCASE`,
        [],
        (_, { rows }) => {
          const playlists: Playlist[] = [];
          for (let i = 0; i < rows.length; i++) {
            playlists.push(rows.item(i));
          }
          resolve(playlists);
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const getPlaylistById = async (id: number): Promise<Playlist | null> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT * FROM ${TABLE_NAMES.PLAYLISTS} WHERE id = ?`,
        [id],
        (_, { rows }) => {
          if (rows.length > 0) {
            resolve(rows.item(0));
          } else {
            resolve(null);
          }
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const getPlaylistWithSongs = async (playlistId: number): Promise<Playlist | null> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT p.*, s.id as songId, s.filePath, s.name as songName, s.artist as songArtist, s.duration as songDuration, s.albumId as songAlbumId, a.name as albumName, a.artist as albumArtist, a.cover as albumCover, a.year as albumYear FROM ${TABLE_NAMES.PLAYLISTS} p LEFT JOIN ${TABLE_NAMES.PLAYLIST_SONGS} ps ON p.id = ps.playlistId LEFT JOIN ${TABLE_NAMES.SONGS} s ON ps.songId = s.id LEFT JOIN ${TABLE_NAMES.ALBUMS} a ON s.albumId = a.id WHERE p.id = ? ORDER BY ps.addedAt`,
        [playlistId],
        (_, { rows }) => {
          if (rows.length === 0) {
            resolve(null);
            return;
          }
          
          const playlist = rows.item(0);
          const songs: Song[] = [];
          
          for (let i = 0; i < rows.length; i++) {
            const row = rows.item(i);
            if (row.songId) {
              songs.push({
                id: row.songId,
                filePath: row.filePath,
                name: row.songName,
                artist: row.songArtist,
                duration: row.songDuration,
                albumId: row.songAlbumId,
                album: row.songAlbumId ? {
                  id: row.songAlbumId,
                  name: row.albumName,
                  artist: row.albumArtist,
                  cover: row.albumCover,
                  year: row.albumYear,
                } : undefined,
              });
            }
          }
          
          resolve({ ...playlist, songs });
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const updatePlaylist = async (playlist: Playlist): Promise<Playlist> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `UPDATE ${TABLE_NAMES.PLAYLISTS} SET name=?, description=?, cover=? WHERE id=?`,
        [playlist.name, playlist.description, playlist.cover, playlist.id],
        (_, { rowsAffected }) => {
          if (rowsAffected > 0) {
            resolve(playlist);
          } else {
            reject(new Error('Playlist not found'));
          }
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const deletePlaylist = async (playlistId: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `DELETE FROM ${TABLE_NAMES.PLAYLISTS} WHERE id=?`,
        [playlistId],
        (_, { rowsAffected }) => {
          resolve(rowsAffected > 0);
        },
        (_, error) => reject(error)
      );
    });
  });
};

// ============ Playlist-Song Operations ============

export const addSongToPlaylist = async (playlistId: number, songId: number): Promise<PlaylistSong> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT OR IGNORE INTO ${TABLE_NAMES.PLAYLIST_SONGS} (playlistId, songId) VALUES (?, ?)`,
        [playlistId, songId],
        (_, { insertId }) => {
          if (insertId > 0) {
            resolve({ playlistId, songId });
          } else {
            // Already exists
            resolve({ playlistId, songId });
          }
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const removeSongFromPlaylist = async (playlistId: number, songId: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `DELETE FROM ${TABLE_NAMES.PLAYLIST_SONGS} WHERE playlistId=? AND songId=?`,
        [playlistId, songId],
        (_, { rowsAffected }) => {
          resolve(rowsAffected > 0);
        },
        (_, error) => reject(error)
      );
    });
  });
};

// ============ Lyrics Cache Operations ============

export const savePlaylistLyrics = async (
  playlistId: number,
  songId: number,
  lyrics: LyricLine[],
  isSynced: boolean
): Promise<PlaylistLyricsCache> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT OR REPLACE INTO ${TABLE_NAMES.PLAYLIST_LYRICS_CACHE} (playlistId, songId, lyrics, isSynced, fetchedAt) VALUES (?, ?, ?, ?, ?)`,
        [
          playlistId,
          songId,
          JSON.stringify(lyrics),
          isSynced ? 1 : 0,
          new Date().toISOString()
        ],
        (_, { insertId }) => {
          resolve({
            id: insertId,
            playlistId,
            songId,
            lyrics: JSON.stringify(lyrics),
            isSynced,
            fetchedAt: new Date().toISOString()
          });
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const getCachedLyrics = async (playlistId: number, songId: number): Promise<LyricLine[] | null> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT lyrics, isSynced FROM ${TABLE_NAMES.PLAYLIST_LYRICS_CACHE} WHERE playlistId=? AND songId=?`,
        [playlistId, songId],
        (_, { rows }) => {
          if (rows.length > 0) {
            const row = rows.item(0);
            try {
              const lyrics: LyricLine[] = JSON.parse(row.lyrics);
              resolve(lyrics);
            } catch (e) {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const getAllCachedLyricsForPlaylist = async (playlistId: number): Promise<Map<number, LyricLine[]>> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT songId, lyrics FROM ${TABLE_NAMES.PLAYLIST_LYRICS_CACHE} WHERE playlistId=?`,
        [playlistId],
        (_, { rows }) => {
          const lyricsMap = new Map<number, LyricLine[]>();
          for (let i = 0; i < rows.length; i++) {
            const row = rows.item(i);
            try {
              const lyrics: LyricLine[] = JSON.parse(row.lyrics);
              lyricsMap.set(row.songId, lyrics);
            } catch (e) {
              console.error('Error parsing cached lyrics:', e);
            }
          }
          resolve(lyricsMap);
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const deleteCachedLyrics = async (playlistId: number, songId: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `DELETE FROM ${TABLE_NAMES.PLAYLIST_LYRICS_CACHE} WHERE playlistId=? AND songId=?`,
        [playlistId, songId],
        (_, { rowsAffected }) => {
          resolve(rowsAffected > 0);
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const clearPlaylistLyricsCache = async (playlistId: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `DELETE FROM ${TABLE_NAMES.PLAYLIST_LYRICS_CACHE} WHERE playlistId=?`,
        [playlistId],
        (_, { rowsAffected }) => {
          resolve(rowsAffected > 0);
        },
        (_, error) => reject(error)
      );
    });
  });
};

// ============ Favorites Operations ============

export const addToFavorites = async (songId: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT OR IGNORE INTO ${TABLE_NAMES.FAVORITES} (songId) VALUES (?)`,
        [songId],
        (_, { insertId }) => {
          resolve(insertId > 0);
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const removeFromFavorites = async (songId: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `DELETE FROM ${TABLE_NAMES.FAVORITES} WHERE songId=?`,
        [songId],
        (_, { rowsAffected }) => {
          resolve(rowsAffected > 0);
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const isSongFavorite = async (songId: number): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT 1 FROM ${TABLE_NAMES.FAVORITES} WHERE songId=?`,
        [songId],
        (_, { rows }) => {
          resolve(rows.length > 0);
        },
        (_, error) => reject(error)
      );
    });
  });
};

export const getFavorites = async (): Promise<Song[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT s.*, a.name as albumName, a.artist as albumArtist, a.cover as albumCover, a.year as albumYear FROM ${TABLE_NAMES.SONGS} s LEFT JOIN ${TABLE_NAMES.ALBUMS} a ON s.albumId = a.id LEFT JOIN ${TABLE_NAMES.FAVORITES} f ON s.id = f.songId ORDER BY f.addedAt DESC`,
        [],
        (_, { rows }) => {
          const songs: Song[] = [];
          for (let i = 0; i < rows.length; i++) {
            const row = rows.item(i);
            songs.push({
              id: row.id,
              filePath: row.filePath,
              name: row.name,
              artist: row.artist,
              duration: row.duration,
              albumId: row.albumId,
              album: row.albumId ? {
                id: row.albumId,
                name: row.albumName,
                artist: row.albumArtist,
                cover: row.albumCover,
                year: row.albumYear,
              } : undefined,
            });
          }
          resolve(songs);
        },
        (_, error) => reject(error)
      );
    });
  });
};

// ============ Statistics Operations ============

export const getLibraryStats = async (): Promise<LibraryStats> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `SELECT COUNT(*) as totalSongs FROM ${TABLE_NAMES.SONGS}`,
        [],
        (_, { rows: songRows }) => {
          const totalSongs = songRows.item(0).totalSongs;
          
          tx.executeSql(
            `SELECT COUNT(*) as totalAlbums FROM ${TABLE_NAMES.ALBUMS}`,
            [],
            (_, { rows: albumRows }) => {
              const totalAlbums = albumRows.item(0).totalAlbums;
              
              tx.executeSql(
                `SELECT COUNT(DISTINCT artist) as totalArtists FROM ${TABLE_NAMES.SONGS}`,
                [],
                (_, { rows: artistRows }) => {
                  const totalArtists = artistRows.item(0).totalArtists;
                  
                  tx.executeSql(
                    `SELECT COUNT(*) as totalPlaylists FROM ${TABLE_NAMES.PLAYLISTS}`,
                    [],
                    (_, { rows: playlistRows }) => {
                      const totalPlaylists = playlistRows.item(0).totalPlaylists;
                      
                      tx.executeSql(
                        `SELECT SUM(duration) as totalDuration FROM ${TABLE_NAMES.SONGS}`,
                        [],
                        (_, { rows: durationRows }) => {
                          const totalDuration = durationRows.item(0).totalDuration || 0;
                          
                          resolve({
                            totalSongs,
                            totalAlbums,
                            totalArtists,
                            totalPlaylists,
                            totalDuration,
                          });
                        },
                        (_, error) => reject(error)
                      );
                    },
                    (_, error) => reject(error)
                  );
                },
                (_, error) => reject(error)
              );
            },
            (_, error) => reject(error)
          );
        },
        (_, error) => reject(error)
      );
    });
  });
};

// ============ Clear Database ============

export const clearDatabase = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      const tables = Object.values(TABLE_NAMES);
      let completed = 0;
      const total = tables.length;
      
      tables.forEach(table => {
        tx.executeSql(
          `DELETE FROM ${table}`,
          [],
          () => {
            completed++;
            if (completed === total) {
              resolve();
            }
          },
          (_, error) => reject(error)
        );
      });
    });
  });
};

// ============ Batch Operations ============

export const insertAlbumsBatch = async (albums: Omit<Album, 'id'>[]): Promise<Album[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      const insertedAlbums: Album[] = [];
      let completed = 0;
      const total = albums.length;
      
      albums.forEach(album => {
        tx.executeSql(
          `INSERT OR IGNORE INTO ${TABLE_NAMES.ALBUMS} (name, artist, year, cover) VALUES (?, ?, ?, ?)`,
          [album.name, album.artist, album.year || null, album.cover || null],
          (_, { insertId }) => {
            insertedAlbums.push({ ...album, id: insertId });
            completed++;
            if (completed === total) {
              resolve(insertedAlbums);
            }
          },
          (_, error) => reject(error)
        );
      });
    });
  });
};

export const insertSongsBatch = async (songs: Omit<Song, 'id'>[]): Promise<Song[]> => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      const insertedSongs: Song[] = [];
      let completed = 0;
      const total = songs.length;
      
      songs.forEach(song => {
        tx.executeSql(
          `INSERT OR IGNORE INTO ${TABLE_NAMES.SONGS} (filePath, name, artist, duration, albumId) VALUES (?, ?, ?, ?, ?)`,
          [song.filePath, song.name, song.artist, song.duration, song.albumId || null],
          (_, { insertId }) => {
            insertedSongs.push({ ...song, id: insertId });
            completed++;
            if (completed === total) {
              resolve(insertedSongs);
            }
          },
          (_, error) => reject(error)
        );
      });
    });
  });
};
