import { integer, sqliteTable, text, blob } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const settings = sqliteTable("settings", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name"),
  profilePicture: text("profilePicture"),
  musicFolder: text("musicFolder"),
  lastFmUsername: text("lastFmUsername"),
  lastFmSessionKey: text("lastFmSessionKey"),
  enableLastFm: integer("enableLastFm", { mode: "boolean" }).default(false),
  scrobbleThreshold: integer("scrobbleThreshold").default(50),
});

export const albums = sqliteTable("albums", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name"),
  artist: text("artist"),
  year: integer("year"),
  cover: text("cover"),
});

export const songs = sqliteTable("songs", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  filePath: text("filePath"),
  name: text("name"),
  artist: text("artist"),
  duration: integer("duration"),
  albumId: integer("albumId").references(() => albums.id),
});

export const albumsRelations = relations(albums, ({ many }) => ({
  songs: many(songs),
}));

export const songsRelations = relations(songs, ({ one }) => ({
  album: one(albums, {
    fields: [songs.albumId],
    references: [albums.id],
  }),
}));

export const playlists = sqliteTable("playlists", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  cover: text("cover").notNull(),
});

export const playlistSongs = sqliteTable("playlistSongs", {
  playlistId: integer("playlistId").references(() => playlists.id, {
    onDelete: "cascade",
  }),
  songId: integer("songId").references(() => songs.id, {
    onDelete: "cascade",
  }),
});

export const playlistRelations = relations(playlists, ({ many }) => ({
  songs: many(playlistSongs),
}));

export const playlistSongRelations = relations(playlistSongs, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistSongs.playlistId],
    references: [playlists.id],
  }),
  song: one(songs, { fields: [playlistSongs.songId], references: [songs.id] }),
}));
