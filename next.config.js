const ghPages = !!process.env.GHPAGES_EXPORT;

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  /* config options here */
  assetPrefix: ghPages ? '/hareonna/' : undefined,
}

module.exports = nextConfig