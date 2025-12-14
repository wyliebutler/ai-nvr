const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'data/nvr.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error(err);
});

console.log("=== Recent Notifications ===");
db.each("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 5", (err, row) => {
    console.log(row);
});

console.log("\n=== Feeds in DB ===");
db.each("SELECT * FROM feeds", (err, row) => {
    console.log(row);
});

// We can't easily check API response from node script without fetch/axios, 
// using curl in next step instead

const fs = require('fs');
try {
    console.log("\n=== Recordings in /app/server/recordings/22 ===");
    const files = fs.readdirSync('/app/server/recordings/22');
    console.log(files);
} catch (e) {
    console.log("Error reading recordings:", e.message);
}
