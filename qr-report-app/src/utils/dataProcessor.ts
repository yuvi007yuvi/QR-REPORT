import * as XLSX from 'xlsx';

export interface ReportRecord {
    qrId: string;
    ward: string;
    zone: string;
    assignedTo: string;
    zonalHead: string;
    buildingName: string;
    siteName: string;
    type: string;
    status: 'Scanned' | 'Pending' | 'Unknown';
    scannedBy: string;
    scanTime: string;
    remarks: string;
    beforeScanStatus: 'Scanned' | 'Pending';
    afterScanStatus: 'Scanned' | 'Pending';
    beforeScanTime: string;
    afterScanTime: string;
    timeDifference: string;
}

export interface SummaryStats {
    total: number;
    scanned: number;
    pending: number;
    unknown: number;
    scannedPercentage: number;
    zoneStats: Record<string, { total: number; scanned: number; pending: number }>;
    zonalHeadStats: Record<string, { total: number; scanned: number; pending: number }>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const parseFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                resolve(json);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

export const processData = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    masterData: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supervisorData: any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    scannedData: any[],
    filterDate?: string
): { report: ReportRecord[]; stats: SummaryStats; availableDates: string[] } => {
    // 1. Create Supervisor & Zonal Head Map (Ward -> { Supervisor, ZonalHead })
    const wardMap = new Map<string, { supervisor: string; zonalHead: string }>();

    supervisorData.forEach((row) => {
        let ward = row['Ward No'] ? String(row['Ward No']).trim() : (row['WARD NO.'] ? String(row['WARD NO.']).trim() : '');
        // Normalize: remove leading zeros (e.g. "01" -> "1")
        ward = ward.replace(/^0+/, '');

        const supervisor = row['Supervisor'] || row['SUPERVISOR NAME'] || '';
        const zonalHead = row['Zonal Head'] || '';
        if (ward) wardMap.set(ward, { supervisor, zonalHead });
    });

    // 2. Create Master Map (QR ID -> Record)
    const masterMap = new Map<string, ReportRecord>();

    // Zone Mapping
    const zoneMapping: Record<string, string> = {
        '1': '1-City',
        '2': '2-Bhuteswar',
        '3': '3-Aurangabad',
        '4': '4-Vrindavan'
    };

    masterData.forEach((row) => {
        const qrId = row['QR Code ID'] ? String(row['QR Code ID']).trim() : '';
        if (!qrId) return;

        const wardRaw = row['Ward'] ? String(row['Ward']).trim() : '';
        let zone = row['Zone & Circle'] ? String(row['Zone & Circle']).trim() : '';

        // Apply Zone Mapping
        if (zoneMapping[zone]) {
            zone = zoneMapping[zone];
        }

        const buildingName = row['Building/Street'] || '';
        const siteName = row['Site Name'] || '';
        let type = row['Type'] || '';

        // Identify Underground Dustbins
        if (siteName.toUpperCase().includes('UNDERGROUND') || siteName.toUpperCase().includes('UNDER GROUND')) {
            type = 'Underground Dustbin';
        }

        // Extract Ward Number from "60-Jagannath Puri" -> "60"
        let wardNum = wardRaw.split('-')[0].trim();
        // Normalize: remove leading zeros
        wardNum = wardNum.replace(/^0+/, '');

        const mapping = wardMap.get(wardNum) || { supervisor: 'Unassigned', zonalHead: 'Unassigned' };
        const assignedTo = mapping.supervisor;
        const zonalHead = mapping.zonalHead;

        masterMap.set(qrId, {
            qrId,
            ward: wardRaw,
            zone,
            assignedTo,
            zonalHead,
            buildingName,
            siteName,
            type,
            status: 'Pending', // Default
            scannedBy: '-',
            scanTime: '-',
            remarks: '-',
            beforeScanStatus: 'Pending',
            afterScanStatus: 'Pending',
            beforeScanTime: '-',
            afterScanTime: '-',
            timeDifference: '-'
        });
    });

    const report: ReportRecord[] = [];
    const unknownQRs: ReportRecord[] = [];
    const availableDatesSet = new Set<string>();

    // Helper to convert Excel serial date to JS Date string
    const formatExcelDate = (serial: number | string): string => {
        if (!serial) return '-';
        if (typeof serial === 'string' && (serial.includes('/') || serial.includes('-'))) {
            return serial;
        }
        const num = Number(serial);
        if (!isNaN(num)) {
            const date = new Date(Math.round((num - 25569) * 86400 * 1000));
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
        return String(serial);
    };

    // Helper to convert Excel serial date to JS Time string (12-hour format)
    const formatExcelTime = (serial: number | string): string => {
        if (!serial) return '-';

        let hours: number;
        let minutes: number;

        if (typeof serial === 'string') {
            let timePart = serial.trim(); // Trim whitespace

            // Check if it's already in "HH:MM AM/PM" or "HH:MM" format
            // If it matches a time pattern directly, use it
            const timePattern = /^\d{1,2}:\d{2}(\s?[AP]M)?$/i;
            if (timePattern.test(timePart)) {
                // Ensure proper spacing for AM/PM if missing (e.g., "12:30PM" -> "12:30 PM")
                // normalize only if it has AM/PM
                if (timePart.toUpperCase().includes('M')) {
                    return timePart.replace(/([AP]M)/i, ' $1').replace(/\s+/g, ' ').trim();
                }
                return timePart;
            }

            // If it has a space, it might be "Date Time". Split and take the second part ONLY if the first part looks like a date
            if (serial.includes(' ')) {
                const parts = serial.split(' ');
                // Heuristic: If part[0] has numbers and slashes/dashes, it's likely a date.
                if (parts[0].match(/[\d/-]/)) {
                    timePart = parts[1] || parts[0]; // Fallback to full string if split fails strangely
                }
            }

            // If already has AM/PM after processing, return as is
            if (timePart && (timePart.toUpperCase().includes('AM') || timePart.toUpperCase().includes('PM'))) {
                return timePart;
            }

            if (!timePart || !timePart.includes(':')) return '-';

            const parts = timePart.split(':');
            hours = parseInt(parts[0], 10);
            minutes = parseInt(parts[1], 10);
        } else {
            const num = Number(serial);
            if (isNaN(num)) return '-';

            // Extract the fractional part (time)
            // Excel serial numbers are days. The fractional part is the time.
            const fractionalDay = num - Math.floor(num);

            // Convert to total seconds (1 day = 86400 seconds)
            // Add a small epsilon to handle floating point precision issues
            const totalSeconds = Math.round(fractionalDay * 86400);

            hours = Math.floor(totalSeconds / 3600);
            minutes = Math.floor((totalSeconds % 3600) / 60);
        }

        if (isNaN(hours) || isNaN(minutes)) return '-';

        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        const minutesStr = String(minutes).padStart(2, '0');

        return `${hours12}:${minutesStr} ${ampm}`;
    };

    const calculateTimeDifference = (start: string, end: string): string => {
        if (start === '-' || end === '-') return '-';

        const parseMinutes = (timeStr: string): number => {
            const [time, modifier] = timeStr.split(' ');
            const timeParts = time.split(':').map(Number);
            let hours = timeParts[0];
            const minutes = timeParts[1];

            if (hours === 12) {
                hours = 0;
            }
            if (modifier === 'PM') {
                hours += 12;
            }
            return hours * 60 + minutes;
        };

        const startMin = parseMinutes(start);
        const endMin = parseMinutes(end);

        let diff = endMin - startMin;
        if (diff < 0) {
            diff += 24 * 60; // Assume next day
        }

        const h = Math.floor(diff / 60);
        const m = diff % 60;

        if (h === 0) return `${m}m`;
        return `${h}h ${m}m`;
    };

    // Helper to find value from multiple possible keys
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getValue = (row: any, keys: string[]): string | undefined => {
        for (const key of keys) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                return String(row[key]);
            }
        }
        return undefined;
    };

    // 3. Process Scanned Data
    const qrKeys = ['QR Code ID', 'QR Code', 'QR ID', 'qr_code_id', 'Content', 'Data', 'Serial Number', 'Barcode'];
    const beforeScanKeys = ['Before Clean Time', 'Before Scan', 'Before Scan Time', 'BeforeScan', 'In Time', 'Start Time', 'Time In'];
    const afterScanKeys = ['After Clean Time', 'After Scan', 'After Scan Time', 'AfterScan', 'Out Time', 'End Time', 'Time Out'];
    const dateKeys = ['Date Of Scan', 'Date', 'Scan Date', 'Timestamp', 'Time'];
    const supervisorKeys = ['Supervisor Name', 'Scan ID', 'Scanner', 'User', 'Employee Name'];

    // Log the first row keys to help debugging
    if (scannedData.length > 0) {
        console.log('Detected Scanned Data Keys:', Object.keys(scannedData[0]));
    }

    scannedData.forEach((row) => {
        const qrId = getValue(row, qrKeys)?.trim() || '';
        if (!qrId) return;

        const rawDate = getValue(row, dateKeys);
        const scanTime = formatExcelDate(rawDate || '');

        if (scanTime !== '-') {
            availableDatesSet.add(scanTime);
        }

        // If filtering is active, skip if date doesn't match
        if (filterDate && filterDate !== 'All' && scanTime !== filterDate) {
            return;
        }

        const scannedBy = getValue(row, supervisorKeys) || 'Unknown';

        const beforeScanRaw = getValue(row, beforeScanKeys);
        const afterScanRaw = getValue(row, afterScanKeys);
        const beforeScanTime = formatExcelTime(beforeScanRaw || '');
        const afterScanTime = formatExcelTime(afterScanRaw || '');
        const beforeScanStatus = beforeScanTime !== '-' ? 'Scanned' : 'Pending';
        const afterScanStatus = afterScanTime !== '-' ? 'Scanned' : 'Pending';
        const timeDifference = calculateTimeDifference(beforeScanTime, afterScanTime);

        if (masterMap.has(qrId)) {
            const record = masterMap.get(qrId)!;
            if (record.status !== 'Scanned') {
                record.status = 'Scanned';
                record.scannedBy = scannedBy;
                record.scanTime = scanTime;
            }
            // Update Before/After status if available in this scan record
            // Note: Assuming the scanned file contains the latest status for these
            if (beforeScanStatus === 'Scanned') {
                record.beforeScanStatus = 'Scanned';
                record.beforeScanTime = beforeScanTime;
            }
            if (afterScanStatus === 'Scanned') {
                record.afterScanStatus = 'Scanned';
                record.afterScanTime = afterScanTime;
            }
            if (beforeScanStatus === 'Scanned' && afterScanStatus === 'Scanned') {
                record.timeDifference = timeDifference;
            }
        } else {
            const existingUnknown = unknownQRs.find(u => u.qrId === qrId);
            if (!existingUnknown) {
                unknownQRs.push({
                    qrId,
                    ward: 'Unknown',
                    zone: 'Unknown',
                    assignedTo: 'Unknown',
                    zonalHead: 'Unknown',
                    buildingName: 'Unknown',
                    siteName: 'Unknown',
                    type: 'Unknown',
                    status: 'Unknown',
                    scannedBy,
                    scanTime,
                    remarks: '-',
                    beforeScanStatus,
                    afterScanStatus,
                    beforeScanTime,
                    afterScanTime,
                    timeDifference
                });
            }
        }
    });

    // 4. Combine Results
    report.push(...Array.from(masterMap.values()));
    // report.push(...unknownQRs); // Disabled as per user request to only show master list QRs

    // Sort dates descending
    const availableDates = Array.from(availableDatesSet).sort((a, b) => {
        const parseDate = (d: string) => {
            const parts = d.split(/[-/]/);
            if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
            return 0;
        };
        return parseDate(b) - parseDate(a);
    });

    // 5. Calculate Stats
    const total = report.length;
    const scanned = report.filter((r) => r.status === 'Scanned').length;
    const pending = report.filter((r) => r.status === 'Pending').length;
    const unknown = report.filter((r) => r.status === 'Unknown').length;
    const scannedPercentage = total > 0 ? Math.round((scanned / total) * 100) : 0;

    const zoneStats: Record<string, { total: number; scanned: number; pending: number }> = {};
    const zonalHeadStats: Record<string, { total: number; scanned: number; pending: number }> = {};

    report.forEach((r) => {
        if (r.status === 'Unknown') return;

        // Zone Stats
        const zone = r.zone || 'Unspecified';
        if (!zoneStats[zone]) zoneStats[zone] = { total: 0, scanned: 0, pending: 0 };
        zoneStats[zone].total++;
        if (r.status === 'Scanned') zoneStats[zone].scanned++;
        if (r.status === 'Pending') zoneStats[zone].pending++;

        // Zonal Head Stats
        const head = r.zonalHead || 'Unassigned';
        if (!zonalHeadStats[head]) zonalHeadStats[head] = { total: 0, scanned: 0, pending: 0 };
        zonalHeadStats[head].total++;
        if (r.status === 'Scanned') zonalHeadStats[head].scanned++;
        if (r.status === 'Pending') zonalHeadStats[head].pending++;
    });

    return {
        report,
        stats: {
            total,
            scanned,
            pending,
            unknown,
            scannedPercentage,
            zoneStats,
            zonalHeadStats,
        },
        availableDates
    };
};
