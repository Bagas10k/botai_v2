// src/routes/orders.js — API Routes untuk Pesanan & Invoices
const express = require('express');
const router = express.Router();
const { getDb } = require('../db/sqlite');
const { addCustomer } = require('../db/models');

// ─── ORDERS ───────────────────────────────────────────────
router.get('/orders', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.json([]);
        const rows = await db.all('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('Gagal mengambil orders:', err.message);
        res.status(500).json({ error: 'Gagal mengambil data pesanan' });
    }
});

router.post('/orders/:id/status', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(500).json({ error: 'Database belum siap' });
        const { id } = req.params;
        const { status } = req.body;
        await db.run('UPDATE orders SET status = ? WHERE id = ?', status, id);
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal update status order:', err.message);
        res.status(500).json({ error: 'Gagal update status pesanan' });
    }
});

router.delete('/orders/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(500).json({ error: 'Database belum siap' });
        const { id } = req.params;
        await db.run('DELETE FROM orders WHERE id = ?', id);
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal menghapus order:', err.message);
        res.status(500).json({ error: 'Gagal menghapus pesanan' });
    }
});

// ─── INVOICES ─────────────────────────────────────────────
router.get('/invoices', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.json([]);
        const rows = await db.all('SELECT * FROM invoices ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        console.error('Gagal mengambil invoices:', err.message);
        res.status(500).json({ error: 'Gagal mengambil data invoice' });
    }
});

router.post('/invoices', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(500).json({ error: 'Database belum siap' });
        const { id, customer_number, customer_name, status, details } = req.body;
        await db.run(
            'INSERT INTO invoices (id, customer_number, customer_name, status, details) VALUES (?, ?, ?, ?, ?)',
            id || ('INV-' + Date.now().toString().substring(6)),
            customer_number || 'DASHBOARD',
            customer_name || 'Dashboard User',
            status || 'SELESAI',
            details || 'Pembayaran OCR'
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal membuat invoice baru:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/invoices/:id/status', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(500).json({ error: 'Database belum siap' });
        const { id } = req.params;
        const { status } = req.body;
        await db.run('UPDATE invoices SET status = ? WHERE id = ?', status, id);
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal update status invoice:', err.message);
        res.status(500).json({ error: 'Gagal update status invoice' });
    }
});

router.delete('/invoices/:id', async (req, res) => {
    try {
        const db = getDb();
        if (!db) return res.status(500).json({ error: 'Database belum siap' });
        const { id } = req.params;
        await db.run('DELETE FROM invoices WHERE id = ?', id);
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal menghapus invoice:', err.message);
        res.status(500).json({ error: 'Gagal menghapus data invoice' });
    }
});

// ─── CRM ──────────────────────────────────────────────────
router.post('/customers/update-crm', async (req, res) => {
    try {
        const { customer_number, notes } = req.body;
        if (!customer_number) return res.status(400).json({ error: 'Nomor pelanggan wajib diisi' });
        await addCustomer(customer_number, notes);
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal update CRM:', err.message);
        res.status(500).json({ error: 'Gagal update data CRM pelanggan' });
    }
});

module.exports = router;
