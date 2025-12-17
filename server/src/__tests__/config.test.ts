import { envSchema } from '../config';

describe('Configuration Validation', () => {
    it('accepts valid configuration', () => {
        const result = envSchema.safeParse({
            NODE_ENV: 'production',
            PORT: '8080',
            JWT_SECRET: 'super-secret-password-longer-than-8-chars',
            LOG_LEVEL: 'debug'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.PORT).toBe(8080); // Coercion works
            expect(result.data.NODE_ENV).toBe('production');
        }
    });

    it('rejects short JWT secret', () => {
        const result = envSchema.safeParse({
            JWT_SECRET: 'short'
        });
        expect(result.success).toBe(false);
    });

    it('uses defaults', () => {
        const result = envSchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.PORT).toBe(7000);
            expect(result.data.NODE_ENV).toBe('development');
        }
    });
});
