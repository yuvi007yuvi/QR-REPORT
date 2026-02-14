import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { Upload, AlertCircle, CheckCircle, Search, ChevronDown, ChevronUp, FileText, Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import 'jspdf-autotable';

// Type definitions
interface POIRecord {
    'S.No.': string;
    'Zone & Circle': string;
    'Ward Name': string;
    'Vehicle Number': string;
    'Vehicle Type': string;
    'Route Name': string;
    'Total': string; // Assignee POI
    'Covered': string; // KYC Covered
    'Not Covered': string;
    'Coverage': string;
    'Date': string;
}

interface WardRecord {
    'S.No': string;
    'Ward Name': string;
    'Zonal': string;
    'Total HH (Target)': string;
}

interface RouteSummary {
    routeName: string;
    vehicleNumber: string;
    assigneePOI: number;
    kycCovered: number;
    coverage: number;
    capacityTarget: number;
    gap: number;
}

interface ExternalKYCRecord {
    'S.No.': string;
    'Ward Name': string;
    'Area': string;
    'Customer Count': string;
}

interface WardCrossCheck {
    wardName: string;
    zone: string;
    targetPOI: number;
    existingKYC: number;
    assigneePOI: number;
    kycCovered: number;
    difference: number; // Target - Assignee
    routes: RouteSummary[];
}

const WARD_TARGETS: WardRecord[] = [
    { 'S.No': '1', 'Ward Name': '29-Koyla Alipur', 'Zonal': 'Nishant', 'Total HH (Target)': '1800' },
    { 'S.No': '2', 'Ward Name': '64-Ghati Bahalray', 'Zonal': 'Girish', 'Total HH (Target)': '3000' },
    { 'S.No': '3', 'Ward Name': '05-Bharatpur Gate', 'Zonal': 'Girish', 'Total HH (Target)': '4010' },
    { 'S.No': '4', 'Ward Name': '61-Chaubia Para', 'Zonal': 'Girish', 'Total HH (Target)': '6000' },
    { 'S.No': '5', 'Ward Name': '56-Mandi Randas', 'Zonal': 'Ranveer', 'Total HH (Target)': '3691' },
    { 'S.No': '6', 'Ward Name': '46-Radha Nagar', 'Zonal': 'Ranveer', 'Total HH (Target)': '2248' },
    { 'S.No': '7', 'Ward Name': '11-Tarsi', 'Zonal': 'Bharat', 'Total HH (Target)': '1790' },
    { 'S.No': '8', 'Ward Name': '48-Satoha Asangpur', 'Zonal': 'Bharat', 'Total HH (Target)': '3500' },
    { 'S.No': '9', 'Ward Name': '42-Manoharpur', 'Zonal': 'Ranveer', 'Total HH (Target)': '5361' },
    { 'S.No': '10', 'Ward Name': '45-Birla Mandir', 'Zonal': 'Ranveer', 'Total HH (Target)': '5545' },
    { 'S.No': '11', 'Ward Name': '08-Atas', 'Zonal': 'Pankaj', 'Total HH (Target)': '3140' },
    { 'S.No': '12', 'Ward Name': '59-Maholi Second', 'Zonal': 'Bharat', 'Total HH (Target)': '4000' },
    { 'S.No': '13', 'Ward Name': '40-Rajkumar', 'Zonal': 'Ranveer', 'Total HH (Target)': '1332' },
    { 'S.No': '14', 'Ward Name': '38-Civil Lines', 'Zonal': 'Nishant', 'Total HH (Target)': '4027' },
    { 'S.No': '15', 'Ward Name': '65-Holi Gali', 'Zonal': 'Girish', 'Total HH (Target)': '3200' },
    { 'S.No': '16', 'Ward Name': '36-Jaisingh Pura', 'Zonal': 'Ranveer', 'Total HH (Target)': '4750' },
    { 'S.No': '17', 'Ward Name': '68-Shanti Nagar', 'Zonal': 'Bharat', 'Total HH (Target)': '2511' },
    { 'S.No': '18', 'Ward Name': '26-Naya Nagla', 'Zonal': 'Girish', 'Total HH (Target)': '4000' },
    { 'S.No': '19', 'Ward Name': '58-Gau Ghat', 'Zonal': 'Ranveer', 'Total HH (Target)': '2163' },
    { 'S.No': '20', 'Ward Name': '23-Aheer Pada', 'Zonal': 'Nishant', 'Total HH (Target)': '1950' },
    { 'S.No': '21', 'Ward Name': '10-Aurangabad First', 'Zonal': 'Nishant', 'Total HH (Target)': '2100' },
    { 'S.No': '22', 'Ward Name': '04-Ishapur Yamunapar', 'Zonal': 'Girish', 'Total HH (Target)': '3900' },
    { 'S.No': '23', 'Ward Name': '35-Bankhandi', 'Zonal': 'Girish', 'Total HH (Target)': '3000' },
    { 'S.No': '24', 'Ward Name': '67-Kemar Van', 'Zonal': 'Pankaj', 'Total HH (Target)': '2572' },
    { 'S.No': '25', 'Ward Name': '55-Govind Nagar', 'Zonal': 'Ranveer', 'Total HH (Target)': '3632' },
    { 'S.No': '26', 'Ward Name': '31-Navneet Nagar', 'Zonal': 'Bharat', 'Total HH (Target)': '2440' },
    { 'S.No': '27', 'Ward Name': '12-Radhe Shyam Colony', 'Zonal': 'Ranveer', 'Total HH (Target)': '4712' },
    { 'S.No': '28', 'Ward Name': '44-Radhika Bihar', 'Zonal': 'Bharat', 'Total HH (Target)': '2100' },
    { 'S.No': '29', 'Ward Name': '25-Chharaura', 'Zonal': 'Pankaj', 'Total HH (Target)': '2672' },
    { 'S.No': '30', 'Ward Name': '03-Girdharpur', 'Zonal': 'Bharat', 'Total HH (Target)': '4200' },
    { 'S.No': '31', 'Ward Name': '19-Ramnagar Yamunapar', 'Zonal': 'Girish', 'Total HH (Target)': '3500' },
    { 'S.No': '32', 'Ward Name': '39-Mahavidhya Colony', 'Zonal': 'Ranveer', 'Total HH (Target)': '4293' },
    { 'S.No': '33', 'Ward Name': '63-Maliyaan Sadar', 'Zonal': 'Nishant', 'Total HH (Target)': '2000' },
    { 'S.No': '34', 'Ward Name': '69-Ratan Chhatri', 'Zonal': 'Pankaj', 'Total HH (Target)': '2965' },
    { 'S.No': '35', 'Ward Name': '49-Daimpiriyal Nagar', 'Zonal': 'Girish', 'Total HH (Target)': '3000' },
    { 'S.No': '36', 'Ward Name': '28-Aurangabad Second', 'Zonal': 'Nishant', 'Total HH (Target)': '2200' },
    { 'S.No': '37', 'Ward Name': '53-Krishna Puri', 'Zonal': 'Girish', 'Total HH (Target)': '1200' },
    { 'S.No': '38', 'Ward Name': '41-Dhaulipiau', 'Zonal': 'Nishant', 'Total HH (Target)': '2995' },
    { 'S.No': '39', 'Ward Name': '13-Sunrakh', 'Zonal': 'Pankaj', 'Total HH (Target)': '2737' },
    { 'S.No': '40', 'Ward Name': '24-Sarai Azamabad', 'Zonal': 'Ranveer', 'Total HH (Target)': '3563' },
    { 'S.No': '41', 'Ward Name': '16-Bakalpur', 'Zonal': 'Bharat', 'Total HH (Target)': '4950' },
    { 'S.No': '42', 'Ward Name': '33-Palikhera', 'Zonal': 'Bharat', 'Total HH (Target)': '4500' },
    { 'S.No': '43', 'Ward Name': '21-Chaitanya Bihar', 'Zonal': 'Pankaj', 'Total HH (Target)': '3768' },
    { 'S.No': '44', 'Ward Name': '47-Dwarkapuri', 'Zonal': 'Bharat', 'Total HH (Target)': '2872' },
    { 'S.No': '45', 'Ward Name': '22-Badhri Nagar', 'Zonal': 'Ranveer', 'Total HH (Target)': '2117' },
    { 'S.No': '46', 'Ward Name': '32-Ranchibagar', 'Zonal': 'Nishant', 'Total HH (Target)': '3000' },
    { 'S.No': '47', 'Ward Name': '37-Baldevpuri', 'Zonal': 'Bharat', 'Total HH (Target)': '1430' },
    { 'S.No': '48', 'Ward Name': '60-Jagannath Puri', 'Zonal': 'Ranveer', 'Total HH (Target)': '2187' },
    { 'S.No': '49', 'Ward Name': '01-Birjapur', 'Zonal': 'Bharat', 'Total HH (Target)': '3800' },
    { 'S.No': '50', 'Ward Name': '02-Ambedkar Nagar', 'Zonal': 'Girish', 'Total HH (Target)': '1850' },
    { 'S.No': '51', 'Ward Name': '06-Aduki', 'Zonal': 'Nishant', 'Total HH (Target)': '3000' },
    { 'S.No': '52', 'Ward Name': '07-Lohvan', 'Zonal': 'Girish', 'Total HH (Target)': '4100' },
    { 'S.No': '53', 'Ward Name': '09-Gandhi Nagar', 'Zonal': 'Pankaj', 'Total HH (Target)': '856' },
    { 'S.No': '54', 'Ward Name': '14-Lakshmi Nagar Yamunapar', 'Zonal': 'Girish', 'Total HH (Target)': '1050' },
    { 'S.No': '55', 'Ward Name': '15-Maholi First', 'Zonal': 'Bharat', 'Total HH (Target)': '3800' },
    { 'S.No': '56', 'Ward Name': '17-Bairaagpura', 'Zonal': 'Ranveer', 'Total HH (Target)': '1498' },
    { 'S.No': '57', 'Ward Name': '18-General ganj', 'Zonal': 'Girish', 'Total HH (Target)': '1128' },
    { 'S.No': '58', 'Ward Name': '20-Krishna Nagar First', 'Zonal': 'Bharat', 'Total HH (Target)': '1700' },
    { 'S.No': '59', 'Ward Name': '27-Baad', 'Zonal': 'Nishant', 'Total HH (Target)': '1500' },
    { 'S.No': '60', 'Ward Name': '30-Krishna Nagar Second', 'Zonal': 'Bharat', 'Total HH (Target)': '1250' },
    { 'S.No': '61', 'Ward Name': '34-Radhaniwas', 'Zonal': 'Pankaj', 'Total HH (Target)': '2610' },
    { 'S.No': '62', 'Ward Name': '43-Ganeshra', 'Zonal': 'Ranveer', 'Total HH (Target)': '4647' },
    { 'S.No': '63', 'Ward Name': '50-Patharpura', 'Zonal': 'Pankaj', 'Total HH (Target)': '885' },
    { 'S.No': '64', 'Ward Name': '51-Gaushala Nagar', 'Zonal': 'Pankaj', 'Total HH (Target)': '2140' },
    { 'S.No': '65', 'Ward Name': '52-Chandrapuri', 'Zonal': 'Nishant', 'Total HH (Target)': '1795' },
    { 'S.No': '66', 'Ward Name': '54-Pratap Nagar', 'Zonal': 'Bharat', 'Total HH (Target)': '2920' },
    { 'S.No': '67', 'Ward Name': '57-Balajipuram', 'Zonal': 'Nishant', 'Total HH (Target)': '2000' },
    { 'S.No': '68', 'Ward Name': '62-Mathura Darwaza', 'Zonal': 'Pankaj', 'Total HH (Target)': '756' },
    { 'S.No': '69', 'Ward Name': '66-Keshighat', 'Zonal': 'Pankaj', 'Total HH (Target)': '913' },
    { 'S.No': '70', 'Ward Name': '70-Biharipur', 'Zonal': 'Pankaj', 'Total HH (Target)': '465' }
];

const VEHICLE_TARGETS: Record<string, number> = {
    'Primary - Three Wheeler (ER)': 250,
    'Primary - Auto Tipper': 700,
    'Primary - Euler Tipper': 700,
    'Primary - Manual Rickshaw': 200,
    'Primary - Wheel Barrow': 200
};

export const WardKYCCrossCheck: React.FC = () => {
    const [poiData, setPoiData] = useState<POIRecord[]>([]);
    const [wardData] = useState<WardRecord[]>(WARD_TARGETS);
    const [existingKYCData, setExistingKYCData] = useState<ExternalKYCRecord[]>([]);
    const [processedData, setProcessedData] = useState<WardCrossCheck[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<'ward' | 'route'>('ward');
    const [searchTerm, setSearchTerm] = useState('');

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'poi' | 'kyc' = 'poi') => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (type === 'poi') {
                    // Validate headers for POI file
                    const headers = results.meta.fields || [];
                    if (!headers.includes('Total') || !headers.includes('Covered') || !headers.includes('Ward Name')) {
                        setError("Invalid POI Report Format. Missing required columns: Total, Covered, Ward Name");
                        setLoading(false);
                        return;
                    }
                    setPoiData(results.data as POIRecord[]);
                } else {
                    // Validate headers for Existing KYC file
                    const headers = results.meta.fields || [];
                    if (!headers.includes('Area') || !headers.includes('Customer Count')) {
                        setError("Invalid KYC Data Format. Missing required columns: Area, Customer Count");
                        setLoading(false);
                        return;
                    }
                    setExistingKYCData(results.data as ExternalKYCRecord[]);
                }
                setLoading(false);
                setError(null);
            },
            error: (err) => {
                setError(`Error parsing ${type} file: ${err.message}`);
                setLoading(false);
            }
        });
    };

    useMemo(() => {
        if (poiData.length === 0 || wardData.length === 0) return;

        const summary: WardCrossCheck[] = [];

        // Group POI data by Ward
        const poiByWard: Record<string, { assignee: number; kyc: number; zone: string; routes: RouteSummary[] }> = {};

        poiData.forEach(row => {
            const wardName = row['Ward Name']?.trim();
            if (!wardName) return;

            if (!poiByWard[wardName]) {
                poiByWard[wardName] = { assignee: 0, kyc: 0, zone: row['Zone & Circle'], routes: [] };
            }

            const total = parseInt(row['Total'] || '0', 10);
            const covered = parseInt(row['Covered'] || '0', 10);

            poiByWard[wardName].assignee += total;
            poiByWard[wardName].kyc += covered;

            const vType = row['Vehicle Type']?.trim();
            const target = VEHICLE_TARGETS[vType] || 700;
            poiByWard[wardName].routes.push({
                routeName: row['Route Name'],
                vehicleNumber: row['Vehicle Number'],
                assigneePOI: total,
                kycCovered: covered,
                coverage: total > 0 ? Math.round((covered / total) * 100) : 0,
                capacityTarget: target,
                gap: target - total
            });
        });

        // Map existing KYC data for fast lookup
        const existingKYCMap: Record<string, number> = {};
        existingKYCData.forEach(r => {
            const area = r['Area']?.trim();
            if (area) {
                existingKYCMap[area] = parseInt(r['Customer Count'] || '0', 10);
            }
        });

        // Merge with Ward Data
        wardData.forEach((row: any) => {
            const wardName = row['Ward Name']?.trim();
            if (!wardName) return;

            const target = parseInt(row['Total HH (Target)'] || '0', 10);
            const matchedPOI = poiByWard[wardName] || { assignee: 0, kyc: 0, zone: row['Zonal'] || 'N/A', routes: [] };
            const existingVal = existingKYCMap[wardName] || 0;

            summary.push({
                wardName: wardName,
                zone: matchedPOI.zone,
                targetPOI: target,
                existingKYC: existingVal,
                assigneePOI: matchedPOI.assignee,
                kycCovered: matchedPOI.kyc,
                difference: target - matchedPOI.assignee,
                routes: matchedPOI.routes
            });
        });

        // Also include Wards from POI data that might not be in Ward Data (if any)
        const wardNamesInWardData = new Set(wardData.map((r: any) => r['Ward Name']?.trim()));
        Object.keys(poiByWard).forEach(wardName => {
            if (!wardNamesInWardData.has(wardName)) {
                const data = poiByWard[wardName];
                summary.push({
                    wardName: wardName,
                    zone: data.zone,
                    targetPOI: 0, // No target found
                    existingKYC: existingKYCMap[wardName] || 0,
                    assigneePOI: data.assignee,
                    kycCovered: data.kyc,
                    difference: 0 - data.assignee,
                    routes: data.routes
                });
            }
        });

        setProcessedData(summary);
    }, [poiData, wardData, existingKYCData]);

    const routeAnalysis = useMemo(() => {
        // Define targets for each vehicle type
        const vehicleTargets = VEHICLE_TARGETS;

        const targetTypes = Object.keys(vehicleTargets);

        // Filter and normalize vehicle type matching
        const relevantRoutes = poiData.filter(row => {
            const vType = row['Vehicle Type']?.trim();
            // Check for exact match or if the key is contained (for safety)
            return targetTypes.includes(vType);
        });

        const met: POIRecord[] = [];
        const unmet: POIRecord[] = [];

        relevantRoutes.forEach(row => {
            const vType = row['Vehicle Type']?.trim();
            const minTarget = vehicleTargets[vType] || 700; // default fallback
            const total = parseInt(row['Total'] || '0', 10);

            if (total >= minTarget) {
                met.push(row);
            } else {
                unmet.push(row);
            }
        });

        // Sort unmet by Total ascending (lowest first)
        unmet.sort((a, b) => parseInt(a['Total'] || '0') - parseInt(b['Total'] || '0'));
        // Sort met by Total descending (highest first)
        met.sort((a, b) => parseInt(b['Total'] || '0') - parseInt(a['Total'] || '0'));

        const all = [...relevantRoutes].sort((a, b) => parseInt(b['Total'] || '0') - parseInt(a['Total'] || '0'));

        return { met, unmet, all, vehicleTargets };
    }, [poiData]);

    const toggleRow = (wardName: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(wardName)) {
            newExpanded.delete(wardName);
        } else {
            newExpanded.add(wardName);
        }
        setExpandedRows(newExpanded);
    };

    const filteredData = processedData.filter(d =>
        d.wardName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.zone.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groupedData = useMemo(() => {
        const groups: Record<string, WardCrossCheck[]> = {};
        filteredData.forEach(item => {
            const zone = item.zone || 'Unknown Zone';
            if (!groups[zone]) groups[zone] = [];
            groups[zone].push(item);
        });
        return groups;
    }, [filteredData]);

    const sortedZones = useMemo(() => Object.keys(groupedData).sort(), [groupedData]);

    const stats = useMemo(() => {
        return {
            totalWards: processedData.length,
            totalTarget: processedData.reduce((acc, curr) => acc + curr.targetPOI, 0),
            totalAssignee: processedData.reduce((acc, curr) => acc + curr.assigneePOI, 0),
            totalKYC: processedData.reduce((acc, curr) => acc + curr.kycCovered, 0),
            messyWards: processedData.filter(d => d.difference > 0 || (d.assigneePOI > 0 && d.kycCovered / d.assigneePOI < 0.8)).length
        };
    }, [processedData]);

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        if (activeTab === 'ward') {
            const exportData = processedData.map(d => ({
                "Ward Name": d.wardName,
                "Zone": d.zone,
                "Target POI": d.targetPOI,
                "Assignee (Route Total)": d.assigneePOI,
                "Difference (Target - Assignee)": d.difference,
                "KYC Covered": d.kycCovered,
                "Coverage %": d.assigneePOI > 0 ? ((d.kycCovered / d.assigneePOI) * 100).toFixed(1) + '%' : '0%',
                "Status": d.difference > 0 ? "Target Unmet" : "Target Met"
            }));
            const ws = XLSX.utils.json_to_sheet(exportData);
            XLSX.utils.book_append_sheet(wb, ws, "Ward_Cross_Check");
        } else {
            const getRemark = (r: any) => {
                const vType = r['Vehicle Type']?.trim();
                const minTarget = routeAnalysis.vehicleTargets[vType] || 700;
                const total = parseInt(r['Total'] || '0', 10);
                const gap = minTarget - total;
                return gap > 0 ? `Action Required: Increase KYC to assign ${gap} more to route.` : "Target Met";
            };

            const metData = routeAnalysis.met.map(r => ({
                "Route Name": r['Route Name'],
                "Vehicle Number": r['Vehicle Number'],
                "Vehicle Type": r['Vehicle Type'],
                "Target": routeAnalysis.vehicleTargets[r['Vehicle Type']?.trim()] || 700,
                "Total POI": r['Total'],
                "Covered": r['Covered'],
                "Remark": getRemark(r)
            }));
            const unmetData = routeAnalysis.unmet.map(r => ({
                "Route Name": r['Route Name'],
                "Vehicle Number": r['Vehicle Number'],
                "Vehicle Type": r['Vehicle Type'],
                "Target": routeAnalysis.vehicleTargets[r['Vehicle Type']?.trim()] || 700,
                "Total POI": r['Total'],
                "Covered": r['Covered'],
                "Remark": getRemark(r)
            }));
            const allData = routeAnalysis.all.map(r => ({
                "Route Name": r['Route Name'],
                "Vehicle Number": r['Vehicle Number'],
                "Vehicle Type": r['Vehicle Type'],
                "Target": routeAnalysis.vehicleTargets[r['Vehicle Type']?.trim()] || 700,
                "Total POI": r['Total'],
                "Covered": r['Covered'],
                "Remark": getRemark(r)
            }));

            const wsMet = XLSX.utils.json_to_sheet(metData);
            const wsUnmet = XLSX.utils.json_to_sheet(unmetData);
            const wsAll = XLSX.utils.json_to_sheet(allData);

            XLSX.utils.book_append_sheet(wb, wsMet, "Targets_Met");
            XLSX.utils.book_append_sheet(wb, wsUnmet, "Targets_Unmet");
            XLSX.utils.book_append_sheet(wb, wsAll, "All_Routes");
        }

        XLSX.writeFile(wb, activeTab === 'ward' ? "Ward_KYC_Cross_Check_Report.xlsx" : "Route_Capacity_Report.xlsx");
    };

    const RouteTable = ({ data, title, type, targets, wardTargets }: { data: POIRecord[], title: string, type: 'success' | 'warning' | 'info', targets: Record<string, number>, wardTargets: Record<string, number> }) => {
        // Group data by Ward
        const groupedByWard = useMemo(() => {
            const groups: Record<string, POIRecord[]> = {};
            data.forEach(row => {
                const ward = row['Ward Name']?.trim() || 'Unknown Ward';
                if (!groups[ward]) groups[ward] = [];
                groups[ward].push(row);
            });
            return groups;
        }, [data]);

        // Sort Wards (try to natural sort if possible, e.g. "Ward 1", "Ward 2", "Ward 10")
        const sortedWards = useMemo(() => {
            return Object.keys(groupedByWard).sort((a, b) => {
                // Extract numbers if possible
                const numA = parseInt(a.replace(/\D/g, '') || '0', 10);
                const numB = parseInt(b.replace(/\D/g, '') || '0', 10);
                if (numA !== numB) return numA - numB;
                return a.localeCompare(b);
            });
        }, [groupedByWard]);

        return (
            <div className={`rounded-xl shadow-sm border overflow-hidden ${type === 'success' ? 'border-green-100' :
                type === 'warning' ? 'border-red-100' : 'border-blue-100'
                }`}>
                <div className={`px-6 py-4 border-b flex justify-between items-center ${type === 'success' ? 'bg-green-50 border-green-100' :
                    type === 'warning' ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'
                    }`}>
                    <h3 className={`font-bold ${type === 'success' ? 'text-green-800' :
                        type === 'warning' ? 'text-red-800' : 'text-blue-800'
                        }`}>{title}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${type === 'success' ? 'bg-green-100 text-green-700' :
                        type === 'warning' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                        {data.length} Routes
                    </span>
                </div>

                <div className="bg-white p-4 space-y-6">
                    {sortedWards.map(ward => {
                        const wardRoutes = groupedByWard[ward];
                        const totalRoutes = wardRoutes.length;
                        const totalAssigned = wardRoutes.reduce((acc, curr) => acc + parseInt(curr['Total'] || '0', 10), 0);
                        const totalKYC = wardRoutes.reduce((acc, curr) => acc + parseInt(curr['Covered'] || '0', 10), 0);
                        const target = wardTargets[ward] || 0;

                        return (
                            <div key={ward} className="border border-gray-300 rounded-sm">
                                <div className="bg-white p-3 flex flex-col md:flex-row justify-between items-center border-b border-gray-300 gap-2">
                                    <span className="font-bold text-gray-800 uppercase text-sm tracking-wide">{ward}</span>
                                    <div className="flex flex-wrap gap-3 text-xs font-medium text-gray-600 justify-center">
                                        <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                            Ward Target (KYC): <span className="text-gray-900 font-bold ml-1">{target > 0 ? target.toLocaleString() : 'N/A'}</span>
                                        </span>
                                        <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                            Assigned POI: <span className="text-blue-700 font-bold ml-1">{totalAssigned.toLocaleString()}</span>
                                        </span>
                                        <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                            KYC Covered: <span className="text-green-700 font-bold ml-1">{totalKYC.toLocaleString()}</span>
                                        </span>
                                        <span className="bg-gray-100 px-2 py-1 rounded border border-gray-200">
                                            Routes: <span className="text-gray-900 font-bold ml-1">{totalRoutes}</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-50 border-b border-gray-200">
                                    <div className="bg-white p-4 border border-blue-100 rounded-lg shadow-sm">
                                        <h4 className="font-bold text-gray-800 mb-1 text-sm flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-blue-600" />
                                            Ward Performance Summary
                                        </h4>
                                        <p className="text-sm text-gray-600 leading-relaxed">
                                            Ward <strong>{ward}</strong> has a total target of <strong>{target.toLocaleString()}</strong> households.
                                            Currently, <strong>{totalKYC.toLocaleString()}</strong> KYCs are completed on routes ({target > 0 ? ((totalKYC / target) * 100).toFixed(1) : '0'}% of Ward Target).
                                            <br />
                                            Route Assignment: <strong>{totalAssigned.toLocaleString()}</strong> assigned vs <strong>{target.toLocaleString()}</strong> target (Gap: {target - totalAssigned > 0 ? (target - totalAssigned).toLocaleString() : '0'}).

                                            <span className="block mt-2 font-medium text-blue-800 bg-blue-50 p-2 rounded border border-blue-100">
                                                {target > totalKYC ? (
                                                    <>
                                                        <span className="font-bold text-red-600">Action Required: </span>
                                                        We have to increase the KYC in this ward by <strong>{(target - totalKYC).toLocaleString()}</strong> so we can assign them on route to complete the route KYC count.
                                                    </>
                                                ) : (
                                                    <span className="text-green-700">Ward KYC Target Met. Ensure all are correctly assigned to routes.</span>
                                                )}
                                                {(target - totalAssigned) > 0 && (
                                                    <span className="block mt-1 text-orange-700">
                                                        Also need to assign <strong>{(target - totalAssigned).toLocaleString()}</strong> more households to routes to cover the full ward.
                                                    </span>
                                                )}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="text-xs text-black border-b border-gray-300 bg-white">
                                            <tr>
                                                <th className="px-4 py-2 border-r border-gray-300 w-12 text-center">S.No.</th>
                                                <th className="px-4 py-2 border-r border-gray-300">Route Name</th>
                                                <th className="px-4 py-2 border-r border-gray-300">Vehicle Number</th>
                                                <th className="px-4 py-2 border-r border-gray-300">Vehicle Type</th>
                                                <th className="px-4 py-2 border-r border-gray-300 text-center text-blue-800 font-bold">Target</th>
                                                <th className="px-4 py-2 border-r border-gray-300 text-center">Assigned POI</th>
                                                <th className="px-4 py-2 border-r border-gray-300 text-center">KYC Covered</th>
                                                <th className="px-4 py-2 border-r border-gray-300 text-center">Coverage</th>
                                                <th className="px-4 py-2 text-center">Remark</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-300">
                                            {groupedByWard[ward].map((row, idx) => {
                                                const vType = row['Vehicle Type']?.trim();
                                                const minTarget = targets[vType] || 700;
                                                const total = parseInt(row['Total'] || '0', 10);
                                                const gap = minTarget - total;

                                                return (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="px-4 py-2 border-r border-gray-300 text-center">{idx + 1}</td>
                                                        <td className="px-4 py-2 border-r border-gray-300 font-medium text-gray-900">{row['Route Name']}</td>
                                                        <td className="px-4 py-2 border-r border-gray-300 text-gray-600">{row['Vehicle Number']}</td>
                                                        <td className="px-4 py-2 border-r border-gray-300 text-gray-700">{row['Vehicle Type']}</td>
                                                        <td className="px-4 py-2 border-r border-gray-300 text-center font-mono font-bold text-blue-800">{minTarget}</td>
                                                        <td className="px-4 py-2 border-r border-gray-300 text-center font-mono font-bold">{row['Total']}</td>
                                                        <td className="px-4 py-2 border-r border-gray-300 text-center font-mono font-bold text-green-700">{row['Covered']}</td>
                                                        <td className="px-4 py-2 border-r border-gray-300 text-center text-gray-600 font-medium">{row['Coverage']}%</td>
                                                        <td className="px-4 py-2 text-center text-xs font-bold w-48">
                                                            {gap > 0 ? (
                                                                <span className="text-red-600 bg-red-50 px-2 py-1 rounded block text-center border border-red-100">
                                                                    Action Required: Increase KYC to assign {gap} more to route.
                                                                </span>
                                                            ) : (
                                                                <span className="text-green-700 bg-green-50 px-2 py-1 rounded block text-center">
                                                                    Target Met
                                                                </span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        );
                    })}
                    {sortedWards.length === 0 && (
                        <div className="text-center py-8 text-gray-400 italic">No routes found in this category</div>
                    )}
                </div>
            </div>
        );
    };

    const wardTargetMap = useMemo(() => {
        const map: Record<string, number> = {};
        processedData.forEach(d => {
            map[d.wardName] = d.targetPOI;
        });
        return map;
    }, [processedData]);

    return (
        <div className="space-y-6 p-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Ward Wise KYC Cross-Check Report</h1>
                    <p className="text-gray-500 text-sm mt-1">Compare Target POIs vs Actual Route Assignees and KYC Performance</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={exportToExcel}
                        disabled={processedData.length === 0 && routeAnalysis.met.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* View Toggles */}
            <div className="flex p-1 bg-gray-200 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('ward')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'ward' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    Ward Cross-Check
                </button>
                <button
                    onClick={() => setActiveTab('route')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'route' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    Route Capacity Analysis
                </button>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* File Upload Section */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                    <p className="text-gray-500 font-medium">Processing Data...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group hover:border-blue-300 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <FileText className="w-16 h-16 text-blue-600" />
                        </div>
                        <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                            Route KYC Report
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">Upload the POI Report (e.g., POI-Report-14-02-2026.csv)</p>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={(e) => handleFileUpload(e, 'poi')}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className={`flex items-center justify-center p-4 border-2 border-dashed rounded-lg transition-colors ${poiData.length > 0 ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                                {poiData.length > 0 ? (
                                    <div className="flex items-center gap-2 text-green-700">
                                        <CheckCircle className="w-5 h-5" />
                                        <span className="font-medium">Loaded {poiData.length} records</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Upload className="w-5 h-5" />
                                        <span>Click to Upload CSV</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden group hover:border-purple-300 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <FileText className="w-16 h-16 text-purple-600" />
                        </div>
                        <h3 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <span className="bg-purple-100 text-purple-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                            Existing KYC Data
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">Upload Existing KYC Data (e.g., KYC_By_Wards.csv)</p>
                        <div className="relative">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={(e) => handleFileUpload(e, 'kyc')}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                            />
                            <div className={`flex items-center justify-center p-4 border-2 border-dashed rounded-lg transition-colors ${existingKYCData.length > 0 ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                                {existingKYCData.length > 0 ? (
                                    <div className="flex items-center gap-2 text-green-700">
                                        <CheckCircle className="w-5 h-5" />
                                        <span className="font-medium">Loaded {existingKYCData.length} records</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-gray-500">
                                        <Upload className="w-5 h-5" />
                                        <span>Click to Upload CSV</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'route' && poiData.length > 0 && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-blue-800 text-sm space-y-1">
                        <p><strong>Capacity & KYC Targets:</strong></p>
                        <ul className="list-disc pl-5 space-y-0.5">
                            <li>Auto/Euler Tipper: <strong>700</strong></li>
                            <li>Three Wheeler (ER): <strong>250</strong></li>
                            <li>Manual Rickshaw / Wheel Barrow: <strong>200</strong></li>
                        </ul>
                    </div>

                    <RouteTable
                        data={routeAnalysis.all}
                        title="All Routes"
                        type="info"
                        targets={routeAnalysis.vehicleTargets}
                        wardTargets={wardTargetMap}
                    />

                    <RouteTable
                        data={routeAnalysis.met}
                        title="Target Met (Capacity Achieved)"
                        type="success"
                        targets={routeAnalysis.vehicleTargets}
                        wardTargets={wardTargetMap}
                    />

                    <RouteTable
                        data={routeAnalysis.unmet}
                        title="Target Unmet (Under Capacity)"
                        type="warning"
                        targets={routeAnalysis.vehicleTargets}
                        wardTargets={wardTargetMap}
                    />
                </div>
            )}

            {activeTab === 'ward' && processedData.length > 0 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <p className="text-xs text-gray-500 uppercase font-semibold">Total Target POI</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalTarget.toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <p className="text-xs text-gray-500 uppercase font-semibold">Total Assignee POI</p>
                            <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalAssignee.toLocaleString()}</p>
                            <p className="text-xs text-gray-400 mt-1">Gap: {(stats.totalTarget - stats.totalAssignee).toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <p className="text-xs text-gray-500 uppercase font-semibold">Total KYC Covered</p>
                            <p className="text-2xl font-bold text-green-600 mt-1">{stats.totalKYC.toLocaleString()}</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {((stats.totalKYC / stats.totalAssignee) * 100).toFixed(1)}% of Assigned
                            </p>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                            <p className="text-xs text-gray-500 uppercase font-semibold">Low KYC/Gap Wards</p>
                            <p className="text-2xl font-bold text-red-600 mt-1">{stats.messyWards}</p>
                            <p className="text-xs text-gray-400 mt-1">Require Attention</p>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search by Ward Name or Zone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    {/* Data Tables Grouped by Zone */}
                    <div className="space-y-8">
                        {sortedZones.map((zone) => (
                            <div key={zone} className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-1 bg-blue-600 rounded-full"></div>
                                    <h2 className="text-xl font-bold text-gray-800">
                                        {zone}
                                        <span className="ml-3 text-sm font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                                            {groupedData[zone].length} Wards
                                        </span>
                                    </h2>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                                                <tr>
                                                    <th className="px-6 py-3 w-8"></th>
                                                    <th className="px-6 py-3 w-8">S.No.</th>
                                                    <th className="px-6 py-3 font-semibold">Ward Name</th>
                                                    <th className="px-6 py-3 font-semibold text-right">Target POI</th>
                                                    <th className="px-6 py-3 font-semibold text-right text-blue-700">Assignee POI</th>
                                                    <th className="px-6 py-3 font-semibold text-right">Difference</th>
                                                    <th className="px-6 py-3 font-semibold text-right text-green-700">KYC Covered</th>
                                                    <th className="px-6 py-3 font-semibold text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {groupedData[zone].map((row, index) => {
                                                    const isLowKYC = row.difference > 0 || (row.assigneePOI > 0 && row.kycCovered / row.assigneePOI < 0.8);

                                                    return (
                                                        <React.Fragment key={row.wardName}>
                                                            <tr
                                                                className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedRows.has(row.wardName) ? 'bg-blue-50/30' : ''}`}
                                                                onClick={() => toggleRow(row.wardName)}
                                                            >
                                                                <td className="px-6 py-4">
                                                                    {expandedRows.has(row.wardName) ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                                                </td>
                                                                <td className="px-6 py-4 text-gray-500 text-xs w-8">{index + 1}</td>
                                                                <td className="px-6 py-4 font-medium text-gray-900">{row.wardName}</td>
                                                                <td className="px-6 py-4 text-right text-gray-600 font-mono">{row.targetPOI.toLocaleString()}</td>
                                                                <td className="px-6 py-4 text-right font-bold text-blue-600 font-mono">{row.assigneePOI.toLocaleString()}</td>
                                                                <td className={`px-6 py-4 text-right font-mono font-medium ${row.difference > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                                                    {row.difference > 0 ? `-${row.difference}` : `+${Math.abs(row.difference)}`}
                                                                </td>
                                                                <td className="px-6 py-4 text-right font-bold text-green-600 font-mono">{row.kycCovered.toLocaleString()}</td>
                                                                <td className="px-6 py-4 text-center">
                                                                    {isLowKYC ? (
                                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                                            Attention
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                                            Good
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>

                                                            {/* Expanded Route Details */}
                                                            {expandedRows.has(row.wardName) && (
                                                                <tr className="bg-gray-50">
                                                                    <td colSpan={8} className="px-4 py-4">
                                                                        <div className="mb-3 ml-8 p-4 bg-white border border-blue-100 rounded-lg shadow-sm">
                                                                            <h4 className="font-bold text-gray-800 mb-1 text-sm flex items-center gap-2">
                                                                                <FileText className="w-4 h-4 text-blue-600" />
                                                                                Ward Performance Summary
                                                                            </h4>
                                                                            <p className="text-sm text-gray-600 leading-relaxed">
                                                                                Ward <strong>{row.wardName}</strong> has a total target of <strong>{row.targetPOI.toLocaleString()}</strong> households.
                                                                                Currently, <strong>{row.kycCovered.toLocaleString()}</strong> KYCs are completed ({row.targetPOI > 0 ? ((row.kycCovered / row.targetPOI) * 100).toFixed(1) : '0'}% of Ward Target).
                                                                                <br />
                                                                                Route Assignment: <strong>{row.assigneePOI.toLocaleString()}</strong> assigned vs <strong>{row.targetPOI.toLocaleString()}</strong> target (Gap: {row.difference > 0 ? row.difference.toLocaleString() : '0'}).
                                                                                <span className="block mt-2 font-medium text-blue-800 bg-blue-50 p-2 rounded border border-blue-100">
                                                                                    {row.targetPOI > row.kycCovered ? (
                                                                                        <>
                                                                                            <span className="font-bold text-red-600">Action Required: </span>
                                                                                            We have to increase the KYC in this ward by <strong>{(row.targetPOI - row.kycCovered).toLocaleString()}</strong> so we can assign them on route to complete the route KYC count.
                                                                                        </>
                                                                                    ) : (
                                                                                        <span className="text-green-700">Ward KYC Target Met. Ensure all are correctly assigned to routes.</span>
                                                                                    )}
                                                                                    {row.difference > 0 && (
                                                                                        <span className="block mt-1 text-orange-700">
                                                                                            Also need to assign <strong>{row.difference}</strong> more households to routes to cover the full ward.
                                                                                        </span>
                                                                                    )}
                                                                                </span>
                                                                            </p>
                                                                        </div>
                                                                        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden ml-8">
                                                                            <table className="w-full text-xs">
                                                                                <thead className="bg-gray-100 border-b border-gray-200 text-gray-500">
                                                                                    <tr>
                                                                                        <th className="px-4 py-2 text-left">Route Name</th>
                                                                                        <th className="px-4 py-2 text-left">Vehicle Number</th>
                                                                                        <th className="px-4 py-2 text-right">Assignee POI</th>
                                                                                        <th className="px-4 py-2 text-right">Target (Capacity)</th>
                                                                                        <th className="px-4 py-2 text-right">KYC Covered</th>
                                                                                        <th className="px-4 py-2 text-right">Uncovered</th>
                                                                                        <th className="px-4 py-2 text-center">Coverage</th>
                                                                                        <th className="px-4 py-2 text-left">Action Summary</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-gray-100">
                                                                                    {row.routes.length > 0 ? (
                                                                                        row.routes.map((route, idx) => (
                                                                                            <tr key={idx} className="hover:bg-gray-50/50">
                                                                                                <td className="px-4 py-2 font-medium text-gray-700">{route.routeName}</td>
                                                                                                <td className="px-4 py-2 text-gray-600">{route.vehicleNumber}</td>
                                                                                                <td className="px-4 py-2 text-right font-mono">{route.assigneePOI}</td>
                                                                                                <td className="px-4 py-2 text-right font-mono text-blue-600">{route.capacityTarget}</td>
                                                                                                <td className="px-4 py-2 text-right font-mono text-green-600">{route.kycCovered}</td>
                                                                                                <td className="px-4 py-2 text-right font-mono text-red-500">{route.assigneePOI - route.kycCovered}</td>
                                                                                                <td className="px-4 py-2 text-center font-medium">
                                                                                                    <span className={route.coverage < 80 ? 'text-red-600' : 'text-green-600'}>
                                                                                                        {route.coverage}%
                                                                                                    </span>
                                                                                                </td>
                                                                                                <td className="px-4 py-2 text-left font-medium text-xs">
                                                                                                    {route.gap > 0 ? (
                                                                                                        <span className="text-red-600 bg-red-50 px-2 py-1 rounded inline-block border border-red-100">
                                                                                                            Action Required: Increase KYC to assign {route.gap} more to route.
                                                                                                        </span>
                                                                                                    ) : (
                                                                                                        <span className="text-green-700 bg-green-50 px-2 py-1 rounded inline-block">
                                                                                                            Target Met.
                                                                                                        </span>
                                                                                                    )}
                                                                                                </td>
                                                                                            </tr>
                                                                                        ))
                                                                                    ) : (
                                                                                        <tr>
                                                                                            <td colSpan={6} className="px-4 py-3 text-center text-gray-500 italic">No routes found for this ward in POI report.</td>
                                                                                        </tr>
                                                                                    )}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {sortedZones.length === 0 && (
                            <div className="p-12 text-center text-gray-500 bg-white rounded-xl border border-gray-100">
                                <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                <p>No wards found matching your search</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
