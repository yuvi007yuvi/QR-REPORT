
const XLSX = require('xlsx');
const path = require('path');

const filePath = 'd:\\DEVELOPMENT REPORTS\\QR-REPORT\\qr-report-app\\src\\data\\qr-codes-mathura.csv.xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const json = XLSX.utils.sheet_to_json(worksheet);

console.log('Columns:', Object.keys(json[0] || {}));
console.log('Sample Row:', json[0]);
console.log('Total Rows:', json.length);
