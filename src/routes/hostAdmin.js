// src/routes/hostAdmin.js — API Routes untuk Kontrol Admin Host (buka/tutup, trigger, jadwal, dll)
const express = require('express');
const router = express.Router();
const { getGroupConfigs, saveGroupConfig } = require('../db/models');
const { getClient, getStatus, setMessagesAdminsOnlyHelper } = require('../services/whatsapp/client');

// ─── BUKA / TUTUP GRUP TERTENTU ───────────────────────────
router.post('/open-close-group', async (req, res) => {
    try {
        const { groupId, action } = req.body;
        if (!groupId || !action) return res.status(400).json({ error: 'groupId dan action wajib diisi.' });
        const client = getClient();
        if (!client || getStatus() !== 'CONNECTED') {
            return res.status(500).json({ error: 'WhatsApp client tidak terhubung.' });
        }
        const shouldAdminsOnly = action !== 'buka';
        await setMessagesAdminsOnlyHelper(client, groupId, shouldAdminsOnly);
        const msgText = shouldAdminsOnly
            ? "🔔 *Pemberitahuan Manual:* Grup ini ditutup sementara oleh Admin. Hanya Admin yang dapat mengirim pesan."
            : "🔔 *Pemberitahuan Manual:* Jam operasional toko telah dimulai. Grup dibuka kembali untuk umum. Silakan ajukan pesanan Anda!";
        await client.sendMessage(groupId, msgText);
        res.json({ success: true });
    } catch(err) {
        console.error('Gagal mengontrol grup secara manual:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── TOGGLE BOT DI GRUP ───────────────────────────────────
router.post('/toggle-group', async (req, res) => {
    try {
        const { groupId, enabled } = req.body;
        const { group_configs: gConfigs } = await getGroupConfigs();
        const gCfg = gConfigs[groupId];
        if (gCfg) {
            gCfg.enabled = enabled;
            await saveGroupConfig(groupId, gCfg);
            req.app.get('io').emit('group_config_updated', { groupId });
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Grup tidak ditemukan' });
        }
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PESAN SAMBUTAN ───────────────────────────────────────
router.post('/welcome-message', async (req, res) => {
    try {
        const { groupId, welcomeMessage } = req.body;
        const { group_configs: gConfigs } = await getGroupConfigs();
        const gCfg = gConfigs[groupId];
        if (gCfg) {
            gCfg.welcomeMessage = welcomeMessage;
            await saveGroupConfig(groupId, gCfg);
            req.app.get('io').emit('group_config_updated', { groupId });
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Grup tidak ditemukan' });
        }
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PESAN PERPISAHAN ─────────────────────────────────────
router.post('/goodbye-message', async (req, res) => {
    try {
        const { groupId, goodbyeMessage } = req.body;
        const { group_configs: gConfigs } = await getGroupConfigs();
        const gCfg = gConfigs[groupId];
        if (gCfg) {
            gCfg.goodbyeMessage = goodbyeMessage;
            await saveGroupConfig(groupId, gCfg);
            req.app.get('io').emit('group_config_updated', { groupId });
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Grup tidak ditemukan' });
        }
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── JADWAL BUKA/TUTUP OTOMATIS ───────────────────────────
router.post('/group-scheduler', async (req, res) => {
    try {
        const { groupId, schedulerEnabled, openTime, closeTime } = req.body;
        const { group_configs: gConfigs } = await getGroupConfigs();
        const gCfg = gConfigs[groupId];
        if (gCfg) {
            gCfg.autoCloseSchedule = {
                enabled: schedulerEnabled === true,
                openTime: openTime || '08:00',
                closeTime: closeTime || '17:00',
                activeDays: (gCfg.autoCloseSchedule && gCfg.autoCloseSchedule.activeDays) || [1,2,3,4,5,6,7]
            };
            await saveGroupConfig(groupId, gCfg);
            req.app.get('io').emit('group_config_updated', { groupId });
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Grup tidak ditemukan' });
        }
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── PENGATURAN PEMBAYARAN ────────────────────────────────
router.post('/payment-settings', async (req, res) => {
    try {
        const { groupId, paymentType, paymentMedia, paymentText } = req.body;
        const { group_configs: gConfigs } = await getGroupConfigs();
        const gCfg = gConfigs[groupId];
        if (gCfg) {
            gCfg.paymentType = paymentType;
            gCfg.paymentMedia = paymentMedia;
            gCfg.paymentText = paymentText;
            await saveGroupConfig(groupId, gCfg);
            req.app.get('io').emit('group_config_updated', { groupId });
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Grup tidak ditemukan' });
        }
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── TAMBAH TRIGGER KATA KUNCI ────────────────────────────
router.post('/add-trigger', async (req, res) => {
    try {
        const { groupId, keyword, reply, media, scope, allGroups } = req.body;
        if (!groupId || !keyword || !reply) {
            return res.status(400).json({ error: 'GroupId, keyword, dan reply wajib diisi.' });
        }
        const { group_configs: gConfigs } = await getGroupConfigs();
        const isAllGroups = allGroups === true || scope === 'all';
        const finalScope = scope || (isAllGroups ? 'all' : 'group');
        const targetGroupIds = isAllGroups ? Object.keys(gConfigs) : [groupId];
        if (targetGroupIds.length === 0) targetGroupIds.push(groupId);

        for (const gid of targetGroupIds) {
            let gCfg = gConfigs[gid];
            if (!gCfg) {
                gCfg = {
                    groupId: gid, groupName: gid, enabled: true, useAiFallback: true,
                    triggerPrefix: '', allowedKnowledgeFiles: [],
                    categoryFooter: 'Silakan pilih menu dengan mengetik angkanya:',
                    contentFooter: 'Ketik *0* untuk kembali ke menu sebelumnya, atau *#* untuk kembali ke menu utama.',
                    menuTree: { id: "root", name: "Menu Utama", type: "category", text: "Silakan pilih salah satu opsi di bawah ini:", children: [] }
                };
            }
            gCfg.extraTriggers = gCfg.extraTriggers || [];
            gCfg.extraTriggers = gCfg.extraTriggers.filter(t => t.keyword.toLowerCase().trim() !== keyword.toLowerCase().trim());
            gCfg.extraTriggers.push({ keyword: keyword.trim(), reply: reply.trim(), media: media ? media.trim() : '', scope: finalScope });
            await saveGroupConfig(gid, gCfg);
            req.app.get('io').emit('group_config_updated', { groupId: gid });
        }
        res.json({ success: true });
    } catch (err) {
        console.error('Gagal menambahkan trigger:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── HAPUS TRIGGER KATA KUNCI ─────────────────────────────
router.post('/delete-trigger', async (req, res) => {
    try {
        const { groupId, keyword } = req.body;
        if (!groupId || !keyword) return res.status(400).json({ error: 'GroupId dan keyword wajib diisi.' });
        const { group_configs: gConfigs } = await getGroupConfigs();
        const gCfg = gConfigs[groupId];
        if (gCfg) {
            gCfg.extraTriggers = gCfg.extraTriggers || [];
            gCfg.extraTriggers = gCfg.extraTriggers.filter(t => t.keyword.toLowerCase().trim() !== keyword.toLowerCase().trim());
            await saveGroupConfig(groupId, gCfg);
            req.app.get('io').emit('group_config_updated', { groupId });
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Grup tidak ditemukan' });
        }
    } catch (err) {
        console.error('Gagal menghapus trigger:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
