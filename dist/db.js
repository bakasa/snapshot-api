import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
let _db = null;
export function getDb() {
    if (_db)
        return _db;
    const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    fs.mkdirSync(dir, { recursive: true });
    _db = new Database(path.join(dir, 'snapshot.db'));
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    return _db;
}
export function migrate(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      email TEXT,
      plan TEXT DEFAULT 'free' NOT NULL,
      monthly_limit INTEGER DEFAULT 100,
      usage_count INTEGER DEFAULT 0,
      reset_at TEXT DEFAULT (datetime('now', '+30 days')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS screenshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id INTEGER NOT NULL,
      url TEXT NOT NULL,
      width INTEGER DEFAULT 1280,
      format TEXT DEFAULT 'png',
      status INTEGER,
      size_bytes INTEGER,
      took_ms INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (api_key_id) REFERENCES api_keys(id)
    );

    CREATE INDEX IF NOT EXISTS idx_screenshots_key ON screenshots(api_key_id);
    CREATE INDEX IF NOT EXISTS idx_screenshots_created ON screenshots(created_at);
    CREATE INDEX IF NOT EXISTS idx_api_keys_key ON api_keys(key);
  `);
}
export function db() {
    const d = getDb();
    function generateApiKey() {
        return 'ss_' + crypto.randomBytes(24).toString('hex');
    }
    function createApiKey(email, plan = 'free', monthlyLimit = 100) {
        const key = generateApiKey();
        const stmt = d.prepare("INSERT INTO api_keys (key, email, plan, monthly_limit, reset_at) VALUES (?, ?, ?, ?, datetime('now', '+30 days'))");
        const info = stmt.run(key, email || null, plan, monthlyLimit);
        return d.prepare('SELECT * FROM api_keys WHERE id = ?').get(info.lastInsertRowid);
    }
    function getApiKey(key) {
        return d.prepare('SELECT * FROM api_keys WHERE key = ?').get(key);
    }
    function getApiKeyById(id) {
        return d.prepare('SELECT * FROM api_keys WHERE id = ?').get(id);
    }
    function getOrCreateDefaultKey() {
        let key = d.prepare('SELECT * FROM api_keys WHERE key = ?').get('dev-key');
        if (!key) {
            key = createApiKey('dev@auto.company', 'unlimited', 999999);
            d.prepare('UPDATE api_keys SET key = ? WHERE id = ?').run('dev-key', key.id);
            key = d.prepare('SELECT * FROM api_keys WHERE id = ?').get(key.id);
        }
        return key;
    }
    function recordScreenshot(apiKeyId, url, width, format, status, sizeBytes, tookMs) {
        const stmt = d.prepare('INSERT INTO screenshots (api_key_id, url, width, format, status, size_bytes, took_ms) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const info = stmt.run(apiKeyId, url, width, format, status, sizeBytes, tookMs);
        d.prepare('UPDATE api_keys SET usage_count = usage_count + 1 WHERE id = ?').run(apiKeyId);
        return d.prepare('SELECT * FROM screenshots WHERE id = ?').get(info.lastInsertRowid);
    }
    function getUsage(apiKeyId, days = 30) {
        const row = d.prepare("SELECT COUNT(*) as count FROM screenshots WHERE api_key_id = ? AND created_at > datetime('now', '-' || ? || ' days')").get(apiKeyId, days);
        return row?.count ?? 0;
    }
    function getAllKeys() {
        return d.prepare('SELECT * FROM api_keys ORDER BY created_at DESC').all();
    }
    return {
        createApiKey, getApiKey, getApiKeyById, getOrCreateDefaultKey,
        recordScreenshot, getUsage, getAllKeys,
    };
}
