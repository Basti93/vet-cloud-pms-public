import path from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
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
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
      "react/no-unescaped-entities": "warn",
      "prefer-const": "error",
      "import/no-anonymous-default-export": "warn",
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

export default config;
