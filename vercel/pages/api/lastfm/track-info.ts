import { NextApiRequest, NextApiResponse } from "next";
import { LASTFM_CONFIG } from "../config";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // This endpoint requires a GET request
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { artist, track, username } = req.query;

    if (!artist || !track) {
      return res.status(400).json({
        success: false,
        error: "Artist and track parameters are required",
      });
    }

    // Build URL parameters
    const params = new URLSearchParams({
      method: "track.getInfo",
      artist: Array.isArray(artist) ? artist[0] : artist,
      track: Array.isArray(track) ? track[0] : track,
      api_key: LASTFM_CONFIG.API_KEY,
      format: "json",
    });

    // Add username if available (for loved status)
    if (username) {
      params.append(
        "username",
        Array.isArray(username) ? username[0] : username,
      );
    }

    // Make the request
    const url = `${LASTFM_CONFIG.API_URL}?${params.toString()}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      return res.status(400).json({
        success: false,
        error: `Last.fm error ${data.error}: ${data.message}`,
      });
    }

    // Return track info
    return res.status(200).json({
      success: true,
      track: data.track,
    });
  } catch (error) {
    console.error("Last.fm track info error:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred retrieving track information",
    });
  }
}
