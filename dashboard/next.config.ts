import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["gray-matter"],
  async rewrites() {
    return [
      {
        source: "/vault-assets/:path*",
        destination: "/api/vault-asset?path=:path*",
      },
    ];
  },
};

export default nextConfig;
