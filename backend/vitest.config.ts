import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        setupFiles: ['dotenv/config'],
        include: ['tests/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            include: ['src/**/*.ts'],
            exclude: ['src/generated/**', 'src/lib/**', 'src/server.ts', 'src/app.ts', 'src/routes/**'],
            thresholds: {
                lines: 100,
                functions: 100,
                branches: 100,
                statements: 100,
            },
        },
    },
});
