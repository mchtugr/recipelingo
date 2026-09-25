import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.output/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.wxt/**",
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  react.configs.flat.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ["**/*.{js,mjs,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["lib/translation/annotation-formatters/script.js"],
    languageOptions: {
      globals: {
        copy: "readonly",
      },
    },
  },
  {
    files: ["**/*.test.{js,mjs,ts,tsx}", "**/*.spec.{js,mjs,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  prettier,
);
