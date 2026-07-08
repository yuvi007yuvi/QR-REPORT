import React, { useMemo, useState } from 'react';
import { type SummaryStats, parseFile, formatDisplayDate } from '../utils/dataProcessor';
import {
    QrCode,
    CheckCircle,
    Clock,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    MapPin,
    BarChart3,
    Filter,
    Image as ImageIcon,
    MessageCircle,
    Table,
    Upload,
    Trash2
} from 'lucide-react';
import { exportToJPEG } from '../utils/exporter';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';

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

interface DashboardProps {
    stats: SummaryStats;
    onUpload: (data: any[], date: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats, onUpload }) => {
    const [dashboardStats, setDashboardStats] = React.useState<SummaryStats>(stats);
    const [loading, setLoading] = React.useState(false);

    // Filter states
    const [selectedZone, setSelectedZone] = useState('All');
    const [selectedSupervisor, setSelectedSupervisor] = useState('All');
    const [selectedWard, setSelectedWard] = useState('All');

    // Sync with props
    React.useEffect(() => {
        if (stats) {
            setDashboardStats(stats);
        }
    }, [stats]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const jsonData = await parseFile(file);
            // Identify first date in file for the header
            const dateKeys = ['Date Of Scan', 'Date', 'Scan Date', 'Timestamp'];
            let fileDate = '';
            if (jsonData.length > 0) {
                const firstRow = jsonData[0];
                for (const key of dateKeys) {
                    if (firstRow[key]) {
                        fileDate = firstRow[key];
                        break;
                    }
                }
            }
            onUpload(jsonData, formatDisplayDate(fileDate));
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to process file");
        } finally {
            setLoading(false);
        }
    };

    // --- Filter Handlers ---
    const zones = useMemo(() => ['All', ...new Set(dashboardStats.wardStats.map(w => w.zonalHead))].sort(), [dashboardStats.wardStats]);
    const supervisors = useMemo(() => {
        let filteredSupervisors = dashboardStats.wardStats;
        if (selectedZone !== 'All') {
            filteredSupervisors = filteredSupervisors.filter(w => w.zonalHead === selectedZone);
        }
        return ['All', ...new Set(filteredSupervisors.map(w => w.supervisor))].sort();
    }, [dashboardStats.wardStats, selectedZone]);

    const wards = useMemo(() => {
        let filteredWards = dashboardStats.wardStats;
        if (selectedZone !== 'All') {
            filteredWards = filteredWards.filter(w => w.zonalHead === selectedZone);
        }
        if (selectedSupervisor !== 'All') {
            filteredWards = filteredWards.filter(w => w.supervisor === selectedSupervisor);
        }
        return ['All', ...new Set(filteredWards.map(w => w.ward))].sort((a, b) => {
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });
    }, [dashboardStats.wardStats, selectedZone, selectedSupervisor]);

    // --- Filtered Data ---
    const filteredWardStats = useMemo(() => {
        return dashboardStats.wardStats.filter(w => {
            const zoneMatch = selectedZone === 'All' || w.zonalHead === selectedZone;
            const supervisorMatch = selectedSupervisor === 'All' || w.supervisor === selectedSupervisor;
            const wardMatch = selectedWard === 'All' || w.ward === selectedWard;
            return zoneMatch && supervisorMatch && wardMatch;
        });
    }, [dashboardStats.wardStats, selectedZone, selectedSupervisor, selectedWard]);

    const filteredSummaryStats = useMemo(() => {
        const total = filteredWardStats.reduce((acc, curr) => acc + curr.total, 0);
        const scanned = filteredWardStats.reduce((acc, curr) => acc + curr.scanned, 0);
        const pending = filteredWardStats.reduce((acc, curr) => acc + curr.pending, 0);
        const scannedPercentage = total > 0 ? Math.round((scanned / total) * 100) : 0;
        return { total, scanned, pending, scannedPercentage };
    }, [filteredWardStats]);

    // --- Data Preparation for Charts (Filtered) ---
    const zoneChartData = useMemo(() => {
        const results: Record<string, { total: number; scanned: number; pending: number }> = {};
        filteredWardStats.forEach(w => {
            const zone = w.zonalHead || 'Unassigned';
            if (!results[zone]) results[zone] = { total: 0, scanned: 0, pending: 0 };
            results[zone].total += w.total;
            results[zone].scanned += w.scanned;
            results[zone].pending += w.pending;
        });

        return Object.entries(results)
            .sort()
            .map(([zone, data]) => ({
                name: zone,
                Scanned: data.scanned,
                Pending: data.pending,
                Total: data.total
            }));
    }, [filteredWardStats]);

    const pieChartData = useMemo(() => [
        { name: 'Scanned', value: filteredSummaryStats.scanned, color: '#16a34a' },
        { name: 'Pending', value: filteredSummaryStats.pending, color: '#ef4444' }
    ], [filteredSummaryStats]);

    const zonalDonutData = useMemo(() => {
        const results: Record<string, { total: number; scanned: number; pending: number }> = {};
        filteredWardStats.forEach(w => {
            const head = w.zonalHead || 'Unassigned';
            if (!results[head]) results[head] = { total: 0, scanned: 0, pending: 0 };
            results[head].total += w.total;
            results[head].scanned += w.scanned;
            results[head].pending += w.pending;
        });

        const sorted = Object.entries(results).sort();
        const scannedData = sorted.map(([name, data]) => ({
            name,
            value: data.scanned,
            percentage: data.total > 0 ? ((data.scanned / data.total) * 100).toFixed(1) : '0'
        }));
        const pendingData = sorted.map(([name, data]) => ({
            name,
            value: data.pending,
            percentage: data.total > 0 ? ((data.pending / data.total) * 100).toFixed(1) : '0'
        }));
        return { scannedData, pendingData };
    }, [filteredWardStats]);

    const cards = [
        {
            label: 'Total QRs Assigned',
            value: filteredSummaryStats.total,
            icon: QrCode,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            border: 'border-emerald-200'
        },
        {
            label: 'Successfully Scanned',
            value: `${filteredSummaryStats.scanned}`,
            subValue: `${filteredSummaryStats.scannedPercentage}% Coverage`,
            icon: CheckCircle,
            color: 'text-green-600',
            bg: 'bg-green-50',
            border: 'border-green-200'
        },
        {
            label: 'Pending Actions',
            value: filteredSummaryStats.pending,
            icon: Clock,
            color: 'text-red-500',
            bg: 'bg-red-50',
            border: 'border-red-200'
        },
        {
            label: 'Active Wards',
            value: filteredWardStats.length,
            icon: MapPin,
            color: 'text-orange-500',
            bg: 'bg-orange-50',
            border: 'border-orange-200'
        },
    ];



    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                        <Filter className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex items-center">
                        <select
                            value={selectedZone}
                            onChange={(e) => {
                                setSelectedZone(e.target.value);
                                setSelectedSupervisor('All');
                                setSelectedWard('All');
                            }}
                            className="bg-transparent border-none text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer py-1 px-4 outline-none"
                        >
                            <option value="All">All Zonal Heads</option>
                            {zones.filter(z => z !== 'All').map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                        <div className="h-4 w-px bg-gray-300"></div>
                        <select
                            value={selectedSupervisor}
                            onChange={(e) => {
                                setSelectedSupervisor(e.target.value);
                                setSelectedWard('All');
                            }}
                            className="bg-transparent border-none text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer py-1 px-4 outline-none"
                        >
                            <option value="All">All Supervisors</option>
                            {supervisors.filter(s => s !== 'All').map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <div className="h-4 w-px bg-gray-300"></div>
                        <select
                            value={selectedWard}
                            onChange={(e) => setSelectedWard(e.target.value)}
                            className="bg-transparent border-none text-sm font-bold text-gray-700 focus:ring-0 cursor-pointer py-1 px-4 outline-none"
                        >
                            <option value="All">All Wards</option>
                            {wards.filter(w => w !== 'All').map(w => <option key={w} value={w}>{w}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <span>{loading ? 'Processing...' : 'Upload Data'}</span>
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={loading}
                        />
                    </label>
                    <button
                        onClick={() => {
                            if (window.confirm('Are you sure you want to clear current report data?')) {
                                onUpload([], '');
                            }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors shadow-sm"
                    >
                        <Trash2 className="w-4 h-4" />
                        Clear Data
                    </button>
                </div>
                <button
                    onClick={() => exportToJPEG('dashboard-report-container', 'Dashboard_Report')}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                >
                    <ImageIcon className="w-4 h-4" />
                    Export JPEG
                </button>
            </div>

            <div id="dashboard-report-container" className="space-y-8 bg-transparent p-4 rounded-xl">
                {/* Professional Logo Header */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
                    <div className="grid grid-cols-3 items-center gap-6">
                        {/* Left Side - Nagar Nigam Logo */}
                        <div className="flex flex-col items-center sm:items-start">
                            <img
                                src={nagarNigamLogo}
                                alt="Nagar Nigam Logo"
                                className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm"
                            />

                            <p className="hidden sm:block text-[10px] font-bold text-emerald-500 mt-2 uppercase tracking-tight text-center sm:text-left">
                                Nagar Nigam<br />Mathura-Vrindavan
                            </p>
                        </div>

                        {/* Center - Title Section */}
                        <div className="text-center flex flex-col items-center justify-center">
                            <div className="bg-emerald-100 px-4 py-1 rounded-full mb-3">
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-[0.2em]">Official Report</span>
                            </div>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 tracking-tight leading-none mb-2">
                                QR PERFORMANCE<br />
                                <span className="text-emerald-600">DASHBOARD</span>
                            </h1>
                            <div className="h-1 w-20 bg-emerald-600 rounded-full mb-2"></div>
                            <p className="text-xs sm:text-sm font-medium text-slate-500 uppercase tracking-widest">
                                Daily Attendance & Monitoring
                            </p>
                        </div>

                        {/* Right Side - Nature Green Logo */}
                        <div className="flex flex-col items-center sm:items-end">
                            <img
                                src={natureGreenLogo}
                                alt="Nature Green Logo"
                                className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm"
                            />

                            <p className="hidden sm:block text-[10px] font-bold text-emerald-600 mt-2 uppercase tracking-tight text-center sm:text-right">
                                Nature Green<br />Waste Management
                            </p>
                        </div>
                    </div>
                </div>

                {/* Top Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {cards.map((card, i) => (
                        <div key={i} className={`${card.bg} ${card.border} border p-6 rounded-2xl shadow-sm hover:shadow-md transition-all`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 bg-white rounded-xl shadow-sm`}>
                                    <card.icon className={`w-6 h-6 ${card.color}`} />
                                </div>
                            </div>
                            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">{card.label}</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-slate-900">{card.value}</span>
                                {card.subValue && (
                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{card.subValue}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Bar Chart - Zone Performance */}
                    <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-6">Zone Wise Performance</h3>
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minHeight={350}>
                                <BarChart
                                    data={zoneChartData}
                                    margin={{
                                        top: 10,
                                        right: 30,
                                        left: 0,
                                        bottom: 0,
                                    }}
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
                                    <Bar dataKey="Scanned" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={40} />
                                    <Bar dataKey="Pending" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Pie Chart - Overall Status with Detailed Stats */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Overall Completion</h3>
                        <div className="flex-1 min-h-[280px] relative mb-6">
                            <ResponsiveContainer width="100%" height="100%" minHeight={280}>
                                <PieChart>
                                    <Pie
                                        data={pieChartData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={70}
                                        outerRadius={95}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Centered Percentage */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none mb-8">
                                <div className="text-center">
                                    <span className="block text-3xl font-black text-gray-800">{filteredSummaryStats.scannedPercentage}%</span>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Done</span>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Stats below chart for Dashboard */}
                        <div className="space-y-3 pt-4 border-t border-gray-100">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 font-medium flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-600"></div>
                                    Scanned QRs
                                </span>
                                <span className="font-bold text-gray-900">{filteredSummaryStats.scanned.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500 font-medium flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                    Pending Actions
                                </span>
                                <span className="font-bold text-gray-900">{filteredSummaryStats.pending.toLocaleString()}</span>
                            </div>
                            <div className="pt-2">
                                <div className={`px-3 py-1.5 rounded-lg text-center text-xs font-bold uppercase tracking-wider ${filteredSummaryStats.scannedPercentage >= 90 ? 'bg-green-50 text-green-700' :
                                    filteredSummaryStats.scannedPercentage >= 75 ? 'bg-yellow-50 text-yellow-700' :
                                        'bg-red-50 text-red-700'
                                    }`}>
                                    {filteredSummaryStats.scannedPercentage >= 90 ? 'Excellent Coverage' :
                                        filteredSummaryStats.scannedPercentage >= 75 ? 'On Track' :
                                            'Attention Required'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Zonal Performance Donut Charts (Matching POI Style) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Scanned by Zonals */}
                    <div className="bg-white rounded-xl shadow-sm border-2 border-emerald-500 p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Scanned by Zonals</h3>
                        <div className="h-[350px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%" minHeight={350}>
                                <PieChart margin={{ top: 5, right: 30, bottom: 5, left: 30 }}>
                                    <Pie
                                        data={zonalDonutData.scannedData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={65}
                                        outerRadius={95}
                                        paddingAngle={3}
                                        dataKey="value"
                                        label={(props: any) => {
                                            const { cx, cy, midAngle, outerRadius, name, value, percentage, index } = props;
                                            if (value === 0) return null;
                                            const RADIAN = Math.PI / 180;
                                            const radius = outerRadius + 25;
                                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                            const colors = ['#10b981', '#059669', '#334155', '#94a3b8', '#1e293b', '#0f172a'];
                                            const color = colors[index % colors.length];

                                            return (
                                                <text
                                                    x={x}
                                                    y={y}
                                                    fill={color}
                                                    textAnchor={x > cx ? 'start' : 'end'}
                                                    dominantBaseline="central"
                                                    fontSize="11"
                                                    fontWeight="600"
                                                >
                                                    <tspan x={x} dy="0">{name}</tspan>
                                                    <tspan x={x} dy="12">{value} ({percentage}%)</tspan>
                                                </text>
                                            );
                                        }}
                                        labelLine={true}
                                    >
                                        {zonalDonutData.scannedData.map((_entry, index) => {
                                            const colors = ['#10b981', '#059669', '#334155', '#94a3b8', '#1e293b', '#0f172a'];
                                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                        })}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: any, name: any, props: any) => [
                                            `${value} Scanned (${props.payload?.percentage}%)`,
                                            name
                                        ]}
                                    />
                                    <text
                                        x="50%"
                                        y="48%"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{ fontSize: '16px', fontWeight: 'bold', fill: '#16a34a' }}
                                    >
                                        Scanned
                                    </text>
                                    <text
                                        x="50%"
                                        y="55%"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{ fontSize: '12px', fontWeight: '600', fill: '#4b5563' }}
                                    >
                                        by Zonals
                                    </text>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Pending by Zonals */}
                    <div className="bg-white rounded-xl shadow-sm border-2 border-red-500 p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Pending by Zonals</h3>
                        <div className="h-[350px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%" minHeight={350}>
                                <PieChart margin={{ top: 5, right: 30, bottom: 5, left: 30 }}>
                                    <Pie
                                        data={zonalDonutData.pendingData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={65}
                                        outerRadius={95}
                                        paddingAngle={3}
                                        dataKey="value"
                                        label={(props: any) => {
                                            const { cx, cy, midAngle, outerRadius, name, value, percentage, index } = props;
                                            if (value === 0) return null;
                                            const RADIAN = Math.PI / 180;
                                            const radius = outerRadius + 25;
                                            const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                            const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                            const colors = ['#10b981', '#059669', '#334155', '#94a3b8', '#1e293b', '#0f172a'];
                                            const color = colors[index % colors.length];

                                            return (
                                                <text
                                                    x={x}
                                                    y={y}
                                                    fill={color}
                                                    textAnchor={x > cx ? 'start' : 'end'}
                                                    dominantBaseline="central"
                                                    fontSize="11"
                                                    fontWeight="600"
                                                >
                                                    <tspan x={x} dy="0">{name}</tspan>
                                                    <tspan x={x} dy="12">{value} ({percentage}%)</tspan>
                                                </text>
                                            );
                                        }}
                                        labelLine={true}
                                    >
                                        {zonalDonutData.pendingData.map((_entry, index) => {
                                            const colors = ['#10b981', '#059669', '#334155', '#94a3b8', '#1e293b', '#0f172a'];
                                            return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                        })}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: any, name: any, props: any) => [
                                            `${value} Pending (${props.payload?.percentage}%)`,
                                            name
                                        ]}
                                    />
                                    <text
                                        x="50%"
                                        y="48%"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{ fontSize: '16px', fontWeight: 'bold', fill: '#dc2626' }}
                                    >
                                        Pending
                                    </text>
                                    <text
                                        x="50%"
                                        y="55%"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{ fontSize: '12px', fontWeight: '600', fill: '#4b5563' }}
                                    >
                                        by Zonals
                                    </text>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Ward Performance Analysis Section */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="bg-emerald-50 p-2 rounded-lg">
                                <BarChart3 className="w-5 h-5 text-emerald-600" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 tracking-tight">Zonal Scanning Progress</h3>
                        </div>

                        {/* Top/Low Performing Wards Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Top 5 Wards card */}
                            <div className="bg-white rounded-xl shadow-md border-t-4 border-emerald-500 overflow-hidden">
                                <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100 flex items-center justify-between">
                                    <h3 className="font-bold text-emerald-800 flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5" />
                                        Top 5 Performing Wards
                                    </h3>
                                </div>
                                <div className="p-4">
                                    <div className="space-y-3">
                                        {filteredWardStats.slice(0, 5).map((ward, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                                                        #{idx + 1}
                                                    </div>
                                                    <span className="font-bold text-gray-800">{ward.ward}</span>
                                                </div>
                                                <span className="font-black text-emerald-600">{ward.percentage}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Low 5 Wards card */}
                            <div className="bg-white rounded-xl shadow-md border-t-4 border-red-500 overflow-hidden">
                                <div className="bg-red-50 px-4 py-3 border-b border-red-100 flex items-center justify-between">
                                    <h3 className="font-bold text-red-800 flex items-center gap-2">
                                        <AlertCircle className="w-5 h-5" />
                                        Low 5 Performing Wards
                                    </h3>
                                </div>
                                <div className="p-4">
                                    <div className="space-y-3">
                                        {[...filteredWardStats]
                                            .filter(w => w.total > 0)
                                            .sort((a, b) => a.percentage - b.percentage)
                                            .slice(0, 5)
                                            .map((ward, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-xs font-bold">
                                                            #{idx + 1}
                                                        </div>
                                                        <span className="font-bold text-gray-800">{ward.ward}</span>
                                                    </div>
                                                    <span className="font-black text-red-600">{ward.percentage}%</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Full Ward Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-2">
                                <div className="bg-emerald-50 p-2 rounded-lg">
                                    <Table className="w-5 h-5 text-emerald-600" />
                                </div>
                                <h3 className="text-lg font-black text-slate-900 tracking-tight">Detailed Ward Performance</h3>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-emerald-500 text-white font-bold border-b border-emerald-600">
                                    <tr>
                                        <th className="px-4 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider bg-slate-50">Ward Name</th>
                                        <th className="px-4 py-4 text-left text-xs font-black text-slate-500 uppercase tracking-wider bg-slate-50">Supervisor</th>
                                        <th className="px-4 py-4 text-center text-xs font-black text-slate-500 uppercase tracking-wider bg-slate-50">Total QRs</th>
                                        <th className="px-4 py-4 text-center text-xs font-black text-slate-500 uppercase tracking-wider bg-slate-50">Scanned</th>
                                        <th className="px-4 py-4 text-center text-xs font-black text-slate-500 uppercase tracking-wider bg-slate-50">Pending</th>
                                        <th className="px-4 py-4 text-right text-xs font-black text-slate-500 uppercase tracking-wider bg-slate-50">Progress</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredWardStats.map((row, index) => {
                                        const isHigh = row.percentage >= 90;
                                        const isLow = row.percentage < 75;

                                        // Conditional Logic for Cell Colors
                                        const scannedColor = row.scanned > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800';
                                        const pendingColor = row.pending === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-50 text-red-800';

                                        let perfBg = 'bg-gray-50';
                                        let perfText = 'text-gray-800';
                                        if (row.percentage === 0) { perfBg = 'bg-red-100'; perfText = 'text-red-700'; }
                                        else if (row.percentage < 50) { perfBg = 'bg-orange-100'; perfText = 'text-orange-700'; }
                                        else if (row.percentage < 80) { perfBg = 'bg-yellow-100'; perfText = 'text-yellow-700'; }
                                        else { perfBg = 'bg-emerald-100'; perfText = 'text-emerald-700'; }

                                        return (
                                            <tr key={index} className="hover:bg-emerald-50 transition-colors">
                                                <td className="p-3 border-r border-gray-200 font-bold text-gray-900">{row.ward}</td>
                                                <td className="p-3 border-r border-gray-200 font-medium text-gray-700 text-center">{row.supervisor}</td>
                                                <td className="p-3 border-r border-gray-200 text-center font-mono font-bold">{row.total}</td>
                                                <td className={`p-3 border-r border-gray-200 text-center font-mono font-bold ${scannedColor}`}>{row.scanned}</td>
                                                <td className={`p-3 border-r border-gray-200 text-center font-mono font-bold ${pendingColor}`}>{row.pending}</td>
                                                <td className={`p-3 text-center font-bold ${perfBg} ${perfText}`}>
                                                    <div className="flex items-center justify-center gap-1">
                                                        {row.percentage}%
                                                        {isHigh ? <TrendingUp className="w-4 h-4" /> :
                                                            isLow ? <AlertCircle className="w-4 h-4" /> :
                                                                <TrendingDown className="w-4 h-4" />}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Tables Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Zone Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-base font-bold text-gray-800">Zone Details</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-emerald-500 text-white font-bold border-b border-emerald-600">
                                    <tr>
                                        <th className="px-6 py-3 border-r border-emerald-400/50">Sr. No.</th>
                                        <th className="px-6 py-3 border-r border-emerald-400/50">Zone</th>
                                        <th className="px-6 py-3 border-r border-emerald-400/50 text-right">Total</th>
                                        <th className="px-6 py-3 border-r border-emerald-400/50 text-right">Scanned</th>
                                        <th className="px-6 py-3 border-r border-emerald-400/50 text-right">Pending</th>
                                        <th className="px-6 py-3 text-center">Progress</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {zoneChartData.map((data: any, index: number) => {
                                        const percentage = data.Total > 0 ? Math.round((data.Scanned / data.Total) * 100) : 0;

                                        const scannedColor = data.Scanned > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800';
                                        const pendingColor = data.Pending === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800';

                                        return (
                                            <tr key={data.name} className="hover:bg-emerald-50 transition-colors">
                                                <td className="px-6 py-3 text-gray-700 font-medium border-r border-gray-200 bg-gray-50/30 text-center">{index + 1}</td>
                                                <td className="px-6 py-3 font-bold text-gray-900 border-r border-gray-200">{data.name}</td>
                                                <td className="px-6 py-3 text-right text-gray-700 border-r border-gray-200 bg-emerald-50/30 font-mono font-bold">{data.Total}</td>
                                                <td className={`px-6 py-3 text-right font-mono font-bold border-r border-gray-200 ${scannedColor}`}>{data.Scanned}</td>
                                                <td className={`px-6 py-3 text-right font-mono font-bold border-r border-gray-200 ${pendingColor}`}>{data.Pending}</td>
                                                <td className="px-6 py-3 bg-gray-50/30">
                                                    <div className="flex items-center gap-2 justify-between">
                                                        <div className="flex items-center gap-2 w-full">
                                                            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden border border-gray-300">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-500 ${percentage === 100 ? 'bg-emerald-500' : percentage < 50 ? 'bg-orange-500' : 'bg-emerald-400'}`}
                                                                    style={{ width: `${percentage}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="text-xs font-bold text-gray-700 w-8 text-right">{percentage}%</span>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const text = `🚩 *Zone Daily Report*\n\n🏢 *Zone:* ${data.name}\n📍 *Total:* ${data.Total}\n✅ *Scanned:* ${data.Scanned}\n⏳ *Pending:* ${data.Pending}\n📊 *Progress:* ${percentage}%\n\n_Generated from QR Analysis Tool_`;
                                                                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                                            }}
                                                            title="Share to WhatsApp"
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-full transition-colors flex-shrink-0"
                                                        >
                                                            <MessageCircle className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Zonal Head Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="text-base font-bold text-gray-800">Zonal Head Performance</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-emerald-500 text-white font-bold border-b border-emerald-600">
                                    <tr>
                                        <th className="px-6 py-3 border-r border-emerald-400/50">Sr. No.</th>
                                        <th className="px-6 py-3 border-r border-emerald-400/50">Zonal Head</th>
                                        <th className="px-6 py-3 border-r border-emerald-400/50 text-right">Total</th>
                                        <th className="px-6 py-3 border-r border-emerald-400/50 text-right">Scanned</th>
                                        <th className="px-6 py-3 border-r border-emerald-400/50 text-right text-[10px]">Before</th>
                                        <th className="px-6 py-3 border-r border-emerald-400/50 text-right text-[10px]">After</th>
                                        <th className="px-6 py-3 border-r border-emerald-400/50 text-right">Pending</th>
                                        <th className="px-6 py-3 text-center">Progress</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {zonalDonutData.scannedData.map((headData: any, index: number) => {
                                        // Find total and pending for this head from filteredWardStats
                                        const headDataFull = filteredWardStats.filter(w => w.zonalHead === headData.name).reduce((acc, curr) => ({
                                            total: acc.total + curr.total,
                                            scanned: acc.scanned + curr.scanned,
                                            pending: acc.pending + curr.pending,
                                            before: acc.before + (curr as any).beforeDone,
                                            after: acc.after + (curr as any).afterDone
                                        }), { total: 0, scanned: 0, pending: 0, before: 0, after: 0 });

                                        const percentage = headDataFull.total > 0 ? Math.round((headDataFull.scanned / headDataFull.total) * 100) : 0;

                                        const scannedColor = headDataFull.scanned > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800';
                                        const pendingColor = headDataFull.pending === 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800';

                                        return (
                                            <tr key={headData.name} className="hover:bg-emerald-50 transition-colors">
                                                <td className="px-6 py-3 text-gray-700 font-medium border-r border-gray-200 bg-gray-50/30 text-center">{index + 1}</td>
                                                <td className="px-6 py-3 font-bold text-gray-900 border-r border-gray-200">{headData.name}</td>
                                                <td className="px-6 py-3 text-right text-gray-700 border-r border-gray-200 bg-emerald-50/30 font-mono font-bold">{headDataFull.total}</td>
                                                <td className={`px-6 py-3 text-right font-mono font-bold border-r border-gray-200 ${scannedColor}`}>{headDataFull.scanned}</td>
                                                <td className="px-6 py-3 text-right font-mono font-bold border-r border-gray-200 text-blue-600 bg-blue-50/20">{headDataFull.before}</td>
                                                <td className="px-6 py-3 text-right font-mono font-bold border-r border-gray-200 text-indigo-600 bg-indigo-50/20">{headDataFull.after}</td>
                                                <td className={`px-6 py-3 text-right font-mono font-bold border-r border-gray-200 ${pendingColor}`}>{headDataFull.pending}</td>
                                                <td className="px-6 py-3 bg-gray-50/30">
                                                    <div className="flex items-center gap-2 justify-between">
                                                        <div className="flex items-center gap-2 w-full">
                                                            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden border border-gray-300">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-500 ${percentage === 100 ? 'bg-emerald-500' : percentage < 50 ? 'bg-orange-500' : 'bg-emerald-400'}`}
                                                                    style={{ width: `${percentage}%` }}
                                                                ></div>
                                                            </div>
                                                            <span className="text-xs font-bold text-gray-700 w-8 text-right">{percentage}%</span>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const text = `🚩 *Zonal Head Report*\n\n👤 *Head:* ${headData.name}\n📍 *Total:* ${headDataFull.total}\n✅ *Scanned:* ${headDataFull.scanned}\n⏳ *Pending:* ${headDataFull.pending}\n📊 *Progress:* ${percentage}%\n\n_Generated from QR Analysis Tool_`;
                                                                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                                            }}
                                                            title="Share to WhatsApp"
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-100 rounded-full transition-colors flex-shrink-0"
                                                        >
                                                            <MessageCircle className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 mb-6 text-center">
                    <div className="inline-block bg-white px-8 py-4 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-slate-600 font-medium text-lg tracking-wide">
                            Generated by <span className="font-extrabold text-emerald-500 mx-1">Reports Buddy Pro</span>
                            <br />
                            Created by <span className="font-extrabold text-slate-300 mx-1 border-b-2 border-emerald-900">Yuvraj Singh Tomar</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
