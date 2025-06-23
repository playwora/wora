/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ["lastfm.freetls.fastly.net"],
  },
};

module.exports = nextConfig;
