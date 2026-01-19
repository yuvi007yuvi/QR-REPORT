const fs = require('fs');

try {
    const primary = JSON.parse(fs.readFileSync('debug_response.json', 'utf8'));
    const secondary = JSON.parse(fs.readFileSync('debug_response_secondary.json', 'utf8'));

    // Handle different formats if necessary (e.g. array vs {data: [...]})
    const pCount = Array.isArray(primary) ? primary.length : (primary.data ? primary.data.length : 0);
    const sCount = Array.isArray(secondary) ? secondary.length : (secondary.data ? secondary.data.length : 0);

    console.log(`Primary: ${pCount}`);
    console.log(`Secondary: ${sCount}`);
    console.log(`Total: ${pCount + sCount}`);
} catch (e) {
    console.error(e);
}
