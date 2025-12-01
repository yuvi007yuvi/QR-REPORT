import pkg from 'xlsx';
import * as fs from 'fs';
import path from 'path';

const { read, utils } = pkg;

const files = [
    '../WARD MAPING.xlsx'
];

files.forEach(file => {
    try {
        const filePath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            return;
        }
        const buffer = fs.readFileSync(filePath);
        const workbook = read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = utils.sheet_to_json(worksheet, { header: 1 });
        console.log(`File: ${file}`);
        console.log('Headers:', JSON.stringify(json[0]));
        if (json.length > 1) {
            console.log('First Row:', JSON.stringify(json[1]));
        }
    } catch (e) {
        console.error(`Error reading ${file}:`, e.message);
        console.error(e.stack);
    }
});
