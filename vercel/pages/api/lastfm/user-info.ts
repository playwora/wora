import { NextApiRequest, NextApiResponse } from "next";
import { LASTFM_CONFIG } from "../config";
import { createFormData, generateSignature } from "../utils/lastfm";

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
    const { username, sessionKey } = req.query;

    if (!username) {
      return res.status(400).json({
        success: false,
        error: "Username parameter is required",
      });
    }

    // Build parameters for the API request
    const params: Record<string, string> = {
      method: "user.getInfo",
      user: Array.isArray(username) ? username[0] : username,
      api_key: LASTFM_CONFIG.API_KEY,
    };

    // If there's a session key, this is authenticated request (for private user data)
    let isAuthenticatedRequest = false;
    if (sessionKey && sessionKey !== "undefined" && sessionKey !== "null") {
      isAuthenticatedRequest = true;
      params.sk = Array.isArray(sessionKey) ? sessionKey[0] : sessionKey;
    }

    // Add signature for authenticated requests
    if (isAuthenticatedRequest) {
      params["api_sig"] = generateSignature(params);
    }
    params["format"] = "json";

    // Create request parameters
    let url: string;
    let options: RequestInit = {};

    if (isAuthenticatedRequest) {
      // For authenticated requests, use POST
      const formData = createFormData(params);
      url = LASTFM_CONFIG.API_URL;
      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      };
    } else {
      // For unauthenticated requests, use GET
      const queryParams = new URLSearchParams(params);
      url = `${LASTFM_CONFIG.API_URL}?${queryParams.toString()}`;
    }

    // Make the request
    const response = await fetch(url, options);
    const data = await response.json();

    if (data.error) {
      return res.status(400).json({
        success: false,
        error: `Last.fm error ${data.error}: ${data.message}`,
      });
    }

    // Return user info
    return res.status(200).json({
      success: true,
      user: data.user,
    });
  } catch (error) {
    console.error("Last.fm user info error:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred retrieving user information",
    });
  }
}
