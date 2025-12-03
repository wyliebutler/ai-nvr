#!/bin/bash

echo "Initializing database and creating admin user..."

# Initialize database and create admin user
docker exec ai-nvr-server-1 node -e "
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./data/nvr.sqlite');

const username = 'wyliebutler';
const password = 'Ler542111!!';

// First, create the tables if they don't exist
db.serialize(() => {
    db.run(\`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT CHECK(role IN ('admin', 'viewer')) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    \`, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
            process.exit(1);
        }
        console.log('✓ Database tables initialized');
    });

    db.run(\`
        CREATE TABLE IF NOT EXISTS feeds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            rtsp_url TEXT NOT NULL,
            settings TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    \`);

    db.run(\`
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    \`);

    // Now create the admin user
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.error('Error hashing password:', err);
            process.exit(1);
        }
        
        db.run(
            'INSERT OR REPLACE INTO users (username, password_hash, role) VALUES (?, ?, ?)',
            [username, hash, 'admin'],
            (err) => {
                if (err) {
                    console.error('Error creating user:', err);
                    process.exit(1);
                }
                console.log('✓ Admin user created successfully!');
                console.log('  Username: wyliebutler');
                console.log('  Password: Ler542111!!');
                console.log('');
                console.log('You can now log in at http://localhost:3000');
                db.close();
            }
        );
    });
});
"

echo ""
echo "Done! Your admin user is ready."
