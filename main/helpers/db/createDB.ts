import Database from "better-sqlite3";
import { app } from "electron";
import path from "path";

export const sqlite = new Database(
  path.join(app.getPath("userData"), "wora.db"),
);

export const initDatabase = async () => {
  sqlite.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY,
        name TEXT,
        profilePicture TEXT,
        musicFolder TEXT
      );
      CREATE TABLE IF NOT EXISTS albums (
        id INTEGER PRIMARY KEY,
        name TEXT,
        artist TEXT,
        year INTEGER,
        cover TEXT
      );
      CREATE TABLE IF NOT EXISTS songs (
        id INTEGER PRIMARY KEY,
        filePath TEXT,
        name TEXT,
        artist TEXT,
        duration INTEGER,
        albumId INTEGER,
        FOREIGN KEY (albumId) REFERENCES albums(id)
      );
      CREATE TABLE IF NOT EXISTS playlists (
        id INTEGER PRIMARY KEY,
        name TEXT,
        description TEXT,
        cover TEXT
      );
      CREATE TABLE IF NOT EXISTS playlistSongs (
        playlistId INTEGER,
        songId INTEGER,
        FOREIGN KEY (playlistId) REFERENCES playlists(id),
        Foreign KEY (songId) REFERENCES songs(id)
      );
      CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS eqSettings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device TEXT NOT NULL DEFAULT 'Default',
        scope TEXT NOT NULL,
        key TEXT NOT NULL,
        curve TEXT NOT NULL,
        UNIQUE(device, scope, key)
      );
  `);
  sqlite.exec("INSERT OR IGNORE INTO devices (name) VALUES ('Default');");
};
