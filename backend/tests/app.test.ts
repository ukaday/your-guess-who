import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /health', () => {
    it('returns ok when database responds', async () => {
        const mockPrisma = { $queryRaw: vi.fn().mockResolvedValue([]) };
        const app = createApp(mockPrisma as never, 'http://localhost:5173');

        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
    });
});
