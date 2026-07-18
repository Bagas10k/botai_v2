// src/routes/premium.js — API Routes untuk Produk, Akun, dan Penjualan Premium
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/sqlite');
const { getClient, getStatus } = require('../services/whatsapp/client');

// ─── PRODUK PREMIUM ───────────────────────────────────────
router.get('/products', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.json([]);
        const rows = await db.all('SELECT * FROM premium_products ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('Gagal mengambil premium products:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/products', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(500).json({ error: 'Database belum siap' });
        const { name } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Nama produk wajib diisi' });
        await db.run('INSERT INTO premium_products (name) VALUES (?)', name.trim());
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal menambah premium product:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/products/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(500).json({ error: 'Database belum siap' });
        const { id } = req.params;
        await db.run('DELETE FROM premium_products WHERE id = ?', id);
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal menghapus premium product:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── AKUN PREMIUM ─────────────────────────────────────────
router.get('/accounts', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.json([]);
        const rows = await db.all(`
            SELECT a.*, p.name AS product_name,
                   (SELECT COUNT(*) FROM premium_sales s WHERE s.account_id = a.id) AS active_users
            FROM premium_accounts a 
            LEFT JOIN premium_products p ON a.product_id = p.id 
            ORDER BY a.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Gagal mengambil premium accounts:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/accounts', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(500).json({ error: 'Database belum siap' });
        const { product_id, email, password, max_users, status, notes } = req.body;
        await db.run(`
            INSERT INTO premium_accounts (product_id, email, password, max_users, status, notes) 
            VALUES (?, ?, ?, ?, ?, ?)
        `, product_id, email, password, max_users || 1, status || 'Tersedia', notes || '');
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal menambah premium account:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/accounts/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(500).json({ error: 'Database belum siap' });
        const { id } = req.params;
        await db.run('DELETE FROM premium_accounts WHERE id = ?', id);
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal menghapus premium account:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── PENJUALAN PREMIUM ────────────────────────────────────
router.get('/sales', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.json([]);
        const rows = await db.all(`
            SELECT s.*, a.email AS account_email, p.name AS product_name 
            FROM premium_sales s 
            LEFT JOIN premium_accounts a ON s.account_id = a.id 
            LEFT JOIN premium_products p ON a.product_id = p.id 
            ORDER BY s.created_at DESC
        `);
        res.json(rows);
    } catch (err) {
        console.error('Gagal mengambil premium sales:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/sales', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(500).json({ error: 'Database belum siap' });
        const { account_id, buyer_name, buyer_phone, price, payment_status, profile_name, start_date, end_date, auto_remind } = req.body;
        await db.run(`
            INSERT INTO premium_sales (account_id, buyer_name, buyer_phone, price, payment_status, profile_name, start_date, end_date, auto_remind) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, account_id, buyer_name, buyer_phone, price || 0, payment_status || 'Belum Bayar', profile_name || '', start_date || '', end_date || '', auto_remind !== false ? 1 : 0);
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal menambah penjualan premium:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.delete('/sales/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(500).json({ error: 'Database belum siap' });
        const { id } = req.params;
        await db.run('DELETE FROM premium_sales WHERE id = ?', id);
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal menghapus penjualan premium:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/send-reminder', async (req, res) => {
    try {
        const { sale_id } = req.body;
        const db = getDb();
        const sale = await db.get(`
            SELECT s.*, a.email AS account_email, a.password, p.name AS product_name 
            FROM premium_sales s 
            LEFT JOIN premium_accounts a ON s.account_id = a.id 
            LEFT JOIN premium_products p ON a.product_id = p.id 
            WHERE s.id = ?
        `, sale_id);
        
        if (!sale) return res.status(404).json({ error: 'Data penjualan tidak ditemukan' });
        
        const client = getClient();
        if (!client || getStatus() !== 'CONNECTED') {
            return res.status(500).json({ error: 'WhatsApp client belum terhubung' });
        }
        
        const cleanPhone = sale.buyer_phone.replace(/\D/g, '') + '@c.us';
        const profileInfo = sale.profile_name ? ` (Slot Profile: ${sale.profile_name})` : '';
        const msgText = `🔔 *PENGINGAT MASA AKTIF LANGGANAN PREMIUM* 🔔\n\nHalo Kak *${sale.buyer_name}*,\n\nKami menginformasikan bahwa langganan akun premium Anda untuk produk *${sale.product_name}*${profileInfo} akan segera berakhir pada *${sale.end_date}*.\n\nKredensial Akun:\n- Login: \`${sale.account_email}\`\n- Sandi: \`${sale.password || 'Hubungi Admin'}\`\n\nSilakan lakukan perpanjangan langganan sebelum masa aktif berakhir agar layanan tidak terputus. Terima kasih! 🙏`;
        
        await client.sendMessage(cleanPhone, msgText);
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal mengirim reminder manual:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
