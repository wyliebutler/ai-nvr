import { getDB } from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

export const UserSchema = z.object({
    username: z.string().min(3),
    password: z.string().min(6),
    role: z.enum(['admin', 'viewer']).default('viewer'),
});

export type UserInput = z.infer<typeof UserSchema>;

export const AuthModel = {
    async createUser(input: UserInput) {
        const db = getDB();
        const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

        try {
            const result = await db.run(
                'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
                [input.username, hashedPassword, input.role]
            );
            return { id: result.lastID, username: input.username, role: input.role };
        } catch (error: any) {
            if (error.code === 'SQLITE_CONSTRAINT') {
                throw new Error('Username already exists');
            }
            throw error;
        }
    },

    async login(username: string, password: string) {
        const db = getDB();
        const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

        if (!user) {
            return null;
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return null;
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        return { token, user: { id: user.id, username: user.username, role: user.role } };
    },

    async countUsers() {
        const db = getDB();
        const result = await db.get('SELECT COUNT(*) as count FROM users');
        return result.count;
    },

    async getAllUsers() {
        const db = getDB();
        return db.all('SELECT id, username, role, created_at FROM users');
    },

    async deleteUser(id: number) {
        const db = getDB();
        await db.run('DELETE FROM users WHERE id = ?', [id]);
    }
};
