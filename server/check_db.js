var sqlite3 = require('sqlite3').verbose();
var path = require('path');

var dbPath = path.resolve(__dirname, 'data/nvr.sqlite');
console.log('Opening DB at:', dbPath);

var db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log('Connected to the database.');
});

db.serialize(() => {
    db.each("SELECT key, value FROM settings", (err, row) => {
        if (err) {
            console.error(err.message);
        }
        console.log(row.key + ": " + row.value);
    });
});

db.close();
