import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import {
    Upload,
    FileText,
    Search,
    Users,
    BarChart3,
    TrendingUp,
    Award,
    Filter,
    Map as MapIcon,
    FileType2,
    Image as ImageIcon
} from 'lucide-react';
import { exportToJPEG, exportToPDFImage } from '../utils/exporter';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { MASTER_SUPERVISORS } from '../data/master-supervisors';

interface SupervisorStats {
    id: string;
    name: string;
    number: string;
    zone: string;
    ward: string;
    count: number;
    wardCounts: { [key: string]: number };
    isMaster: boolean;
}

interface ZonalStats {
    zone: string;
    supervisorCount: number;
    kycCount: number;
}

export const SupervisorCountReport: React.FC = () => {
    const [fileName, setFileName] = useState<string | null>(null);
    const [data, setData] = useState<SupervisorStats[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [minCountFilter, setMinCountFilter] = useState<number>(0);
    const [selectedZone, setSelectedZone] = useState<string>('All');
    const [viewMode, setViewMode] = useState<'supervisor' | 'zonal'>('supervisor');

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setLoading(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows = results.data as any[];
                const statsMap = new Map<string, SupervisorStats>();

                rows.forEach((row) => {
                    const csvName = row['Supervisor Name'] || row['supervisor_name'] || row['Name'] || 'Unknown';
                    const csvId = (row['Supervisor Id'] || row['supervisor_id'] || row['ID'] || '').trim().toUpperCase();
                    const csvNumber = row['Supervisor Number'] || row['supervisor_number'] || row['Mobile'] || '';
                    const csvZone = row['Zone-Circle'] || row['zone'] || '';
                    const csvWardRaw = row['Ward No'] || row['Ward Name'] || row['ward'] || 'Unknown';
                    const csvWard = csvWardRaw.toString().trim();

                    // Try to match with Master List
                    const masterMatch = MASTER_SUPERVISORS.find(
                        s => s.empId.toUpperCase() === csvId || s.name.toLowerCase() === csvName.toLowerCase()
                    );

                    const finalId = masterMatch ? masterMatch.empId : csvId;
                    const finalName = masterMatch ? masterMatch.name : csvName;
                    const finalZone = masterMatch ? masterMatch.zonal : (csvZone || 'Unassigned');
                    const finalWard = masterMatch ? masterMatch.ward : 'N/A';
                    const finalNumber = masterMatch ? masterMatch.mobile : csvNumber;


                    // Use ID as unique key if available, otherwise Name
                    const key = finalId ? finalId : finalName;

                    if (key && key !== 'Unknown') {
                        const existing = statsMap.get(key);
                        if (existing) {
                            existing.count += 1;
                            existing.wardCounts[csvWard] = (existing.wardCounts[csvWard] || 0) + 1;
                        } else {
                            statsMap.set(key, {
                                id: finalId,
                                name: finalName,
                                number: finalNumber,
                                zone: finalZone,
                                ward: finalWard,
                                count: 1,
                                wardCounts: { [csvWard]: 1 },
                                isMaster: !!masterMatch
                            });
                        }
                    }
                });

                const sortedStats = Array.from(statsMap.values()).sort((a, b) => b.count - a.count);
                setData(sortedStats);
                setLoading(false);
            },
            error: (err) => {
                console.error("CSV Parse Error:", err);
                setLoading(false);
                alert("Failed to parse CSV file.");
            }
        });
    };

    const uniqueZones = useMemo(() => {
        // Collect zones from both Master List (to ensure all are shown) and Data
        const zones = new Set<string>();
        MASTER_SUPERVISORS.forEach(s => zones.add(s.zonal));
        data.forEach(item => zones.add(item.zone));
        return ['All', ...Array.from(zones).sort()];
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCount = item.count >= minCountFilter;
            const matchesZone = selectedZone === 'All' || item.zone === selectedZone;
            return matchesSearch && matchesCount && matchesZone;
        });
    }, [data, searchTerm, minCountFilter, selectedZone]);

    const zonalStats: ZonalStats[] = useMemo(() => {
        const stats = new Map<string, ZonalStats>();
        data.forEach(item => {
            const zone = item.zone || 'Unknown';
            if (!stats.has(zone)) {
                stats.set(zone, { zone, supervisorCount: 0, kycCount: 0 });
            }
            const current = stats.get(zone)!;
            current.supervisorCount += 1;
            current.kycCount += item.count;
        });
        return Array.from(stats.values()).sort((a, b) => b.kycCount - a.kycCount);
    }, [data]);

    const totalKYC = data.reduce((acc, curr) => acc + curr.count, 0);
    const totalSupervisors = data.length;
    const avgKYC = totalSupervisors > 0 ? Math.round(totalKYC / totalSupervisors) : 0;
    const topPerformer = data.length > 0 ? data[0] : null;

    // Colors for the chart
    const COLORS = ['#4f46e5', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-white min-h-screen font-sans">
            {/* Header Section */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
                                <Users className="w-8 h-8 text-white" />
                            </div>
                            <span>Supervisor & Zonal Report</span>
                        </h1>
                        <p className="text-slate-500 mt-2 font-medium ml-1">
                            Analyze Performance by Supervisor and Zone (Master Mapped)
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="group relative flex items-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer shadow-md hover:shadow-xl transform hover:-translate-y-0.5">
                            <Upload className="w-5 h-5 group-hover:animate-bounce" />
                            <span className="font-bold tracking-wide">{fileName ? 'Upload New File' : 'Upload CSV Data'}</span>
                            <input
                                type="file"
                                className="hidden"
                                accept=".csv"
                                onChange={handleFileUpload}
                                disabled={loading}
                            />
                        </label>
                        <div className="flex bg-white rounded-xl shadow-sm border border-slate-200 p-1">
                            <button
                                onClick={() => exportToJPEG(viewMode === 'supervisor' ? 'supervisor-table-view' : 'zonal-table-view', 'Supervisor_KYC_Report')}
                                className="p-2 px-3 flex items-center gap-2 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors border-r border-slate-100"
                                title="Export as JPEG"
                            >
                                <ImageIcon className="w-5 h-5" />
                                <span className="text-sm font-bold">JPEG</span>
                            </button>
                            <button
                                onClick={() => exportToPDFImage(viewMode === 'supervisor' ? 'supervisor-table-view' : 'zonal-table-view', 'Supervisor_KYC_Report')}
                                className="p-2 px-3 flex items-center gap-2 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors"
                                title="Export as PDF"
                            >
                                <FileType2 className="w-5 h-5" />
                                <span className="text-sm font-bold">PDF</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div id="supervisor-count-report" className="max-w-7xl mx-auto space-y-8">

                {/* Visual Header for Export */}
                {/* Visual Header for Export */}
                <div className="bg-white p-6 border-b border-gray-200 flex flex-col items-center text-center gap-4">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 w-full">
                        <div className="flex items-center gap-4">
                            <img src={nagarNigamLogo} alt="Logo" className="h-16 w-auto object-contain drop-shadow-sm" />
                            <div className="h-12 w-px bg-gray-300 hidden md:block"></div>
                        </div>

                        <div>
                            <h3 className="text-2xl font-black text-gray-900 uppercase tracking-tight leading-none">Mathura Vrindavan Nagar Nigam</h3>
                            <p className="text-base text-emerald-600 font-extrabold tracking-widest uppercase mt-2">
                                Supervisor KYC Performance Report
                            </p>
                            <div className="mt-2 flex items-center justify-center gap-3 text-xs font-bold text-gray-500 uppercase tracking-wide border border-gray-200 bg-gray-50 px-3 py-1 rounded-lg inline-block">
                                <span>Zone: <span className="text-gray-900">{selectedZone}</span></span>
                                <span className="w-1 h-3 bg-gray-300 rounded-full"></span>
                                <span>Filter: <span className="text-gray-900">{searchTerm || 'None'}</span></span>
                                <span className="w-1 h-3 bg-gray-300 rounded-full"></span>
                                <span>Total: <span className="text-gray-900">{totalKYC.toLocaleString()}</span></span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="h-12 w-px bg-gray-300 hidden md:block"></div>
                            <img src={natureGreenLogo} alt="Nature Green" className="h-16 w-auto object-contain drop-shadow-sm" />
                        </div>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                            <FileText size={100} />
                        </div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Total Records</p>
                        <h3 className="text-4xl font-black text-slate-800">{totalKYC.toLocaleString()}</h3>
                        <div className="mt-4 flex items-center text-xs font-medium text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-md">
                            <TrendingUp size={14} className="mr-1" />
                            <span>100% Processed</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                            <Users size={100} />
                        </div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Active Supervisors</p>
                        <h3 className="text-4xl font-black text-slate-800">{totalSupervisors}</h3>
                        <div className="mt-4 flex items-center text-xs font-medium text-indigo-600 bg-indigo-50 w-fit px-2 py-1 rounded-md">
                            <Users size={14} className="mr-1" />
                            <span>Unique IDs</span>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                        <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                            <BarChart3 size={100} />
                        </div>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Avg per Supervisor</p>
                        <h3 className="text-4xl font-black text-slate-800">{avgKYC}</h3>
                        <div className="mt-4 flex items-center text-xs font-medium text-blue-600 bg-blue-50 w-fit px-2 py-1 rounded-md">
                            <span>Target: 100+</span>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-2xl shadow-lg relative overflow-hidden text-white group">
                        <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <Award size={100} />
                        </div>
                        <p className="text-sm font-bold text-indigo-200 uppercase tracking-wider mb-1">Top Performer</p>
                        <h3 className="text-2xl font-black mb-1 truncate">{topPerformer?.name || '---'}</h3>
                        <p className="text-lg opacity-80 font-mono">{topPerformer?.count.toLocaleString()} <span className="text-sm">KYCs</span></p>
                        <div className="mt-4 flex items-center gap-2">
                            <div className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white w-full rounded-full"></div>
                            </div>
                            <span className="text-xs font-bold">#1 Rank</span>
                        </div>
                    </div>
                </div>

                {/* View Switcher */}
                <div className="flex justify-center">
                    <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm inline-flex">
                        <button
                            onClick={() => setViewMode('supervisor')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'supervisor' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Supervisor View
                        </button>
                        <button
                            onClick={() => setViewMode('zonal')}
                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'zonal' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            Zonal View
                        </button>
                    </div>
                </div>

                {/* Supervisor View Content */}
                {viewMode === 'supervisor' && (
                    <>
                        {/* Search & Filter */}
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Search by Supervisor Name or ID..."
                                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="relative">
                                <MapIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <select
                                    className="w-48 pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium appearance-none cursor-pointer bg-white"
                                    value={selectedZone}
                                    onChange={(e) => setSelectedZone(e.target.value)}
                                >
                                    {uniqueZones.map(zone => (
                                        <option key={zone} value={zone}>{zone === 'All' ? 'All Zones' : `${zone}`}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="relative">
                                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                <input
                                    type="number"
                                    placeholder="Min Count"
                                    className="w-32 pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                    value={minCountFilter || ''}
                                    onChange={(e) => setMinCountFilter(parseInt(e.target.value) || 0)}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Table Section */}
                            <div id="supervisor-table-view" className="lg:col-span-2 bg-white shadow-sm overflow-hidden border border-black">
                                <div className="p-5 border-b border-black bg-gray-50 flex flex-col items-center text-center gap-4">
                                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 w-full">
                                        <div className="flex items-center gap-4">
                                            <img src={nagarNigamLogo} alt="Logo" className="h-14 w-auto object-contain drop-shadow-sm" />
                                            <div className="h-8 w-px bg-gray-400 hidden md:block"></div>
                                        </div>

                                        <div>
                                            <h3 className="text-xl font-black text-black uppercase tracking-tight leading-none">Mathura Vrindavan Nagar Nigam</h3>
                                            <p className="text-sm text-emerald-700 font-extrabold tracking-widest uppercase mt-1">
                                                Total KYC Report
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="h-8 w-px bg-gray-400 hidden md:block"></div>
                                            <img src={natureGreenLogo} alt="Nature Green" className="h-14 w-auto object-contain drop-shadow-sm" />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between w-full mt-2 px-2">
                                        <h3 className="font-bold text-black text-lg flex items-center gap-2">
                                            <Users className="w-5 h-5 text-black" />
                                            Supervisor List
                                        </h3>
                                        <div className="flex items-center gap-3 text-xs font-bold text-black uppercase tracking-wide">
                                            <span className="border border-black px-2 py-1 bg-white">Zone: {selectedZone}</span>
                                            <span className="border border-black px-2 py-1 bg-white">Total: {filteredData.length}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="overflow-x-auto h-[calc(100vh-280px)] min-h-[600px] overflow-y-auto">
                                    <table className="w-full text-center border-collapse border border-black">
                                        <thead className="bg-slate-100 sticky top-0 z-10 text-xs font-extrabold text-slate-900 uppercase tracking-wider shadow-sm">
                                            <tr>
                                                <th className="px-4 py-3 border border-black w-20 text-center">Rank</th>
                                                <th className="px-4 py-3 border border-black text-center">Supervisor Name</th>
                                                <th className="px-4 py-3 border border-black text-center">ID</th>
                                                <th className="px-4 py-3 border border-black text-center">Zone</th>
                                                <th className="px-4 py-3 border border-black text-center w-1/3">Ward Dist.</th>
                                                <th className="px-4 py-3 border border-black text-center">Total KYC</th>
                                            </tr>
                                        </thead>
                                        <tbody className="text-sm">
                                            {filteredData.length > 0 ? (
                                                filteredData.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-indigo-50 even:bg-slate-50 transition-colors group">
                                                        <td className="px-4 py-3 border border-black text-center">
                                                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${idx < 3 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-200 text-slate-700'}`}>
                                                                {idx + 1}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 border border-black text-center">
                                                            <div className="font-bold text-slate-800 text-base">{item.name}</div>
                                                            {item.isMaster && <div className="text-[10px] text-emerald-700 font-bold bg-emerald-50 inline-block px-1.5 py-0.5 rounded border border-emerald-200 mt-0.5">Supervisor</div>}
                                                        </td>
                                                        <td className="px-4 py-3 border border-black text-center font-mono text-xs font-bold text-slate-500">{item.id || 'N/A'}</td>
                                                        <td className="px-4 py-3 border border-black text-center">
                                                            <span className="px-2 py-1 bg-white border border-slate-200 rounded-md text-slate-700 font-bold text-xs shadow-sm">
                                                                {item.zone}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 border border-black text-left">
                                                            <div className="flex flex-wrap gap-1.5 justify-center">
                                                                {Object.entries(item.wardCounts)
                                                                    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                                                                    .map(([ward, count]) => (
                                                                        <div key={ward} className="px-2 py-1 bg-white border border-slate-300 rounded shadow-[0_1px_2px_rgba(0,0,0,0.05)] text-[10px] items-center flex gap-1.5 hover:border-indigo-300 transition-colors">
                                                                            <span className="text-slate-500 font-medium">W-{ward}</span>
                                                                            <span className="bg-slate-100 px-1 rounded text-slate-900 font-bold">{count}</span>
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 border border-black text-center font-black text-slate-900 text-lg">
                                                            {item.count.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} className="py-24 text-center text-slate-400 border border-black bg-slate-50">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Search className="w-8 h-8 opacity-20" />
                                                            <p>{loading ? 'Processing Data...' : 'No Data Available'}</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-3 border-t border-black text-center bg-indigo-600">
                                    <p className="text-white font-bold text-[10px] tracking-widest uppercase">
                                        Generated by Reports Buddy Pro • Created by Yuvraj Singh Tomar
                                    </p>
                                </div>
                            </div>

                            {/* Chart Section */}
                            <div className="lg:col-span-1 flex flex-col gap-6">
                                <div className="bg-white border border-black p-4 flex-1 flex flex-col">
                                    <h3 className="font-bold text-black text-lg mb-6 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-black" />
                                        Top 10 Performers {selectedZone !== 'All' ? `- (${selectedZone})` : ''}
                                    </h3>
                                    <div className="flex-1 w-full min-h-[500px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart
                                                data={filteredData.slice(0, 10).map((item, index) => ({
                                                    ...item,
                                                    displayName: `${index + 1}. ${item.name}`
                                                }))}
                                                layout="vertical"
                                                margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} vertical={true} opacity={0.3} stroke="#000" />
                                                <XAxis type="number" hide />
                                                <YAxis
                                                    type="category"
                                                    dataKey="displayName"
                                                    width={120}
                                                    tick={{ fontSize: 11, fontWeight: 'bold', fill: 'black' }}
                                                    interval={0}
                                                />
                                                <Tooltip
                                                    cursor={{ fill: '#f3f4f6' }}
                                                    contentStyle={{ borderRadius: '0px', border: '1px solid black', boxShadow: 'none' }}
                                                    formatter={(value: any) => [`${value} KYCs`, 'Count']}
                                                />
                                                <Bar dataKey="count" radius={[0, 0, 0, 0]} barSize={24} stroke="#000" strokeWidth={1}>
                                                    {filteredData.slice(0, 10).map((_, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                    <LabelList dataKey="count" position="right" fill="black" fontWeight="bold" fontSize={12} formatter={(val: any) => val.toLocaleString()} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Zonal View Content */}
                {viewMode === 'zonal' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div id="zonal-table-view" className="bg-white shadow-sm overflow-hidden border border-black">
                            <div className="p-4 border-b border-black bg-gray-100">
                                <h3 className="font-bold text-black text-lg">Zonal Performance</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-center border-collapse border border-black">
                                    <thead className="bg-gray-200 text-xs font-bold text-black uppercase tracking-wider">
                                        <tr>
                                            <th className="px-4 py-2 border border-black text-center">Zone</th>
                                            <th className="px-4 py-2 border border-black text-center">Supervisors</th>
                                            <th className="px-4 py-2 border border-black text-center">Total KYC</th>
                                            <th className="px-4 py-2 border border-black text-center">Avg / Sup</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-sm">
                                        {zonalStats.map((stat, idx) => (
                                            <tr key={idx} className="hover:bg-blue-50 transition-colors">
                                                <td className="px-4 py-2 border border-black font-bold text-black text-center">{stat.zone}</td>
                                                <td className="px-4 py-2 border border-black text-center font-medium text-black">{stat.supervisorCount}</td>
                                                <td className="px-4 py-2 border border-black text-center font-black text-blue-700">{stat.kycCount.toLocaleString()}</td>
                                                <td className="px-4 py-2 border border-black text-center font-medium text-black">
                                                    {stat.supervisorCount > 0 ? Math.round(stat.kycCount / stat.supervisorCount) : 0}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="p-3 border-t border-black text-center bg-indigo-600">
                                <p className="text-white font-bold text-[10px] tracking-widest uppercase">
                                    Generated by Reports Buddy Pro • Created by Yuvraj Singh Tomar
                                </p>
                            </div>
                        </div>

                        <div className="bg-white border border-black p-4 flex flex-col">
                            <h3 className="font-bold text-black text-lg mb-6">Zone vs KYC Volume</h3>
                            <div className="flex-1 w-full min-h-[400px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={zonalStats} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.5} stroke="#000" />
                                        <XAxis
                                            dataKey="zone"
                                            tick={{ fontSize: 12, fill: 'black' }}
                                            angle={-45}
                                            textAnchor="end"
                                            interval={0}
                                        />
                                        <YAxis tickLine={false} axisLine={false} tick={{ fill: 'black' }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '0px', border: '1px solid black', boxShadow: 'none' }}
                                            cursor={{ fill: '#f3f4f6' }}
                                        />
                                        <Bar dataKey="kycCount" radius={[0, 0, 0, 0]} stroke="#000" strokeWidth={1}>
                                            {zonalStats.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
