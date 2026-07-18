// src/handlers/guardHandler.js
'use strict';
const { config } = require('../config/config');
const { addCustomer } = require('../db/models');
const { normalizePhone } = require('./helpers');

async function checkAndProcessGuards(msg, {
    chatId, senderId, userMessage, isGroup, shopData, clientInstance
}) {
    const senderPhone = senderId.split('@')[0];

    // 1. Resolve isSenderHostAdmin status
    const isSenderBoss = (() => {
        if (!config.boss_number || config.boss_number.trim() === '') return false;
        const cleanBoss = normalizePhone(config.boss_number);
        const cleanSender = normalizePhone(senderId);
        return cleanSender === cleanBoss;
    })();

    let isSenderHostAdmin = false;
    const isPinnedAdmin = (shopData.host_admins || []).some(admin => {
        const cleanAdmin = normalizePhone(admin);
        const cleanSender = normalizePhone(senderId);
        return cleanAdmin === cleanSender;
    });
    isSenderHostAdmin = isPinnedAdmin || isSenderBoss;

    if (!isSenderHostAdmin && isGroup) {
        try {
            const chat = await msg.getChat();
            if (chat.isGroup) {
                const participant = chat.participants.find(p => p.id._serialized === senderId);
                if (participant && (participant.isAdmin || participant.isSuperAdmin)) {
                    isSenderHostAdmin = true;
                }
            }
        } catch (e) {
            console.error('Gagal memverifikasi status admin grup:', e.message);
        }
    }

    // 2. Check if bot is disabled in this scope
    if (!isGroup && config.private_chat_bot_enabled === false && !isSenderHostAdmin) {
        return { shouldIgnore: true, isSenderHostAdmin };
    }
    if (isGroup && config.group_chat_bot_enabled === false && !isSenderHostAdmin) {
        return { shouldIgnore: true, isSenderHostAdmin };
    }

    // 3. Auto-save customer to CRM (SQLite) and send VCard
    const rawSenderId = msg.author || msg.from;
    if (!msg.fromMe && rawSenderId && (rawSenderId.endsWith('@c.us') || rawSenderId.endsWith('@lid'))) {
        (async () => {
            try {
                const customerExists = (shopData.customers || []).some(c => c.phone.replace(/\D/g, '') === senderPhone);
                if (!customerExists && !isSenderHostAdmin && senderId !== 'status@broadcast') {
                    const contact = await msg.getContact();
                    const phone = contact.number || contact.id.user;
                    const name = contact.pushname || contact.name || `Pelanggan ${senderPhone}`;
                    if (phone && phone.length > 5) {
                        await addCustomer(phone, name);
                        
                        // Send VCard
                        if (config.auto_send_vcard !== false) {
                            const businessName = config.vcard_name || 'CS Jajan Digital';
                            const myNumber = (clientInstance && clientInstance.info && clientInstance.info.wid && clientInstance.info.wid.user) 
                                ? clientInstance.info.wid.user 
                                : '';
                            
                            if (myNumber) {
                                const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${businessName}\nORG:${businessName}\nTEL;TYPE=CELL;waid=${myNumber}:+${myNumber}\nEND:VCARD`;
                                console.log(`[Auto Save VCard] Mengirim kontak bisnis ke pelanggan baru: ${senderPhone}`);
                                await clientInstance.sendMessage(senderId, vcard);
                                await clientInstance.sendMessage(senderId, `Halo Kak! Kontak kami di atas otomatis dikirim agar Kakak bisa menyimpannya. Silakan simpan nomor kami agar tidak ketinggalan info promo menarik di status/story WhatsApp kami ya! 🙏`);
                            }
                        }
                    }
                }
            } catch (crmErr) {
                console.error('[CRM Auto-Save Warning] Gagal menyimpan pelanggan otomatis:', crmErr.message);
            }
        })();
    }

    // 4. Auto order notify to host admins
    const orderKeywords = /\b(beli|pesan|order|daftar|payment|transfer|cod|harga|pembayaran|list|checkout|boking|booking)\b/i;
    if (orderKeywords.test(userMessage) && !isSenderHostAdmin && senderId !== 'status@broadcast' && !msg.fromMe) {
        (async () => {
            try {
                const contact = await msg.getContact();
                const customerName = contact.pushname || contact.name || `Pelanggan ${senderPhone}`;
                const groupNameText = isGroup ? 'Grup' : 'Chat Pribadi';
                const notifyText = `🔔 *Notifikasi Pesanan Masuk Baru!*\n\n` +
                                   `*Pelanggan:* ${customerName} (wa.me/${senderPhone})\n` +
                                   `*Tipe:* ${groupNameText}\n` +
                                   `*Pesan:* "${userMessage}"`;
                
                const adminTargets = new Set();
                const cleanBoss = config.boss_number ? (config.boss_number.replace(/\D/g, '') + '@c.us') : '';
                if (cleanBoss) adminTargets.add(cleanBoss);
                (shopData.host_admins || []).forEach(admin => {
                    adminTargets.add(admin.replace(/\D/g, '') + '@c.us');
                });

                for (const adminTarget of adminTargets) {
                    try {
                        await clientInstance.sendMessage(adminTarget, notifyText);
                    } catch (err) {
                        console.error(`Gagal mengirim notifikasi pesanan ke ${adminTarget}:`, err.message);
                    }
                }
            } catch (err) {
                console.error('Gagal memproses notifikasi pesanan otomatis:', err.message);
            }
        })();
    }

    return { shouldIgnore: false, isSenderHostAdmin };
}

module.exports = { checkAndProcessGuards };
