const fs = require('fs');
const content = fs.readFileSync('mathura_2026-02-23.csv', 'utf8');
const lines = content.split(/\r?\n/).filter(l => l.trim());
const wards = {};
lines.slice(1).forEach(l => {
    const parts = l.split(',');
    if (parts.length >= 1) {
        const wardName = parts[0].trim();
        const match = wardName.match(/^(\d+)/);
        if (match) {
            wards[parseInt(match[1])] = wardName;
        }
    }
});

let out = 'const WARD_NAMES: Record<string, string> = {\n';
Object.keys(wards).sort((a, b) => a - b).forEach(num => {
    out += `    "${num}": "${wards[num]}",\n`;
});
out += '};';
process.stdout.write(out);
