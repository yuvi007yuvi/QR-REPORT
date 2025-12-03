import pkg from 'xlsx';
import * as fs from 'fs';
import path from 'path';

const { read, utils } = pkg;

const inputFile = './Total qr .csv';
const outputFile = './src/data/masterData.json';

try {
    const filePath = path.resolve(process.cwd(), inputFile);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    const buffer = fs.readFileSync(filePath);
    const workbook = read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const json = utils.sheet_to_json(worksheet);

    // Ensure directory exists
    const dir = path.dirname(outputFile);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputFile, JSON.stringify(json, null, 2));
    console.log(`Successfully converted ${inputFile} to ${outputFile}`);
} catch (e) {
    console.error(`Error converting file:`, e.message);
    console.error(e.stack);
}
