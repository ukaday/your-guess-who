import "dotenv/config";
import { defineConfig } from "prisma/config";

const buildDatabaseUrl = (): string | undefined => {
    const explicit = process.env["DATABASE_URL"];
    if (explicit) return explicit;
    const username = process.env["DB_USERNAME"];
    const password = process.env["DB_PASSWORD"];
    const host = process.env["DB_HOST"];
    const port = process.env["DB_PORT"];
    const name = process.env["DB_NAME"];
    if (!username || !password || !host || !port || !name) return undefined;
    return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
};

export default defineConfig({
    schema: "prisma/schema.prisma",
    migrations: {
        path: "prisma/migrations",
    },
    datasource: {
        url: buildDatabaseUrl(),
    },
});
