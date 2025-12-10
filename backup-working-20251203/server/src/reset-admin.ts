import { initDB, getDB } from './db';
import { AuthModel } from './auth';
import bcrypt from 'bcryptjs';

async function resetAdmin() {
    try {
        await initDB();
        const db = getDB();
        console.log('Database initialized.');

        const username = 'admin';
        const password = 'admin';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if user exists
        const existing = await db.get('SELECT * FROM users WHERE username = ?', [username]);

        if (existing) {
            console.log('Admin user exists. Updating password...');
            await db.run('UPDATE users SET password_hash = ? WHERE username = ?', [hashedPassword, username]);
            console.log('Password updated to: admin');
        } else {
            console.log('Creating admin user...');
            await AuthModel.createUser({
                username,
                password,
                role: 'admin'
            });
            console.log('Admin user created: admin / admin');
        }

    } catch (error) {
        console.error('Failed to reset admin:', error);
    }
}

resetAdmin();
