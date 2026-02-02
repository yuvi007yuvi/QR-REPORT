import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Download, ArrowRightLeft, ChevronDown, Filter, X, FileDown } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { toJpeg } from 'html-to-image';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';
import supervisorData from '../data/supervisorData.json';

interface POIRecord {
    "Route Name": string;
    "Vehicle Number": string;
    "Date": string;
    "Ward Name": string;
    "Zone & Circle": string;
    "Coverage": string;
    "Total": string;
    "Covered": string;
    [key: string]: string;
}

interface RouteData {
    routeName: string;
    ward: string;
    zone: string;
    zonalIncharge: string;
    supervisor: string;
    vehicleChanges: number;
    uniqueVehicles: string[];
    vehicleHistory: Record<string, { vehicle: string; coverage: string; total: string; covered: string }>; // Date -> Data
}

const MultiSelect = ({ label, options, selected, onChange }: { label: string, options: string[], selected: string[], onChange: (val: string[]) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter(item => item !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-between gap-2 px-3 py-2 text-sm border rounded-lg min-w-[200px] bg-white transition-colors ${selected.length > 0 ? 'border-blue-500 ring-1 ring-blue-200' : 'border-gray-300 hover:border-gray-400'}`}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    <span className="font-medium text-gray-700 whitespace-nowrap">{label}</span>
                    {selected.length > 0 && (
                        <span className="px-1.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
                            {selected.length}
                        </span>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute z-50 w-64 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                    <div className="p-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center sticky top-0">
                        <span className="text-xs font-semibold text-gray-500 uppercase">Select {label}</span>
                        {selected.length > 0 && (
                            <button
                                onClick={() => onChange([])}
                                className="text-xs text-red-600 hover:text-red-700 font-medium"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                    <div className="p-1">
                        {options.map(option => (
                            <label key={option} className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50 rounded cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={selected.includes(option)}
                                    onChange={() => toggleOption(option)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className={`text-sm ${selected.includes(option) ? 'text-gray-900 font-medium' : 'text-gray-600 group-hover:text-gray-900'}`}>
                                    {option}
                                </span>
                            </label>
                        ))}
                        {options.length === 0 && (
                            <div className="px-3 py-4 text-sm text-center text-gray-400">
                                No options available
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export const VehicleChangeReport: React.FC = () => {
    const [data, setData] = useState<RouteData[]>([]);
    const [dates, setDates] = useState<string[]>([]);
    const [selectedZones, setSelectedZones] = useState<string[]>([]);
    const [selectedWards, setSelectedWards] = useState<string[]>([]);
    const [selectedZonalIncharge, setSelectedZonalIncharge] = useState<string[]>([]);
    const [selectedSupervisors, setSelectedSupervisors] = useState<string[]>([]);
    const [selectedChangeCounts, setSelectedChangeCounts] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState<string | null>(null);
    const reportRef = React.useRef<HTMLDivElement>(null);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setFileName(file.name);

        Papa.parse<POIRecord>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                processData(results.data);
                setLoading(false);
            },
            error: (error) => {
                console.error('Error parsing CSV:', error);
                setLoading(false);
            }
        });
    };

    const processData = (records: POIRecord[]) => {
        const routeMap = new Map<string, RouteData>();
        const uniqueDates = new Set<string>();

        // Create maps for name-based and number-based lookup
        const wardToZonalHead = new Map<string, string>();
        const wardToSupervisor = new Map<string, string>();
        const wardNoToZonalHead = new Map<string, string>();
        const wardNoToSupervisor = new Map<string, string>();

        supervisorData.forEach((item: any) => {
            const name = item["Ward Name"].trim();
            const no = String(item["Ward No"]).trim();
            wardToZonalHead.set(name, item["Zonal Head"]);
            wardToSupervisor.set(name, item["Supervisor"]);
            wardNoToZonalHead.set(no, item["Zonal Head"]);
            wardNoToSupervisor.set(no, item["Supervisor"]);
        });

        const ZONE_MAPPING: Record<string, string> = {
            '1': 'City Zone',
            '2': 'Bhuteswar Zone',
            '3': 'Aurangabad Zone',
            '4': 'Vrindavan Zone'
        };

        records.forEach(record => {
            const routeName = record["Route Name"];
            const vehicleNumber = record["Vehicle Number"];
            const date = record["Date"];
            // Extract Ward Name properly (sometimes it has number prefix "41-Dhaulipiau")
            const rawWard = record["Ward Name"] || '-';

            // Try to extract parts: "ID-Name" -> ID="41", Name="Dhaulipiau"
            let wardNamePart = rawWard;
            let wardNoPart = '';

            if (rawWard.includes('-')) {
                const parts = rawWard.split('-');
                if (parts.length >= 2) {
                    wardNoPart = parts[0].trim();
                    wardNamePart = parts[1].trim();
                }
            }

            // Try lookup by Name first, then by Number
            let zonalIncharge = wardToZonalHead.get(wardNamePart);
            let supervisor = wardToSupervisor.get(wardNamePart);

            if (!zonalIncharge && wardNoPart) {
                zonalIncharge = wardNoToZonalHead.get(wardNoPart);
            }
            if (!supervisor && wardNoPart) {
                supervisor = wardNoToSupervisor.get(wardNoPart);
            }

            zonalIncharge = zonalIncharge || 'Unknown';
            supervisor = supervisor || 'Unknown';

            const rawZone = record["Zone & Circle"] ? String(record["Zone & Circle"]).trim() : '';
            const zone = ZONE_MAPPING[rawZone] || rawZone || '-';
            const coverage = record["Coverage"] || '-';
            const total = record["Total"] || '0';
            const covered = record["Covered"] || '0';

            if (!routeName || !vehicleNumber || !date) return;

            uniqueDates.add(date);

            if (!routeMap.has(routeName)) {
                routeMap.set(routeName, {
                    routeName,
                    ward: record["Ward Name"] || '-',
                    zone,
                    zonalIncharge,
                    supervisor,
                    vehicleChanges: 0,
                    uniqueVehicles: [],
                    vehicleHistory: {}
                });
            }

            const routeInfo = routeMap.get(routeName)!;
            routeInfo.vehicleHistory[date] = { vehicle: vehicleNumber, coverage, total, covered };
        });

        // Sort dates to ensure chronological order for change calculation
        // Assuming date format DD-MM-YYYY
        const sortedDates = Array.from(uniqueDates).sort((a, b) => {
            const [d1, m1, y1] = a.split('-').map(Number);
            const [d2, m2, y2] = b.split('-').map(Number);
            return new Date(y1, m1 - 1, d1).getTime() - new Date(y2, m2 - 1, d2).getTime();
        });

        setDates(sortedDates);

        // Calculate changes and unique vehicles
        routeMap.forEach(route => {
            const vehicles = new Set<string>();
            let changes = 0;
            let lastVehicle = '';

            // Iterate through sorted dates to track changes
            sortedDates.forEach(date => {
                const dayInfo = route.vehicleHistory[date];
                if (dayInfo) {
                    const currentVehicle = dayInfo.vehicle;
                    vehicles.add(currentVehicle);
                    if (lastVehicle && lastVehicle !== currentVehicle) {
                        changes++;
                    }
                    lastVehicle = currentVehicle;
                }
            });

            route.uniqueVehicles = Array.from(vehicles);
            route.vehicleChanges = changes;
        });

        // Convert map to array and sort by Ward Name (A-Z), then Route Name
        const processededData = Array.from(routeMap.values()).sort((a, b) => {
            const wardCompare = a.ward.localeCompare(b.ward, undefined, { numeric: true, sensitivity: 'base' });
            if (wardCompare !== 0) return wardCompare;
            return a.routeName.localeCompare(b.routeName, undefined, { numeric: true, sensitivity: 'base' });
        });
        setData(processededData);
    };

    // Filter Logic
    const uniqueZones = React.useMemo(() => {
        return Array.from(new Set(data.map(d => d.zone))).sort().filter(Boolean);
    }, [data]);

    const uniqueWards = React.useMemo(() => {
        const wards = data
            .filter(d => selectedZones.length === 0 || selectedZones.includes(d.zone)) // Filter wards based on selected zone if any
            .map(d => d.ward);
        return Array.from(new Set(wards)).sort().filter(Boolean);
    }, [data, selectedZones]);

    const uniqueChangeCounts = React.useMemo(() => {
        const counts = Array.from(new Set(data.map(d => d.vehicleChanges))).sort((a, b) => a - b);
        return counts.map(c => c === 0 ? "No change" : c.toString());
    }, [data]);

    const uniqueZonalIncharges = React.useMemo(() => {
        return Array.from(new Set(data.map(d => d.zonalIncharge))).sort().filter(Boolean);
    }, [data]);

    const uniqueSupervisors = React.useMemo(() => {
        return Array.from(new Set(data.map(d => d.supervisor))).sort().filter(Boolean);
    }, [data]);

    const filteredData = React.useMemo(() => {
        return data.filter(item => {
            const matchZone = selectedZones.length === 0 || selectedZones.includes(item.zone);
            const matchWard = selectedWards.length === 0 || selectedWards.includes(item.ward);
            const matchIncharge = selectedZonalIncharge.length === 0 || selectedZonalIncharge.includes(item.zonalIncharge);
            const matchSupervisor = selectedSupervisors.length === 0 || selectedSupervisors.includes(item.supervisor);
            const changeVal = item.vehicleChanges === 0 ? "No change" : item.vehicleChanges.toString();
            const matchChange = selectedChangeCounts.length === 0 || selectedChangeCounts.includes(changeVal);
            return matchZone && matchWard && matchIncharge && matchSupervisor && matchChange;
        });
    }, [data, selectedZones, selectedWards, selectedZonalIncharge, selectedSupervisors, selectedChangeCounts]);

    const grandTotals = React.useMemo(() => {
        const totals: Record<string, { total: number; covered: number }> = {};

        filteredData.forEach(row => {
            dates.forEach(date => {
                if (!totals[date]) totals[date] = { total: 0, covered: 0 };
                const dayInfo = row.vehicleHistory[date];
                if (dayInfo) {
                    totals[date].total += parseInt(dayInfo.total) || 0;
                    totals[date].covered += parseInt(dayInfo.covered) || 0;
                }
            });
        });

        return totals;
    }, [filteredData, dates]);

    const exportToExcel = () => {
        if (filteredData.length === 0) return;

        // Prepare data for export
        const exportData = filteredData.map((row, index) => {
            const rowData: any = {
                'S.No.': index + 1,
                'Zone': row.zone,
                'Ward': row.ward,
                'Supervisor': row.supervisor,
                'Route Name': row.routeName,
                'Change Count': row.vehicleChanges === 0 ? 'No change' : row.vehicleChanges,
                'Unique Vehicles': row.uniqueVehicles.join(', ')
            };

            dates.forEach(date => {
                const info = row.vehicleHistory[date];
                rowData[date] = info ? `${info.vehicle}\nCov: ${info.coverage}%\nTotal: ${info.total}\nCovered: ${info.covered}` : '-';
            });

            return rowData;
        });

        // Add Grand Total row
        const totalRow: any = {
            'S.No.': '',
            'Zone': 'GRAND TOTAL',
            'Ward': '',
            'Supervisor': '',
            'Route Name': '',
            'Change Count': '',
            'Unique Vehicles': ''
        };

        dates.forEach(date => {
            const t = grandTotals[date];
            const percent = t.total > 0 ? Math.round((t.covered / t.total) * 100) : 0;
            totalRow[date] = `Total: ${t.total}\nCovered: ${t.covered}\nCov: ${percent}%`;
        });

        exportData.push(totalRow);

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Vehicle Changes");
        XLSX.writeFile(wb, "Vehicle_Change_Report.xlsx");
    };
    const handleExportPDF = async () => {
        if (!reportRef.current) return;
        try {
            const element = reportRef.current;
            const table = element.querySelector('table');

            // Calculate total dimensions required
            // We use the table's scrollWidth to ensure we capture all columns
            const totalWidth = table ? Math.max(element.scrollWidth, table.scrollWidth) + 40 : element.scrollWidth;
            const totalHeight = element.scrollHeight + 20;

            const dataUrl = await toJpeg(element, {
                quality: 0.95,
                backgroundColor: '#ffffff',
                width: totalWidth,
                height: totalHeight,
                style: {
                    overflow: 'visible', // Ensure no internal scrollbars clip content
                    height: 'auto',
                    maxHeight: 'none',
                    width: `${totalWidth}px`,
                    maxWidth: 'none'
                }
            });

            // Create PDF with custom dimensions matching the content
            // This ensures no shrinking occurs and all data is visible
            const pdf = new jsPDF({
                orientation: totalWidth > totalHeight ? 'l' : 'p',
                unit: 'px',
                format: [totalWidth, totalHeight]
            });

            pdf.addImage(dataUrl, 'JPEG', 0, 0, totalWidth, totalHeight);
            pdf.save(`Vehicle_Change_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (e) {
            console.error("PDF Export Error", e);
            alert("Export failed. Please try again or use Excel export.");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Vehicle Change Report</h2>
                    <p className="text-sm text-gray-500">Analyze vehicle changes per route date-wise</p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="hidden"
                            id="csv-upload"
                        />
                        <label
                            htmlFor="csv-upload"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
                        >
                            <Upload className="w-4 h-4" />
                            {loading ? 'Processing...' : 'Upload Report CSV'}
                        </label>
                    </div>
                    {data.length > 0 && (
                        <div className="flex gap-2">
                            <button
                                onClick={handleExportPDF}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                                <FileDown className="w-4 h-4" />
                                Export PDF
                            </button>
                            <button
                                onClick={exportToExcel}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                Export Excel
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {fileName && (
                <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
                    <FileSpreadsheet className="w-4 h-4" />
                    Active File: <span className="font-semibold">{fileName}</span>
                </div>
            )}

            {data.length > 0 ? (
                <div ref={reportRef} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                    {/* Report Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
                        <img src={NagarNigamLogo} alt="Nagar Nigam" className="h-10 object-contain md:h-12" />
                        <div className="text-center">
                            <h2 className="text-lg font-bold text-gray-800 uppercase md:text-xl">Vehicle Change Report</h2>
                            <p className="text-xs font-medium text-gray-500 md:text-sm">Mathura-Vrindavan Nagar Nigam</p>
                            {(selectedZones.length > 0 || selectedWards.length > 0 || selectedZonalIncharge.length > 0 || selectedSupervisors.length > 0 || selectedChangeCounts.length > 0) && (
                                <div className="mt-2 text-[10px] md:text-xs text-blue-700 bg-blue-50 px-3 py-1 rounded-full inline-block border border-blue-100 font-medium">
                                    <span className="font-bold text-gray-600">Applied Filters: </span>
                                    {selectedZones.length > 0 && <span className="mr-2">Zone: {selectedZones.length > 2 ? `${selectedZones.length} Selected` : selectedZones.join(', ')}</span>}
                                    {selectedZonalIncharge.length > 0 && <span className="mr-2">Incharge: {selectedZonalIncharge.length > 2 ? `${selectedZonalIncharge.length} Selected` : selectedZonalIncharge.join(', ')}</span>}
                                    {selectedWards.length > 0 && <span className="mr-2">Ward: {selectedWards.length > 2 ? `${selectedWards.length} Selected` : selectedWards.join(', ')}</span>}
                                    {selectedSupervisors.length > 0 && <span className="mr-2">Sup: {selectedSupervisors.length > 2 ? `${selectedSupervisors.length} Selected` : selectedSupervisors.join(', ')}</span>}
                                    {selectedChangeCounts.length > 0 && <span>Changes: {selectedChangeCounts.join(', ')}</span>}
                                </div>
                            )}
                        </div>
                        <img src={NatureGreenLogo} alt="Nature Green" className="h-10 object-contain md:h-12" />
                    </div>

                    {/* Filters Toolbar */}
                    <div className="flex gap-4 p-4 border-b border-gray-200 bg-gray-50 flex-wrap">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mr-2">
                            <Filter className="w-4 h-4" />
                            Filters:
                        </div>
                        <MultiSelect
                            label="Zone"
                            options={uniqueZones}
                            selected={selectedZones}
                            onChange={setSelectedZones}
                        />
                        <MultiSelect
                            label="Ward"
                            options={uniqueWards}
                            selected={selectedWards}
                            onChange={setSelectedWards}
                        />
                        <MultiSelect
                            label="Zonal Incharge"
                            options={uniqueZonalIncharges}
                            selected={selectedZonalIncharge}
                            onChange={setSelectedZonalIncharge}
                        />
                        <MultiSelect
                            label="Supervisor"
                            options={uniqueSupervisors}
                            selected={selectedSupervisors}
                            onChange={setSelectedSupervisors}
                        />
                        <MultiSelect
                            label="Change Count"
                            options={uniqueChangeCounts}
                            selected={selectedChangeCounts}
                            onChange={setSelectedChangeCounts}
                        />
                        {(selectedZones.length > 0 || selectedWards.length > 0 || selectedChangeCounts.length > 0 || selectedZonalIncharge.length > 0 || selectedSupervisors.length > 0) && (
                            <button
                                onClick={() => { setSelectedZones([]); setSelectedWards([]); setSelectedChangeCounts([]); setSelectedZonalIncharge([]); setSelectedSupervisors([]); }}
                                className="flex items-center gap-1 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                            >
                                <X className="w-4 h-4" />
                                Clear All
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto border border-black">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0 z-30">
                                <tr>
                                    <th className="px-2 py-1 border border-black min-w-[50px] sticky left-0 z-20 bg-gray-100 text-center">S.No.</th>
                                    <th className="px-2 py-1 border border-black min-w-[80px] sticky left-[50px] z-20 bg-gray-100">Zone</th>
                                    <th className="px-2 py-1 border border-black min-w-[140px] sticky left-[130px] z-20 bg-gray-100">Ward</th>
                                    <th className="px-2 py-1 border border-black min-w-[120px] sticky left-[270px] z-20 bg-gray-100">Supervisor</th>
                                    <th className="px-2 py-1 border border-black min-w-[180px] sticky left-[390px] z-20 bg-gray-100">Route Name</th>
                                    <th className="px-2 py-1 border border-black min-w-[70px] text-center bg-gray-100">Chg</th>
                                    <th className="px-2 py-1 border border-black min-w-[200px] bg-gray-100">Vehicles Used</th>
                                    {dates.map(date => (
                                        <th key={date} className="px-2 py-1 border border-black min-w-[130px] text-center bg-gray-100 whitespace-nowrap font-mono text-[11px]">
                                            {date}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {filteredData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-2 py-1.5 border border-black sticky left-0 bg-white z-10 text-center text-gray-500 font-medium">
                                            {idx + 1}
                                        </td>
                                        <td className="px-2 py-1.5 border border-black sticky left-[50px] bg-white z-10 font-medium text-gray-700 whitespace-nowrap">
                                            {row.zone}
                                        </td>
                                        <td className="px-2 py-1.5 border border-black sticky left-[130px] bg-white z-10 text-gray-700 truncate max-w-[140px]" title={row.ward}>
                                            {row.ward}
                                        </td>
                                        <td className="px-2 py-1.5 border border-black sticky left-[270px] bg-white z-10 text-gray-700 truncate max-w-[120px]" title={row.supervisor}>
                                            {row.supervisor}
                                        </td>
                                        <td className="px-2 py-1.5 border border-black sticky left-[390px] bg-white z-10 font-medium text-gray-900 truncate max-w-[180px]" title={row.routeName}>
                                            {row.routeName}
                                        </td>
                                        <td className="px-1 py-1 border border-black text-center font-mono">
                                            {row.vehicleChanges > 0 ? (
                                                <span className="text-red-600 font-bold">{row.vehicleChanges}</span>
                                            ) : (
                                                <span className="text-green-600 font-bold text-[10px] whitespace-nowrap">No change</span>
                                            )}
                                        </td>
                                        <td className="px-2 py-1 border border-black text-gray-500 text-[10px] break-words max-w-[200px]">
                                            {row.uniqueVehicles.join(', ')}
                                        </td>
                                        {dates.map((date, dateIdx) => {
                                            const dayInfo = row.vehicleHistory[date];
                                            const vehicle = dayInfo?.vehicle;
                                            const coverage = dayInfo?.coverage;
                                            const total = dayInfo?.total;
                                            const covered = dayInfo?.covered;

                                            const prevDayInfo = dateIdx > 0 ? row.vehicleHistory[dates[dateIdx - 1]] : null;
                                            const prevVehicle = prevDayInfo?.vehicle;

                                            const isChanged = prevVehicle && vehicle && prevVehicle !== vehicle;

                                            return (
                                                <td key={date} className={`px-2 py-1 border border-black valign-top ${isChanged ? 'bg-red-50' : ''}`}>
                                                    {vehicle ? (
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center justify-between">
                                                                <span className={`text-[11px] font-mono leading-none ${isChanged ? 'font-bold text-black' : 'text-gray-900'}`}>
                                                                    {vehicle}
                                                                </span>
                                                                {isChanged && <ArrowRightLeft className="w-3 h-3 text-red-600" />}
                                                            </div>
                                                            <div className="grid grid-cols-3 gap-1 text-[10px] items-center border-t border-black pt-0.5 mt-0.5 text-black">
                                                                <span className={`col-span-1 font-bold ${parseInt(coverage) <= 30 ? 'text-red-600' :
                                                                    parseInt(coverage) <= 60 ? 'text-gray-500' :
                                                                        parseInt(coverage) <= 80 ? 'text-blue-600' : 'text-green-600'
                                                                    }`}>
                                                                    {coverage}%
                                                                </span>
                                                                <span className="col-span-1 text-center font-medium" title="Total">T:{total}</span>
                                                                <span className="col-span-1 text-right font-medium" title="Covered">C:{covered}</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-center text-gray-300">-</div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 font-bold sticky bottom-0 z-40 border-t-2 border-black shadow-[0_-2px_4px_rgba(0,0,0,0.1)]">
                                <tr>
                                    <td colSpan={7} className="px-4 py-3 text-right bg-gray-200 border border-black text-gray-800 uppercase tracking-wider text-xs">
                                        Grand Total
                                    </td>
                                    {dates.map(date => {
                                        const t = grandTotals[date];
                                        const percent = t.total > 0 ? Math.round((t.covered / t.total) * 100) : 0;
                                        return (
                                            <td key={date} className="px-2 py-2 border border-black bg-gray-50">
                                                <div className="flex flex-col gap-1 text-[10px] items-center text-center">
                                                    <span className={`font-bold text-xs ${percent <= 30 ? 'text-red-600' :
                                                        percent <= 60 ? 'text-gray-500' :
                                                            percent <= 80 ? 'text-blue-600' : 'text-green-600'
                                                        }`}>
                                                        {percent}%
                                                    </span>
                                                    <div className="flex justify-between w-full px-1 text-gray-600 gap-2">
                                                        <span>T: {t.total.toLocaleString()}</span>
                                                        <span>C: {t.covered.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <div className="p-4 border-t border-black bg-gray-50 text-xs text-gray-500 flex justify-between">
                        <span>Showing {filteredData.length} routes</span>
                        <span>Total Dates: {dates.length}</span>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center p-12 bg-white rounded-lg border-2 border-dashed border-gray-300 text-gray-500 min-h-[300px]">
                    {loading ? (
                        <div className="animate-pulse">Processing data...</div>
                    ) : (
                        <>
                            <FileSpreadsheet className="w-12 h-12 mb-4 text-gray-400" />
                            <p className="text-lg font-medium text-gray-700">No data to display</p>
                            <p className="mb-4">Upload the POI Report CSV to generate the Vehicle Change Analysis</p>
                            <div className="text-xs text-center p-4 bg-gray-50 rounded text-gray-600 max-w-md">
                                <strong>Expected Columns:</strong> Check inside current file structure like <br />
                                "Route Name", "Vehicle Number", "Date", "Ward Name", "Zone & Circle", "Total", "Covered", "Coverage"
                            </div>
                        </>
                    )}
                </div>
            )
            }
        </div >
    );
};

export default VehicleChangeReport;
