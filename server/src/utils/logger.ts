import pino from 'pino';

// Why create a wrapper?
// 1. Consistency: We enforce the same log format across the entire app.
// 2. Environment Awareness: We can auto-switch between "Pretty" (Human) and "JSON" (Machine) modes.

import { config } from '../config';

const isDev = config.NODE_ENV !== 'production';

// Ring Buffer Implementation
const LOG_BUFFER_SIZE = 1000;
const logBuffer: any[] = [];

// Custom destination to capture logs
const bufferStream = {
    write(msg: string) {
        try {
            const logEntry = JSON.parse(msg);
            if (logBuffer.length >= LOG_BUFFER_SIZE) {
                logBuffer.shift(); // Remove oldest
            }
            logBuffer.push(logEntry);

            // Also write to stdout so we don't lose logs in console
            process.stdout.write(msg);
        } catch (e) {
            // Fallback for non-JSON strings
            process.stdout.write(msg);
        }
    }
};

export const getRecentLogs = () => [...logBuffer].reverse(); // Newest first

export const logger = pino({
    level: config.LOG_LEVEL,
    // transport, // Removed to use custom stream (or we can use multistream but keep it simple)
    formatters: {
        // Standardize log levels (e.g., use 'severity' instead of number codes if needed, but defaults are good)
    }
}, bufferStream);

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
