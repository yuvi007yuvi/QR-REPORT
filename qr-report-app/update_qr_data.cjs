const fs = require('fs');
const path = require('path');

const csvPath = 'd:\\DEVELOPMENT REPORTS\\QR-REPORT\\qr-report-app\\QrData (4).csv';
const jsonPath = 'd:\\DEVELOPMENT REPORTS\\QR-REPORT\\qr-report-app\\src\\data\\masterData.json';

// 1. Read existing JSON to preserve Date/Time metadata
const existingJsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const existingMap = new Map();
existingJsonData.forEach(item => {
    existingMap.set(item['QR Code ID'], {
        Date: item.Date,
        Time: item.Time
    });
});

// 2. Read and parse CSV
const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
const headers = lines[0].split(',').map(h => h.trim());

const newMasterData = [];

function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
        } else {
            cur += char;
        }
    }
    result.push(cur.trim());
    return result.map(v => v.replace(/^"|"$/g, '').trim());
}

for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const matches = parseCSVLine(line);
    const csvRecord = {};
    headers.forEach((header, index) => {
        let value = matches[index] || '';
        value = value.replace(/^"|"$/g, '').trim();
        csvRecord[header] = value;
    });

    const qrId = csvRecord['QR Code ID'];
    if (!qrId) continue;

    const existingMeta = existingMap.get(qrId) || {};

    const newRecord = {
        "S.No.": newMasterData.length + 1,
        "QR Code ID": qrId,
        "Site Name": csvRecord['Site Name'],
        "Zone & Circle": Number(csvRecord['Zone & Circle']) || csvRecord['Zone & Circle'],
        "Ward": csvRecord['Ward'],
        "Building/Street": csvRecord['Building/Street'],
        "Type": csvRecord['Type'],
        "Latitude": Number(csvRecord['Latitude']) || csvRecord['Latitude'],
        "Longitude": Number(csvRecord['Longitude']) || csvRecord['Longitude'],
        "Date": existingMeta.Date || "",
        "Time": existingMeta.Time || ""
    };

    newMasterData.push(newRecord);
}

// 3. Write new JSON
fs.writeFileSync(jsonPath, JSON.stringify(newMasterData, null, 2), 'utf8');

console.log(`Update Complete!`);
console.log(`Original records: ${existingJsonData.length}`);
console.log(`New records: ${newMasterData.length}`);
console.log(`Removed records: ${existingJsonData.length - newMasterData.length + (newMasterData.length - new Set(newMasterData.map(r=>r['QR Code ID'])).size)}`);
