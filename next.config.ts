import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The runner and Amplify backend code are not part of the web bundle.
  outputFileTracingExcludes: { "*": ["amplify/**", "runner/**", "design/**", "video/**", "crew-app/**"] },
};

export default config;
