import { NextApiRequest, NextApiResponse } from "next";
import { LASTFM_CONFIG } from "../config";
import { createFormData, generateSignature } from "../utils/lastfm";
import * as crypto from "crypto";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // This endpoint requires a POST request
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: "Username and password are required",
      });
    }

    // For Last.fm's auth.getMobileSession:
    // According to the API docs: http://www.last.fm/api/mobileauth

    // Set up the parameters for the API request
    const params: Record<string, string> = {
      method: "auth.getMobileSession",
      username: username,
      password: password, // Last.fm expects the plaintext password
      api_key: LASTFM_CONFIG.API_KEY,
    };

    // Generate signature
    params.api_sig = generateSignature(params);
    params.format = "json";

    // Create form data
    const formData = createFormData(params);

    // Make the request
    console.log("Making Last.fm auth request with params:", {
      ...params,
      password: "[HIDDEN]", // Don't log the password
      api_sig: "[SIGNATURE]", // Don't log the full signature
    });

    const response = await fetch(LASTFM_CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await response.json();

    if (data.error) {
      console.error("Last.fm auth error:", data);
      return res.status(400).json({
        success: false,
        error: `Last.fm error ${data.error}: ${data.message}`,
      });
    }

    // Return the session key
    return res.status(200).json({
      success: true,
      session: data.session,
    });
  } catch (error) {
    console.error("Last.fm authentication error:", error);
    return res.status(500).json({
      success: false,
      error: "An error occurred during authentication",
    });
  }
}
