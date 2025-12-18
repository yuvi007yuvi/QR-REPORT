import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { Upload, Download, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import supervisorDataJson from '../data/supervisorData.json';
import * as XLSX from 'xlsx';

interface POIRow {
    "S.No.": string;
    "Zone & Circle": string;
    "Ward Name": string;
    "Vehicle Number": string;
    "Route Name": string;
    "Total": string;
    "Covered": string;
    "Not Covered": string;
    "Coverage": string;
    "Date": string;
    "Start Time": string;
    "End Time": string;
}

interface AggregatedStats {
    supervisorName: string;
    zonalHead: string;
    zone: string;
    total: number;
    covered: number;
    notCovered: number;
    wardCount: number;
    wards: string[];
    vehicles: string[];
}

interface WardStats {
    wardNumber: string;
    wardName: string;
    supervisorName: string;
    zonalHead: string;
    total: number;
    covered: number;
    notCovered: number;
    vehicles: string[];
}

export const CoverageReport: React.FC = () => {
    const [stats, setStats] = useState<AggregatedStats[]>([]);
    const [wardStats, setWardStats] = useState<WardStats[]>([]);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState<string>('');
    const [viewType, setViewType] = useState<'supervisor' | 'ward'>('supervisor');

    // Create Ward -> Supervisor Lookup
    const wardLookup = useMemo(() => {
        const lookup = new Map<string, { supervisor: string; zonalHead: string }>();
        supervisorDataJson.forEach((item: any) => {
            // Normalize Ward No to string
            lookup.set(String(item["Ward No"]), {
                supervisor: item.Supervisor,
                zonalHead: item["Zonal Head"]
            });
        });
        return lookup;
    }, []);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setLoading(true);

        Papa.parse<POIRow>(file, {
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

    const processData = (rows: POIRow[]) => {
        const supervisorMap = new Map<string, AggregatedStats>();
        const wardMap = new Map<string, WardStats>();

        rows.forEach(row => {
            const wardNameStr = row["Ward Name"];
            if (!wardNameStr) return;

            // Extract Ward Number (e.g., "18" from "18-General ganj")
            const wardMatch = wardNameStr.match(/^(\d+)/);
            if (!wardMatch) return; // Skip if no number found

            const wardNum = wardMatch[1];
            const vehicle = row["Vehicle Number"];

            // Find Supervisor
            const supervisorInfo = wardLookup.get(wardNum) || {
                supervisor: 'Unmapped',
                zonalHead: 'Unmapped'
            };

            // --- Supervisor Aggregation ---
            const supKey = `${supervisorInfo.zonalHead}-${supervisorInfo.supervisor}`;

            if (!supervisorMap.has(supKey)) {
                supervisorMap.set(supKey, {
                    supervisorName: supervisorInfo.supervisor,
                    zonalHead: supervisorInfo.zonalHead,
                    zone: row["Zone & Circle"] || 'Unknown',
                    total: 0,
                    covered: 0,
                    notCovered: 0,
                    wardCount: 0,
                    wards: [],
                    vehicles: []
                });
            }

            const supEntry = supervisorMap.get(supKey)!;
            supEntry.total += Number(row.Total) || 0;
            supEntry.covered += Number(row.Covered) || 0;
            supEntry.notCovered += Number(row["Not Covered"]) || 0;

            if (!supEntry.wards.includes(wardNum)) {
                supEntry.wards.push(wardNum);
                supEntry.wardCount++;
            }
            if (vehicle && !supEntry.vehicles.includes(vehicle)) {
                supEntry.vehicles.push(vehicle);
            }

            // --- Ward Aggregation ---
            if (!wardMap.has(wardNum)) {
                wardMap.set(wardNum, {
                    wardNumber: wardNum,
                    wardName: row["Ward Name"],
                    supervisorName: supervisorInfo.supervisor,
                    zonalHead: supervisorInfo.zonalHead,
                    total: 0,
                    covered: 0,
                    notCovered: 0,
                    vehicles: []
                });
            }

            const wardEntry = wardMap.get(wardNum)!;
            wardEntry.total += Number(row.Total) || 0;
            wardEntry.covered += Number(row.Covered) || 0;
            wardEntry.notCovered += Number(row["Not Covered"]) || 0;
            if (vehicle && !wardEntry.vehicles.includes(vehicle)) {
                wardEntry.vehicles.push(vehicle);
            }
        });

        // Convert Maps to Arrays and Sort
        const sortedSupervisorStats = Array.from(supervisorMap.values()).sort((a, b) => {
            if (a.zonalHead !== b.zonalHead) {
                return a.zonalHead.localeCompare(b.zonalHead);
            }
            const covA = a.total > 0 ? (a.covered / a.total) : 0;
            const covB = b.total > 0 ? (b.covered / b.total) : 0;
            return covB - covA;
        });

        const sortedWardStats = Array.from(wardMap.values()).sort((a, b) => {
            // Sort by Zonal Head, then Supervisor, then Ward Number
            if (a.zonalHead !== b.zonalHead) return a.zonalHead.localeCompare(b.zonalHead);
            if (a.supervisorName !== b.supervisorName) return a.supervisorName.localeCompare(b.supervisorName);
            return Number(a.wardNumber) - Number(b.wardNumber);
        });

        setStats(sortedSupervisorStats);
        setWardStats(sortedWardStats);
    };

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Supervisor Wise
        const supervisorData = stats.map(item => ({
            "Zonal Head": item.zonalHead,
            "Supervisor": item.supervisorName,
            "Wards Count": item.wardCount,
            "Assigned Vehicles": item.vehicles.join(", "),
            "Total Points": item.total,
            "Covered": item.covered,
            "Not Covered": item.notCovered,
            "Coverage %": item.total > 0 ? ((item.covered / item.total) * 100).toFixed(2) + '%' : '0%'
        }));
        const wsSupervisor = XLSX.utils.json_to_sheet(supervisorData);
        XLSX.utils.book_append_sheet(wb, wsSupervisor, "Supervisor Wise");

        // Sheet 2: Ward Wise
        const wardData = wardStats.map(item => ({
            "Zonal Head": item.zonalHead,
            "Supervisor": item.supervisorName,
            "Ward": item.wardName,
            "Assigned Vehicles": item.vehicles.join(", "),
            "Total Points": item.total,
            "Covered": item.covered,
            "Not Covered": item.notCovered,
            "Coverage %": item.total > 0 ? ((item.covered / item.total) * 100).toFixed(2) + '%' : '0%'
        }));
        const wsWard = XLSX.utils.json_to_sheet(wardData);
        XLSX.utils.book_append_sheet(wb, wsWard, "Ward Wise");

        XLSX.writeFile(wb, "Coverage_Report.xlsx");
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">Coverage Analysis</h2>
                        <p className="text-gray-500 text-sm mt-1">
                            Upload POI Report CSV to generate Supervisor & Ward wise coverage stats.
                        </p>
                    </div>
                </div>

                {/* File Upload Area */}
                {stats.length === 0 && (
                    <div className="flex items-center justify-center w-full mb-8">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-8 h-8 mb-3 text-gray-400" />
                                <p className="mb-2 text-sm text-gray-500">
                                    <span className="font-semibold">Click to upload POI CSV</span> or drag and drop
                                </p>
                                <p className="text-xs text-gray-500">
                                    {fileName || "Supported format: .csv"}
                                </p>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                accept=".csv"
                                onChange={handleFileUpload}
                                disabled={loading}
                            />
                        </label>
                    </div>
                )}

                {stats.length > 0 && (
                    <>
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                            {/* View Toggle */}
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => setViewType('supervisor')}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewType === 'supervisor'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    Supervisor Wise
                                </button>
                                <button
                                    onClick={() => setViewType('ward')}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewType === 'ward'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    Ward Wise
                                </button>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        setStats([]);
                                        setWardStats([]);
                                        setFileName('');
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors shadow-sm"
                                >
                                    <Upload className="w-4 h-4" />
                                    Upload New
                                </button>
                                <button
                                    onClick={exportToExcel}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                                >
                                    <Download className="w-4 h-4" />
                                    Export Excel
                                </button>
                            </div>
                        </div>

                        {viewType === 'supervisor' ? (
                            <div className="overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-600 font-medium">
                                        <tr>
                                            <th className="p-4 border-b">Zonal Head</th>
                                            <th className="p-4 border-b">Supervisor Name</th>
                                            <th className="p-4 border-b text-center">Wards(Count)</th>
                                            <th className="p-4 border-b">Assigned Vehicles</th>
                                            <th className="p-4 border-b text-right">Total Points</th>
                                            <th className="p-4 border-b text-right">Covered</th>
                                            <th className="p-4 border-b text-right">Not Covered</th>
                                            <th className="p-4 border-b text-right">Coverage %</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {stats.map((row, index) => {
                                            const coverage = row.total > 0 ? (row.covered / row.total) * 100 : 0;
                                            const isHigh = coverage >= 90;
                                            const isLow = coverage < 75;

                                            return (
                                                <tr key={index} className="hover:bg-gray-50 transition-colors">
                                                    <td className="p-4 font-medium text-gray-900">{row.zonalHead}</td>
                                                    <td className="p-4 font-semibold text-gray-800">{row.supervisorName}</td>
                                                    <td className="p-4 text-center text-gray-600">
                                                        <span className="bg-gray-100 px-2 py-1 rounded-full text-xs font-semibold">
                                                            {row.wardCount}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-gray-600 text-xs max-w-xs break-words">
                                                        {row.vehicles.join(", ")}
                                                    </td>
                                                    <td className="p-4 text-right font-mono">{row.total}</td>
                                                    <td className="p-4 text-right font-mono text-green-600">{row.covered}</td>
                                                    <td className="p-4 text-right font-mono text-red-500">{row.notCovered}</td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className={`font-bold ${isHigh ? 'text-green-600' : isLow ? 'text-red-600' : 'text-yellow-600'}`}>
                                                                {coverage.toFixed(1)}%
                                                            </span>
                                                            {isHigh ? <TrendingUp className="w-4 h-4 text-green-500" /> :
                                                                isLow ? <AlertCircle className="w-4 h-4 text-red-500" /> :
                                                                    <TrendingDown className="w-4 h-4 text-yellow-500" />}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {stats.map((supervisor, sIndex) => {
                                    const supervisorWards = wardStats.filter(w => w.supervisorName === supervisor.supervisorName);
                                    if (supervisorWards.length === 0) return null;

                                    const supCoverage = supervisor.total > 0 ? (supervisor.covered / supervisor.total) * 100 : 0;
                                    const isSupHigh = supCoverage >= 90;
                                    const isSupLow = supCoverage < 75;

                                    return (
                                        <div key={sIndex} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                            {/* Supervisor Header */}
                                            <div className="bg-gray-50 p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="text-lg font-bold text-gray-900">{supervisor.supervisorName}</h3>
                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                                                            {supervisor.zonalHead}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-500 mt-1">
                                                        Vehicles: {supervisor.vehicles.join(", ")}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-6 text-sm">
                                                    <div className="text-gray-600">
                                                        <span className="block text-xs text-gray-400 uppercase">Wards</span>
                                                        <span className="font-semibold">{supervisor.wardCount}</span>
                                                    </div>
                                                    <div className="text-gray-600 text-right">
                                                        <span className="block text-xs text-gray-400 uppercase">Total Points</span>
                                                        <span className="font-mono">{supervisor.total}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="block text-xs text-gray-400 uppercase">Coverage</span>
                                                        <div className={`flex items-center gap-1 font-bold ${isSupHigh ? 'text-green-600' : isSupLow ? 'text-red-600' : 'text-yellow-600'}`}>
                                                            {supCoverage.toFixed(1)}%
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Wards Table */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-white text-gray-500 border-b border-gray-100">
                                                        <tr>
                                                            <th className="p-3 pl-4 font-medium">Ward Name</th>
                                                            <th className="p-3 font-medium">Assigned Vehicles</th>
                                                            <th className="p-3 text-right font-medium">Total</th>
                                                            <th className="p-3 text-right font-medium">Covered</th>
                                                            <th className="p-3 text-right font-medium">Not Covered</th>
                                                            <th className="p-3 pr-4 text-right font-medium">Coverage %</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {supervisorWards.map((ward, wIndex) => {
                                                            const coverage = ward.total > 0 ? (ward.covered / ward.total) * 100 : 0;
                                                            const isHigh = coverage >= 90;
                                                            const isLow = coverage < 75;

                                                            return (
                                                                <tr key={wIndex} className="hover:bg-gray-50">
                                                                    <td className="p-3 pl-4 font-medium text-gray-800">{ward.wardName}</td>
                                                                    <td className="p-3 text-gray-500 text-xs">{ward.vehicles.join(", ")}</td>
                                                                    <td className="p-3 text-right font-mono text-gray-600">{ward.total}</td>
                                                                    <td className="p-3 text-right font-mono text-green-600">{ward.covered}</td>
                                                                    <td className="p-3 text-right font-mono text-red-500">{ward.notCovered}</td>
                                                                    <td className="p-3 pr-4 text-right">
                                                                        <span className={`font-semibold ${isHigh ? 'text-green-600' : isLow ? 'text-red-600' : 'text-yellow-600'}`}>
                                                                            {coverage.toFixed(1)}%
                                                                        </span>
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
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
