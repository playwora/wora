import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    status: "OK",
    message: "API is running properly!",
    endpoints: [
      "/api/lastfm/auth",
      "/api/lastfm/now-playing",
      "/api/lastfm/scrobble",
      "/api/lastfm/track-info",
      "/api/lastfm/user-info",
    ],
  });
}
