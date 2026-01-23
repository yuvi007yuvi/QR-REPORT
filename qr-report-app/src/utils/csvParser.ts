// Utility functions for parsing CSV data

export interface ComplaintRecord {
  srNo: string;
  compId: string;
  name: string;
  phoneNumber: string;
  zone: string;
  ward: string;
  latitude: string;
  longitude: string;
  houseNumber: string;
  status: string;
  complaintType: string;
  complaintSubtype: string;
  complaintRegisteredDate: string;
  complaintDetail: string;
  actionTaken: string;
  registeredBy: string;
  happinessCodeOtp: string;
  updateBy: string;
  beforeImage: string;
  afterImage: string;
  closingDate: string;
  landmark: string;
  supervisorRemark: string;
  assignee: string;
  sfiName: string;
}

/**
 * Parses a CSV string into an array of objects
 */
export const parseCSV = (csvText: string): ComplaintRecord[] => {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const result: ComplaintRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;

    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;

    const record: any = {};
    headers.forEach((header, index) => {
      // Normalize header names to match our interface
      const normalizedHeader = normalizeHeader(header);
      record[normalizedHeader] = values[index]?.replace(/"/g, '') || '';
    });

    result.push(record as ComplaintRecord);
  }

  return result;
};

/**
 * Parses a single CSV line, handling quoted fields that may contain commas
 */
export const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        // Handle double quotes inside quoted field
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quotes state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
};

/**
 * Normalizes CSV header names to match our interface property names
 */
const normalizeHeader = (header: string): keyof ComplaintRecord => {
  const normalized = header.toLowerCase().trim().replace(/\s+/g, '');
  
  switch (normalized) {
    case 'srno':
      return 'srNo';
    case 'compid':
      return 'compId';
    case 'phonenumber':
      return 'phoneNumber';
    case 'housenumber':
      return 'houseNumber';
    case 'complainttype':
      return 'complaintType';
    case 'complaintsubtype':
      return 'complaintSubtype';
    case 'complaintregistereddate':
      return 'complaintRegisteredDate';
    case 'registeredby':
      return 'registeredBy';
    case 'happinesscode/otp':
      return 'happinessCodeOtp';
    case 'updateby':
      return 'updateBy';
    case 'beforeimage':
      return 'beforeImage';
    case 'afterimage':
      return 'afterImage';
    case 'closingdate':
      return 'closingDate';
    case 'landmark':
      return 'landmark';
    case 'supervisorremark':
      return 'supervisorRemark';
    case 'sfiname':
      return 'sfiName';
    default:
      // Convert to camelCase if not found in special cases
      return header
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase()) as keyof ComplaintRecord;
  }
};

/**
 * Filters complaint records for C&D waste related complaints
 */
export const filterCDWasteComplaints = (records: ComplaintRecord[]): ComplaintRecord[] => {
  return records.filter(record => 
    record.complaintSubtype.toLowerCase().includes('c&d waste') || 
    record.complaintSubtype.toLowerCase().includes('c&d') ||
    record.complaintType.toLowerCase().includes('c&d')
  );
};

/**
 * Gets unique values for a given field from complaint records
 */
export const getUniqueValues = (records: ComplaintRecord[], field: keyof ComplaintRecord): string[] => {
  const uniqueSet = new Set<string>();
  records.forEach(record => {
    const value = record[field];
    if (value && typeof value === 'string' && value.trim() !== '') {
      uniqueSet.add(value.trim());
    }
  });
  return Array.from(uniqueSet).sort();
};

/**
 * Groups complaint records by supervisor
 */
export const groupBySupervisor = (records: ComplaintRecord[]) => {
  const groups: { [key: string]: ComplaintRecord[] } = {};

  records.forEach(record => {
    if (record.assignee) {
      // Split multiple supervisors if comma-separated
      record.assignee.split(',').forEach(sup => {
        const supervisor = sup.trim();
        if (supervisor) {
          if (!groups[supervisor]) {
            groups[supervisor] = [];
          }
          groups[supervisor].push(record);
        }
      });
    } else {
      // Records without assignee go to 'Unassigned'
      const unassignedKey = 'Unassigned';
      if (!groups[unassignedKey]) {
        groups[unassignedKey] = [];
      }
      groups[unassignedKey].push(record);
    }
  });

  return Object.entries(groups).map(([supervisor, records]) => ({
    supervisor,
    records,
    count: records.length
  }));
};

/**
 * Groups complaint records by ward
 */
export const groupByWard = (records: ComplaintRecord[]) => {
  const groups: { [key: string]: ComplaintRecord[] } = {};

  records.forEach(record => {
    if (record.ward) {
      if (!groups[record.ward]) {
        groups[record.ward] = [];
      }
      groups[record.ward].push(record);
    }
  });

  return Object.entries(groups).map(([ward, records]) => ({
    ward,
    records,
    count: records.length
  }));
};

/**
 * Groups complaint records by zone
 */
export const groupByZone = (records: ComplaintRecord[]) => {
  const groups: { [key: string]: ComplaintRecord[] } = {};

  records.forEach(record => {
    if (record.zone) {
      if (!groups[record.zone]) {
        groups[record.zone] = [];
      }
      groups[record.zone].push(record);
    }
  });

  return Object.entries(groups).map(([zone, records]) => ({
    zone,
    records,
    count: records.length
  }));
};