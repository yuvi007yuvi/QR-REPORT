import React from 'react';
import type { SummaryStats } from '../utils/dataProcessor';
import { QrCode, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface DashboardProps {
    stats: SummaryStats;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
    const cards = [
        {
            label: 'Total QRs',
            value: stats.total,
            icon: QrCode,
            color: 'text-blue-600',
            bg: 'bg-blue-100',
        },
        {
            label: 'Scanned',
            value: `${stats.scanned} (${stats.scannedPercentage}%)`,
            icon: CheckCircle,
            color: 'text-green-600',
            bg: 'bg-green-100',
        },
        {
            label: 'Pending',
            value: stats.pending,
            icon: Clock,
            color: 'text-red-600',
            bg: 'bg-red-100',
        },
        {
            label: 'Unknown/Invalid',
            value: stats.unknown,
            icon: AlertTriangle,
            color: 'text-yellow-600',
            bg: 'bg-yellow-100',
        },
    ];

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {cards.map((card, index) => (
                    <div
                        key={index}
                        className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 flex items-center justify-between"
                    >
                        <div>
                            <p className="text-sm font-medium text-gray-500">{card.label}</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">
                                {card.value}
                            </p>
                        </div>
                        <div className={`p-3 rounded-full ${card.bg}`}>
                            <card.icon className={`w-6 h-6 ${card.color}`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Zone-wise Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-900">Zone-wise Performance</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3">Zone</th>
                                    <th className="px-6 py-3">Total</th>
                                    <th className="px-6 py-3">Scanned</th>
                                    <th className="px-6 py-3">Pending</th>
                                    <th className="px-6 py-3">Completion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {Object.entries(stats.zoneStats).sort().map(([zone, data]) => {
                                    const percentage = data.total > 0 ? Math.round((data.scanned / data.total) * 100) : 0;
                                    return (
                                        <tr key={zone} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{zone}</td>
                                            <td className="px-6 py-4">{data.total}</td>
                                            <td className="px-6 py-4 text-green-600 font-medium">{data.scanned}</td>
                                            <td className="px-6 py-4 text-red-600 font-medium">{data.pending}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-full max-w-[60px] bg-gray-200 rounded-full h-1.5">
                                                        <div
                                                            className={`h-1.5 rounded-full ${percentage === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${percentage}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs text-gray-500">{percentage}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                        <h3 className="text-lg font-semibold text-gray-900">Zonal Head Performance</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3">Zonal Head</th>
                                    <th className="px-6 py-3">Total</th>
                                    <th className="px-6 py-3">Scanned</th>
                                    <th className="px-6 py-3">Pending</th>
                                    <th className="px-6 py-3">Completion</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {Object.entries(stats.zonalHeadStats).sort().map(([head, data]) => {
                                    const percentage = data.total > 0 ? Math.round((data.scanned / data.total) * 100) : 0;
                                    return (
                                        <tr key={head} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{head}</td>
                                            <td className="px-6 py-4">{data.total}</td>
                                            <td className="px-6 py-4 text-green-600 font-medium">{data.scanned}</td>
                                            <td className="px-6 py-4 text-red-600 font-medium">{data.pending}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-full max-w-[60px] bg-gray-200 rounded-full h-1.5">
                                                        <div
                                                            className={`h-1.5 rounded-full ${percentage === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${percentage}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="text-xs text-gray-500">{percentage}%</span>
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
