const fs = require('fs');

try {
    const content = fs.readFileSync('src/components/customers (18).csv', 'utf8');
    const lines = content.trim().split(/\r?\n/).slice(1);
    const ids = new Set();
    let duplicateCount = 0;

    lines.forEach(line => {
        if (!line.trim()) return;
        // Basic CSV parsing for quoted fields
        const matches = line.match(/"([^"]*)"/g);
        if (matches && matches.length > 1) {
            const id = matches[1].replace(/"/g, ''); // Customer ID is index 1
            if (ids.has(id)) {
                duplicateCount++;
            } else {
                ids.add(id);
            }
        }
    });

    console.log('Unique IDs:', ids.size);
    console.log('Duplicates:', duplicateCount);
} catch (e) {
    console.error(e);
}
