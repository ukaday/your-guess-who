export const errorToMessage = (err: unknown): string =>
    err instanceof Error ? err.message : String(err);
