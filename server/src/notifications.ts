import { getDB } from './db';

export const NotificationModel = {
    async create(feedId: number, type: string, message: string) {
        const db = getDB();
        await db.run(
            'INSERT INTO notifications (feed_id, type, message) VALUES (?, ?, ?)',
            [feedId, type, message]
        );
    },

    async getRecent(page: number = 1, limit: number = 50) {
        const db = getDB();
        const offset = (page - 1) * limit;

        const logs = await db.all(`
            SELECT n.*, f.name as feed_name 
            FROM notifications n 
            LEFT JOIN feeds f ON n.feed_id = f.id 
            ORDER BY n.created_at DESC 
            LIMIT ? OFFSET ?
        `, [limit, offset]);

        const totalResult = await db.get('SELECT COUNT(*) as count FROM notifications');
        const total = totalResult ? totalResult.count : 0;

        return {
            logs,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        };
    },

    async cleanupOldLogs(hours: number = 24) {
        const db = getDB();
        // SQLite 'datetime' modifier handles 'now' and '-X hours'
        await db.run(`
            DELETE FROM notifications 
            WHERE created_at < datetime('now', '-' || ? || ' hours')
        `, [hours]);
    }
};
