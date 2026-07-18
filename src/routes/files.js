// src/routes/files.js — API Routes untuk Manajemen File, OCR
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const KNOWLEDGE_DIR = './knowledge';
const MEDIA_DIR = './media';

// ─── FILE LIST ────────────────────────────────────────────
router.get('/files', (req, res) => {
    try {
        const knowledgeFiles = fs.existsSync(KNOWLEDGE_DIR) ? fs.readdirSync(KNOWLEDGE_DIR) : [];
        const mediaFiles = fs.existsSync(MEDIA_DIR) ? fs.readdirSync(MEDIA_DIR) : [];
        res.json({
            knowledge: knowledgeFiles.map(name => ({ name })),
            media: mediaFiles.map(name => ({ name }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── UPLOAD ───────────────────────────────────────────────
// Note: multer instances are passed from index.js via router.use
router.post('/upload/knowledge', (req, res, next) => {
    // multer dipasang dari index.js
    req.app.get('knowledgeUpload').single('file')(req, res, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

router.post('/upload/media', (req, res, next) => {
    req.app.get('mediaUpload').single('file')(req, res, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ─── OCR ──────────────────────────────────────────────────
router.post('/ocr', (req, res, next) => {
    req.app.get('mediaUpload').single('file')(req, res, async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!req.file) return res.status(400).json({ error: 'Tidak ada file gambar yang diupload' });
        
        try {
            const { performOCR, isReceiptText, extractReceiptDetails } = require('../services/ocr/ocrService');
            const filePath = req.file.path;
            const buffer = fs.readFileSync(filePath);
            const ocrText = await performOCR(buffer);
            try { fs.unlinkSync(filePath); } catch (_) {}
            const isReceipt = isReceiptText(ocrText);
            let parsed = null;
            if (isReceipt) {
                parsed = await extractReceiptDetails(ocrText);
            }
            res.json({ success: true, text: ocrText, isReceipt, parsed });
        } catch (ocrErr) {
            console.error('Error saat OCR di Dashboard:', ocrErr.message);
            res.status(500).json({ error: ocrErr.message });
        }
    });
});

// ─── DELETE FILE ─────────────────────────────────────────
router.post('/files/delete', (req, res) => {
    const { type, filename } = req.body;
    const targetDir = type === 'media' ? MEDIA_DIR : KNOWLEDGE_DIR;
    const filePath = path.join(targetDir, filename);
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Gagal menghapus berkas: ' + err.message });
        }
    } else {
        res.status(404).json({ error: 'File tidak ditemukan' });
    }
});

// ─── RENAME FILE ─────────────────────────────────────────
router.post('/files/rename', (req, res) => {
    const { type, oldFilename, newFilename, oldName, newName } = req.body;
    const oldNameFinal = oldFilename || oldName;
    const newNameFinal = newFilename || newName;
    if (!oldNameFinal || !newNameFinal) {
        return res.status(400).json({ error: 'Nama file lama atau baru tidak valid' });
    }
    const targetDir = type === 'media' ? MEDIA_DIR : KNOWLEDGE_DIR;
    const oldPath = path.join(targetDir, oldNameFinal);
    const newPath = path.join(targetDir, newNameFinal);
    if (fs.existsSync(oldPath)) {
        try {
            fs.renameSync(oldPath, newPath);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: 'Gagal mengubah nama berkas: ' + err.message });
        }
    } else {
        res.status(404).json({ error: 'File tidak ditemukan' });
    }
});

module.exports = router;
