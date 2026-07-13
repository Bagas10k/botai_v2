const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '../../config.json');
const CONFIG_EXAMPLE_FILE = path.join(__dirname, '../../config.example.json');

// Ensure config exists
if (!fs.existsSync(CONFIG_FILE)) {
    if (fs.existsSync(CONFIG_EXAMPLE_FILE)) {
        fs.copyFileSync(CONFIG_EXAMPLE_FILE, CONFIG_FILE);
    } else {
        console.error('Error: File config.json tidak ditemukan dan config.example.json juga tidak ada!');
        process.exit(1);
    }
}

// Load config
let config = {};
try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
} catch (e) {
    console.error('Error parsing config.json:', e);
    process.exit(1);
}

// Auto-correct puppeteer path based on OS
let configModified = false;
if (process.platform === 'linux') {
    if (config.puppeteer_executable_path && (config.puppeteer_executable_path.includes('\\') || config.puppeteer_executable_path.toLowerCase().includes('program files') || config.puppeteer_executable_path.toLowerCase().includes('chrome.exe'))) {
        config.puppeteer_executable_path = '/usr/bin/google-chrome-stable';
        configModified = true;
    }
} else if (process.platform === 'win32') {
    if (config.puppeteer_executable_path && config.puppeteer_executable_path.includes('/')) {
        config.puppeteer_executable_path = '';
        configModified = true;
    }
}

if (configModified) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    } catch (e) {
        console.error('Gagal menyimpan koreksi otomatis path puppeteer ke config.json:', e);
    }
}

// Gemini key rotation state
let currentGeminiKeyIndex = 0;

function rotateGeminiKey() {
    let keys = config.gemini_api_keys || [];
    if (keys.length === 0 && config.gemini_api_key) keys = [config.gemini_api_key];
    if (keys.length === 0 && config.api_key) keys = [config.api_key];
    keys = keys.filter(k => k && k.trim().length > 0);
    if (keys.length > 0) {
        currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % keys.length;
    }
    return currentGeminiKeyIndex;
}

function getGeminiKey() {
    let keys = config.gemini_api_keys || [];
    if (keys.length === 0 && config.gemini_api_key) keys = [config.gemini_api_key];
    if (keys.length === 0 && config.api_key) keys = [config.api_key];
    keys = keys.filter(k => k && k.trim().length > 0);
    if (keys.length === 0) return null;
    return {
        key: keys[currentGeminiKeyIndex % keys.length],
        index: currentGeminiKeyIndex % keys.length,
        total: keys.length
    };
}

function updateConfig(newConfig) {
    Object.assign(config, newConfig);
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    return config;
}

module.exports = {
    config,
    getGeminiKey,
    rotateGeminiKey,
    updateConfig,
    CONFIG_FILE
};
