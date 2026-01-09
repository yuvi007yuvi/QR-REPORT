import { useState, useMemo } from 'react';
import { FileUpload } from './FileUpload';
import { Calendar, Filter, Table as TableIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { MASTER_SUPERVISORS } from '../data/master-supervisors';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';

interface POIRecord {
    sno: string;
    zone: string;
    wardName: string;
    vehicleNumber: string;
    routeName: string;
    total: number;
    covered: number;
    notCovered: number;
    coverage: number;
    date: string;
    routeInTime: string;
    routeOutTime: string;
}

const DateWiseCoverageReport = () => {
    const [poiFile, setPoiFile] = useState<File | null>(null);
    const [poiData, setPoiData] = useState<POIRecord[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [selectedWard, setSelectedWard] = useState<string>('All');
    const [selectedZone, setSelectedZone] = useState<string>('All');
    const [selectedZonal, setSelectedZonal] = useState<string>('All');
    const [sortOrder, setSortOrder] = useState<'ward' | 'high-to-low' | 'low-to-high'>('ward');
    const [minPercentage, setMinPercentage] = useState<number>(0);
    const [maxPercentage, setMaxPercentage] = useState<number>(100);

    // Helper function to get supervisor and zonal from ward name
    const getSupervisorInfo = (wardName: string) => {
        // Extract ward number from ward name (e.g., "65-Holi Gali" -> "65")
        const wardNumberRaw = wardName.split('-')[0].trim();
        // Remove leading zeros (e.g., "01" -> "1")
        const wardNumber = String(parseInt(wardNumberRaw, 10));

        // Find supervisor for this ward (C&T department only)
        const supervisor = MASTER_SUPERVISORS.find(s => {
            if (s.department !== 'C&T') return false; // Only C&T department
            const wards = s.ward.split(',').map(w => w.trim());
            return wards.includes(wardNumber);
        });

        return {
            supervisor: supervisor?.name || '-',
            zonal: supervisor?.zonal || '-'
        };
    };

    // Helper function to convert Excel serial date to DD-MM-YYYY
    const excelDateToJSDate = (serial: number): string => {
        // Excel date formula: days since 1900-01-01 (with 1900 leap year bug)
        const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
        const days = Math.floor(serial);
        const milliseconds = days * 24 * 60 * 60 * 1000;
        const date = new Date(excelEpoch.getTime() + milliseconds);

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        return `${day}-${month}-${year}`;
    };

    const handleFileProcess = async () => {
        if (!poiFile) return;

        setLoading(true);
        try {
            const data = await poiFile.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const records: POIRecord[] = jsonData.map((row: any) => {
                // Handle date - could be string or Excel serial number
                let dateValue = row['Date'];
                let formattedDate = '';

                if (typeof dateValue === 'number') {
                    // It's an Excel serial date
                    formattedDate = excelDateToJSDate(dateValue);
                } else if (typeof dateValue === 'string') {
                    // It's already a string, use as-is
                    formattedDate = dateValue;
                } else {
                    formattedDate = String(dateValue || '');
                }

                return {
                    sno: String(row['S.No.'] || ''),
                    zone: String(row['Zone & Circle'] || ''),
                    wardName: String(row['Ward Name'] || ''),
                    vehicleNumber: String(row['Vehicle Number'] || ''),
                    routeName: String(row['Route Name'] || ''),
                    total: Number(row['Total']) || 0,
                    covered: Number(row['Covered']) || 0,
                    notCovered: Number(row['Not Covered']) || 0,
                    coverage: Number(row['Coverage']) || 0,
                    date: formattedDate,
                    routeInTime: String(row['Route In Time'] || ''),
                    routeOutTime: String(row['Route Out Time'] || ''),
                };
            });

            setPoiData(records);
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing file. Please check the format.');
        } finally {
            setLoading(false);
        }
    };

    // Get unique values for filters
    const { wards, zones, dates, zonals } = useMemo(() => {
        const wards = Array.from(new Set(poiData.map(r => r.wardName))).sort();
        const zones = Array.from(new Set(poiData.map(r => r.zone))).sort();
        const dates = Array.from(new Set(poiData.map(r => r.date))).sort((a, b) => {
            // Parse DD-MM-YYYY format
            const [dayA, monthA, yearA] = a.split('-').map(Number);
            const [dayB, monthB, yearB] = b.split('-').map(Number);
            const dateA = new Date(yearA, monthA - 1, dayA);
            const dateB = new Date(yearB, monthB - 1, dayB);
            return dateA.getTime() - dateB.getTime();
        });

        // Get unique zonals from C&T supervisors
        const zonalSet = new Set<string>();
        wards.forEach(ward => {
            const { zonal } = getSupervisorInfo(ward);
            if (zonal !== '-') zonalSet.add(zonal);
        });
        const zonals = Array.from(zonalSet).sort();

        return { wards, zones, dates, zonals };
    }, [poiData]);

    // Filter data based on selections
    const filteredData = useMemo(() => {
        return poiData.filter(record => {
            if (selectedWard !== 'All' && record.wardName !== selectedWard) return false;
            if (selectedZone !== 'All' && record.zone !== selectedZone) return false;

            // Filter by zonal
            if (selectedZonal !== 'All') {
                const { zonal } = getSupervisorInfo(record.wardName);
                if (zonal !== selectedZonal) return false;
            }

            return true;
        });
    }, [poiData, selectedWard, selectedZone, selectedZonal]);

    // Table data: Each unique route as a row with date values as columns
    const tableData = useMemo(() => {
        const routeMap = new Map<string, {
            wardName: string;
            vehicleNumber: string;
            routeName: string;
            supervisor: string;
            zonal: string;
            zone: string;
            total: number;
            dateValues: Map<string, number>;
        }>();

        filteredData.forEach(record => {
            // Create unique key for each route
            const key = `${record.wardName}|${record.vehicleNumber}|${record.routeName}`;

            if (!routeMap.has(key)) {
                const { supervisor, zonal } = getSupervisorInfo(record.wardName);
                routeMap.set(key, {
                    wardName: record.wardName,
                    vehicleNumber: record.vehicleNumber,
                    routeName: record.routeName,
                    supervisor: supervisor,
                    zonal: zonal,
                    zone: record.zone,
                    total: 0,
                    dateValues: new Map(),
                });
            }

            const routeData = routeMap.get(key)!;
            routeData.total = record.total; // Use total from record (same for all dates)
            const coverage = record.total > 0 ? Math.round((record.covered / record.total) * 100) : 0;
            routeData.dateValues.set(record.date, coverage);
        });

        // Convert to array
        let result = Array.from(routeMap.entries())
            .map(([key, data]) => {
                // Calculate average coverage across all dates
                const coverages = Array.from(data.dateValues.values());
                const avgCoverage = coverages.length > 0
                    ? Math.round(coverages.reduce((sum, val) => sum + val, 0) / coverages.length)
                    : 0;
                return { key, ...data, avgCoverage };
            });

        // Apply percentage filter
        result = result.filter(row =>
            row.avgCoverage >= minPercentage && row.avgCoverage <= maxPercentage
        );

        // Apply sorting
        if (sortOrder === 'high-to-low') {
            result.sort((a, b) => b.avgCoverage - a.avgCoverage);
        } else if (sortOrder === 'low-to-high') {
            result.sort((a, b) => a.avgCoverage - b.avgCoverage);
        } else {
            result.sort((a, b) => a.wardName.localeCompare(b.wardName));
        }

        return result;
    }, [filteredData, dates, sortOrder, minPercentage, maxPercentage]);

    // Export to Excel
    const exportToExcel = () => {
        if (tableData.length === 0) return;

        const excelData = tableData.map((row, index) => {
            const rowData: any = {
                'Sr. No.': index + 1,
                'Ward Name': row.wardName,
                'Vehicle Number': row.vehicleNumber,
                'Route Name': row.routeName,
                'Supervisor': row.supervisor,
                'Zonal': row.zonal,
                'Zone': row.zone,
                'Total': row.total,
            };

            dates.forEach(date => {
                const coverage = row.dateValues.get(date);
                rowData[date] = coverage !== undefined ? `${coverage}%` : '0%';
            });

            return rowData;
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Route Coverage');
        XLSX.writeFile(wb, `Coverage_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const getCellColor = (percentage: number) => {
        if (percentage === 0) return 'bg-red-100 text-red-800';
        if (percentage === 100) return 'bg-green-100 text-green-800';
        if (percentage >= 75) return 'bg-yellow-100 text-yellow-800';
        return 'bg-orange-100 text-orange-800';
    };

    if (poiData.length === 0) {
        return (
            <div className="max-w-2xl mx-auto mt-10">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Calendar className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">
                        Date-wise Coverage Report
                    </h2>
                    <p className="text-gray-500 mb-8 text-center max-w-md mx-auto">
                        Upload POI report CSV to view route-level coverage data across all dates.
                    </p>

                    <FileUpload
                        label="POI Report CSV"
                        file={poiFile}
                        onFileSelect={setPoiFile}
                        required
                    />

                    <button
                        onClick={handleFileProcess}
                        disabled={!poiFile || loading}
                        className={`w-full mt-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${!poiFile || loading
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 hover:shadow-xl active:scale-95'
                            }`}
                    >
                        {loading ? 'Processing...' : 'Generate Report'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Nagar Nigam Header */}
            <div className="bg-white border-b-4 border-gray-300 p-6">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    {/* Left Logo - Nagar Nigam */}
                    <div className="flex-shrink-0">
                        <div className="flex flex-col items-center">
                            <img
                                src={nagarNigamLogo}
                                alt="Nagar Nigam Logo"
                                className="w-24 h-24 object-contain"
                            />
                            <div className="text-xs font-bold text-gray-800 mt-2 text-center uppercase tracking-wider">
                                Nagar Nigam<br />Mathura-Vrindavan
                            </div>
                        </div>
                    </div>

                    {/* Center Heading */}
                    <div className="flex-1 text-center px-8">
                        <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight mb-2 uppercase scale-y-110">
                            Mathura Vrindavan Nagar Nigam
                        </h1>
                        <div className="inline-block border-b-2 border-green-600 pb-1">
                            <h2 className="text-xl md:text-2xl font-bold text-green-700 tracking-widest uppercase">
                                Date Wise Coverage Report
                            </h2>
                        </div>
                    </div>

                    {/* Right Logo - Nature Green */}
                    <div className="flex-shrink-0">
                        <div className="flex flex-col items-center">
                            <img
                                src={natureGreenLogo}
                                alt="Nature Green Logo"
                                className="w-24 h-24 object-contain"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                            <TableIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Route-wise Coverage Report</h2>
                            <p className="text-sm text-gray-500">{dates.length} dates • {tableData.length} routes</p>
                        </div>
                    </div>
                    <button
                        onClick={exportToExcel}
                        className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-teal-700 transition-all shadow-md hover:shadow-lg"
                    >
                        Export to Excel
                    </button>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Filter by Ward
                        </label>
                        <select
                            value={selectedWard}
                            onChange={(e) => setSelectedWard(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                        >
                            <option value="All">All Wards ({wards.length})</option>
                            {wards.map(ward => (
                                <option key={ward} value={ward}>{ward}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Filter by Zone
                        </label>
                        <select
                            value={selectedZone}
                            onChange={(e) => setSelectedZone(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                        >
                            <option value="All">All Zones ({zones.length})</option>
                            {zones.map(zone => (
                                <option key={zone} value={zone}>Zone {zone}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Filter by Zonal
                        </label>
                        <select
                            value={selectedZonal}
                            onChange={(e) => setSelectedZonal(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                        >
                            <option value="All">All Zonals ({zonals.length})</option>
                            {zonals.map(zonal => (
                                <option key={zonal} value={zonal}>{zonal}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Sort Order
                        </label>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as 'ward' | 'high-to-low' | 'low-to-high')}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                        >
                            <option value="ward">Ward Name (A-Z)</option>
                            <option value="high-to-low">Coverage: High to Low</option>
                            <option value="low-to-high">Coverage: Low to High</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Coverage Range
                        </label>
                        <div className="flex gap-2 items-center">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={minPercentage}
                                onChange={(e) => setMinPercentage(Number(e.target.value))}
                                className="w-20 px-2 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                placeholder="Min"
                            />
                            <span className="text-gray-500">-</span>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={maxPercentage}
                                onChange={(e) => setMaxPercentage(Number(e.target.value))}
                                className="w-20 px-2 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                placeholder="Max"
                            />
                            <span className="text-xs text-gray-500">%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                        <thead>
                            <tr className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
                                <th className="px-3 py-2 text-center font-bold border border-yellow-600 sticky left-0 bg-yellow-500 z-10 min-w-[60px]">
                                    Sr. No.
                                </th>
                                <th className="px-3 py-2 text-left font-bold border border-yellow-600 min-w-[150px]">
                                    Ward Name
                                </th>
                                <th className="px-3 py-2 text-left font-bold border border-yellow-600 min-w-[120px]">
                                    Vehicle Number
                                </th>
                                <th className="px-3 py-2 text-left font-bold border border-yellow-600 min-w-[100px]">
                                    Route Name
                                </th>
                                <th className="px-3 py-2 text-left font-bold border border-yellow-600 min-w-[100px]">
                                    Supervisor
                                </th>
                                <th className="px-3 py-2 text-left font-bold border border-yellow-600 min-w-[100px]">
                                    Zonal
                                </th>
                                <th className="px-3 py-2 text-center font-bold border border-yellow-600">
                                    Zone
                                </th>
                                <th className="px-3 py-2 text-center font-bold border border-yellow-600">
                                    Total
                                </th>
                                {dates.map((date) => (
                                    <th key={date} className="px-2 py-2 text-center font-bold border border-yellow-600 min-w-[90px]">
                                        {date}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tableData.map((row, rowIndex) => (
                                <tr key={row.key} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-3 py-2 text-center font-bold text-gray-900 border border-gray-300 sticky left-0 bg-inherit">
                                        {rowIndex + 1}
                                    </td>
                                    <td className="px-3 py-2 font-semibold text-gray-900 border border-gray-300">
                                        {row.wardName}
                                    </td>
                                    <td className="px-3 py-2 text-gray-700 border border-gray-300">
                                        {row.vehicleNumber}
                                    </td>
                                    <td className="px-3 py-2 text-gray-700 border border-gray-300">
                                        {row.routeName}
                                    </td>
                                    <td className="px-3 py-2 text-gray-700 border border-gray-300">
                                        {row.supervisor}
                                    </td>
                                    <td className="px-3 py-2 text-gray-700 border border-gray-300">
                                        {row.zonal}
                                    </td>
                                    <td className="px-3 py-2 text-center text-gray-700 border border-gray-300">
                                        {row.zone}
                                    </td>
                                    <td className="px-3 py-2 text-center font-bold text-gray-900 border border-gray-300">
                                        {row.total}
                                    </td>
                                    {dates.map(date => {
                                        const value = row.dateValues.get(date) || 0;
                                        return (
                                            <td
                                                key={date}
                                                className={`px-2 py-2 text-center font-semibold border border-gray-300 ${getCellColor(value)}`}
                                            >
                                                {value}%
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DateWiseCoverageReport;
