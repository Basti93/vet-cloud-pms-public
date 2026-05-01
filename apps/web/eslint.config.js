import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/triple-slash-reference": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react/no-unescaped-entities": "warn",
      "prefer-const": "warn",
    },
  },
  {
    ignores: [
      "next-env.d.ts",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "drizzle/**",
      "scripts/**",
    ],
  },
];
