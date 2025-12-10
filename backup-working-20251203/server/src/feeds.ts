import { getDB } from './db';
import { z } from 'zod';

export const FeedSchema = z.object({
    name: z.string().min(1),
    rtsp_url: z.string().url(),
    settings: z.string().optional(), // JSON string
});

export type FeedInput = z.infer<typeof FeedSchema>;

export const FeedModel = {
    async getAllFeeds() {
        const db = getDB();
        return db.all('SELECT * FROM feeds ORDER BY created_at DESC');
    },

    async createFeed(input: FeedInput) {
        const db = getDB();
        const result = await db.run(
            'INSERT INTO feeds (name, rtsp_url, settings) VALUES (?, ?, ?)',
            [input.name, input.rtsp_url, input.settings || '{}']
        );
        return { id: result.lastID, ...input };
    },

    async deleteFeed(id: number) {
        const db = getDB();
        await db.run('DELETE FROM feeds WHERE id = ?', [id]);
    },

    async updateFeed(id: number, input: FeedInput) {
        const db = getDB();
        await db.run(
            'UPDATE feeds SET name = ?, rtsp_url = ?, settings = ? WHERE id = ?',
            [input.name, input.rtsp_url, input.settings || '{}', id]
        );
        return { id, ...input };
    }
};
