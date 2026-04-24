import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const requireEnv = (key: string): string => {
    const value = process.env[key];
    if (!value) throw new Error(`Missing required environment variable: ${key}`);
    return value;
};

export default defineConfig(({ command }) => ({
    plugins: [vue()],
    server: command === 'serve' ? {
        proxy: {
            '/api': requireEnv('BACKEND_URL'),
        },
    } : undefined,
}));
