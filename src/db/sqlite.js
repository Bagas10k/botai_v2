const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

const SQLITE_DB_FILE = path.join(__dirname, '../../database.sqlite');
const DATABASE_FILE = path.join(__dirname, '../../database.json');

let db = null;

async function initDatabase() {
    try {
        db = await open({
            filename: SQLITE_DB_FILE,
            driver: sqlite3.Database
        });

        // Enable foreign keys
        await db.run('PRAGMA foreign_keys = ON');
        
        await db.exec(`
            CREATE TABLE IF NOT EXISTS key_value_store (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_number TEXT,
                customer_name TEXT,
                details TEXT,
                status TEXT DEFAULT 'PENDING',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                customer_number TEXT,
                customer_name TEXT,
                status TEXT,
                details TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS premium_products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS premium_accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER,
                email TEXT NOT NULL,
                password TEXT NOT NULL,
                max_users INTEGER DEFAULT 1,
                status TEXT DEFAULT 'Tersedia',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(product_id) REFERENCES premium_products(id) ON DELETE SET NULL
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS premium_sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER,
                buyer_name TEXT NOT NULL,
                buyer_phone TEXT NOT NULL,
                price INTEGER DEFAULT 0,
                payment_status TEXT DEFAULT 'Belum Bayar',
                profile_name TEXT,
                start_date TEXT,
                end_date TEXT,
                auto_remind INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(account_id) REFERENCES premium_accounts(id) ON DELETE SET NULL
            )
        `);

        // Relational tables for settings and metadata
        await db.exec(`
            CREATE TABLE IF NOT EXISTS group_configs (
                group_id TEXT PRIMARY KEY,
                group_name TEXT,
                bot_active INTEGER DEFAULT 1,
                welcome_message TEXT,
                custom_rules TEXT,
                settings TEXT
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS chat_sessions (
                session_id TEXT PRIMARY KEY,
                messages TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS shop_admins (
                phone TEXT PRIMARY KEY,
                name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS shop_customers (
                phone TEXT PRIMARY KEY,
                name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT,
                message TEXT,
                time TEXT,
                is_active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Handle Legacy Migrations if needed
        const rows = await db.all('SELECT key, value FROM key_value_store');
        const hasData = rows.length > 0;
        
        if (!hasData) {
            console.log('[DB] SQLite kosong. Memeriksa database lama/file JSON untuk migrasi...');
            let legacyData = {
                chat_sessions: {},
                log_history: { finance: [], agenda: [] },
                reminders: [],
                group_configs: { group_configs: {} },
                shop_data: { host_admins: [], customers: [] }
            };

            if (fs.existsSync(DATABASE_FILE)) {
                try {
                    const raw = fs.readFileSync(DATABASE_FILE, 'utf-8');
                    legacyData = JSON.parse(raw);
                    console.log('[DB] database.json ditemukan. Memigrasikan data...');
                    fs.renameSync(DATABASE_FILE, DATABASE_FILE + '.bak');
                } catch (e) {
                    console.error('Gagal membaca database.json lama:', e);
                }
            }

            // Save log_history to key_value_store
            await db.run('INSERT OR REPLACE INTO key_value_store (key, value) VALUES (?, ?)', 'log_history', JSON.stringify(legacyData.log_history || { finance: [], agenda: [] }));

            // Migrate group_configs
            const gc = legacyData.group_configs?.group_configs || {};
            for (const gid of Object.keys(gc)) {
                const conf = gc[gid] || {};
                await db.run('INSERT OR REPLACE INTO group_configs (group_id, group_name, bot_active, welcome_message, custom_rules, settings) VALUES (?, ?, ?, ?, ?, ?)',
                    gid, conf.group_name || '', conf.bot_active !== false ? 1 : 0, conf.welcome_message || '', JSON.stringify(conf.custom_rules || []), JSON.stringify(conf)
                );
            }

            // Migrate chat_sessions
            const cs = legacyData.chat_sessions || {};
            for (const sid of Object.keys(cs)) {
                await db.run('INSERT OR REPLACE INTO chat_sessions (session_id, messages) VALUES (?, ?)', sid, JSON.stringify(cs[sid] || []));
            }

            // Migrate shop admins and customers
            const sd = legacyData.shop_data || { host_admins: [], customers: [] };
            for (const admin of sd.host_admins || []) {
                if (admin && admin.phone) {
                    await db.run('INSERT OR REPLACE INTO shop_admins (phone, name) VALUES (?, ?)', admin.phone, admin.name || '');
                }
            }
            for (const cust of sd.customers || []) {
                if (cust && cust.phone) {
                    await db.run('INSERT OR REPLACE INTO shop_customers (phone, name) VALUES (?, ?)', cust.phone, cust.name || '');
                }
            }

            // Migrate reminders
            for (const rem of legacyData.reminders || []) {
                await db.run('INSERT INTO reminders (phone, message, time, is_active) VALUES (?, ?, ?, ?)', rem.phone, rem.message, rem.time, rem.is_active !== false ? 1 : 0);
            }

            console.log('[DB] Migrasi data legacy selesai.');
        }

        console.log('[DB] SQLite dan seluruh tabel siap digunakan.');
        return db;
    } catch (err) {
        console.error('[DB] Gagal menginisialisasi SQLite:', err.message);
        throw err;
    }
}

function getDb() {
    return db;
}

module.exports = {
    initDatabase,
    getDb
};
