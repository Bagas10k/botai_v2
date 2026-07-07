// Dashboard Admin Chatbot CS Sania AI - Client Logic
const socket = io();

// State & UI Elements
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const qrContainer = document.getElementById('qr-container');
const qrPlaceholder = document.getElementById('qr-code-placeholder');
const activeSessionInfo = document.getElementById('active-session-info');
const knowledgeList = document.getElementById('knowledge-list');
const mediaList = document.getElementById('media-list');
const chatMessages = document.getElementById('chat-messages');
const badgeModelName = document.getElementById('badge-model-name');

// File Upload inputs
const knowledgeUpload = document.getElementById('knowledge-upload');
const mediaUpload = document.getElementById('media-upload');

// Config Form Elements
const configForm = document.getElementById('config-form');
const cfgProvider = document.getElementById('cfg-provider');
const cfgGeminiApiKeys = document.getElementById('cfg-gemini-api-keys');
const cfgGeminiModel = document.getElementById('cfg-gemini-model');
const cfgApiUrl = document.getElementById('cfg-api-url');
const cfgModelName = document.getElementById('cfg-model-name');
const cfgMaxTokens = document.getElementById('cfg-max-tokens');
const cfgApiKey = document.getElementById('cfg-api-key');
const cfgSheetsUrl = document.getElementById('cfg-sheets-url');
const cfgBossNumber = document.getElementById('cfg-boss-number');
const cfgReportTime = document.getElementById('cfg-report-time');
const cfgSystemPrompt = document.getElementById('cfg-system-prompt');
const cfgAiMemory = document.getElementById('cfg-ai-memory');

// History Log Elements
const historyFinanceList = document.getElementById('history-finance-list');
const historyAgendaList = document.getElementById('history-agenda-list');

window.toggleProviderFields = function() {
    const provider = cfgProvider.value;
    const groups = {
        gemini: document.getElementById('group-gemini-settings'),
        local: document.getElementById('group-local-settings'),
        groq: document.getElementById('group-groq-settings'),
        deepseek: document.getElementById('group-deepseek-settings'),
        qwen: document.getElementById('group-qwen-settings'),
        openrouter: document.getElementById('group-openrouter-settings')
    };
    
    Object.keys(groups).forEach(key => {
        const group = groups[key];
        if (group) {
            if (key === provider) {
                group.classList.remove('hidden');
            } else {
                group.classList.add('hidden');
            }
        }
    });
};

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadFiles();
    loadConfig();
    loadAiMemory();
    loadHistoryLog();
    setupUploadHandlers();
    setupConfigHandler();
    
    // Sync theme selector from localStorage
    const savedTheme = localStorage.getItem('dashboard-theme') || 'light';
    const selector = document.getElementById('cfg-theme-selector');
    if (selector) {
        selector.value = savedTheme;
    }
});

// Change Theme Handler (dihandle di index.html — fungsi ini sebagai fallback/compat)
// Fungsi utama ada di inline script index.html agar tidak ada duplikasi

// Switch Tab Navigation
window.switchTab = function(tabId) {
    const tabMonitor = document.getElementById('tab-monitor');
    const tabMemory = document.getElementById('tab-memory');
    const tabSettings = document.getElementById('tab-settings');
    const tabGroups = document.getElementById('tab-groups');
    const tabShop = document.getElementById('tab-shop');
    
    const btnMonitor = document.getElementById('btn-tab-monitor');
    const btnMemory = document.getElementById('btn-tab-memory');
    const btnSettings = document.getElementById('btn-tab-settings');
    const btnGroups = document.getElementById('btn-tab-groups');
    const btnShop = document.getElementById('btn-tab-shop');
    
    // Hide all
    if (tabMonitor) tabMonitor.classList.add('hidden');
    if (tabMemory) tabMemory.classList.add('hidden');
    if (tabSettings) tabSettings.classList.add('hidden');
    if (tabGroups) tabGroups.classList.add('hidden');
    if (tabShop) tabShop.classList.add('hidden');
    
    if (btnMonitor) btnMonitor.classList.remove('active');
    if (btnMemory) btnMemory.classList.remove('active');
    if (btnSettings) btnSettings.classList.remove('active');
    if (btnGroups) btnGroups.classList.remove('active');
    if (btnShop) btnShop.classList.remove('active');
    
    if (tabId === 'monitor') {
        if (tabMonitor) tabMonitor.classList.remove('hidden');
        if (btnMonitor) btnMonitor.classList.add('active');
    } else if (tabId === 'memory') {
        if (tabMemory) tabMemory.classList.remove('hidden');
        if (btnMemory) btnMemory.classList.add('active');
    } else if (tabId === 'settings') {
        if (tabSettings) tabSettings.classList.remove('hidden');
        if (btnSettings) btnSettings.classList.add('active');
    } else if (tabId === 'groups') {
        if (tabGroups) tabGroups.classList.remove('hidden');
        if (btnGroups) btnGroups.classList.add('active');
        loadGroupsList();
    } else if (tabId === 'shop') {
        if (tabShop) tabShop.classList.remove('hidden');
        if (btnShop) btnShop.classList.add('active');
        loadHostAdmins();
        loadCustomersList();
    }
};// Real-time Socket.io Connection Events
socket.on('connect', () => {
    console.log('Connected to dashboard backend server via WebSockets.');
});

socket.on('whatsapp_status', (data) => {
    updateConnectionStatus(data.status);
});

socket.on('qr', (qrData) => {
    renderQRCode(qrData);
});

socket.on('message_log', (msg) => {
    appendMessageLog(msg);
});

socket.on('history_updated', (data) => {
    renderHistoryLog(data);
});

socket.on('memory_updated', (data) => {
    if (cfgAiMemory) {
        cfgAiMemory.value = data.content;
    }
    loadFiles();
});

// Update WhatsApp status display
function updateConnectionStatus(status) {
    statusDot.className = 'status-dot';
    
    if (status === 'CONNECTED') {
        statusDot.classList.add('connected');
        statusText.textContent = 'Terhubung (Aktif)';
        qrContainer.classList.add('hidden');
        activeSessionInfo.classList.remove('hidden');
    } else if (status === 'INITIALIZING') {
        statusDot.classList.add('initializing');
        statusText.textContent = 'Menginisialisasi WhatsApp...';
        qrContainer.classList.add('hidden');
        activeSessionInfo.classList.add('hidden');
    } else if (status === 'QR_RECEIVED') {
        statusDot.classList.add('initializing');
        statusText.textContent = 'Menunggu Pindai QR';
        activeSessionInfo.classList.add('hidden');
    } else {
        statusDot.classList.add('disconnected');
        statusText.textContent = 'Terputus (Offline)';
        activeSessionInfo.classList.add('hidden');
    }
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Render QR code dynamically
function renderQRCode(qrData) {
    qrPlaceholder.innerHTML = '';
    
    const canvas = document.createElement('canvas');
    qrPlaceholder.appendChild(canvas);
    
    // Draw QR using the global QRCode library loaded via CDN
    QRCode.toCanvas(canvas, qrData, { 
        width: 220, 
        margin: 1,
        color: {
            dark: '#0b0f19',
            light: '#ffffff'
        }
    }, function (error) {
        if (error) {
            console.error('Error drawing QR canvas:', error);
            qrPlaceholder.innerHTML = '<p style="color:red">Gagal memuat QR Code</p>';
        }
    });

    qrContainer.classList.remove('hidden');
    activeSessionInfo.classList.add('hidden');
}

// Append new WhatsApp message to the live chat feed
function appendMessageLog(msg) {
    const placeholder = chatMessages.querySelector('.chat-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    const cleanChatId = msg.chatId.split('@')[0];
    const timestampStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let sessionBlock = document.getElementById(`session-${cleanChatId}`);
    if (!sessionBlock) {
        sessionBlock = document.createElement('div');
        sessionBlock.id = `session-${cleanChatId}`;
        sessionBlock.className = 'chat-session-block';
        
        const header = document.createElement('div');
        header.className = 'session-user-header';
        header.textContent = `WA User: +${cleanChatId}`;
        sessionBlock.appendChild(header);
        chatMessages.appendChild(sessionBlock);
    }
    
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${msg.type}`; // 'incoming' (User) or 'outgoing' (Sania) or 'system-cmd'
    
    let bubbleContent = `<div>${escapeHtml(msg.body)}</div>`;
    
    if (msg.fileSent) {
        const iconName = msg.fileSent.endsWith('.png') ? 'image' : 'file-text';
        bubbleContent += `
            <div class="media-tag-indicator" style="display:inline-flex; align-items:center; gap:6px;">
                <i data-lucide="${iconName}" style="width:14px; height:14px;"></i>
                <span>Mengirim Berkas: <strong>${escapeHtml(msg.fileSent)}</strong></span>
            </div>
        `;
    }
    
    bubbleContent += `<span class="message-time">${timestampStr}</span>`;
    bubble.innerHTML = bubbleContent;
    
    sessionBlock.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (window.lucide) {
        lucide.createIcons();
    }
}

// Fetch files list from server
async function loadFiles() {
    try {
        const res = await fetch('/api/files');
        const data = await res.json();
        
        renderFileList(knowledgeList, data.knowledge, 'knowledge');
        renderFileList(mediaList, data.media, 'media');
    } catch (err) {
        console.error('Gagal memuat berkas:', err);
    }
}

// Render list of files in UI
function renderFileList(container, files, type) {
    container.innerHTML = '';
    
    if (files.length === 0) {
        container.innerHTML = `<div class="file-item-placeholder">Tidak ada berkas tersedia.</div>`;
        return;
    }
    
    files.forEach(file => {
        const item = document.createElement('div');
        item.className = 'file-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'file-name';
        nameSpan.textContent = file;
        nameSpan.title = file;
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'file-actions';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-danger btn-sm';
        deleteBtn.textContent = 'Hapus';
        deleteBtn.onclick = () => deleteFile(type, file);
        
        actionsDiv.appendChild(deleteBtn);
        item.appendChild(nameSpan);
        item.appendChild(actionsDiv);
        container.appendChild(item);
    });
}

// Setup File Upload inputs change listeners
function setupUploadHandlers() {
    knowledgeUpload.addEventListener('change', () => handleFileUpload(knowledgeUpload, 'knowledge'));
    mediaUpload.addEventListener('change', () => handleFileUpload(mediaUpload, 'media'));
}

// Handle file upload to backend
async function handleFileUpload(inputElement, type) {
    const file = inputElement.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const res = await fetch(`/api/upload/${type}`, {
            method: 'POST',
            body: formData
        });
        
        if (res.ok) {
            alert(`File ${file.name} berhasil diunggah.`);
            loadFiles();
        } else {
            const errText = await res.text();
            alert(`Gagal mengunggah: ${errText}`);
        }
    } catch (err) {
        console.error('Kesalahan unggah:', err);
        alert('Gagal mengunggah karena gangguan koneksi.');
    } finally {
        inputElement.value = '';
    }
}

// Delete file on server
async function deleteFile(type, filename) {
    if (!confirm(`Apakah Anda yakin ingin menghapus berkas "${filename}"?`)) return;
    
    try {
        const res = await fetch('/api/files/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ type, filename })
        });
        
        if (res.ok) {
            loadFiles();
        } else {
            alert('Gagal menghapus berkas.');
        }
    } catch (err) {
        console.error('Kesalahan hapus berkas:', err);
    }
}

// Load configurations from config.json
async function loadConfig() {
    try {
        const res = await fetch('/api/config');
        if (!res.ok) throw new Error('Gagal mengambil data konfigurasi.');
        const config = await res.json();
        
        cfgProvider.value = config.provider || 'gemini';
        
        // Memuat stok API Keys (gabungkan dengan newline untuk textarea)
        let keysList = '';
        if (config.gemini_api_keys && Array.isArray(config.gemini_api_keys)) {
            keysList = config.gemini_api_keys.join('\n');
        } else if (config.gemini_api_key) {
            keysList = config.gemini_api_key;
        }
        cfgGeminiApiKeys.value = keysList;
        
        cfgGeminiModel.value = config.provider === 'gemini' ? (config.model_name || 'gemini-2.5-flash') : 'gemini-2.5-flash';
        
        cfgApiUrl.value = config.api_url || '';
        cfgModelName.value = config.provider === 'local' ? (config.model_name || 'qwen3.5-9b') : 'qwen3.5-9b';
        cfgApiKey.value = config.api_key || '';
        
        // Memuat keys untuk provider baru
        document.getElementById('cfg-groq-api-key').value = config.groq_api_key || '';
        document.getElementById('cfg-groq-model').value = config.groq_model || 'llama-3.3-70b-versatile';
        
        document.getElementById('cfg-deepseek-api-key').value = config.deepseek_api_key || '';
        document.getElementById('cfg-deepseek-model').value = config.deepseek_model || 'deepseek-chat';
        
        document.getElementById('cfg-qwen-api-key').value = config.qwen_api_key || '';
        document.getElementById('cfg-qwen-model').value = config.qwen_model || 'qwen-plus';
        
        document.getElementById('cfg-openrouter-api-key').value = config.openrouter_api_key || '';
        document.getElementById('cfg-openrouter-model').value = config.openrouter_model || 'meta-llama/llama-3.3-70b-instruct';
        
        cfgMaxTokens.value = config.max_tokens || 1000;
        cfgSheetsUrl.value = config.google_sheets_url || '';
        cfgBossNumber.value = config.boss_number || '';
        cfgReportTime.value = config.report_time || '08:00';
        cfgSystemPrompt.value = config.system_prompt_template || '';
        
        // Update header badge with current provider name and model
        let providerLabel = 'Gemini';
        if (config.provider === 'local') providerLabel = 'LM Studio';
        else if (config.provider === 'groq') providerLabel = 'Groq';
        else if (config.provider === 'deepseek') providerLabel = 'DeepSeek';
        else if (config.provider === 'qwen') providerLabel = 'Qwen';
        else if (config.provider === 'openrouter') providerLabel = 'OpenRouter';
        
        badgeModelName.textContent = `${providerLabel}: ${config.model_name || 'Aktif'}`;
        
        toggleProviderFields();
    } catch (err) {
        console.error('Error loading config:', err);
    }
}

// Save config handler
function setupConfigHandler() {
    configForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const provider = cfgProvider.value;
        const keysInput = cfgGeminiApiKeys.value;
        const geminiKeys = keysInput.split('\n')
            .map(k => k.trim())
            .filter(k => k.length > 0);
            
        // Tentukan model name berdasarkan provider yang aktif
        let activeModel = 'gemini-2.5-flash';
        if (provider === 'gemini') {
            activeModel = cfgGeminiModel.value.trim();
        } else if (provider === 'local') {
            activeModel = cfgModelName.value.trim();
        } else if (provider === 'groq') {
            activeModel = document.getElementById('cfg-groq-model').value.trim();
        } else if (provider === 'deepseek') {
            activeModel = document.getElementById('cfg-deepseek-model').value.trim();
        } else if (provider === 'qwen') {
            activeModel = document.getElementById('cfg-qwen-model').value.trim();
        } else if (provider === 'openrouter') {
            activeModel = document.getElementById('cfg-openrouter-model').value.trim();
        }
            
        const payload = {
            provider: provider,
            gemini_api_keys: geminiKeys,
            api_url: cfgApiUrl.value.trim(),
            api_key: cfgApiKey.value.trim(),
            model_name: activeModel,
            max_tokens: parseInt(cfgMaxTokens.value, 10),
            google_sheets_url: cfgSheetsUrl.value.trim(),
            boss_number: cfgBossNumber.value.trim(),
            report_time: cfgReportTime.value.trim(),
            system_prompt_template: cfgSystemPrompt.value.trim(),
            
            // Sertakan key & model provider lainnya agar tidak terhapus
            groq_api_key: document.getElementById('cfg-groq-api-key').value.trim(),
            groq_model: document.getElementById('cfg-groq-model').value.trim(),
            deepseek_api_key: document.getElementById('cfg-deepseek-api-key').value.trim(),
            deepseek_model: document.getElementById('cfg-deepseek-model').value.trim(),
            qwen_api_key: document.getElementById('cfg-qwen-api-key').value.trim(),
            qwen_model: document.getElementById('cfg-qwen-model').value.trim(),
            openrouter_api_key: document.getElementById('cfg-openrouter-api-key').value.trim(),
            openrouter_model: document.getElementById('cfg-openrouter-model').value.trim()
        };
        
        try {
            const res = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                alert('Konfigurasi bot berhasil disimpan dan diterapkan!');
                loadConfig(); // Refresh values & header badge
            } else {
                alert('Gagal menyimpan konfigurasi.');
            }
        } catch (err) {
            console.error('Save config error:', err);
            alert('Terjadi kesalahan koneksi saat menyimpan.');
        }
    });
}

// Utility to escape HTML and prevent XSS in monitor console
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Load AI Memory from server
async function loadAiMemory() {
    try {
        const res = await fetch('/api/memory');
        if (!res.ok) throw new Error('Gagal mengambil data memori otomatis.');
        const data = await res.json();
        if (cfgAiMemory) {
            cfgAiMemory.value = data.content || '';
        }
    } catch (err) {
        console.error('Error loading AI memory:', err);
    }
}

// Save AI Memory to server
window.saveAiMemory = async function() {
    if (!cfgAiMemory) return;
    
    const payload = {
        content: cfgAiMemory.value
    };
    
    try {
        const res = await fetch('/api/memory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            alert('Undang-Undang Utama AI (Konstitusi Bot) berhasil disimpan!');
            loadFiles();
        } else {
            alert('Gagal menyimpan Undang-Undang.');
        }
    } catch (err) {
        console.error('Save memory error:', err);
        alert('Terjadi kesalahan koneksi saat menyimpan.');
    }
};

// Clear AI Memory
window.clearAiMemory = function() {
    if (!cfgAiMemory) return;
    if (confirm('Apakah Anda yakin ingin menghapus seluruh Undang-Undang Utama AI (Konstitusi Bot)?')) {
        cfgAiMemory.value = '';
        saveAiMemory();
    }
};

// Load History Logs from server
async function loadHistoryLog() {
    try {
        const res = await fetch('/api/history');
        if (!res.ok) throw new Error('Gagal mengambil history log.');
        const data = await res.json();
        renderHistoryLog(data);
    } catch (err) {
        console.error('Error loading history log:', err);
    }
}

// Render history logs inside WhatsApp style lists (iOS layout)
function renderHistoryLog(data) {
    if (!data) return;
    
    // 1. Finance list
    if (historyFinanceList) {
        historyFinanceList.innerHTML = '';
        const finance = data.finance || [];
        if (finance.length === 0) {
            historyFinanceList.innerHTML = `
                <div class="file-item-placeholder">Belum ada catatan keuangan masuk.</div>
            `;
        } else {
            finance.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'wa-chat-item';
                
                const dateStr = new Date(entry.tanggal).toLocaleDateString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const isIncome = entry.tipe === 'Pemasukan';
                const avatarIcon = isIncome ? 'arrow-down-left' : 'arrow-up-right';
                const avatarClass = isIncome ? 'income' : 'expense';
                
                item.innerHTML = `
                    <div class="wa-chat-avatar ${avatarClass}"><i data-lucide="${avatarIcon}"></i></div>
                    <div class="wa-chat-details">
                        <div class="wa-chat-title-row">
                            <span class="wa-chat-title">${escapeHtml(entry.keterangan)}</span>
                            <span class="wa-chat-time">${dateStr}</span>
                        </div>
                        <div class="wa-chat-subtitle-row" style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                            <span class="wa-chat-subtitle" style="color:${isIncome ? '#30d158' : '#ff453a'}; font-weight:600; font-size:13.5px;">
                                ${isIncome ? '+' : '-'} Rp ${entry.nominal.toLocaleString('id-ID')}
                            </span>
                            <span class="preset-category-badge" style="background:${isIncome ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)'}; color:${isIncome ? '#30d158' : '#ff453a'}; padding:2px 6px; font-size:10px; border-radius:4px; font-weight:600;">
                                ${entry.tipe}
                            </span>
                        </div>
                    </div>
                `;
                historyFinanceList.appendChild(item);
            });
        }
    }
    
    // 2. Agenda list
    if (historyAgendaList) {
        historyAgendaList.innerHTML = '';
        const agenda = data.agenda || [];
        if (agenda.length === 0) {
            historyAgendaList.innerHTML = `
                <div class="file-item-placeholder">Belum ada agenda terjadwal.</div>
            `;
        } else {
            agenda.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'wa-chat-item';
                
                item.innerHTML = `
                    <div class="wa-chat-avatar agenda"><i data-lucide="calendar"></i></div>
                    <div class="wa-chat-details">
                        <div class="wa-chat-title-row">
                            <span class="wa-chat-title">${escapeHtml(entry.acara)}</span>
                        </div>
                        <div class="wa-chat-subtitle-row" style="margin-top:4px;">
                            <span class="wa-chat-subtitle" style="color:var(--wa-green); font-size:12.5px; font-weight:600;">
                                <i data-lucide="clock" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-top:-2px; margin-right:2px;"></i> ${escapeHtml(entry.waktu)}
                            </span>
                        </div>
                    </div>
                `;
                historyAgendaList.appendChild(item);
            });
        }
    }

    // Trigger Lucide SVG compilation
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Refresh WhatsApp Client (Refresh QR/Sesi)
window.refreshQRCode = async function(clearSession = false) {
    const confirmMsg = clearSession 
        ? 'Apakah Anda yakin ingin mereset sesi WhatsApp dan memindai QR Code baru?' 
        : 'Apakah Anda ingin memuat ulang koneksi WhatsApp?';
        
    if (!confirm(confirmMsg)) return;
    
    const statusText = document.getElementById('status-text');
    if (statusText) statusText.textContent = 'Memuat Ulang...';
    
    try {
        const res = await fetch('/api/whatsapp/restart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ clearSession })
        });
        
        if (res.ok) {
            alert('WhatsApp Client sedang di-restart, mohon tunggu beberapa saat.');
        } else {
            const errMsg = await res.text();
            alert('Gagal me-restart client: ' + errMsg);
        }
    } catch (err) {
        console.error('Restart client error:', err);
        alert('Terjadi kesalahan koneksi saat me-restart.');
    }
};

// ══════════════════════════════════════════
// GROUPS TAB LOGIC
// ══════════════════════════════════════════

let activeGroups = [];
let selectedGroupId = null;
let selectedGroupConfig = null;
let selectedNodeId = null;

// Ambil Daftar Grup dari API
window.loadGroupsList = async function() {
    try {
        const res = await fetch('/api/groups');
        if (!res.ok) throw new Error('Gagal mengambil daftar grup');
        
        activeGroups = await res.json();
        renderGroupsListSidebar();
        
        // Update select dropdown untuk modal salin konfig
        updateCloneSourceDropdown();
    } catch (err) {
        console.error('Error loadGroupsList:', err);
        const container = document.getElementById('groups-list-container');
        if (container) {
            container.innerHTML = `<p style="color:#ff453a; text-align:center; font-size:0.85rem;">Terjadi kesalahan: ${err.message}</p>`;
        }
    }
};

// Render daftar grup ke sidebar kiri
function renderGroupsListSidebar() {
    const container = document.getElementById('groups-list-container');
    if (!container) return;
    
    if (activeGroups.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary); text-align:center; font-size:0.85rem; margin-top:30px;">Tidak ada grup yang terdeteksi.</p>';
        return;
    }
    
    container.innerHTML = '';
    activeGroups.forEach(g => {
        const card = document.createElement('div');
        card.className = `group-item-card ${selectedGroupId === g.id ? 'active' : ''}`;
        card.style = `
            padding: 10px;
            border-radius: 6px;
            border: 1px solid ${selectedGroupId === g.id ? 'var(--accent-color)' : 'var(--border-color)'};
            background: ${selectedGroupId === g.id ? 'rgba(10, 132, 255, 0.1)' : 'rgba(255,255,255,0.02)'};
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: all 0.2s ease;
            margin-bottom: 8px;
        `;
        
        // Hover effect
        card.onmouseover = () => { if (selectedGroupId !== g.id) card.style.background = 'rgba(255,255,255,0.05)'; };
        card.onmouseout = () => { if (selectedGroupId !== g.id) card.style.background = 'rgba(255,255,255,0.02)'; };
        card.onclick = () => selectGroup(g.id);
        
        const infoDiv = document.createElement('div');
        infoDiv.innerHTML = `
            <div style="font-weight:600; font-size:0.85rem; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:180px;">${g.name}</div>
            <div style="font-size:0.7rem; color:var(--text-secondary);">${g.id.split('@')[0]}</div>
        `;
        
        const badge = document.createElement('span');
        badge.textContent = g.enabled ? 'Aktif' : 'Nonaktif';
        badge.style = `
            font-size: 0.65rem;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            background: ${g.enabled ? 'rgba(48,209,88,0.15)' : 'rgba(255,255,255,0.1)'};
            color: ${g.enabled ? '#30d158' : 'var(--text-secondary)'};
        `;
        
        card.appendChild(infoDiv);
        card.appendChild(badge);
        container.appendChild(card);
    });
}

// Memilih Grup untuk dikonfigurasi
window.selectGroup = async function(groupId) {
    selectedGroupId = groupId;
    selectedNodeId = null;
    
    // UI states
    document.getElementById('no-group-selected-placeholder').classList.add('hidden');
    document.getElementById('group-editor-panel').classList.remove('hidden');
    
    // Highlight list sidebar
    renderGroupsListSidebar();
    
    // Load config dari server
    try {
        const res = await fetch(`/api/group-config/${groupId}`);
        if (!res.ok) throw new Error('Gagal mengambil data konfigurasi grup');
        
        selectedGroupConfig = await res.json();
        
        // Set info dasar
        document.getElementById('selected-group-title').textContent = selectedGroupConfig.groupName;
        document.getElementById('grp-enabled').checked = selectedGroupConfig.enabled;
        document.getElementById('grp-ai-fallback').checked = selectedGroupConfig.useAiFallback;
        document.getElementById('grp-trigger').value = selectedGroupConfig.triggerPrefix || '';
        document.getElementById('grp-category-footer').value = selectedGroupConfig.categoryFooter || 'Silakan pilih menu dengan mengetik angkanya:';
        document.getElementById('grp-content-footer').value = selectedGroupConfig.contentFooter || 'Ketik *0* untuk kembali ke menu sebelumnya, atau *#* untuk kembali ke menu utama.';
        
        // Emojis, Number navigation, Headers/Footers
        document.getElementById('grp-category-emoji').value = selectedGroupConfig.categoryEmoji || '📁';
        document.getElementById('grp-content-emoji').value = selectedGroupConfig.contentEmoji || '📄';
        document.getElementById('grp-number-nav-enable').checked = selectedGroupConfig.enableNumberNavigation !== false;
        document.getElementById('grp-universal-header').value = selectedGroupConfig.universalHeader || '';
        document.getElementById('grp-universal-footer').value = selectedGroupConfig.universalFooter || '';
        
        // Auto Close Schedule
        const schedule = selectedGroupConfig.autoCloseSchedule || { enabled: false, openTime: '08:00', closeTime: '17:00', activeDays: [1,2,3,4,5] };
        document.getElementById('grp-auto-close-enable').checked = schedule.enabled;
        document.getElementById('grp-open-time').value = schedule.openTime || '08:00';
        document.getElementById('grp-close-time').value = schedule.closeTime || '17:00';
        
        // Day checkboxes
        const activeDays = schedule.activeDays || [1,2,3,4,5];
        document.querySelectorAll('.grp-active-day-cb').forEach(cb => {
            cb.checked = activeDays.includes(parseInt(cb.value, 10));
        });
        
        // Toggle schedule UI fields visibility
        toggleScheduleFields();

        // Extra Triggers
        renderExtraTriggersList(selectedGroupConfig.extraTriggers || []);
        
        // Load knowledge files list (dengan checkbox keaktifan)
        await loadKnowledgeFilesChecklist();
        
        // Render visual editor pohon menu
        renderMenuTreeVisual();
        
        // Reset editor node sebelah kanan
        resetNodeEditorForm();
    } catch (err) {
        console.error('Error selectGroup:', err);
        alert('Gagal memuat konfigurasi grup: ' + err.message);
    }
};

// Ambil knowledge files dan tampilkan list checkbox
async function loadKnowledgeFilesChecklist() {
    const container = document.getElementById('grp-knowledge-files');
    if (!container) return;
    
    try {
        const res = await fetch('/api/files');
        if (!res.ok) throw new Error('Gagal mengambil berkas referensi');
        const data = await res.json();
        
        const files = data.knowledge || [];
        if (files.length === 0) {
            container.innerHTML = '<p style="color:var(--text-secondary); font-size:0.75rem; text-align:center; margin-top:20px;">Tidak ada berkas .txt di tab Memory.</p>';
            return;
        }
        
        container.innerHTML = '';
        files.forEach(f => {
            const label = document.createElement('label');
            label.style = 'display:flex; align-items:center; gap:8px; font-size:0.8rem; cursor:pointer; padding:2px 0;';
            
            const isChecked = selectedGroupConfig.allowedKnowledgeFiles && selectedGroupConfig.allowedKnowledgeFiles.includes(f.name);
            label.innerHTML = `
                <input type="checkbox" class="grp-kb-checkbox" value="${f.name}" ${isChecked ? 'checked' : ''} style="width:14px; height:14px;">
                <span style="text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${f.name}">${f.name}</span>
            `;
            container.appendChild(label);
        });
    } catch (err) {
        console.error('Error loadKnowledgeFilesChecklist:', err);
        container.innerHTML = '<p style="color:#ff453a; font-size:0.75rem;">Gagal memuat daftar berkas.</p>';
    }
}

// ══════════════════════════════════════════
// LOGIKA POHON MENU (TREE MENU EDITOR)
// ══════════════════════════════════════════

// Render pohon secara visual
window.renderMenuTreeVisual = function() {
    const container = document.getElementById('menu-tree-visualizer');
    if (!container) return;
    
    if (!selectedGroupConfig || !selectedGroupConfig.menuTree) {
        container.innerHTML = '<p style="color:var(--text-secondary); font-size:0.85rem; text-align:center;">Data menu tidak ditemukan.</p>';
        return;
    }
    
    container.innerHTML = '';
    const rootNode = selectedGroupConfig.menuTree;
    
    // Render mulai dari root
    const rootEl = createNodeHTML(rootNode, 0);
    container.appendChild(rootEl);
    
    // Re-initialize Lucide Icons untuk tombol/ikon pohon
    lucide.createIcons();
};

// Buat elemen HTML untuk sebuah node secara rekursif
function createNodeHTML(node, depth) {
    const div = document.createElement('div');
    div.style.marginLeft = `${depth * 15}px`;
    div.style.marginTop = '4px';
    
    const header = document.createElement('div');
    header.className = `menu-node-item ${selectedNodeId === node.id ? 'selected' : ''}`;
    
    // Style node item
    header.style = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 8px;
        border-radius: 4px;
        cursor: pointer;
        background: ${selectedNodeId === node.id ? 'rgba(10, 132, 255, 0.15)' : 'transparent'};
        border: 1px solid ${selectedNodeId === node.id ? 'var(--accent-color)' : 'transparent'};
        font-size: 0.85rem;
        transition: all 0.15s ease;
    `;
    
    // Hover effects
    header.onmouseover = () => { if (selectedNodeId !== node.id) header.style.background = 'rgba(255,255,255,0.03)'; };
    header.onmouseout = () => { if (selectedNodeId !== node.id) header.style.background = 'transparent'; };
    header.onclick = (e) => {
        e.stopPropagation();
        selectTreeNode(node.id);
    };
    
    const iconName = node.type === 'category' ? 'folder' : 'file-text';
    const color = node.type === 'category' ? '#ff9f0a' : '#0a84ff';
    
    const statusBadge = node.type === 'content' 
        ? `<span class="status-badge" onclick="quickToggleStatus(event, '${node.id}')" style="font-size: 0.65rem; margin-left: 6px; padding: 2px 6px; border-radius: 4px; font-weight: bold; background: ${
            node.status === 'Tersedia' ? 'rgba(52, 199, 89, 0.15); color: #30d158; border: 1px solid rgba(52, 199, 89, 0.3);' :
            node.status === 'Habis' ? 'rgba(255, 69, 58, 0.15); color: #ff453a; border: 1px solid rgba(255, 69, 58, 0.3);' :
            node.status === 'Pre-order' ? 'rgba(255, 159, 10, 0.15); color: #ff9f0a; border: 1px solid rgba(255, 159, 10, 0.3);' :
            'rgba(255,255,255,0.05); color: var(--text-secondary); border: 1px solid rgba(255,255,255,0.1);'
        }">${node.status || 'Atur Status'}</span>`
        : '';

    header.innerHTML = `
        <i data-lucide="${iconName}" style="width: 14px; height: 14px; color: ${color};"></i>
        <span style="font-weight: ${node.type === 'category' ? '600' : '400'}; flex: 1;">${node.name}</span>
        ${statusBadge}
        ${node.type === 'category' ? `<span style="font-size:0.7rem; color:var(--text-secondary); padding: 0 4px; background:rgba(255,255,255,0.05); border-radius:3px;">${node.children ? node.children.length : 0}</span>` : ''}
    `;
    
    div.appendChild(header);
    
    // Render children jika bertipe kategori
    if (node.type === 'category' && node.children && node.children.length > 0) {
        const childrenContainer = document.createElement('div');
        node.children.forEach(child => {
            const childEl = createNodeHTML(child, depth + 1);
            childrenContainer.appendChild(childEl);
        });
        div.appendChild(childrenContainer);
    }
    
    return div;
}

window.quickToggleStatus = function(e, nodeId) {
    e.stopPropagation(); // Cegah selectNode terpanggil!
    if (!selectedGroupConfig) return;
    
    const node = findNodeInTree(selectedGroupConfig.menuTree, nodeId);
    if (node && node.type === 'content') {
        const statuses = ['', 'Tersedia', 'Habis', 'Pre-order'];
        const currentIdx = statuses.indexOf(node.status || '');
        const nextIdx = (currentIdx + 1) % statuses.length;
        node.status = statuses[nextIdx];
        
        // Re-render visual tree
        renderMenuTreeVisual();
        
        // Jika node ini sedang dipilih, sinkronkan nilai di form edit kanan juga!
        if (selectedNodeId === nodeId) {
            document.getElementById('node-status').value = node.status;
        }
    }
};

// Memilih Node Menu untuk diedit
window.selectTreeNode = function(nodeId) {
    selectedNodeId = nodeId;
    renderMenuTreeVisual(); // Re-render visual highlighting
    
    const node = findNodeInTree(selectedGroupConfig.menuTree, nodeId);
    if (!node) return;
    
    // Tampilkan editor fields
    document.getElementById('node-editor-placeholder').classList.add('hidden');
    document.getElementById('node-editor-fields').classList.remove('hidden');
    
    // Update data form
    document.getElementById('node-name').value = node.name;
    document.getElementById('node-type').value = node.type;
    
    // Tipe toggle fields
    toggleNodeFields();
    
    document.getElementById('node-text').value = node.text || '';
    if (node.type === 'content') {
        document.getElementById('node-media').value = node.media || '';
        document.getElementById('node-status-field').classList.remove('hidden');
        document.getElementById('node-status').value = node.status || '';
    } else {
        document.getElementById('node-media').value = '';
        document.getElementById('node-status-field').classList.add('hidden');
        document.getElementById('node-status').value = '';
    }
};

// Toggle field berdasarkan tipe node aktif
window.toggleNodeFields = function() {
    const nodeType = document.getElementById('node-type').value;
    const mediaField = document.getElementById('node-media-field');
    const statusField = document.getElementById('node-status-field');
    const btnAddChild = document.getElementById('btn-add-child');
    
    if (nodeType === 'category') {
        if (mediaField) mediaField.classList.add('hidden');
        if (statusField) statusField.classList.add('hidden');
        if (btnAddChild) btnAddChild.classList.remove('hidden');
    } else {
        if (mediaField) mediaField.classList.remove('hidden');
        if (statusField) statusField.classList.remove('hidden');
        if (btnAddChild) btnAddChild.classList.add('hidden');
    }
    
    // Sync ke data pohon jika ada pergantian tipe node
    if (selectedGroupId && selectedNodeId) {
        const node = findNodeInTree(selectedGroupConfig.menuTree, selectedNodeId);
        if (node && node.type !== nodeType) {
            node.type = nodeType;
            if (nodeType === 'category') {
                node.children = node.children || [];
                delete node.media;
                delete node.status;
            } else {
                node.media = "";
                node.status = "";
                delete node.children;
            }
            renderMenuTreeVisual();
        }
    }
};

// Reset Form Node Editor
function resetNodeEditorForm() {
    document.getElementById('node-editor-fields').classList.add('hidden');
    document.getElementById('node-editor-placeholder').classList.remove('hidden');
    selectedNodeId = null;
}

// Helper rekursif: Cari node di dalam pohon
function findNodeInTree(node, id) {
    if (node.id === id) return node;
    if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
            const found = findNodeInTree(child, id);
            if (found) return found;
        }
    }
    return null;
}

// Hubungkan Listener Input Form secara real-time
document.addEventListener('DOMContentLoaded', () => {
    const inputName = document.getElementById('node-name');
    const inputText = document.getElementById('node-text');
    const inputMedia = document.getElementById('node-media');
    
    if (inputName) {
        inputName.addEventListener('input', (e) => {
            if (!selectedGroupId || !selectedNodeId) return;
            const node = findNodeInTree(selectedGroupConfig.menuTree, selectedNodeId);
            if (node) {
                node.name = e.target.value;
                renderMenuTreeVisual();
            }
        });
    }
    
    if (inputText) {
        inputText.addEventListener('input', (e) => {
            if (!selectedGroupId || !selectedNodeId) return;
            const node = findNodeInTree(selectedGroupConfig.menuTree, selectedNodeId);
            if (node) {
                node.text = e.target.value;
            }
        });
    }
    
    if (inputMedia) {
        inputMedia.addEventListener('input', (e) => {
            if (!selectedGroupId || !selectedNodeId) return;
            const node = findNodeInTree(selectedGroupConfig.menuTree, selectedNodeId);
            if (node && node.type === 'content') {
                node.media = e.target.value;
            }
        });
    }
    
    const inputStatus = document.getElementById('node-status');
    if (inputStatus) {
        inputStatus.addEventListener('change', (e) => {
            if (!selectedGroupId || !selectedNodeId) return;
            const node = findNodeInTree(selectedGroupConfig.menuTree, selectedNodeId);
            if (node && node.type === 'content') {
                node.status = e.target.value;
                renderMenuTreeVisual();
            }
        });
    }
});

// Tambah Node Anak ke kategori aktif
window.addChildNode = function() {
    if (!selectedGroupId || !selectedNodeId) return;
    const node = findNodeInTree(selectedGroupConfig.menuTree, selectedNodeId);
    if (!node || node.type !== 'category') return;
    
    const newId = Date.now().toString();
    const newNode = {
        id: newId,
        name: "Menu Baru",
        type: "content",
        text: "Isi balasan teks...",
        media: ""
    };
    
    node.children = node.children || [];
    node.children.push(newNode);
    
    renderMenuTreeVisual();
    selectTreeNode(newId); // Select node baru agar bisa diedit
};

// Hapus Node
window.deleteNode = function() {
    if (!selectedGroupId || !selectedNodeId) return;
    
    if (selectedNodeId === 'root') {
        alert('Node Utama (Root) tidak boleh dihapus!');
        return;
    }
    
    if (!confirm('Apakah Anda yakin ingin menghapus menu ini beserta seluruh sub-menunya?')) return;
    
    const removed = removeNodeFromTree(selectedGroupConfig.menuTree, selectedNodeId);
    if (removed) {
        resetNodeEditorForm();
        renderMenuTreeVisual();
    }
};

// Helper rekursif: Hapus node dari pohon
function removeNodeFromTree(parentNode, targetId) {
    if (parentNode.children && Array.isArray(parentNode.children)) {
        for (let i = 0; i < parentNode.children.length; i++) {
            if (parentNode.children[i].id === targetId) {
                parentNode.children.splice(i, 1);
                return true;
            }
            const found = removeNodeFromTree(parentNode.children[i], targetId);
            if (found) return true;
        }
    }
    return false;
}

// Simpan Konfigurasi Grup & Menu Tree ke Server
window.saveGroupConfiguration = async function() {
    if (!selectedGroupId || !selectedGroupConfig) return;
    
    const enabled = document.getElementById('grp-enabled').checked;
    const useAiFallback = document.getElementById('grp-ai-fallback').checked;
    const triggerPrefix = document.getElementById('grp-trigger').value.trim();
    const categoryFooter = document.getElementById('grp-category-footer').value.trim();
    const contentFooter = document.getElementById('grp-content-footer').value.trim();
    
    const categoryEmoji = document.getElementById('grp-category-emoji').value.trim() || '📁';
    const contentEmoji = document.getElementById('grp-content-emoji').value.trim() || '📄';
    const enableNumberNavigation = document.getElementById('grp-number-nav-enable').checked;
    const universalHeader = document.getElementById('grp-universal-header').value.trim();
    const universalFooter = document.getElementById('grp-universal-footer').value.trim();
    
    // Auto Close Schedule
    const activeDays = [];
    document.querySelectorAll('.grp-active-day-cb:checked').forEach(cb => {
        activeDays.push(parseInt(cb.value, 10));
    });
    const autoCloseSchedule = {
        enabled: document.getElementById('grp-auto-close-enable').checked,
        openTime: document.getElementById('grp-open-time').value,
        closeTime: document.getElementById('grp-close-time').value,
        activeDays
    };
    
    // Extra Triggers
    const extraTriggers = [];
    document.querySelectorAll('.extra-trigger-row').forEach(row => {
        const keyword = row.querySelector('.grp-et-keyword').value.trim();
        const reply = row.querySelector('.grp-et-reply').value.trim();
        if (keyword && reply) {
            extraTriggers.push({ keyword, reply });
        }
    });

    // Ambil file referensi tercentang
    const allowedKnowledgeFiles = [];
    document.querySelectorAll('.grp-kb-checkbox:checked').forEach(cb => {
        allowedKnowledgeFiles.push(cb.value);
    });
    
    const payload = {
        groupName: selectedGroupConfig.groupName,
        enabled,
        useAiFallback,
        triggerPrefix,
        categoryFooter,
        contentFooter,
        allowedKnowledgeFiles,
        menuTree: selectedGroupConfig.menuTree,
        categoryEmoji,
        contentEmoji,
        enableNumberNavigation,
        universalHeader,
        universalFooter,
        autoCloseSchedule,
        extraTriggers
    };
    
    try {
        const res = await fetch(`/api/group-config/${selectedGroupId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            alert('Konfigurasi grup berhasil disimpan!');
            loadGroupsList(); // Refresh keaktifan status di sidebar
        } else {
            const txt = await res.text();
            alert('Gagal menyimpan konfigurasi: ' + txt);
        }
    } catch (err) {
        console.error('Error saveGroupConfiguration:', err);
        alert('Terjadi kesalahan koneksi saat menyimpan.');
    }
};

// ══════════════════════════════════════════
// LOGIKA DUPLIKASI (CLONING) KONFIGURASI
// ══════════════════════════════════════════

// Perbarui dropdown modal salin konfig
function updateCloneSourceDropdown() {
    const select = document.getElementById('clone-source-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Pilih Grup Sumber --</option>';
    activeGroups.forEach(g => {
        if (g.id !== selectedGroupId) {
            const option = document.createElement('option');
            option.value = g.id;
            option.textContent = g.name;
            select.appendChild(option);
        }
    });
}

// Buka Modal
window.showCloneConfigModal = function() {
    updateCloneSourceDropdown();
    document.getElementById('clone-config-modal').classList.remove('hidden');
    lucide.createIcons();
};

// Tutup Modal
window.closeCloneConfigModal = function() {
    document.getElementById('clone-config-modal').classList.add('hidden');
};

// Terapkan Duplikasi
window.applyCloneConfig = async function() {
    const sourceId = document.getElementById('clone-source-select').value;
    if (!sourceId) {
        alert('Pilih grup sumber terlebih dahulu!');
        return;
    }
    
    if (!confirm('Apakah Anda yakin ingin menimpa seluruh konfigurasi dan menu grup ini dengan data dari grup terpilih? Perubahan saat ini yang belum disimpan akan hilang.')) return;
    
    try {
        const res = await fetch(`/api/group-config/${sourceId}`);
        if (!res.ok) throw new Error('Gagal mengambil data grup sumber');
        
        const sourceConfig = await res.json();
        
        selectedGroupConfig.useAiFallback = sourceConfig.useAiFallback;
        selectedGroupConfig.triggerPrefix = sourceConfig.triggerPrefix;
        selectedGroupConfig.categoryFooter = sourceConfig.categoryFooter || '';
        selectedGroupConfig.contentFooter = sourceConfig.contentFooter || '';
        selectedGroupConfig.allowedKnowledgeFiles = JSON.parse(JSON.stringify(sourceConfig.allowedKnowledgeFiles || []));
        selectedGroupConfig.menuTree = JSON.parse(JSON.stringify(sourceConfig.menuTree));
        
        // Perbarui UI form
        document.getElementById('grp-ai-fallback').checked = selectedGroupConfig.useAiFallback;
        document.getElementById('grp-trigger').value = selectedGroupConfig.triggerPrefix || '';
        document.getElementById('grp-category-footer').value = selectedGroupConfig.categoryFooter || '';
        document.getElementById('grp-content-footer').value = selectedGroupConfig.contentFooter || '';
        
        // Perbarui checkboxes
        document.querySelectorAll('.grp-kb-checkbox').forEach(cb => {
            cb.checked = selectedGroupConfig.allowedKnowledgeFiles.includes(cb.value);
        });
        
        // Re-render visual tree
        renderMenuTreeVisual();
        resetNodeEditorForm();
        
        // Tutup modal
        closeCloneConfigModal();
        alert('Konfigurasi berhasil disalin! Silakan klik "Simpan Menu" untuk menerapkan secara permanen.');
    } catch (err) {
        console.error('Error applyCloneConfig:', err);
        alert('Gagal menyalin konfigurasi: ' + err.message);
    }
};

// ══════════════════════════════════════════
// TOKO / SHOP MANAGER HELPER FUNCTIONS
// ══════════════════════════════════════════

window.toggleScheduleFields = function() {
    const isEnabled = document.getElementById('grp-auto-close-enable').checked;
    const fields = document.getElementById('grp-schedule-fields');
    if (fields) {
        if (isEnabled) {
            fields.classList.remove('hidden');
        } else {
            fields.classList.add('hidden');
        }
    }
};

window.renderExtraTriggersList = function(triggers = []) {
    const list = document.getElementById('grp-extra-triggers-list');
    if (!list) return;
    list.innerHTML = '';
    
    triggers.forEach((t, idx) => {
        const row = document.createElement('div');
        row.style = 'display: flex; flex-direction: column; gap: 4px; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; background: var(--bg-primary); margin-bottom: 6px;';
        row.className = 'extra-trigger-row';
        
        row.innerHTML = `
            <div style="display: flex; gap: 6px;">
                <input type="text" placeholder="Kata Kunci" class="form-control grp-et-keyword" value="${t.keyword || ''}" style="flex: 1; padding: 4px 8px; font-size: 0.8rem; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color);">
                <button type="button" class="btn btn-secondary btn-icon" onclick="deleteExtraTriggerRow(this)" style="padding: 4px; color: #ff453a; border-color: rgba(255,69,58,0.2); background: transparent;">
                    <i data-lucide="trash" style="width: 12px; height: 12px;"></i>
                </button>
            </div>
            <textarea placeholder="Respon Teks Balasan" class="form-control grp-et-reply" rows="2" style="width: 100%; padding: 4px 8px; font-size: 0.8rem; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); resize: vertical;">${t.reply || ''}</textarea>
        `;
        list.appendChild(row);
    });
    
    if (window.lucide) lucide.createIcons();
};

window.addExtraTriggerRow = function() {
    const list = document.getElementById('grp-extra-triggers-list');
    if (!list) return;
    
    const row = document.createElement('div');
    row.style = 'display: flex; flex-direction: column; gap: 4px; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px; background: var(--bg-primary); margin-bottom: 6px;';
    row.className = 'extra-trigger-row';
    
    row.innerHTML = `
        <div style="display: flex; gap: 6px;">
            <input type="text" placeholder="Kata Kunci" class="form-control grp-et-keyword" style="flex: 1; padding: 4px 8px; font-size: 0.8rem; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color);">
            <button type="button" class="btn btn-secondary btn-icon" onclick="deleteExtraTriggerRow(this)" style="padding: 4px; color: #ff453a; border-color: rgba(255,69,58,0.2); background: transparent;">
                <i data-lucide="trash" style="width: 12px; height: 12px;"></i>
            </button>
        </div>
        <textarea placeholder="Respon Teks Balasan" class="form-control grp-et-reply" rows="2" style="width: 100%; padding: 4px 8px; font-size: 0.8rem; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); resize: vertical;"></textarea>
    `;
    list.appendChild(row);
    
    if (window.lucide) lucide.createIcons();
};

window.deleteExtraTriggerRow = function(btn) {
    const row = btn.closest('.extra-trigger-row');
    if (row) row.remove();
};

// Host Admin
let activeHostAdmins = [];

window.loadHostAdmins = async function() {
    try {
        const res = await fetch('/api/shop/admins');
        if (!res.ok) throw new Error('Gagal memuat Host Admin');
        activeHostAdmins = await res.json();
        
        const list = document.getElementById('shop-admins-list');
        if (!list) return;
        list.innerHTML = '';
        
        if (activeHostAdmins.length === 0) {
            list.innerHTML = `<p style="text-align: center; color: var(--text-secondary); font-size: 0.8rem; margin-top: 30px;">Belum ada Host Admin...</p>`;
            return;
        }
        
        activeHostAdmins.forEach(admin => {
            const cleanAdmin = admin.replace(/\D/g, '');
            const row = document.createElement('div');
            row.style = 'display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: var(--bg-secondary); margin-bottom: 6px;';
            row.innerHTML = `
                <span style="font-weight: 500; font-size: 0.85rem;"><i data-lucide="shield" style="width: 14px; height: 14px; display: inline-block; vertical-align: middle; margin-right: 4px; color: #30d158;"></i> ${cleanAdmin}</span>
                <button class="btn btn-secondary btn-icon" onclick="deleteHostAdmin('${admin}')" style="padding: 4px; color: #ff453a; border-color: rgba(255,69,58,0.2); background: transparent;">
                    <i data-lucide="trash" style="width: 12px; height: 12px;"></i>
                </button>
            `;
            list.appendChild(row);
        });
        
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error('Error loadHostAdmins:', err);
    }
};

window.addHostAdmin = async function() {
    const input = document.getElementById('shop-admin-input');
    const val = input.value.trim().replace(/\D/g, '');
    if (!val || val.length < 9) {
        alert('Format nomor tidak valid! Masukkan angka saja, contoh: 628123456789');
        return;
    }
    
    const formatted = val + '@c.us';
    if (activeHostAdmins.includes(formatted)) {
        alert('Nomor ini sudah terdaftar sebagai Host Admin!');
        return;
    }
    
    activeHostAdmins.push(formatted);
    
    try {
        const res = await fetch('/api/shop/admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host_admins: activeHostAdmins })
        });
        
        if (res.ok) {
            input.value = '';
            loadHostAdmins();
        } else {
            throw new Error(await res.text());
        }
    } catch (err) {
        alert('Gagal menambah Host Admin: ' + err.message);
    }
};

window.deleteHostAdmin = async function(admin) {
    if (!confirm('Apakah Anda yakin ingin menghapus nomor ini dari Host Admin?')) return;
    
    activeHostAdmins = activeHostAdmins.filter(a => a !== admin);
    
    try {
        const res = await fetch('/api/shop/admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host_admins: activeHostAdmins })
        });
        
        if (res.ok) {
            loadHostAdmins();
        } else {
            throw new Error(await res.text());
        }
    } catch (err) {
        alert('Gagal menghapus Host Admin: ' + err.message);
    }
};

// Customers
let activeCustomers = [];

window.loadCustomersList = async function() {
    try {
        const res = await fetch('/api/shop/customers');
        if (!res.ok) throw new Error('Gagal memuat pelanggan');
        activeCustomers = await res.json();
        
        const list = document.getElementById('shop-customers-list');
        if (!list) return;
        list.innerHTML = '';
        
        if (activeCustomers.length === 0) {
            list.innerHTML = `<p style="text-align: center; color: var(--text-secondary); font-size: 0.9rem; margin-top: 50px;">Belum ada pelanggan terdeteksi.</p>`;
            return;
        }
        
        activeCustomers.forEach((cust, idx) => {
            const card = document.createElement('div');
            card.style = 'border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: var(--bg-secondary); margin-bottom: 10px;';
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <input type="text" id="cust-name-${idx}" value="${cust.name}" style="font-weight: bold; font-size: 0.95rem; border: none; background: transparent; color: var(--text-primary); border-bottom: 1px dashed var(--border-color); padding: 2px;">
                        <a href="https://wa.me/${cust.phone}" target="_blank" style="font-size: 0.75rem; color: #30d158; text-decoration: none;">wa.me/${cust.phone}</a>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-secondary" onclick="viewCustomerChatLogs('${cust.phone}')" style="font-size: 0.75rem; padding: 4px 8px; display: flex; align-items: center; gap: 4px;">
                            <i data-lucide="message-square" style="width: 12px; height: 12px;"></i> Lihat Chat
                        </button>
                        <button class="btn btn-primary" onclick="saveCustomerInfo(${idx})" style="font-size: 0.75rem; padding: 4px 8px;">Simpan</button>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <div style="flex: 1;">
                        <label style="font-size: 0.7rem; color: var(--text-secondary);">Catatan / Alamat / Detail Pesanan</label>
                        <input type="text" id="cust-notes-${idx}" value="${cust.notes || ''}" placeholder="Tulis catatan di sini..." class="form-control" style="width: 100%; padding: 4px 8px; font-size: 0.8rem; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                    </div>
                    <div style="width: 100px;">
                        <label style="font-size: 0.7rem; color: var(--text-secondary);">Jumlah Order</label>
                        <input type="number" id="cust-order-${idx}" value="${cust.orderCount || 0}" class="form-control" style="width: 100%; padding: 4px 8px; font-size: 0.8rem; text-align: center; background: var(--bg-primary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 6px;">
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
        
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error('Error loadCustomersList:', err);
    }
};

window.saveCustomerInfo = async function(idx) {
    const cust = activeCustomers[idx];
    if (!cust) return;
    
    const newName = document.getElementById(`cust-name-${idx}`).value.trim();
    const newNotes = document.getElementById(`cust-notes-${idx}`).value.trim();
    const newOrderCount = parseInt(document.getElementById(`cust-order-${idx}`).value, 10) || 0;
    
    cust.name = newName;
    cust.notes = newNotes;
    cust.orderCount = newOrderCount;
    
    try {
        const res = await fetch('/api/shop/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customers: activeCustomers })
        });
        
        if (res.ok) {
            alert('Data pelanggan berhasil disimpan!');
            loadCustomersList();
        } else {
            throw new Error(await res.text());
        }
    } catch (err) {
        alert('Gagal menyimpan data pelanggan: ' + err.message);
    }
};

// Isolated Chat Modal
window.viewCustomerChatLogs = async function(phone) {
    const contactId = phone.includes('@') ? phone : `${phone}@c.us`;
    const cleanId = contactId.split('@')[0];
    
    document.getElementById('shop-chat-modal-title').innerHTML = `<i data-lucide="message-square" style="width: 16px; height: 16px; display: inline-block; vertical-align: middle; margin-right: 6px;"></i> Chat: wa.me/${cleanId}`;
    if (window.lucide) lucide.createIcons();
    
    const container = document.getElementById('shop-chat-messages-container');
    container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); font-size:0.85rem; margin-top:50px;">Memuat riwayat chat...</p>';
    
    document.getElementById('shop-chat-modal').classList.remove('hidden');
    
    try {
        const res = await fetch(`/api/shop/logs/${contactId}`);
        if (!res.ok) throw new Error('Gagal mengambil riwayat chat');
        
        const logs = await res.json();
        container.innerHTML = '';
        
        if (logs.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); font-size:0.85rem; margin-top:50px;">Belum ada riwayat chat dengan nomor ini.</p>';
            return;
        }
        
        logs.forEach(msg => {
            const isBot = msg.role === 'model' || msg.role === 'assistant';
            const bubble = document.createElement('div');
            bubble.style = `
                max-width: 80%;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 0.85rem;
                line-height: 1.4;
                margin-bottom: 8px;
                word-wrap: break-word;
                ${isBot 
                    ? 'align-self: flex-end; background: #34c759; color: #fff; border-bottom-right-radius: 2px;' 
                    : 'align-self: flex-start; background: var(--bg-primary); color: var(--text-primary); border-bottom-left-radius: 2px; border: 1px solid var(--border-color);'
                }
            `;
            bubble.innerHTML = msg.content ? msg.content.replace(/\n/g, '<br>') : '';
            container.appendChild(bubble);
        });
        
        container.scrollTop = container.scrollHeight;
    } catch (err) {
        container.innerHTML = `<p style="text-align:center; color:#ff453a; font-size:0.85rem; margin-top:50px;">Gagal memuat log: ${err.message}</p>`;
    }
};

window.closeShopChatModal = function() {
    document.getElementById('shop-chat-modal').classList.add('hidden');
};

// Broadcast
window.sendBroadcast = async function() {
    const msgInput = document.getElementById('broadcast-msg');
    const mediaInput = document.getElementById('broadcast-media');
    
    const message = msgInput.value.trim();
    const media = mediaInput.value.trim();
    
    if (!message) {
        alert('Tulis pesan broadcast terlebih dahulu!');
        return;
    }
    
    if (!confirm('Apakah Anda yakin ingin mengirim pesan siaran ini ke SELURUH grup WhatsApp aktif?')) return;
    
    try {
        const res = await fetch('/api/shop/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, media })
        });
        
        if (res.ok) {
            const result = await res.json();
            alert(`Siaran massal berhasil dikirim ke ${result.count} dari total ${result.total} grup aktif!`);
            msgInput.value = '';
            mediaInput.value = '';
        } else {
            throw new Error(await res.text());
        }
    } catch (err) {
        alert('Gagal mengirim siaran massal: ' + err.message);
    }
};
