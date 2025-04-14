/** @type {import('next').NextConfig} */

module.exports = {
  // Use output: 'export' since we're integrating with Electron
  output: "export",
  distDir: process.env.NODE_ENV === "production" ? "../app" : ".next",
  trailingSlash: true,
  images: {
    unoptimized: true, // Required for static export
    domains: ['lastfm.freetls.fastly.net'], // Allow Last.fm images
  },
  webpack: (config) => {
    return config;
  },
};
