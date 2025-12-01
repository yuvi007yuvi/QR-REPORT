import React, { useState } from 'react';
import type { ReportRecord } from '../utils/dataProcessor';
import { ArrowUpDown, Search, FileSpreadsheet, FileText, Image as ImageIcon, QrCode, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { exportToExcel, exportToPDF, exportToJPEG } from '../utils/exporter';

interface ReportTableProps {
    data: ReportRecord[];
}

export const ReportTable: React.FC<ReportTableProps> = ({ data }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedZoneHead, setSelectedZoneHead] = useState('All');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ReportRecord; direction: 'asc' | 'desc' } | null>(null);

    const zonalHeads = React.useMemo(() => {
        const heads = new Set(data.map(d => d.zonalHead).filter(h => h && h !== 'Unassigned' && h !== 'Unknown'));
        return ['All', ...Array.from(heads).sort()];
    }, [data]);

    const handleSort = (key: keyof ReportRecord) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredData = data.filter((item) => {
        const matchesSearch = Object.values(item).some((val) =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        );
        const matchesZoneHead = selectedZoneHead === 'All' || item.zonalHead === selectedZoneHead;
        return matchesSearch && matchesZoneHead;
    });

    const sortedData = React.useMemo(() => {
        if (!sortConfig) return filteredData;
        return [...filteredData].sort((a, b) => {
            if (a[sortConfig.key] < b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (a[sortConfig.key] > b[sortConfig.key]) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [filteredData, sortConfig]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Scanned':
                return 'bg-green-100 text-green-800';
            case 'Pending':
                return 'bg-red-100 text-red-800';
            case 'Unknown':
                return 'bg-yellow-100 text-yellow-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const stats = React.useMemo(() => {
        const total = filteredData.length;
        const scanned = filteredData.filter(d => d.status === 'Scanned').length;
        const pending = filteredData.filter(d => d.status === 'Pending').length;
        const unknown = filteredData.filter(d => d.status === 'Unknown').length;
        const scannedPercentage = total > 0 ? Math.round((scanned / total) * 100) : 0;
        return { total, scanned, pending, unknown, scannedPercentage };
    }, [filteredData]);

    const cards = [
        { label: 'Total', value: stats.total, icon: QrCode, color: 'text-blue-600', bg: 'bg-blue-100' },
        { label: 'Scanned', value: `${stats.scanned} (${stats.scannedPercentage}%)`, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
        { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-red-600', bg: 'bg-red-100' },
        { label: 'Unknown', value: stats.unknown, icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    ];

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-800">
                        Detailed Report
                        {selectedZoneHead !== 'All' && (
                            <span className="ml-2 text-blue-600 font-normal">
                                - {selectedZoneHead}
                            </span>
                        )}
                    </h3>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="relative flex-1 sm:flex-none">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <select
                            value={selectedZoneHead}
                            onChange={(e) => setSelectedZoneHead(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            {zonalHeads.map(head => (
                                <option key={head} value={head}>{head === 'All' ? 'All Zonal Heads' : head}</option>
                            ))}
                        </select>

                        <button
                            onClick={() => exportToExcel(sortedData)}
                            className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                            title="Export to Excel"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span className="hidden sm:inline">Excel</span>
                        </button>

                        <button
                            onClick={() => exportToPDF(sortedData, `REPORT OF ${selectedZoneHead === 'All' ? 'ALL ZONAL HEADS' : selectedZoneHead.toUpperCase()} QR REPORT`)}
                            className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                            title="Export to PDF"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="hidden sm:inline">PDF</span>
                        </button>

                        <button
                            onClick={() => exportToJPEG('report-table-container', `Report_${selectedZoneHead}`)}
                            className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
                            title="Export to JPEG"
                        >
                            <ImageIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">JPEG</span>
                        </button>
                    </div>
                </div>
                <div id="report-table-container" className="bg-white p-4">
                    <h1 className="text-2xl font-bold text-center mb-6 uppercase text-gray-900 border-b-2 border-gray-800 pb-2">
                        REPORT OF {selectedZoneHead === 'All' ? 'ALL ZONAL HEADS' : selectedZoneHead} QR REPORT
                    </h1>

                    {/* Filtered Stats Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {cards.map((card, index) => (
                            <div key={index} className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-medium text-gray-500">{card.label}</p>
                                    <p className="text-lg font-bold text-gray-900 mt-0.5">{card.value}</p>
                                </div>
                                <div className={`p-2 rounded-full ${card.bg}`}>
                                    <card.icon className={`w-4 h-4 ${card.color}`} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-gray-600 font-medium">S.No.</th>
                                    {['QR ID', 'Ward', 'Zone', 'Zonal Head', 'Building/Street', 'Assigned To', 'Status', 'Scanned By', 'Scan Time'].map((header, idx) => {
                                        const key = ['qrId', 'ward', 'zone', 'zonalHead', 'buildingName', 'assignedTo', 'status', 'scannedBy', 'scanTime'][idx] as keyof ReportRecord;
                                        return (
                                            <th
                                                key={key}
                                                className="px-6 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                                                onClick={() => handleSort(key)}
                                            >
                                                <div className="flex items-center gap-1">
                                                    {header}
                                                    <ArrowUpDown className="w-3 h-3" />
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {sortedData.slice(0, 100).map((row, index) => ( // Limit to 100 for perf, add pagination if needed
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-3 text-gray-500">{index + 1}</td>
                                        <td className="px-6 py-3 font-medium text-gray-900">{row.qrId}</td>
                                        <td className="px-6 py-3 text-gray-600">{row.ward}</td>
                                        <td className="px-6 py-3 text-gray-600">{row.zone}</td>
                                        <td className="px-6 py-3 text-gray-600">{row.zonalHead}</td>
                                        <td className="px-6 py-3 text-gray-600 truncate max-w-[200px]" title={row.buildingName}>{row.buildingName}</td>
                                        <td className="px-6 py-3 text-gray-600">{row.assignedTo}</td>
                                        <td className="px-6 py-3">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                                                    row.status
                                                )}`}
                                            >
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-gray-600">{row.scannedBy}</td>
                                        <td className="px-6 py-3 text-gray-600">{row.scanTime}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {sortedData.length > 100 && (
                            <div className="p-4 text-center text-gray-500 text-xs">
                                Showing first 100 of {sortedData.length} records. Search to find specific items.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
