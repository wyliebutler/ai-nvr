import { getDB } from './db';

export const SettingsModel = {
    async getAllSettings() {
        const db = getDB();
        const rows = await db.all('SELECT key, value FROM settings');
        // Convert array of {key, value} to object
        return rows.reduce((acc: any, row: any) => {
            acc[row.key] = row.value;
            return acc;
        }, {});
    },

    async updateSettings(settings: Record<string, string>) {
        const db = getDB();
        // Use transaction
        await db.exec('BEGIN TRANSACTION');
        try {
            const stmt = await db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
            for (const [key, value] of Object.entries(settings)) {
                await stmt.run(key, value);
            }
            await stmt.finalize();
            await db.exec('COMMIT');
        } catch (error) {
            await db.exec('ROLLBACK');
            throw error;
        }
        return settings;
    }
};
