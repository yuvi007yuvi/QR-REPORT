import React, { useMemo } from 'react';
import type { SummaryStats } from '../utils/dataProcessor';
import {
    QrCode,
    CheckCircle,
    Clock,
    AlertTriangle,
    TrendingUp
} from 'lucide-react';
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
}

export const Dashboard: React.FC<DashboardProps> = ({ stats }) => {

    // --- Data Preparation for Charts ---
    const zoneChartData = useMemo(() => {
        return Object.entries(stats.zoneStats)
            .sort()
            .map(([zone, data]) => ({
                name: zone,
                Scanned: data.scanned,
                Pending: data.pending,
                Total: data.total
            }));
    }, [stats.zoneStats]);

    const pieChartData = useMemo(() => [
        { name: 'Scanned', value: stats.scanned, color: '#16a34a' }, // green-600
        { name: 'Pending', value: stats.pending, color: '#ef4444' }  // red-500
    ], [stats.scanned, stats.pending]);

    const cards = [
        {
            label: 'Total QRs Assigned',
            value: stats.total,
            icon: QrCode,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            border: 'border-blue-200'
        },
        {
            label: 'Successfully Scanned',
            value: `${stats.scanned}`,
            subValue: `${stats.scannedPercentage}% Coverage`,
            icon: CheckCircle,
            color: 'text-green-600',
            bg: 'bg-green-50',
            border: 'border-green-200'
        },
        {
            label: 'Pending Actions',
            value: stats.pending,
            icon: Clock,
            color: 'text-red-500',
            bg: 'bg-red-50',
            border: 'border-red-200'
        },
        {
            label: 'Unknown / Invalid',
            value: stats.unknown,
            icon: AlertTriangle,
            color: 'text-orange-500',
            bg: 'bg-orange-50',
            border: 'border-orange-200'
        },
    ];



    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card, index) => (
                    <div
                        key={index}
                        className={`bg-white rounded-xl shadow-sm p-6 border ${card.border} hover:shadow-md transition-shadow duration-200 flex flex-col justify-between`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-500 mb-1">{card.label}</p>
                                <h3 className="text-3xl font-bold text-gray-900 tracking-tight">{card.value}</h3>
                                {card.subValue && (
                                    <p className="text-xs font-semibold text-green-600 mt-1 flex items-center gap-1">
                                        <TrendingUp className="w-3 h-3" />
                                        {card.subValue}
                                    </p>
                                )}
                            </div>
                            <div className={`p-3 rounded-xl ${card.bg}`}>
                                <card.icon className={`w-6 h-6 ${card.color}`} />
                            </div>
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
                        <ResponsiveContainer width="100%" height="100%">
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

                {/* Pie Chart - Overall Status */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Overall Completion</h3>
                    <div className="flex-1 min-h-[300px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {pieChartData.map((entry, index) => (
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
                                <span className="block text-3xl font-bold text-gray-800">{stats.scannedPercentage}%</span>
                                <span className="text-xs text-gray-500 uppercase font-semibold">Complete</span>
                            </div>
                        </div>
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
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3">Zone</th>
                                    <th className="px-6 py-3 text-right">Total</th>
                                    <th className="px-6 py-3 text-right">Scanned</th>
                                    <th className="px-6 py-3 text-right">Pending</th>
                                    <th className="px-6 py-3 text-center">Progress</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.entries(stats.zoneStats).sort().map(([zone, data]) => {
                                    const percentage = data.total > 0 ? Math.round((data.scanned / data.total) * 100) : 0;
                                    return (
                                        <tr key={zone} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-gray-900">{zone}</td>
                                            <td className="px-6 py-3 text-right text-gray-600">{data.total}</td>
                                            <td className="px-6 py-3 text-right text-green-600 font-semibold">{data.scanned}</td>
                                            <td className="px-6 py-3 text-right text-red-500">{data.pending}</td>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-2 justify-center">
                                                    <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${percentage === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${percentage}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-500 w-8">{percentage}%</span>
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
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3">Zonal Head</th>
                                    <th className="px-6 py-3 text-right">Total</th>
                                    <th className="px-6 py-3 text-right">Scanned</th>
                                    <th className="px-6 py-3 text-right">Pending</th>
                                    <th className="px-6 py-3 text-center">Progress</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.entries(stats.zonalHeadStats).sort().map(([head, data]) => {
                                    const percentage = data.total > 0 ? Math.round((data.scanned / data.total) * 100) : 0;
                                    return (
                                        <tr key={head} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-3 font-medium text-gray-900">{head}</td>
                                            <td className="px-6 py-3 text-right text-gray-600">{data.total}</td>
                                            <td className="px-6 py-3 text-right text-green-600 font-semibold">{data.scanned}</td>
                                            <td className="px-6 py-3 text-right text-red-500">{data.pending}</td>
                                            <td className="px-6 py-3">
                                                <div className="flex items-center gap-2 justify-center">
                                                    <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${percentage === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${percentage}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs font-medium text-gray-500 w-8">{percentage}%</span>
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
        </div>
    );
};
