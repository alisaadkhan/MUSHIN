import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const ignoreSupabaseEdgeFunctions = process.env.LINT_EDGE_FUNCTIONS !== "1";

export default tseslint.config(
  { ignores: ["dist", ...(ignoreSupabaseEdgeFunctions ? ["supabase/**"] : [])] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // This codebase intentionally uses `any` in a few integration/bridge layers
      // (Supabase dynamic payloads, analytics adapters, etc.). Treat it as a
      // warning to avoid blocking functional builds on type strictness.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
