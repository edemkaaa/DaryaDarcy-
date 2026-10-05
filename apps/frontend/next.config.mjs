const target = process.env.API_PROXY_TARGET?.replace(/\/$/, "");

export default {
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],
  async rewrites() {
    if (!target) return [];
    return [
      { source: "/api/:path*", destination: `${target}/api/:path*` },
      { source: "/media/:path*", destination: `${target}/media/:path*` },
    ];
  },
};
