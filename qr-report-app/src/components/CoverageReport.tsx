import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { Upload, Download, TrendingUp, TrendingDown, CheckCircle, AlertCircle, MapPin } from 'lucide-react';
import supervisorDataJson from '../data/supervisorData.json';
import * as XLSX from 'xlsx';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';

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
    routeName: string;
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
    const [selectedZone, setSelectedZone] = useState('All');
    const [selectedSupervisor, setSelectedSupervisor] = useState('All');
    const [selectedWard, setSelectedWard] = useState('All');

    // Create Ward -> Supervisor Lookup
    const wardLookup = useMemo(() => {
        const lookup = new Map<string, { supervisor: string; zonalHead: string }>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

            // Normalize ward number by removing leading zeros (e.g., "01" -> "1")
            const wardNum = String(Number(wardMatch[1]));
            const vehicle = row["Vehicle Number"];
            const routeName = row["Route Name"] || "-";

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

            // --- Ward Route Aggregation ---
            const wardRouteKey = `${wardNum}_${routeName}`;
            if (!wardMap.has(wardRouteKey)) {
                wardMap.set(wardRouteKey, {
                    wardNumber: wardNum,
                    wardName: row["Ward Name"],
                    routeName: routeName,
                    supervisorName: supervisorInfo.supervisor,
                    zonalHead: supervisorInfo.zonalHead,
                    total: 0,
                    covered: 0,
                    notCovered: 0,
                    vehicles: []
                });
            }

            const wardEntry = wardMap.get(wardRouteKey)!;
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
            // Sort by Zonal Head, then Supervisor, then Ward Number, then Route
            if (a.zonalHead !== b.zonalHead) return a.zonalHead.localeCompare(b.zonalHead);
            if (a.supervisorName !== b.supervisorName) return a.supervisorName.localeCompare(b.supervisorName);
            if (Number(a.wardNumber) !== Number(b.wardNumber)) return Number(a.wardNumber) - Number(b.wardNumber);
            return a.routeName.localeCompare(b.routeName);
        });

        setStats(sortedSupervisorStats);
        setWardStats(sortedWardStats);
    };

    // --- Filters & Derived Data ---
    const zones = useMemo(() => ['All', ...Array.from(new Set(stats.map(s => s.zonalHead))).sort()], [stats]);

    const supervisors = useMemo(() => {
        let filtered = stats;
        if (selectedZone !== 'All') filtered = filtered.filter(s => s.zonalHead === selectedZone);
        return ['All', ...Array.from(new Set(filtered.map(s => s.supervisorName))).sort()];
    }, [stats, selectedZone]);

    const wards = useMemo(() => {
        let filtered = wardStats;
        if (selectedZone !== 'All') filtered = filtered.filter(w => w.zonalHead === selectedZone);
        if (selectedSupervisor !== 'All') filtered = filtered.filter(w => w.supervisorName === selectedSupervisor);
        return ['All', ...Array.from(new Set(filtered.map(w => w.wardNumber))).sort((a, b) => Number(a) - Number(b))];
    }, [wardStats, selectedZone, selectedSupervisor]);

    const filteredStats = useMemo(() => {
        return stats.filter(item => {
            if (selectedZone !== 'All' && item.zonalHead !== selectedZone) return false;
            if (selectedSupervisor !== 'All' && item.supervisorName !== selectedSupervisor) return false;
            if (selectedWard !== 'All' && !item.wards.includes(selectedWard)) return false;
            return true;
        });
    }, [stats, selectedZone, selectedSupervisor, selectedWard]);

    const filteredWardStats = useMemo(() => {
        return wardStats.filter(item => {
            if (selectedZone !== 'All' && item.zonalHead !== selectedZone) return false;
            if (selectedSupervisor !== 'All' && item.supervisorName !== selectedSupervisor) return false;
            if (selectedWard !== 'All' && item.wardNumber !== selectedWard) return false;
            return true;
        });
    }, [wardStats, selectedZone, selectedSupervisor, selectedWard]);

    // --- Chart Data Preparation ---
    const chartData = useMemo(() => {
        const total = filteredStats.reduce((sum, item) => sum + item.total, 0);
        const covered = filteredStats.reduce((sum, item) => sum + item.covered, 0);
        const notCovered = filteredStats.reduce((sum, item) => sum + item.notCovered, 0);
        const coverage = total > 0 ? Math.round((covered / total) * 100) : 0;

        // Group by Zonal Head for the Bar Chart
        const zonalData: Record<string, { total: number, covered: number, notCovered: number }> = {};
        filteredStats.forEach(stat => {
            const head = stat.zonalHead || 'Unassigned';
            if (!zonalData[head]) zonalData[head] = { total: 0, covered: 0, notCovered: 0 };
            zonalData[head].total += stat.total;
            zonalData[head].covered += stat.covered;
            zonalData[head].notCovered += stat.notCovered;
        });

        const barChartData = Object.entries(zonalData).map(([name, data]) => ({
            name,
            Covered: data.covered,
            NotCovered: data.notCovered,
            Total: data.total
        })).sort((a, b) => a.name.localeCompare(b.name));

        const pieChartData = [
            { name: 'Covered', value: covered, color: '#16a34a' },
            { name: 'Not Covered', value: notCovered, color: '#ef4444' }
        ];

        return {
            total,
            covered,
            notCovered,
            coverage,
            barChartData,
            pieChartData
        };
    }, [filteredStats]);

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

        // Sheet 2: Ward Route Wise
        const wardData = wardStats.map(item => ({
            "Zonal Head": item.zonalHead,
            "Supervisor": item.supervisorName,
            "Ward": item.wardName,
            "Route Name": item.routeName,
            "Assigned Vehicles": item.vehicles.join(", "),
            "Total Points": item.total,
            "Covered": item.covered,
            "Not Covered": item.notCovered,
            "Coverage %": item.total > 0 ? ((item.covered / item.total) * 100).toFixed(2) + '%' : '0%'
        }));
        const wsWard = XLSX.utils.json_to_sheet(wardData);
        XLSX.utils.book_append_sheet(wb, wsWard, "Ward & Route Wise");

        XLSX.writeFile(wb, "Coverage_Report.xlsx");
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Header / Upload Section */}
            {stats.length === 0 && (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center max-w-2xl mx-auto mt-8">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Upload className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Coverage Analysis</h2>
                    <p className="text-gray-500 mb-8">
                        Upload the POI Report CSV to visualize coverage across wards and supervisors.
                    </p>
                    <div className="flex items-center justify-center w-full mb-4">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <p className="mb-2 text-sm text-gray-500">
                                    <span className="font-semibold">Click to upload POI CSV</span>
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
                </div>
            )}

            {stats.length > 0 && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-blue-200 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Total Points</p>
                                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{chartData.total.toLocaleString()}</h3>
                                </div>
                                <div className="p-2 bg-blue-50 rounded-lg">
                                    <MapPin className="w-5 h-5 text-blue-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-green-200 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Covered Points</p>
                                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{chartData.covered.toLocaleString()}</h3>
                                </div>
                                <div className="p-2 bg-green-50 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-red-200 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Not Covered</p>
                                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{chartData.notCovered.toLocaleString()}</h3>
                                </div>
                                <div className="p-2 bg-red-50 rounded-lg">
                                    <AlertCircle className="w-5 h-5 text-red-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm p-6 border border-purple-200 hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Overall Coverage</p>
                                    <h3 className="text-2xl font-bold text-gray-900 mt-1">{chartData.coverage}%</h3>
                                </div>
                                <div className="p-2 bg-purple-50 rounded-lg">
                                    <TrendingUp className="w-5 h-5 text-purple-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Report Content */}
                    <div className="space-y-6">

                        {/* Charts Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Bar Chart */}
                            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <h3 className="text-lg font-bold text-gray-800 mb-6">Zonal Coverage Performance</h3>
                                <div className="h-[350px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={chartData.barChartData}
                                            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                            <XAxis
                                                dataKey="name"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#6b7280', fontSize: 12 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fill: '#6b7280', fontSize: 12 }}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#f3f4f6' }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Bar dataKey="Covered" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={40} />
                                            <Bar dataKey="NotCovered" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Pie Chart */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Overall Coverage</h3>
                                <div className="flex-1 min-h-[300px] relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={chartData.pieChartData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={70}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {chartData.pieChartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    {/* Centered Percentage */}
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none mb-8">
                                        <div className="text-center">
                                            <span className="block text-3xl font-bold text-gray-800">{chartData.coverage}%</span>
                                            <span className="text-xs text-gray-500 uppercase font-semibold">Covered</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Filter Controls & Table Actions */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Zonal Head</label>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        value={selectedZone}
                                        onChange={(e) => {
                                            setSelectedZone(e.target.value);
                                            setSelectedSupervisor('All');
                                            setSelectedWard('All');
                                        }}
                                    >
                                        {zones.map(z => <option key={z} value={z}>{z}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Supervisor</label>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        value={selectedSupervisor}
                                        onChange={(e) => {
                                            setSelectedSupervisor(e.target.value);
                                            setSelectedWard('All');
                                        }}
                                    >
                                        {supervisors.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Ward Number</label>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        value={selectedWard}
                                        onChange={(e) => setSelectedWard(e.target.value)}
                                    >
                                        {wards.map(w => <option key={w} value={w}>{w}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-100">
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
                                            setSelectedZone('All');
                                            setSelectedSupervisor('All');
                                            setSelectedWard('All');
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
                        </div>

                        {/* Tables */}
                        {viewType === 'supervisor' ? (
                            <div className="overflow-x-auto rounded-lg border-2 border-gray-300 shadow-sm">
                                <table className="w-full text-sm border-collapse">
                                    <thead className="bg-blue-600 text-white">
                                        <tr>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Zonal Head</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Supervisor Name</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Wards(Count)</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Assigned Vehicles</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Total Points</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Covered</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Not Covered</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Coverage %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStats.map((row, index) => {
                                            const coverage = row.total > 0 ? (row.covered / row.total) * 100 : 0;
                                            const isHigh = coverage >= 90;
                                            const isLow = coverage < 75;

                                            return (
                                                <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                                                    <td className="p-3 border border-gray-300 font-medium text-gray-900 text-center">{row.zonalHead}</td>
                                                    <td className="p-3 border border-gray-300 font-semibold text-gray-800 text-center">{row.supervisorName}</td>
                                                    <td className="p-3 border border-gray-300 text-center text-gray-700 font-medium">
                                                        {row.wardCount}
                                                    </td>
                                                    <td className="p-3 border border-gray-300 text-gray-600 text-xs text-center">
                                                        {row.vehicles.join(", ")}
                                                    </td>
                                                    <td className="p-3 border border-gray-300 text-center font-mono text-gray-700">{row.total.toLocaleString()}</td>
                                                    <td className="p-3 border border-gray-300 text-center font-mono font-semibold text-green-700">{row.covered.toLocaleString()}</td>
                                                    <td className="p-3 border border-gray-300 text-center font-mono font-semibold text-red-600">{row.notCovered.toLocaleString()}</td>
                                                    <td className="p-3 border border-gray-300 text-center">
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
                                {filteredStats.map((supervisor, sIndex) => {
                                    const supervisorWards = filteredWardStats.filter(w => w.supervisorName === supervisor.supervisorName);
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
                                                <table className="w-full text-sm border-collapse">
                                                    <thead className="bg-green-600 text-white">
                                                        <tr>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Ward Name</th>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Route Name</th>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Assigned Vehicles</th>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Total</th>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Covered</th>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Not Covered</th>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Coverage %</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {supervisorWards.map((ward, wIndex) => {
                                                            const coverage = ward.total > 0 ? (ward.covered / ward.total) * 100 : 0;
                                                            const isHigh = coverage >= 90;
                                                            const isLow = coverage < 75;

                                                            return (
                                                                <tr key={wIndex} className={`${wIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-green-50 transition-colors`}>
                                                                    <td className="p-2.5 border border-gray-300 font-medium text-gray-800 text-center">{ward.wardName}</td>
                                                                    <td className="p-2.5 border border-gray-300 text-gray-700 text-center">{ward.routeName}</td>
                                                                    <td className="p-2.5 border border-gray-300 text-gray-600 text-xs text-center">{ward.vehicles.join(", ")}</td>
                                                                    <td className="p-2.5 border border-gray-300 text-center font-mono text-gray-700">{ward.total.toLocaleString()}</td>
                                                                    <td className="p-2.5 border border-gray-300 text-center font-mono font-semibold text-green-700">{ward.covered.toLocaleString()}</td>
                                                                    <td className="p-2.5 border border-gray-300 text-center font-mono font-semibold text-red-600">{ward.notCovered.toLocaleString()}</td>
                                                                    <td className="p-2.5 border border-gray-300 text-center">
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
                    </div>
                </>
            )}
        </div>
    );
};
