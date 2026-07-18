// src/routes/configRoute.js — API Routes untuk Config Bot
const express = require('express');
const router = express.Router();
const { config, updateConfig: saveConfig } = require('../config/config');

router.get('/config', (req, res) => {
    res.json(config);
});

router.post('/config', (req, res) => {
    try {
        const newConfig = req.body;
        // Jangan timpa api_key jika yang dikirim adalah placeholder atau kosong
        const isPlaceholder = (v) => !v || v.includes('YOUR_LOCAL') || v.includes('TOKEN');
        if (isPlaceholder(newConfig.api_key)) {
            delete newConfig.api_key;
        }
        Object.assign(config, newConfig);
        saveConfig(config);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
