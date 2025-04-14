import React from "react";

export default function Home() {
  return (
    <div
      style={{
        padding: "20px",
        maxWidth: "800px",
        margin: "0 auto",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>WORA Last.fm API</h1>
      <p>
        This is a serverless API for Last.fm integration. The following
        endpoints are available:
      </p>

      <ul style={{ lineHeight: 1.6 }}>
        <li>
          <strong>POST /api/lastfm/auth</strong> - Authenticate with Last.fm
        </li>
        <li>
          <strong>POST /api/lastfm/now-playing</strong> - Update now playing
          status
        </li>
        <li>
          <strong>POST /api/lastfm/scrobble</strong> - Scrobble a track
        </li>
        <li>
          <strong>GET /api/lastfm/track-info</strong> - Get track information
        </li>
        <li>
          <strong>GET /api/lastfm/user-info</strong> - Get user information
        </li>
      </ul>

      <p>
        <a href="/api" style={{ color: "#0070f3", textDecoration: "none" }}>
          Test API Status
        </a>
      </p>
    </div>
  );
}
