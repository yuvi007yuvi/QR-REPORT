import * as fs from 'fs';
import * as XLSX from 'xlsx';
import * as path from 'path';

const csvPath = path.resolve(__dirname, '../WARD MAPING.csv');
const jsonPath = path.resolve(__dirname, 'src/data/supervisorData.json');

try {
    console.log(`Reading CSV from: ${csvPath}`);
    const workbook = XLSX.readFile(csvPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Writing JSON to: ${jsonPath}`);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
    console.log('Conversion successful!');
    console.log(`Total records: ${jsonData.length}`);
} catch (error) {
    console.error('Error converting CSV:', error);
}
