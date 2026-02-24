const fs = require('fs');
const content = fs.readFileSync('mathura_2026-02-23.csv', 'utf8');
const lines = content.split(/\r?\n/).filter(l => l.trim());
const mapping = {};
lines.slice(1).forEach(l => {
    const parts = l.split(',');
    if (parts.length >= 2) {
        const ward = parts[0].trim();
        const id = parts[1].trim();
        if (id) mapping[id] = { ward: ward, name: id };
    }
});

let out = 'const ROUTE_WARD_MAPPING: Record<string, { ward: string; name: string }> = {\n';
Object.keys(mapping).sort().forEach((id) => {
    const val = mapping[id];
    out += `    "${id}": { "ward": "${val.ward}", "name": "${val.name}" },\n`;
});
out += '};';
fs.writeFileSync('complete_mapping.txt', out, 'utf8');
