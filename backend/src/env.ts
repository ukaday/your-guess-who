const requireEnv = (key: string): string => {
    const value = process.env[key];
    if (!value)
        throw new Error(`Missing required environment variable: ${key}`);
    return value;
};

export const env = {
    DATABASE_URL: requireEnv('DATABASE_URL'),
    PORT: requireEnv('PORT'),
    FRONTEND_ORIGIN: requireEnv('FRONTEND_ORIGIN'),
};
