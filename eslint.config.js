import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    { ignores: ['dist', 'public'] },
    {
        extends: [js.configs.recommended, ...tseslint.configs.recommended],
        files: ['**/*.{ts,tsx,js,jsx}'],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
        plugins: {
            'react-hooks': reactHooks,
            'react-refresh': reactRefresh,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "object-property-newline": ["error", { "allowAllPropertiesOnSameLine": true }],
            "object-curly-newline": [
                "error",
                {
                    "ObjectExpression": { "multiline": true },
                    "ObjectPattern": { "multiline": true, "minProperties": 1 },
                    "ImportDeclaration": { "multiline": true, "minProperties": 2 },
                    "ExportDeclaration": { "multiline": true, "minProperties": 3 }
                }
            ],
            "object-curly-spacing": ["error", "always"],
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
            'indent': ['error', 4],
            'curly': ['error', 'all'],
            '@typescript-eslint/no-explicit-any': 'off',
            'react-refresh/only-export-components': [
                'warn',
                { allowConstantExport: true },
            ],
        },
    },
)
