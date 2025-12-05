import request from 'supertest';
import { app } from '../app';
import { initDB, closeDB } from '../db';

beforeAll(async () => {
    await initDB();
});

afterAll(async () => {
    await closeDB();
});

describe('API Smoke Test', () => {
    it('GET /api/status should return 404 (since we dont have a status endpoint yet) or 401 if auth required', async () => {
        // We haven't implemented a /status endpoint, but sending a request to a non-existent route 
        // usually returns 404 on this server (unless caught by auth).
        // Let's test the root route or a known route. 
        // Looking at routes.ts, most routes are protected.
        // Let's try /login with bad credentials, which should return 401.

        const response = await request(app)
            .post('/api/login')
            .send({ username: 'fake', password: 'fake' });

        if (response.status !== 401) {
            throw new Error(`Test Failed. Expected 401, got ${response.status}. Body: ${JSON.stringify(response.body)}`);
        }
        expect(response.status).toBe(401);
    });
});
