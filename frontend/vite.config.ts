import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

const requireEnv = (env: Record<string, string>, key: string): string => {
    const value = env[key];
    if (!value) throw new Error(`Missing required environment variable: ${key}`);
    return value;
};

export default defineConfig(({ command, mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [vue()],
        server: command === 'serve' ? {
            proxy: {
                '/api': requireEnv(env, 'BACKEND_URL'),
            },
        } : undefined,
    };
});
