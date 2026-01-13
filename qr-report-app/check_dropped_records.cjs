const fs = require('fs');

try {
    const masterContent = fs.readFileSync('src/data/master-supervisors.ts', 'utf8');
    const csvContent = fs.readFileSync('src/components/customers (18).csv', 'utf8');

    // 1. Parse Master Supervisors
    const supervisorWards = {}; // EmpID -> Set<WardNum>

    // Regex to capture { ... empId: "...", ... ward: "..." } blocks is hard.
    // simpler: valid single lines or just scan text.
    // The file structure is consistent: { sNo: "...", empId: "...", ... ward: "...", ... }

    // Split by lines and parse object-like strings
    const masterLines = masterContent.split('\n');
    masterLines.forEach(line => {
        const empIdMatch = line.match(/empId:\s*"([^"]+)"/);
        const wardMatch = line.match(/ward:\s*"([^"]+)"/);

        if (empIdMatch) {
            const empId = empIdMatch[1].trim();
            const wardStr = wardMatch ? wardMatch[1] : "";

            // Parse wards: "1,2,3" -> ["1", "2", "3"]
            // "N/A" -> []
            let wards = [];
            if (wardStr && wardStr !== 'N/A' && wardStr !== 'NA') {
                wards = wardStr.split(',').map(w => w.trim());
            }

            supervisorWards[empId] = new Set(wards);
        }
    });

    console.log(`Loaded ${Object.keys(supervisorWards).length} supervisors from master.`);

    // 2. Parse CSV
    const csvLines = csvContent.trim().split(/\r?\n/).slice(1);

    let total = 0;
    let matchedId = 0;
    let droppedWard = 0;
    let droppedId = 0;
    let accepted = 0;

    csvLines.forEach(line => {
        if (!line.trim()) return;
        total++;
        const parts = line.match(/"([^"]*)"/g);
        if (!parts || parts.length < 24) return; // Ensure enough cols

        // CSV Structure from previous view_file:
        // Index 23: "Supervisor ID" ("MVSID...")
        // Index 13: "Ward Name" ("49-Daimpiriyal Nagar")

        const supId = parts[23].replace(/"/g, '').trim();
        const wardRaw = parts[13].replace(/"/g, '').trim();

        // Parse Ward Number: "49-Daimpiriyal Nagar" -> "49"
        const wardNum = wardRaw.split('-')[0].trim().replace(/^0+/, '');

        if (supervisorWards[supId]) {
            matchedId++;
            const allowedWards = supervisorWards[supId];

            if (allowedWards.size > 0 && !allowedWards.has(wardNum)) {
                droppedWard++;
                // console.log(`Dropped: ID ${supId} worked in Ward ${wardNum} (Allowed: ${Array.from(allowedWards)})`);
            } else {
                accepted++;
            }
        } else {
            droppedId++;
            // console.log(`Unknown Supervisor ID: ${supId}`);
        }
    });

    console.log('Total Records:', total);
    console.log('Unknown Supervisor ID:', droppedId);
    console.log('Known Supervisor ID:', matchedId);
    console.log('  -> Rejected (Ward Mismatch):', droppedWard);
    console.log('  -> Accepted:', accepted);

} catch (e) {
    console.error(e);
}
