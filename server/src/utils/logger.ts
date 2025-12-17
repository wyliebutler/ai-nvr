import pino from 'pino';

// Why create a wrapper?
// 1. Consistency: We enforce the same log format across the entire app.
// 2. Environment Awareness: We can auto-switch between "Pretty" (Human) and "JSON" (Machine) modes.

import { config } from '../config';

const isDev = config.NODE_ENV !== 'production';

// Configuration for Pino
const transport = isDev
    ? {
        target: 'pino-pretty',
        options: {
            colorize: true,      // Add colors for error/info/warn
            translateTime: 'SYS:standard', // Human readable time
            ignore: 'pid,hostname', // Hide noise in dev
        },
    }
    : undefined; // undefined means "Use Default JSON" (Best for production)

export const logger = pino({
    level: config.LOG_LEVEL,
    transport,
    formatters: {
        // Standardize log levels (e.g., use 'severity' instead of number codes if needed, but defaults are good)
    }
});

/**
 * Educational Note:
 * 
 * Instead of: console.log("User logged in", userId);
 * We use:     logger.info({ userId }, "User logged in");
 * 
 * Why? The second approach creates a structured object:
 * { "level": 30, "time": 123456789, "userId": 123, "msg": "User logged in" }
 * 
 * A tool like Datadog or ELK can now graph "Logins per minute" by counting these objects!
 */
