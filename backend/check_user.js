const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'database/tienda.db');
const db = new sqlite3.Database(dbPath);

const username = 'admin';
const password = 'admin123';

db.serialize(() => {
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
        if (err) {
            console.error('Error querying database:', err);
            return;
        }

        if (!row) {
            console.log(`User '${username}' not found in database.`);
        } else {
            console.log(`User '${username}' found:`, row);
            const match = await bcrypt.compare(password, row.password);
            console.log(`Password '${password}' match:`, match);
        }
        db.close();
    });
});
