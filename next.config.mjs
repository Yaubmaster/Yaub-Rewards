/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/rewards',
  async redirects() {
    return [
      {
        source: '/',
        destination: '/rewards',
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
