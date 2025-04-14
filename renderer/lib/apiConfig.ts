// Configure API URLs based on environment
const isDev = process.env.NODE_ENV === "development";

// Your Vercel deployment URL
const PROD_API_URL = "https://wora-ten.vercel.app";
const DEV_API_URL = "http://localhost:3000";

// Use localhost for development, the Vercel URL for production
export const API_BASE_URL = isDev ? DEV_API_URL : PROD_API_URL;

// Helper function to construct API endpoints
export const apiEndpoint = (path: string): string => {
  return `${API_BASE_URL}${path}`;
};
