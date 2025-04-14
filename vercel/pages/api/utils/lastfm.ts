import * as crypto from "crypto";
import { LASTFM_CONFIG } from "../config";

/**
 * Generate MD5 hash for password authentication
 */
export const getMD5Auth = (username: string, password: string): string => {
  // Last.fm expects: md5(username + md5(password))
  const passwordHash = crypto.createHash("md5").update(password).digest("hex");
  return crypto
    .createHash("md5")
    .update(username.toLowerCase() + passwordHash)
    .digest("hex");
};

/**
 * Generate API signature for authenticated requests
 */
export const generateSignature = (params: Record<string, string>): string => {
  // Remove format parameter
  const signatureParams = { ...params };
  delete signatureParams.format;

  // Create signature string: alphabetically sorted param names + values + secret
  const signatureStr =
    Object.keys(signatureParams)
      .sort()
      .map((key) => key + signatureParams[key])
      .join("") + LASTFM_CONFIG.API_SECRET;

  // Return MD5 hash
  return crypto.createHash("md5").update(signatureStr).digest("hex");
};

/**
 * Create form data for POST requests
 */
export const createFormData = (
  params: Record<string, string>,
): URLSearchParams => {
  const formData = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    formData.append(key, value);
  });
  return formData;
};
