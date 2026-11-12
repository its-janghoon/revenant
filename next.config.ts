import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The runner and Amplify backend code are not part of the web bundle.
  // The DESIGN.md linter reads spec-config.yaml next to its own file when it loads. Bundling bakes
  // in the build path, so it runs from node_modules and the file ships with the server.
  serverExternalPackages: ["@google/design.md"],
  outputFileTracingIncludes: { "*": ["node_modules/@google/design.md/dist/linter/**"] },
  outputFileTracingExcludes: { "*": ["amplify/**", "runner/**", "design/**", "video/**", "crew-app/**", "templates/**"] },
};

export default config;
