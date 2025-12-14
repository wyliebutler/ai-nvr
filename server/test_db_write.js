var sqlite3 = require('sqlite3').verbose();
var path = require('path');

var dbPath = path.resolve(__dirname, 'data/nvr.sqlite');
console.log('Opening DB at:', dbPath);

var db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('Connected to the database.');
});

db.serialize(() => {
    var stmt = db.prepare("INSERT INTO notifications (feed_id, type, message) VALUES (?, ?, ?)");
    stmt.run(999, "info", "Manual Test Log " + Date.now());
    stmt.finalize();

    db.each("SELECT id, type, message, created_at FROM notifications ORDER BY created_at DESC LIMIT 5", (err, row) => {
        if (err) {
            console.error(err.message);
        }
        console.log(row.id + "\t" + row.created_at + "\t" + row.type + "\t" + row.message);
    });
});

db.close();
