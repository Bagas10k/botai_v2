const axios = require('axios');
const { config } = require('../../config/config');

let sheetsSummaryCache = { data: null, timestamp: 0 };

async function sendToGoogleSheets(payload) {
    const sheetsUrl = config.google_sheets_url;
    if (!sheetsUrl) {
        throw new Error('URL Google Sheets belum dikonfigurasi di dasbor.');
    }
    
    const response = await axios.post(sheetsUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000
    });
    
    if (response.data && response.data.status === 'success') {
        return response.data;
    } else {
        throw new Error((response.data && response.data.message) || 'Respon gagal dari Google Sheets App.');
    }
}

async function fetchSheetsSummary(forceRefresh = false) {
    const now = Date.now();
    // Cache for 60 seconds
    if (!forceRefresh && sheetsSummaryCache.data && (now - sheetsSummaryCache.timestamp < 60000)) {
        return sheetsSummaryCache.data;
    }
    
    const sheetsUrl = config.google_sheets_url;
    if (!sheetsUrl) {
        return null;
    }
    
    try {
        console.log('[Google Sheets] Mengambil ringkasan data terbaru secara real-time...');
        const response = await axios.post(sheetsUrl, {
            action: 'read_data'
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000
        });
        
        if (response.data && response.data.status === 'success') {
            sheetsSummaryCache.data = response.data;
            sheetsSummaryCache.timestamp = now;
            return response.data;
        }
    } catch (err) {
        console.error('Gagal fetchSheetsSummary dari Google Sheets:', err.message);
    }
    
    return sheetsSummaryCache.data;
}

module.exports = {
    sendToGoogleSheets,
    fetchSheetsSummary
};
