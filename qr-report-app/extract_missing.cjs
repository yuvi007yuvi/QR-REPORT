const fs = require('fs');
const jsonPath = 'd:\\DEVELOPMENT REPORTS\\QR-REPORT\\qr-report-app\\src\\data\\masterData.json';
const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const missingIds = ['MVNNDB2', 'MVNNDB1', 'MVNNDG77', 'MVNNDG48', 'MVNNDG45', 'MVNNDG32', 'MVNNDS1'];

const results = jsonData.filter(r => missingIds.includes(r['QR Code ID']));
console.log(JSON.stringify(results, null, 2));
