const requireEnv = (key: string): string => {
    const value = process.env[key];
    if (!value)
        throw new Error(`Missing required environment variable: ${key}`);
    return value;
};

const buildDatabaseUrl = (): string => {
    const explicit = process.env['DATABASE_URL'];
    if (explicit) return explicit;
    const username = encodeURIComponent(requireEnv('DB_USERNAME'));
    const password = encodeURIComponent(requireEnv('DB_PASSWORD'));
    const host = requireEnv('DB_HOST');
    const port = requireEnv('DB_PORT');
    const name = requireEnv('DB_NAME');
    return `postgresql://${username}:${password}@${host}:${port}/${name}`;
};

export const env = {
    DATABASE_URL: buildDatabaseUrl(),
    PORT: requireEnv('PORT'),
    FRONTEND_ORIGIN: requireEnv('FRONTEND_ORIGIN'),
    COGNITO_USER_POOL_ID: requireEnv('COGNITO_USER_POOL_ID'),
    COGNITO_CLIENT_ID: requireEnv('COGNITO_CLIENT_ID'),
    S3_BUCKET: requireEnv('S3_BUCKET'),
};
