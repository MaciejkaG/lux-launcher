import globals from "globals";
import pluginJs from "@eslint/js";

export default [
    {
        languageOptions: { globals: globals.browser },
        files: ["static/assets/js/**/*.js"],
        rules: {
            semi: "error",
        },
    },
    pluginJs.configs.recommended,
];
