import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    prettier,
    {
        languageOptions: {
            parserOptions: {
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        files: ['src/socket/**/*.ts'],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        "UnaryExpression[operator='void'] > CallExpression[callee.name!='guard']",
                    message:
                        'Register socket handlers through the guard so a rejection cannot become an unhandled rejection.',
                },
                {
                    selector:
                        "CallExpression[callee.object.name='socket'][callee.property.name='on'] > :matches(ArrowFunctionExpression, FunctionExpression)[async=true]",
                    message:
                        'Do not pass an async function to socket.on. Call the handler through the guard so a rejection cannot become an unhandled rejection.',
                },
            ],
        },
    },
    {
        ignores: ['src/generated/**'],
    },
)
