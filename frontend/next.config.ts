import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server only serves /_next/* assets to the hostname it was started
  // with (localhost). The auth cookie is SameSite=Lax, so the dashboard has to
  // be browsed on the same hostname as the API — allow 127.0.0.1 as well, and
  // either hostname works in development.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
