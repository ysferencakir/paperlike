import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated native project output — not source, and "build/**" above
    // only matches a top-level dir, not android/app/build.
    "android/**",
    // Parallel-agent worktrees are separate repositories, not root-project source.
    ".claude/**",
    // Vendored, pre-minified worker script (pdf.js) — not our source.
    "public/pdf.worker.min.mjs",
  ]),
]);

export default eslintConfig;
