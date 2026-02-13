import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Upload, FileDown, Search, CheckCircle, FileSpreadsheet, ChevronDown, ChevronUp, ArrowUpDown } from 'lucide-react';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';

interface MergedData {
    sNo: number;
    vehicleNumber: string;
    vehicleType: string;
    zoneName: string;
    wardName: string;
    tripCount: number;
    dumpSiteName: string;
    tripInTime: string;
    tripOutTime: string;
    tripDate: string;

    // POI Data
    totalPoints: string;
    coveredPoints: string;
    notCoveredPoints: string;
    coverage: string;
}

interface TripRaw {
    vehicleNumber: string;
    vehicleType: string;
    zoneName: string; // Add zoneName to TripRaw
    wardName: string;
    tripCount: number;
    dumpSiteName: string;
    tripDate: string;
    tripInTime: string;
    tripOutTime: string;
}

interface POIRaw {
    vehicleNumber: string;
    vehicleType: string;
    zoneName: string;
    wardName: string;
    totalPoints: string;
    coveredPoints: string;
    notCoveredPoints: string;
    coverage: string;
}

const TripReport: React.FC = () => {
    const [tripData, setTripData] = useState<TripRaw[]>([]);
    const [poiData, setPoiData] = useState<POIRaw[]>([]);
    const [mergedData, setMergedData] = useState<MergedData[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVehicleType, setSelectedVehicleType] = useState('All');
    const [selectedTripCount, setSelectedTripCount] = useState<string>('All');
    const [selectedDumpSites, setSelectedDumpSites] = useState<string[]>([]);
    const [selectedZones, setSelectedZones] = useState<string[]>([]);
    const [isDumpSiteDropdownOpen, setIsDumpSiteDropdownOpen] = useState(false);
    const [isZoneDropdownOpen, setIsZoneDropdownOpen] = useState(false);
    const [showInTime, setShowInTime] = useState(true);
    const [showOutTime, setShowOutTime] = useState(true);
    const [hideZeroStats, setHideZeroStats] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: keyof MergedData; direction: 'asc' | 'desc' } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const tripFileInputRef = useRef<HTMLInputElement>(null);
    const poiFileInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const zoneDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDumpSiteDropdownOpen(false);
            }
            if (zoneDropdownRef.current && !zoneDropdownRef.current.contains(event.target as Node)) {
                setIsZoneDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Merge Logic: Full Outer Join
    useEffect(() => {
        const normalize = (str: string) => str ? String(str).replace(/[^A-Z0-9]/gi, '').toUpperCase() : '';

        // Create a map of normalized vehicle -> POI Data
        const poiMap = new Map<string, POIRaw>();
        poiData.forEach(poi => {
            if (poi.vehicleNumber) {
                poiMap.set(normalize(poi.vehicleNumber), poi);
            }
        });

        // Let's simply collect ALL unique Normalized Vehicle Numbers from both sets
        const allVehicles = new Set<string>();
        tripData.forEach(t => allVehicles.add(normalize(t.vehicleNumber)));
        poiData.forEach(p => allVehicles.add(normalize(p.vehicleNumber)));

        const merged: MergedData[] = [];
        let counter = 1;

        // Iterate through all unique vehicles found
        allVehicles.forEach(normVeh => {
            if (!normVeh) return;

            // Find Trip Record
            const tripRecord = tripData.find(t => normalize(t.vehicleNumber) === normVeh);

            // Find POI Record
            let poiRecord = poiMap.get(normVeh);
            if (!poiRecord) {
                // Try fuzzy match
                for (const [key, val] of poiMap.entries()) {
                    if (key.endsWith(normVeh) || normVeh.endsWith(key)) {
                        poiRecord = val;
                        break;
                    }
                }
            }

            // Construct Merged Record
            const vehicleNumber = tripRecord?.vehicleNumber || poiRecord?.vehicleNumber || normVeh;
            const vehicleType = tripRecord?.vehicleType || poiRecord?.vehicleType || '';
            const zoneName = tripRecord?.zoneName || poiRecord?.zoneName || '';
            const wardName = tripRecord?.wardName || poiRecord?.wardName || '';

            merged.push({
                sNo: counter++,
                vehicleNumber: vehicleNumber,
                vehicleType: vehicleType,
                zoneName: zoneName,
                wardName: wardName,
                tripCount: tripRecord?.tripCount || 0,
                dumpSiteName: tripRecord?.dumpSiteName || '',
                tripDate: tripRecord?.tripDate || '',
                tripInTime: tripRecord?.tripInTime || '',
                tripOutTime: tripRecord?.tripOutTime || '',

                totalPoints: poiRecord?.totalPoints || '0',
                coveredPoints: poiRecord?.coveredPoints || '0',
                notCoveredPoints: poiRecord?.notCoveredPoints || '0',
                coverage: poiRecord?.coverage || '0'
            });
        });

        setMergedData(merged);

    }, [tripData, poiData]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'trip' | 'poi') => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const csvData = e.target?.result;
                if (typeof csvData === 'string') {
                    const workbook = XLSX.read(csvData, { type: 'string' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

                    if (type === 'trip') {
                        const formatDate = (val: any): string => {
                            if (!val) return '';
                            if (typeof val === 'number') {
                                const date = new Date(Math.round((val - 25569) * 864e5));
                                const day = String(date.getUTCDate()).padStart(2, '0');
                                const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                                const year = date.getUTCFullYear();
                                return `${day}-${month}-${year}`;
                            }
                            const strVal = String(val).trim();
                            if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
                                const [y, m, d] = strVal.split('-');
                                return `${d}-${m}-${y}`;
                            }
                            if (/^\d{1,2}[\/.]\d{1,2}[\/.]\d{4}$/.test(strVal)) {
                                return strVal.replace(/[./]/g, '-');
                            }
                            return strVal;
                        };

                        const processed: TripRaw[] = jsonData.slice(1).map((row: any) => ({
                            sNo: row[0],
                            vehicleNumber: row[2] || '',
                            vehicleType: row[3] || '',
                            zoneName: '', // Trip report usually doesn't have zone, or it needs to be mapped if present
                            wardName: row[4] || '',
                            tripCount: row[5] ? parseInt(row[5]) : 0,
                            dumpSiteName: row[6] || '',
                            tripDate: formatDate(row[7]),
                            tripInTime: row[8] || '',
                            tripOutTime: row[9] || ''
                        })).filter(t => t.vehicleNumber);

                        setTripData(processed);
                    } else {
                        // POI Report
                        const headers = jsonData[0].map(h => String(h).trim().toLowerCase());

                        const vIdx = headers.findIndex(h => h.includes('vehicle number'));
                        const typeIdx = headers.findIndex(h => h.includes('vehicle type'));
                        const zoneIdx = headers.findIndex(h => h.includes('zone'));
                        const wardIdx = headers.findIndex(h => h.includes('ward name'));

                        const totalIdx = headers.findIndex(h => h.includes('total') || h === 'total');
                        const coveredIdx = headers.findIndex(h => h.includes('covered') && !h.includes('not'));
                        const notCoveredIdx = headers.findIndex(h => h.includes('not covered'));
                        const coverageIdx = headers.findIndex(h => h === 'coverage' || h.includes('coverage'));

                        const processed: POIRaw[] = jsonData.slice(1).map((row: any) => ({
                            vehicleNumber: row[vIdx !== -1 ? vIdx : 3] || '',
                            vehicleType: row[typeIdx !== -1 ? typeIdx : 4] || '',
                            zoneName: row[zoneIdx !== -1 ? zoneIdx : 1] || '',
                            wardName: row[wardIdx !== -1 ? wardIdx : 2] || '',
                            totalPoints: row[totalIdx !== -1 ? totalIdx : 6] || '0',
                            coveredPoints: row[coveredIdx !== -1 ? coveredIdx : 7] || '0',
                            notCoveredPoints: row[notCoveredIdx !== -1 ? notCoveredIdx : 8] || '0',
                            coverage: row[coverageIdx !== -1 ? coverageIdx : 9] || '0'
                        })).filter(p => p.vehicleNumber);

                        setPoiData(processed);
                    }
                }
            } catch (error) {
                console.error('Error parsing CSV:', error);
                alert('Error parsing CSV file');
            } finally {
                setIsLoading(false);
            }
        };

        reader.readAsText(file);
    };

    const exportToExcel = () => {
        const headers = [
            "S.No", "Vehicle Number", "Vehicle Type", "Zone", "Ward Name",
            "Trip Count", "Total HH", "Covered", "Left", "Coverage (%)",
            "Dump Site", "Date", "In Time", "Out Time"
        ];

        const excelData = mergedData.map(row => [
            row.sNo,
            row.vehicleNumber,
            row.vehicleType,
            row.zoneName,
            row.wardName,
            row.tripCount,
            row.totalPoints,
            row.coveredPoints,
            row.notCoveredPoints,
            row.coverage,
            row.dumpSiteName,
            row.tripDate,
            row.tripInTime,
            row.tripOutTime
        ]);

        const reportTitle = [["Mathura Vrindavan Nagar Nigam"], ["Daily Trip & Coverage Report"], [`Generated on: ${new Date().toLocaleDateString()}`], []];

        const ws = XLSX.utils.aoa_to_sheet([...reportTitle, headers, ...excelData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trip_Coverage_Report");
        XLSX.writeFile(wb, "Trip_Coverage_Report.xlsx");
    };

    const exportToPDF = async () => {
        const doc = new jsPDF('landscape');

        try {
            doc.setFontSize(16);
            doc.text("Daily Trip & Coverage Report", 14, 15);
            doc.setFontSize(10);
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

            const tableHeaders = [
                "Veh No.", "Type", "Ward", "Trips", "Total", "Done", "Left", "Cov %", "Dump Site", "In Time"
            ];

            const tableData = mergedData.map(row => [
                row.vehicleNumber,
                row.vehicleType.substring(0, 15),
                row.wardName,
                row.tripCount,
                row.totalPoints,
                row.coveredPoints,
                row.notCoveredPoints,
                row.coverage + '%',
                row.dumpSiteName.substring(0, 15),
                row.tripInTime
            ]);

            autoTable(doc, {
                startY: 25,
                head: [tableHeaders],
                body: tableData,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 1, valign: 'middle', lineColor: [200, 200, 200], lineWidth: 0.1 },
                headStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: 'bold', lineColor: [150, 150, 150], lineWidth: 0.1 },
                margin: { top: 25 },
            });

            doc.save("Trip_Coverage_Report.pdf");
        } catch (error) {
            console.error("PDF Fail", error);
            alert("PDF Export Failed");
        }
    };

    const requestSort = (key: keyof MergedData) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: keyof MergedData) => {
        if (!sortConfig || sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 inline ml-1 text-gray-300" />;
        return sortConfig.direction === 'asc'
            ? <ChevronUp className="w-3 h-3 inline ml-1 text-black" />
            : <ChevronDown className="w-3 h-3 inline ml-1 text-black" />;
    };


    const filteredData = mergedData.filter(item => {
        const matchSearch = String(item.vehicleNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(item.wardName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(item.dumpSiteName || '').toLowerCase().includes(searchTerm.toLowerCase());

        const typeStr = (item.vehicleType || '').toLowerCase();
        let matchType = true;
        if (selectedVehicleType === 'Primary') {
            matchType = typeStr.includes('primary');
        } else if (selectedVehicleType === 'Secondary') {
            matchType = typeStr.includes('secondary');
        }

        const matchTripCount = selectedTripCount === 'All' || item.tripCount === parseInt(selectedTripCount);

        const matchDumpSite = selectedDumpSites.length === 0 || selectedDumpSites.includes(item.dumpSiteName);
        const matchZone = selectedZones.length === 0 || selectedZones.includes(item.zoneName);

        let matchZeroStats = true;
        if (hideZeroStats) {
            // Hide if BOTH Trip Count is 0 AND Coverage is 0 (or N/A)
            const isZeroTrips = item.tripCount === 0;
            const isZeroCoverage = item.coverage === '0' || item.coverage === 'N/A' || !item.coverage;
            if (isZeroTrips && isZeroCoverage) {
                matchZeroStats = false;
            }
        }

        return matchSearch && matchType && matchTripCount && matchDumpSite && matchZone && matchZeroStats;
    }).sort((a, b) => {
        if (!sortConfig) return 0;

        const { key, direction } = sortConfig;
        const valA = a[key];
        const valB = b[key];

        const isNumeric = ['tripCount', 'totalPoints', 'coveredPoints', 'notCoveredPoints', 'coverage', 'sNo'].includes(key);

        if (isNumeric) {
            const numA = parseFloat(String(valA).replace(/[^0-9.-]+/g, "")) || 0;
            const numB = parseFloat(String(valB).replace(/[^0-9.-]+/g, "")) || 0;
            if (numA < numB) return direction === 'asc' ? -1 : 1;
            if (numA > numB) return direction === 'asc' ? 1 : -1;
            return 0;
        }

        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();

        if (strA < strB) return direction === 'asc' ? -1 : 1;
        if (strA > strB) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Get unique values for filters
    const tripCounts = Array.from(new Set(mergedData.map(m => m.tripCount))).sort((a, b) => a - b);
    const dumpSites = Array.from(new Set(mergedData.map(m => m.dumpSiteName).filter(Boolean))).sort();
    const zones = Array.from(new Set(mergedData.map(m => m.zoneName).filter(Boolean))).sort();

    const toggleDumpSite = (site: string) => {
        setSelectedDumpSites(prev =>
            prev.includes(site) ? prev.filter(s => s !== site) : [...prev, site]
        );
    };

    const toggleZone = (zone: string) => {
        setSelectedZones(prev =>
            prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]
        );
    };

    return (
        <div className="flex flex-col h-full bg-white p-4 space-y-4">
            {/* Header Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-green-600" />
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Trip & Coverage Analysis</h1>
                        <p className="text-xs text-gray-500">Comprehensive Vehicle Performance Report</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                    <button
                        onClick={() => tripFileInputRef.current?.click()}
                        className={`px-3 py-2 text-sm rounded border flex items-center gap-2 ${tripData.length > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                    >
                        {tripData.length > 0 ? <CheckCircle className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                        Trip Report
                    </button>
                    <input type="file" ref={tripFileInputRef} onChange={(e) => handleFileUpload(e, 'trip')} className="hidden" accept=".csv,.xlsx" />

                    <button
                        onClick={() => poiFileInputRef.current?.click()}
                        className={`px-3 py-2 text-sm rounded border flex items-center gap-2 ${poiData.length > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                    >
                        {poiData.length > 0 ? <CheckCircle className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                        POI Report
                    </button>
                    <input type="file" ref={poiFileInputRef} onChange={(e) => handleFileUpload(e, 'poi')} className="hidden" accept=".csv,.xlsx" />

                    {(mergedData.length > 0) && (
                        <>
                            <div className="h-6 w-px bg-gray-300 mx-2"></div>
                            <button onClick={exportToExcel} className="p-2 text-green-600 hover:bg-green-50 rounded border border-gray-200" title="Export Excel">
                                <FileDown className="w-5 h-5" />
                            </button>
                            <button onClick={exportToPDF} className="p-2 text-red-600 hover:bg-red-50 rounded border border-gray-200" title="Export PDF">
                                <FileDown className="w-5 h-5" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                    />
                </div>

                {/* Sort Button Removed - Headers are now clickable */}

                {/* Vehicle Type Filter */}
                <select
                    value={selectedVehicleType}
                    onChange={e => setSelectedVehicleType(e.target.value)}
                    className="py-1.5 px-3 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500 bg-white"
                >
                    <option value="All">All Types</option>
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary</option>
                </select>

                {/* Trip Count Filter */}
                <select
                    value={selectedTripCount}
                    onChange={e => setSelectedTripCount(e.target.value)}
                    className="py-1.5 px-3 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500 bg-white min-w-[120px]"
                >
                    <option value="All">All Trips</option>
                    {tripCounts.map(count => (
                        <option key={count} value={count}>{count} Trips</option>
                    ))}
                </select>

                {/* Zone Filter (Multi Select) */}
                <div className="relative" ref={zoneDropdownRef}>
                    <button
                        onClick={() => setIsZoneDropdownOpen(!isZoneDropdownOpen)}
                        className="py-1.5 px-3 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500 bg-white flex items-center gap-2 min-w-[150px] justify-between"
                    >
                        <span className="truncate max-w-[120px]">
                            {selectedZones.length === 0 ? 'All Zones' : `${selectedZones.length} Selected`}
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>

                    {isZoneDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg z-20 max-h-60 overflow-y-auto">
                            <div className="p-2 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
                                <span className="text-xs font-semibold text-gray-500">Select Zones</span>
                                <button
                                    onClick={() => setSelectedZones([])}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                    Clear
                                </button>
                            </div>
                            {zones.map(zone => (
                                <label key={zone} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedZones.includes(zone)}
                                        onChange={() => toggleZone(zone)}
                                        className="rounded border-gray-300 text-green-600 mr-2"
                                    />
                                    <span className="text-sm text-gray-700 truncate">{zone}</span>
                                </label>
                            ))}
                            {zones.length === 0 && <div className="p-3 text-xs text-gray-400 text-center">No zones found</div>}
                        </div>
                    )}
                </div>

                {/* Dump Site Filter (Multi Select) */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsDumpSiteDropdownOpen(!isDumpSiteDropdownOpen)}
                        className="py-1.5 px-3 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500 bg-white flex items-center gap-2 min-w-[150px] justify-between"
                    >
                        <span className="truncate max-w-[120px]">
                            {selectedDumpSites.length === 0 ? 'All Dump Sites' : `${selectedDumpSites.length} Selected`}
                        </span>
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                    </button>

                    {isDumpSiteDropdownOpen && (
                        <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded shadow-lg z-20 max-h-60 overflow-y-auto">
                            <div className="p-2 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
                                <span className="text-xs font-semibold text-gray-500">Select Dump Sites</span>
                                <button
                                    onClick={() => setSelectedDumpSites([])}
                                    className="text-xs text-blue-600 hover:text-blue-800"
                                >
                                    Clear
                                </button>
                            </div>
                            {dumpSites.map(site => (
                                <label key={site} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={selectedDumpSites.includes(site)}
                                        onChange={() => toggleDumpSite(site)}
                                        className="rounded border-gray-300 text-green-600 mr-2"
                                    />
                                    <span className="text-sm text-gray-700 truncate">{site}</span>
                                </label>
                            ))}
                            {dumpSites.length === 0 && <div className="p-3 text-xs text-gray-400 text-center">No dump sites found</div>}
                        </div>
                    )}
                </div>

                {/* Column Visibility Toggle */}
                <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded border border-gray-200">
                    <span className="text-xs font-semibold text-gray-600">Show:</span>
                    <label className="flex items-center gap-1 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showInTime}
                            onChange={e => setShowInTime(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">In Time</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showOutTime}
                            onChange={e => setShowOutTime(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">Out Time</span>
                    </label>
                </div>

                {/* Hide Zero Stats Checkbox */}
                <label className="flex items-center gap-2 cursor-pointer bg-red-50 px-3 py-1.5 rounded border border-red-200 hover:bg-red-100">
                    <input
                        type="checkbox"
                        checked={hideZeroStats}
                        onChange={e => setHideZeroStats(e.target.checked)}
                        className="rounded border-red-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-sm font-semibold text-red-700">Hide Zero Trips & Coverage</span>
                </label>

                <div className="ml-auto text-sm text-gray-500 self-center">
                    Count: {filteredData.length}
                </div>
            </div>

            {/* Excel-like Table */}
            <div className="flex-1 overflow-auto border border-gray-300 bg-white shadow-sm">
                <table className="w-full text-sm border-collapse text-black">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        {/* Report Header Row */}
                        <tr className="bg-white border-b border-gray-300">
                            <th colSpan={
                                7 +
                                (selectedVehicleType !== 'Secondary' ? 4 : 0) +
                                (showInTime ? 1 : 0) +
                                (showOutTime ? 1 : 0)
                            } className="p-4">
                                <div className="flex items-center justify-between px-4">
                                    <img src={nagarNigamLogo} alt="Nagar Nigam" className="h-16 w-auto object-contain" />
                                    <div className="text-center">
                                        <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide">Mathura-Vrindavan Nagar Nigam</h2>
                                        <h3 className="text-lg font-semibold text-gray-600">Daily Trip & Coverage Report</h3>
                                        <p className="text-sm text-gray-500 mt-1">Generated: {new Date().toLocaleString()}</p>
                                    </div>
                                    <img src={natureGreenLogo} alt="Nature Green" className="h-16 w-auto object-contain" />
                                </div>
                            </th>
                        </tr>
                        <tr>
                            <th onClick={() => requestSort('sNo')} className="cursor-pointer hover:bg-gray-200 border border-gray-400 px-2 py-2 font-bold text-black text-center w-12 user-select-none">S.No {getSortIcon('sNo')}</th>
                            <th onClick={() => requestSort('vehicleNumber')} className="cursor-pointer hover:bg-gray-200 border border-gray-400 px-2 py-2 font-bold text-black text-center min-w-[120px] user-select-none">Vehicle Number {getSortIcon('vehicleNumber')}</th>
                            <th onClick={() => requestSort('vehicleType')} className="cursor-pointer hover:bg-gray-200 border border-gray-400 px-2 py-2 font-bold text-black text-center min-w-[180px] user-select-none">Type {getSortIcon('vehicleType')}</th>
                            <th onClick={() => requestSort('zoneName')} className="cursor-pointer hover:bg-gray-200 border border-gray-400 px-2 py-2 font-bold text-black text-center user-select-none">Zone {getSortIcon('zoneName')}</th>
                            <th onClick={() => requestSort('wardName')} className="cursor-pointer hover:bg-gray-200 border border-gray-400 px-2 py-2 font-bold text-black text-center user-select-none">Ward {getSortIcon('wardName')}</th>
                            <th onClick={() => requestSort('tripCount')} className="cursor-pointer hover:bg-gray-200 border border-gray-400 px-2 py-2 font-bold text-black text-center w-16 user-select-none">Trips {getSortIcon('tripCount')}</th>
                            {selectedVehicleType !== 'Secondary' && (
                                <>
                                    <th onClick={() => requestSort('totalPoints')} className="cursor-pointer hover:bg-blue-200 border border-gray-400 px-2 py-2 font-bold text-black text-center w-16 bg-blue-100 user-select-none">Total HH {getSortIcon('totalPoints')}</th>
                                    <th onClick={() => requestSort('coveredPoints')} className="cursor-pointer hover:bg-green-200 border border-gray-400 px-2 py-2 font-bold text-black text-center w-16 bg-green-100 user-select-none">Cov {getSortIcon('coveredPoints')}</th>
                                    <th onClick={() => requestSort('notCoveredPoints')} className="cursor-pointer hover:bg-red-200 border border-gray-400 px-2 py-2 font-bold text-black text-center w-16 bg-red-100 user-select-none">Left {getSortIcon('notCoveredPoints')}</th>
                                    <th onClick={() => requestSort('coverage')} className="cursor-pointer hover:bg-gray-200 border border-gray-400 px-2 py-2 font-bold text-black text-center w-20 bg-gray-100 user-select-none">% {getSortIcon('coverage')}</th>
                                </>
                            )}
                            <th onClick={() => requestSort('dumpSiteName')} className="cursor-pointer hover:bg-gray-200 border border-gray-400 px-2 py-2 font-bold text-black text-center user-select-none">Dump Site {getSortIcon('dumpSiteName')}</th>
                            {showInTime && <th onClick={() => requestSort('tripInTime')} className="cursor-pointer hover:bg-gray-200 border border-gray-400 px-2 py-2 font-bold text-black text-center user-select-none">In Time {getSortIcon('tripInTime')}</th>}
                            {showOutTime && <th onClick={() => requestSort('tripOutTime')} className="cursor-pointer hover:bg-gray-200 border border-gray-400 px-2 py-2 font-bold text-black text-center user-select-none">Out Time {getSortIcon('tripOutTime')}</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-300">
                        {isLoading ? (
                            <tr>
                                <td colSpan={
                                    7 +
                                    (selectedVehicleType !== 'Secondary' ? 4 : 0) +
                                    (showInTime ? 1 : 0) +
                                    (showOutTime ? 1 : 0)
                                } className="p-12 text-center text-gray-500 font-medium">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                                        <span>Processing data, please wait...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredData.length > 0 ? (
                            filteredData.map((row, index) => (
                                <tr key={row.sNo} className="hover:bg-blue-50">
                                    <td className="border border-gray-300 px-2 py-1.5 text-center font-medium">{index + 1}</td>
                                    <td className="border border-gray-300 px-2 py-1.5 font-bold text-center">{row.vehicleNumber}</td>
                                    <td className="border border-gray-300 px-2 py-1.5 text-center truncate max-w-[200px]" title={row.vehicleType}>{row.vehicleType}</td>
                                    <td className="border border-gray-300 px-2 py-1.5 text-center truncate max-w-[150px]" title={row.zoneName}>{row.zoneName}</td>
                                    <td className="border border-gray-300 px-2 py-1.5 text-center truncate max-w-[150px]" title={row.wardName}>{row.wardName}</td>
                                    <td className="border border-gray-300 px-2 py-1.5 text-center font-bold">{row.tripCount > 0 ? row.tripCount : '-'}</td>
                                    {selectedVehicleType !== 'Secondary' && (
                                        <>
                                            <td className="border border-gray-300 px-2 py-1.5 text-center bg-blue-50 font-medium">{row.totalPoints !== '0' ? row.totalPoints : '-'}</td>
                                            <td className="border border-gray-300 px-2 py-1.5 text-center bg-green-50 text-green-800 font-bold">{row.coveredPoints !== '0' ? row.coveredPoints : '-'}</td>
                                            <td className="border border-gray-300 px-2 py-1.5 text-center bg-red-50 text-red-700 font-medium">{row.notCoveredPoints !== '0' ? row.notCoveredPoints : '-'}</td>
                                            <td className="border border-gray-300 px-2 py-1.5 text-center font-bold">
                                                {row.coverage !== '0' && row.coverage !== 'N/A' ? (
                                                    <span className={`${parseInt(row.coverage) >= 90 ? 'text-green-700' :
                                                        parseInt(row.coverage) >= 70 ? 'text-blue-700' :
                                                            parseInt(row.coverage) >= 50 ? 'text-yellow-700' : 'text-red-700'
                                                        }`}>
                                                        {row.coverage}%
                                                    </span>
                                                ) : '-'}
                                            </td>
                                        </>
                                    )}
                                    <td className="border border-gray-300 px-2 py-1.5 text-center truncate max-w-[150px]">{row.dumpSiteName}</td>
                                    {showInTime && <td className="border border-gray-300 px-2 py-1.5 text-center font-mono whitespace-pre-wrap">{row.tripInTime}</td>}
                                    {showOutTime && <td className="border border-gray-300 px-2 py-1.5 text-center font-mono whitespace-pre-wrap">{row.tripOutTime}</td>}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={
                                    7 +
                                    (selectedVehicleType !== 'Secondary' ? 4 : 0) +
                                    (showInTime ? 1 : 0) +
                                    (showOutTime ? 1 : 0)
                                } className="p-8 text-center text-gray-500 font-medium">
                                    {tripData.length === 0 && poiData.length === 0
                                        ? "Please upload Trip and POI reports to view analysis"
                                        : "No matching records found"}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="text-[10px] text-gray-400 text-center">
                Reports Buddy Pro &bull; {new Date().toLocaleDateString()}
            </div>
        </div>
    );
};

export default TripReport;
