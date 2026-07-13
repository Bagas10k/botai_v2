const Tesseract = require('tesseract.js');

async function performOCR(imageBuffer) {
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');
    return text;
}

function isReceiptText(text) {
    const txt = text.toLowerCase();
    
    // Keywords commonly found in receipts
    const receiptKeywords = [
        'total', 'jumlah', 'subtotal', 'grand total', 'netto', 'ppn', 'tax', 'ongkir', 
        'cashier', 'kasir', 'struk', 'nota', 'kuitansi', 'receipt', 'invoice', 'bill',
        'tunai', 'kembalian', 'kembali', 'bayar', 'debit', 'credit', 'payment',
        'harga', 'pcs', 'qty', 'item', 'disc', 'diskon', 'belanja', 'pembelian'
    ];
    
    let matchCount = 0;
    receiptKeywords.forEach(kw => {
        if (txt.includes(kw)) {
            matchCount++;
        }
    });
    
    const hasNominalPattern = /rp\.?\s*\d+[\d.,]*/i.test(txt) || 
                              /\b\d{1,3}([.,]\d{3})+\b/.test(txt) || 
                              /\b\d+\s*(rb|k|jt)\b/i.test(txt);
    
    return (matchCount >= 2) || (matchCount >= 1 && hasNominalPattern);
}

function parseNominal(text) {
    if (!text) return 0;
    
    let cleaned = text.toLowerCase().replace(/[\s\r\n]+/g, '').trim();
    
    let multiplier = 1;
    if (cleaned.endsWith('rb') || cleaned.endsWith('k')) {
        multiplier = 1000;
        cleaned = cleaned.replace(/rb|k/g, '');
    } else if (cleaned.endsWith('jt')) {
        multiplier = 1000000;
        cleaned = cleaned.replace(/jt/g, '');
    }
    
    cleaned = cleaned.replace(/,/g, '.');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
        cleaned = parts.join('');
    } else if (parts.length === 2) {
        if (multiplier === 1 && parts[1].length === 3) {
            cleaned = parts.join('');
        } else {
            cleaned = parseFloat(cleaned);
        }
    }
    
    let num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    
    return Math.round(num * multiplier);
}

function localParseFinanceMessage(text) {
    const msg = text.toLowerCase().trim();
    
    const moneyRegex = /\b\d+([.,]\d+)?\s*(rb|k|jt|juta|ribu)?\b/gi;
    const matches = msg.match(moneyRegex);
    if (!matches) return null;
    
    let nominalStr = '';
    let nominalVal = 0;
    
    for (const match of matches) {
        const val = parseNominal(match);
        if (val > 100) {
            nominalStr = match;
            nominalVal = val;
            break;
        }
    }
    
    if (nominalVal <= 0) return null;
    
    const incomeKeywords = ['masuk', 'pemasukan', 'gaji', 'terima', 'dapat', 'income', 'ditambahkan', 'transfer masuk'];
    const expenseKeywords = ['keluar', 'pengeluaran', 'beli', 'bayar', 'belanja', 'biaya', 'ongkos', 'parkir', 'makan', 'minum', 'toll', 'listrik', 'pulsa'];
    
    let isIncome = false;
    let isExpense = false;
    
    incomeKeywords.forEach(kw => {
        if (msg.includes(kw)) isIncome = true;
    });
    expenseKeywords.forEach(kw => {
        if (msg.includes(kw)) isExpense = true;
    });
    
    let type = 'Pengeluaran';
    if (isIncome && !isExpense) {
        type = 'Pemasukan';
    } else if (isExpense) {
        type = 'Pengeluaran';
    } else {
        return null;
    }
    
    let keterangan = text;
    const escNominal = nominalStr.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    keterangan = keterangan.replace(new RegExp(escNominal, 'gi'), '');
    
    const allKeywords = [...incomeKeywords, ...expenseKeywords, 'catat', 'pencatatan', 'uang'];
    allKeywords.forEach(kw => {
        keterangan = keterangan.replace(new RegExp('\\b' + kw + '\\b', 'gi'), '');
    });
    
    keterangan = keterangan.replace(/[\s\-,;]+/g, ' ').trim();
    
    if (!keterangan) {
        keterangan = type === 'Pemasukan' ? 'Pemasukan Tunai' : 'Pengeluaran Harian';
    }
    
    return {
        intent: 'finance',
        type: type,
        nominal: nominalVal,
        keterangan: keterangan
    };
}

function parseShortcutMessage(userMessage) {
    const msg = userMessage.toLowerCase().trim();
    const prefixMatch = msg.match(/^(\+|-|masuk|keluar)\s*(.+)$/i);
    if (!prefixMatch) return null;

    const action = prefixMatch[1].toLowerCase();
    const rest = prefixMatch[2].trim();

    const nominalRegex = /^(\d+(?:[.,]\d+)?\s*(?:jt|juta|rb|ribu|k)?)\s+(.+)$/i;
    const match = rest.match(nominalRegex);
    if (!match) return null;

    const rawNominal = match[1];
    const keterangan = prefixMatch[2].substring(rawNominal.length).trim();

    const cleanedNominalStr = rawNominal.replace(/\s+/g, '');
    const nominalVal = parseNominal(cleanedNominalStr);

    const type = (action === '+' || action === 'masuk') ? 'Pemasukan' : 'Pengeluaran';

    return {
        type,
        nominal: nominalVal,
        keterangan: keterangan
    };
}

async function extractReceiptDetails(ocrText) {
    const txt = ocrText.toLowerCase();
    const totalRegex = /(?:total|jumlah|grand\s*total|netto|bayar|subtotal|jumlah\s*harga|total\s*bayar)[\s:="'.]*rp?\.?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+)/i;
    const match = txt.match(totalRegex);
    
    let nominal = 0;
    if (match) {
        let rawNum = match[1].replace(/[,.]/g, '');
        if (match[1].includes('.') && match[1].split('.').pop().length === 2) {
            rawNum = rawNum.slice(0, -2);
        } else if (match[1].includes(',') && match[1].split(',').pop().length === 2) {
            rawNum = rawNum.slice(0, -2);
        }
        nominal = parseInt(rawNum, 10) || 0;
    }
    
    if (nominal <= 0) {
        const numberRegex = /\b\d{1,3}(?:[.,]\d{3})+\b/g;
        let numbers = [];
        let numMatch;
        while ((numMatch = numberRegex.exec(txt)) !== null) {
            const val = parseInt(numMatch[0].replace(/[,.]/g, ''), 10);
            if (val > 100) numbers.push(val);
        }
        if (numbers.length > 0) {
            nominal = Math.max(...numbers);
        }
    }
    
    const lines = ocrText.split('\n').map(l => l.trim()).filter(l => l.length > 3);
    let merchant = 'Belanja Harian';
    if (lines.length > 0) {
        const firstLine = lines[0];
        if (!/\d{2}[\/-]\d{2}[\/-]\d{2,4}/.test(firstLine) && !/welcome|kasir|struk|nota/i.test(firstLine)) {
            merchant = firstLine.substring(0, 40);
        } else if (lines.length > 1) {
            merchant = lines[1].substring(0, 40);
        }
    }
    
    return {
        nominal,
        keterangan: `Struk: ${merchant}`
    };
}

module.exports = {
    performOCR,
    isReceiptText,
    parseNominal,
    localParseFinanceMessage,
    parseShortcutMessage,
    extractReceiptDetails
};
