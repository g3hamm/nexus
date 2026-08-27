import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages are compiled to dist before Next builds, so nothing
  // needs transpiling here. Kept explicit so the next person does not wonder.
  serverExternalPackages: ["@aws-sdk/client-kms"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // A seeker's browser should leak as little as possible about where
          // they came from and where they are going.
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            // Camera and microphone are opened deliberately when video ships,
            // not left available by default.
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default config;
