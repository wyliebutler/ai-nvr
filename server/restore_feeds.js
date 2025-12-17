const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// In Docker, WORKDIR is /app/server, data is mounted at /app/server/data
const dbPath = path.resolve(__dirname, 'data/nvr.sqlite');
console.log('Opening DB at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('Connected to the database.');
});

const feeds = [
    { id: 7, name: 'Tapo Driveway', url: 'rtsp://wyliebutler:Ler542111%21%21@192.168.2.51:554/stream1' },
    { id: 8, name: 'PiCam', url: 'rtsp://pi4bcam:8554/usb0' }
];

db.serialize(() => {
    // 1. Restore/Update valid feeds
    const stmt = db.prepare("INSERT OR REPLACE INTO feeds (id, name, rtsp_url, created_at) VALUES (?, ?, ?, datetime('now'))");
    feeds.forEach(feed => {
        console.log(`Restoring feed ${feed.id}: ${feed.name}`);
        stmt.run(feed.id, feed.name, feed.url, (err) => {
            if (err) console.error(`Error inserting feed ${feed.id}:`, err.message);
            else console.log(`Feed ${feed.id} inserted/updated.`);
        });
    });
    stmt.finalize();

    // 2. Remove obsolete feeds (Thingino ID 1, Ghost Tapo ID 21)
    const activeIds = feeds.map(f => f.id).join(',');
    console.log(`Cleaning up feeds. Keeping only: ${activeIds}`);

    // Explicitly delete unwanted IDs to be sure
    db.run(`DELETE FROM feeds WHERE id NOT IN (${activeIds})`, (err) => {
        if (err) console.error("Error deleting obsolete feeds:", err.message);
        else console.log("Obsolete feeds removed.");
    });
});

db.close((err) => {
    if (err) console.error(err.message);
    else console.log('Database connection closed.');
});
