import { getDB } from './db';
import { z } from 'zod';

export const SettingsSchema = z.object({
    // System
    system_mode: z.enum(['home', 'away', 'disarmed']).optional(),

    // Notifications
    notification_email: z.string().email().optional().or(z.literal('')),
    notification_interval: z.coerce.number().min(1).default(15), // Minutes

    // SMTP
    smtp_host: z.string().optional().or(z.literal('')),
    smtp_port: z.coerce.number().optional(),
    smtp_user: z.string().optional().or(z.literal('')),
    smtp_pass: z.string().optional().or(z.literal('')),

    // Recording
    recording_retention: z.coerce.number().min(1).optional(), // Hours

    // Motion
    motion_sensitivity: z.enum(['high', 'medium', 'low', 'very_low']).default('medium')
});

export type SettingsInfo = z.infer<typeof SettingsSchema>;

export const SettingsModel = {
    async getAllSettings(): Promise<SettingsInfo> {
        const db = getDB();
        const rows = await db.all('SELECT key, value FROM settings');
        // Convert array of {key, value} to object
        const rawSettings = rows.reduce((acc: any, row: any) => {
            acc[row.key] = row.value;
            return acc;
        }, {});

        // Parse with Zod (lenient, don't throw on read if DB has old junk, just strip it or use defaults)
        // Using safeParse might be better, or just partial()
        return rawSettings;
    },

    async updateSettings(settings: Record<string, any>) {
        console.log('Updating settings:', settings);

        // VALIDATE INPUT
        const validatedSettings = SettingsSchema.partial().parse(settings);

        const db = getDB();
        // Use transaction
        await db.exec('BEGIN TRANSACTION');
        try {
            const stmt = await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
            for (const [key, value] of Object.entries(validatedSettings)) {
                if (value === undefined || value === null) continue;
                console.log(`Saving setting: ${key} = ${value}`);
                await stmt.run(key, String(value));
            }
            await stmt.finalize();
            await db.exec('COMMIT');
            console.log('Settings updated successfully');
        } catch (error) {
            console.error('Error updating settings:', error);
            await db.exec('ROLLBACK');
            throw error;
        }
        return validatedSettings;
    }
};
