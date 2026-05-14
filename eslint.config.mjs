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
    // Prisma Client gerado — não é código que mantemos.
    "src/generated/**",
    // Worktrees de sessões anteriores do Claude — não fazem parte da build.
    ".claude/worktrees/**",
  ]),
]);

export default eslintConfig;
