// Configuration for Last.fm API
// These credentials are stored on the server side and not exposed to clients
export const LASTFM_CONFIG = {
  API_KEY: process.env.LASTFM_API_KEY || "",
  API_SECRET: process.env.LASTFM_API_SECRET || "",
  API_URL: "https://ws.audioscrobbler.com/2.0/",
};
