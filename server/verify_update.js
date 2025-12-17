const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'data/nvr.sqlite');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) return console.error(err.message);
});

db.all(`SELECT id, name, rtsp_url FROM feeds WHERE id = 8`, [], (err, rows) => {
    if (err) throw err;
    rows.forEach((row) => {
        console.log(`Feed ${row.id}: ${row.name} - ${row.rtsp_url}`);
    });
    db.close();
});
