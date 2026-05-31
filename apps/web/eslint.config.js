import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/triple-slash-reference": "off",
      "react-hooks/static-components": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
      "react/no-unescaped-entities": "warn",
      "prefer-const": "error",
      "import/no-anonymous-default-export": "warn",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/server/audit",
              importNames: ["writeAuditLog"],
              message:
                "Use auditedMutation or auditedProtectedMutation in routers. Direct writeAuditLog is reserved for non-tRPC contexts (cron jobs, invitations, tenant-deletion).",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "coverage/**",
    "drizzle/**",
    "scripts/**",
    "next-env.d.ts",
  ]),
]);
