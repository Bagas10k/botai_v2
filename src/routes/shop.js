// src/routes/shop.js — API Routes untuk Data Toko, Admin, Pelanggan, Broadcast
const express = require('express');
const router = express.Router();
const fs = require('fs');
const { getDb } = require('../db/sqlite');
const { getGroupConfigs, getShopData, addAdmin, addCustomer } = require('../db/models');
const { getClient, getStatus, setMessagesAdminsOnlyHelper } = require('../services/whatsapp/client');

let cancelBroadcastFlag = false;

// ─── PINNED CHATS (host admin) ────────────────────────────
router.get('/pinned-chats', async (req, res) => {
    try {
        const client = getClient();
        const db = getDb();
        const admins = await db.all('SELECT phone FROM shop_admins') || [];
        const adminPhones = new Set(admins.map(a => a.phone.replace(/\D/g, '')));
        
        const fallbackToDbAdmins = () => admins.map(a => {
            const clean = a.phone.replace(/\D/g, '');
            return { id: `${clean}@c.us`, name: clean, phone: clean, isHostAdmin: true };
        });
        
        if (!client || getStatus() !== 'CONNECTED') return res.json(fallbackToDbAdmins());
        
        let chats = [];
        try {
            chats = await client.getChats();
        } catch (err) {
            console.warn('[API Pinned Chats] Fallback ke DB:', err.message);
            return res.json(fallbackToDbAdmins());
        }
        
        const pinned = chats.filter(chat => chat.pinned && !chat.isGroup).map(chat => {
            const phone = (chat.id.user || '').replace(/\D/g, '');
            return { id: chat.id._serialized, name: chat.name || phone, phone, isHostAdmin: adminPhones.has(phone) };
        });
        
        const pinnedPhones = new Set(pinned.map(p => p.phone));
        admins.forEach(a => {
            const clean = a.phone.replace(/\D/g, '');
            if (clean && !pinnedPhones.has(clean)) {
                pinned.push({ id: `${clean}@c.us`, name: clean, phone: clean, isHostAdmin: true });
            }
        });
        
        res.json(pinned);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── ADMINS ───────────────────────────────────────────────
router.get('/admins', async (req, res) => {
    try {
        const shopData = await getShopData();
        const cleanAdmins = (shopData.host_admins || []).map(a => a.replace(/\D/g, ''));
        res.json(cleanAdmins);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/admins', async (req, res) => {
    try {
        const { admins } = req.body;
        if (!Array.isArray(admins)) return res.status(400).json({ error: 'Format salah' });
        const db = getDb();
        if (!db) return res.status(500).json({ error: 'Database belum siap' });
        await db.run('DELETE FROM shop_admins');
        const added = new Set();
        for (const phone of admins) {
            const cleanPhone = phone.split('@')[0].replace(/\D/g, '');
            if (cleanPhone && !added.has(cleanPhone)) {
                await addAdmin(cleanPhone, 'Admin Host');
                added.add(cleanPhone);
            }
        }
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── CUSTOMERS ────────────────────────────────────────────
router.get('/customers', async (req, res) => {
    try {
        const shopData = await getShopData();
        res.json(shopData.customers || []);
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/customers', async (req, res) => {
    try {
        const { customers } = req.body;
        if (!Array.isArray(customers)) return res.status(400).json({ error: 'Format salah' });
        for (const cust of customers) {
            await addCustomer(cust.phone, cust.name);
        }
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── BROADCAST ────────────────────────────────────────────
router.post('/broadcast', async (req, res) => {
    try {
        const { targetType, customNumbers, targetGroup, message, media, delay } = req.body;
        if (!message) return res.status(400).json({ error: 'Pesan broadcast wajib diisi.' });
        
        const client = getClient();
        if (!client || getStatus() !== 'CONNECTED') {
            return res.status(500).json({ error: 'WhatsApp client tidak terhubung.' });
        }
        
        let targetIds = [];
        
        if (targetType === 'groups') {
            const { group_configs: gConfigs } = await getGroupConfigs();
            targetIds = Object.keys(gConfigs).filter(gid => gConfigs[gid].enabled);
        } else if (targetType === 'custom_numbers') {
            if (!customNumbers) return res.status(400).json({ error: 'Nomor HP kustom wajib diisi.' });
            targetIds = customNumbers
                .split(/[\n,]+/)
                .map(num => {
                    let cleaned = num.trim().replace(/\D/g, '');
                    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
                    else if (cleaned.startsWith('8') && cleaned.length >= 9 && cleaned.length <= 13) cleaned = '62' + cleaned;
                    return cleaned;
                })
                .filter(num => num.length > 5)
                .map(num => `${num}@c.us`);
        } else if (targetType === 'group_members') {
            if (!targetGroup) return res.status(400).json({ error: 'Grup asal anggota wajib dipilih.' });
            try {
                console.log(`[Broadcast] Mengambil anggota grup untuk ${targetGroup}...`);
                let resolvedParticipants = [];

                // Strategi 1: WAWebCollections
                try {
                    const strategy1 = await client.pupPage.evaluate(async (chatId) => {
                        try {
                            try {
                                const WAWebGroupQueryJob = window.require('WAWebGroupQueryJob');
                                if (WAWebGroupQueryJob && WAWebGroupQueryJob.queryAndUpdateGroupMetadataById) {
                                    await WAWebGroupQueryJob.queryAndUpdateGroupMetadataById({ id: chatId });
                                }
                            } catch (_) {}
                            const ChatCollection = window.require('WAWebCollections').Chat;
                            const WidFactory = window.require('WAWebWidFactory');
                            if (ChatCollection && WidFactory) {
                                const groupWid = WidFactory.createWid(chatId);
                                const chat = ChatCollection.get(groupWid) || await ChatCollection.find(groupWid);
                                if (chat && chat.groupMetadata && chat.groupMetadata.participants) {
                                    const parts = typeof chat.groupMetadata.participants.serialize === 'function'
                                        ? chat.groupMetadata.participants.serialize()
                                        : chat.groupMetadata.participants;
                                    if (Array.isArray(parts)) {
                                        return parts.map(p => {
                                            if (!p) return null;
                                            const idObj = p.id || p;
                                            if (idObj) {
                                                if (typeof idObj === 'string') return idObj;
                                                if (idObj._serialized) return idObj._serialized;
                                                if (typeof idObj.toString === 'function') return idObj.toString();
                                            }
                                            return null;
                                        }).filter(Boolean);
                                    }
                                }
                            }
                        } catch (_) {}
                        return null;
                    }, targetGroup);
                    if (strategy1 && strategy1.length > 0) {
                        resolvedParticipants = strategy1;
                        console.log(`[Broadcast] Strategi 1 Sukses: ${resolvedParticipants.length} anggota.`);
                    }
                } catch (s1Err) { console.warn('[Broadcast] Strategi 1 Error:', s1Err.message); }

                // Strategi 2: Store.GroupMetadata
                if (resolvedParticipants.length === 0) {
                    try {
                        const strategy2 = await client.pupPage.evaluate(async (chatId) => {
                            try {
                                if (window.Store && window.Store.GroupMetadata) {
                                    const metadata = await window.Store.GroupMetadata.find(chatId);
                                    if (metadata && metadata.participants) {
                                        let arr = [];
                                        const parts = metadata.participants;
                                        if (Array.isArray(parts)) arr = parts;
                                        else if (typeof parts.toArray === 'function') arr = parts.toArray();
                                        else if (parts.models && Array.isArray(parts.models)) arr = parts.models;
                                        else if (typeof parts.serialize === 'function') arr = parts.serialize();
                                        return arr.map(p => {
                                            if (!p) return null;
                                            const id = p.id || p;
                                            if (id) {
                                                if (typeof id === 'string') return id;
                                                if (id._serialized) return id._serialized;
                                                if (typeof id.toString === 'function') return id.toString();
                                            }
                                            return null;
                                        }).filter(Boolean);
                                    }
                                }
                            } catch (_) {}
                            return null;
                        }, targetGroup);
                        if (strategy2 && strategy2.length > 0) {
                            resolvedParticipants = strategy2;
                            console.log(`[Broadcast] Strategi 2 Sukses: ${resolvedParticipants.length} anggota.`);
                        }
                    } catch (s2Err) { console.warn('[Broadcast] Strategi 2 Error:', s2Err.message); }
                }

                // Strategi 3: getChatById
                if (resolvedParticipants.length === 0) {
                    try {
                        const chat = await client.getChatById(targetGroup);
                        if (chat && chat.participants) {
                            resolvedParticipants = chat.participants.map(p => p.id._serialized);
                            console.log(`[Broadcast] Strategi 3 Sukses: ${resolvedParticipants.length} anggota.`);
                        }
                    } catch (s3Err) { console.warn('[Broadcast] Strategi 3 Error:', s3Err.message); }
                }

                // Strategi 4: getChats search
                if (resolvedParticipants.length === 0) {
                    try {
                        const chats = await client.getChats();
                        const matchingChat = chats.find(c => c.id._serialized === targetGroup);
                        if (matchingChat && matchingChat.participants) {
                            resolvedParticipants = matchingChat.participants.map(p => p.id._serialized);
                            console.log(`[Broadcast] Strategi 4 Sukses: ${resolvedParticipants.length} anggota.`);
                        }
                    } catch (s4Err) { console.warn('[Broadcast] Strategi 4 Error:', s4Err.message); }
                }

                if (resolvedParticipants && resolvedParticipants.length > 0) {
                    targetIds = resolvedParticipants;
                } else {
                    return res.status(400).json({ error: 'Gagal mengambil daftar anggota grup. Silakan coba kirim pesan manual ke grup tersebut terlebih dahulu.' });
                }
            } catch (chatErr) {
                return res.status(400).json({ error: 'Gagal mengambil anggota grup: ' + chatErr.message });
            }
        } else {
            const { targetGroupIds } = req.body;
            targetIds = targetGroupIds || [];
        }
        
        const botJid = client.info && client.info.wid ? client.info.wid._serialized : null;
        if (botJid) targetIds = targetIds.filter(jid => jid !== botJid);
        targetIds = [...new Set(targetIds)];
        
        if (targetIds.length === 0) return res.status(400).json({ error: 'Tidak ditemukan target penerima siaran.' });
        
        let messageMedia = null;
        if (media) {
            try {
                if (media.startsWith('http://') || media.startsWith('https://')) {
                    const { MessageMedia } = require('whatsapp-web.js');
                    messageMedia = await MessageMedia.fromUrl(media);
                } else {
                    const path = require('path');
                    const filePath = path.join(process.cwd(), 'media', media);
                    if (fs.existsSync(filePath)) {
                        const { MessageMedia } = require('whatsapp-web.js');
                        messageMedia = MessageMedia.fromFilePath(filePath);
                    } else {
                        return res.status(400).json({ error: `File media '${media}' tidak ditemukan di folder ./media` });
                    }
                }
            } catch (mediaErr) {
                return res.status(400).json({ error: 'Gagal memuat file media: ' + mediaErr.message });
            }
        }
        
        const io = req.app.get('io');
        const delayMs = (parseInt(delay, 10) || 5) * 1000;
        cancelBroadcastFlag = false; // Reset status pembatalan
        
        res.json({ success: true, count: targetIds.length, message: 'Broadcast dimulai di latar belakang.' });
        
        (async () => {
            console.log(`[Broadcast] Memulai pengiriman ke ${targetIds.length} tujuan...`);
            let countSuccess = 0;
            let cancelled = false;
            
            for (let i = 0; i < targetIds.length; i++) {
                if (cancelBroadcastFlag) {
                    console.log('[Broadcast Aborted] Dihentikan oleh pengguna.');
                    cancelled = true;
                    if (io) {
                        io.emit('broadcast_progress', {
                            current: i,
                            total: targetIds.length,
                            successCount: countSuccess,
                            failCount: i - countSuccess,
                            status: 'CANCELLED',
                            lastJid: '',
                            lastStatus: 'ABORTED'
                        });
                    }
                    break;
                }
                
                const jid = targetIds[i];
                let lastStatus = 'SUCCESS';
                
                try {
                    if (getStatus() !== 'CONNECTED') { 
                        console.log('[Broadcast Aborted] WA terputus.'); 
                        break; 
                    }
                    if (messageMedia) {
                        await client.sendMessage(jid, messageMedia, { caption: message });
                    } else {
                        await client.sendMessage(jid, message);
                    }
                    countSuccess++;
                    console.log(`[Broadcast] Berhasil ke ${jid} (${i+1}/${targetIds.length})`);
                } catch (sendErr) {
                    lastStatus = 'FAIL';
                    console.error(`[Broadcast] Gagal ke ${jid}:`, sendErr.message);
                }
                
                if (io) {
                    io.emit('broadcast_progress', {
                        current: i + 1,
                        total: targetIds.length,
                        successCount: countSuccess,
                        failCount: (i + 1) - countSuccess,
                        status: 'RUNNING',
                        lastJid: jid,
                        lastStatus: lastStatus
                    });
                }
                
                if (i < targetIds.length - 1 && !cancelBroadcastFlag) {
                    await new Promise(resolve => setTimeout(resolve, delayMs));
                }
            }
            
            if (!cancelled) {
                console.log(`[Broadcast] Selesai: ${countSuccess}/${targetIds.length} berhasil.`);
                if (io) {
                    io.emit('broadcast_progress', {
                        current: targetIds.length,
                        total: targetIds.length,
                        successCount: countSuccess,
                        failCount: targetIds.length - countSuccess,
                        status: 'COMPLETED',
                        lastJid: '',
                        lastStatus: 'FINISHED'
                    });
                }
            }
        })();
        
    } catch(err) {
        console.error('Gagal memproses broadcast:', err.message);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

// Endpoint untuk menghentikan pengiriman siaran massal yang sedang berjalan
router.post('/broadcast/stop', (req, res) => {
    cancelBroadcastFlag = true;
    res.json({ success: true, message: 'Proses pengiriman siaran massal telah diinstruksikan untuk berhenti.' });
});

// ─── KIRIM PESAN LANGSUNG ─────────────────────────────────
router.post('/send-message', async (req, res) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) return res.status(400).json({ error: 'Nomor dan pesan wajib diisi.' });
        const client = getClient();
        if (!client || getStatus() !== 'CONNECTED') {
            return res.status(500).json({ error: 'WhatsApp client tidak terhubung.' });
        }
        const formattedJid = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@c.us`;
        await client.sendMessage(formattedJid, message);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── AKSI MASSAL TOKO (buka/tutup semua grup) ─────────────
router.post('/action', async (req, res) => {
    try {
        const { action } = req.body;
        if (!action) return res.status(400).json({ error: 'action wajib diisi.' });
        const client = getClient();
        if (!client || getStatus() !== 'CONNECTED') {
            return res.status(500).json({ error: 'WhatsApp client tidak terhubung.' });
        }
        const { group_configs: gConfigs } = await getGroupConfigs();
        const activeGroupIds = Object.keys(gConfigs).filter(id => gConfigs[id].enabled);
        let count = 0;
        const shouldAdminsOnly = action !== 'buka';
        for (const gid of activeGroupIds) {
            try {
                await setMessagesAdminsOnlyHelper(client, gid, shouldAdminsOnly);
                const msgText = shouldAdminsOnly
                    ? "🔔 *Pemberitahuan Manual:* Toko ditutup sementara. Grup ini ditutup untuk umum. Hanya Admin yang dapat mengirim pesan."
                    : "🔔 *Pemberitahuan Manual:* Toko dibuka kembali. Grup dibuka untuk umum. Silakan ajukan pesanan Anda!";
                await client.sendMessage(gid, msgText);
                count++;
            } catch(e) {
                console.error(`Gagal kontrol grup ${gid} massal:`, e.message);
            }
        }
        res.json({ success: true, count });
    } catch(err) {
        console.error('Gagal menjalankan aksi massal toko:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
