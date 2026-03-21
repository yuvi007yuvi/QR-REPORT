const fs = require('fs');
const path = require('path');

const csvPath = 'd:\\DEVELOPMENT REPORTS\\QR-REPORT\\qr-report-app\\QrData (4).csv';
const jsonPath = 'd:\\DEVELOPMENT REPORTS\\QR-REPORT\\qr-report-app\\src\\data\\masterData.json';

const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const csvContent = fs.readFileSync(csvPath, 'utf8');

const csvRecords = [];
const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
const headers = lines[0].split(',').map(h => h.trim());

for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const row = {};
    // Regex to handle quoted CSV fields with commas
    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    headers.forEach((header, index) => {
        let value = matches[index] || '';
        value = value.replace(/^"|"$/g, '').trim();
        row[header] = value;
    });
    csvRecords.push(row);
}

const csvIds = new Set(csvRecords.map(r => r['QR Code ID']));
const jsonIds = new Set(jsonData.map(r => r['QR Code ID']));

console.log('Total JSON records:', jsonData.length);
console.log('Total CSV records:', csvRecords.length);

console.log('\nIDs in JSON but NOT in CSV:');
jsonData.forEach(r => {
    if (!csvIds.has(r['QR Code ID'])) {
        console.log(r['QR Code ID']);
    }
});

console.log('\nIDs in CSV but NOT in JSON:');
csvRecords.forEach(r => {
    if (!jsonIds.has(r['QR Code ID'])) {
        console.log(r['QR Code ID']);
    }
});
