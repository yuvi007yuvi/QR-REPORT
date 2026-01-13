const fs = require('fs');

try {
    const content = fs.readFileSync('src/components/customers (18).csv', 'utf8');
    const lines = content.trim().split(/\r?\n/).slice(1);
    const dates = {};

    lines.forEach(line => {
        if (!line.trim()) return;
        const parts = line.match(/"([^"]*)"/g);
        if (parts && parts.length > 16) {
            const date = parts[16].replace(/"/g, ''); // Index 16 is 'Created Date'
            dates[date] = (dates[date] || 0) + 1;
        }
    });

    console.log('Date Distribution:', JSON.stringify(dates, null, 2));
} catch (e) {
    console.error(e);
}
