import React, { useState } from 'react';
import type { ReportRecord } from '../utils/dataProcessor';
import { ArrowUpDown, Search, FileSpreadsheet, FileText, Image as ImageIcon, Trash2 } from 'lucide-react';
import { exportToExcel, exportToPDF, exportToJPEG } from '../utils/exporter';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';

interface UndergroundReportProps {
    data: ReportRecord[];
}

export const UndergroundReport: React.FC<UndergroundReportProps> = ({ data }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof ReportRecord; direction: 'asc' | 'desc' } | null>(null);

    // Filter for Underground Dustbins only
    const undergroundData = React.useMemo(() => {
        return data.filter(item => item.type === 'Underground Dustbin');
    }, [data]);

    const handleSort = (key: keyof ReportRecord) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredData = undergroundData.filter((item) => {
        const matchesSearch = Object.values(item).some((val) =>
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        );
        return matchesSearch;
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

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-orange-100 p-2 rounded-lg">
                            <Trash2 className="w-5 h-5 text-orange-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">
                            Underground Dustbin Report
                        </h3>
                    </div>

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

                        <button
                            onClick={() => exportToExcel(sortedData)}
                            className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
                            title="Export to Excel"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            <span className="hidden sm:inline">Excel</span>
                        </button>

                        <button
                            onClick={() => exportToPDF(sortedData, 'UNDERGROUND DUSTBIN REPORT')}
                            className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                            title="Export to PDF"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="hidden sm:inline">PDF</span>
                        </button>

                        <button
                            onClick={() => exportToJPEG('underground-report-container', 'Underground_Dustbin_Report')}
                            className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
                            title="Export to JPEG"
                        >
                            <ImageIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">JPEG</span>
                        </button>
                    </div>
                </div>

                <div id="underground-report-container" className="bg-white p-4">
                    {/* Professional Logo Header */}
                    <div className="bg-white rounded-xl shadow-lg border-2 border-blue-100 p-6 mb-8">
                        <div className="grid grid-cols-3 items-center gap-6">
                            {/* Left Side - Nagar Nigam Logo */}
                            <div className="flex flex-col items-center sm:items-start">
                                <img
                                    src={nagarNigamLogo}
                                    alt="Nagar Nigam Logo"
                                    className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm"
                                />

                                <p className="hidden sm:block text-[10px] font-bold text-blue-800 mt-2 uppercase tracking-tight text-center sm:text-left">
                                    Nagar Nigam<br />Mathura-Vrindavan
                                </p>
                            </div>

                            {/* Center - Title Section */}
                            <div className="text-center flex flex-col items-center justify-center">
                                <div className="bg-blue-50 px-4 py-1 rounded-full mb-3">
                                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">Official Report</span>
                                </div>
                                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">
                                    UNDERGROUND<br />
                                    <span className="text-blue-600">DUSTBIN REPORT</span>
                                </h1>
                                <div className="h-1 w-20 bg-blue-600 rounded-full mb-2"></div>
                                <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-widest">
                                    Secondary Collection Points
                                </p>
                            </div>

                            {/* Right Side - Nature Green Logo */}
                            <div className="flex flex-col items-center sm:items-end">
                                <img
                                    src={natureGreenLogo}
                                    alt="Nature Green Logo"
                                    className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm"
                                />

                                <p className="hidden sm:block text-[10px] font-bold text-green-700 mt-2 uppercase tracking-tight text-center sm:text-right">
                                    Nature Green<br />Waste Management
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-gray-600 font-medium">S.No.</th>
                                    {['QR ID', 'Site Name', 'Type', 'Ward', 'Zone', 'Status', 'Scanned By', 'Scan Time'].map((header, idx) => {
                                        const key = ['qrId', 'siteName', 'type', 'ward', 'zone', 'status', 'scannedBy', 'scanTime'][idx] as keyof ReportRecord;
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
                                {sortedData.length > 0 ? (
                                    sortedData.map((row, index) => (
                                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-3 text-gray-500">{index + 1}</td>
                                            <td className="px-6 py-3 font-medium text-gray-900">{row.qrId}</td>
                                            <td className="px-6 py-3 text-gray-600">{row.siteName}</td>
                                            <td className="px-6 py-3 text-gray-600">{row.type}</td>
                                            <td className="px-6 py-3 text-gray-600">{row.ward}</td>
                                            <td className="px-6 py-3 text-gray-600">{row.zone}</td>
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
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                                            No Underground Dustbins found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-12 mb-6 text-center">
                    <div className="inline-block bg-white px-8 py-4 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-slate-600 font-medium text-lg tracking-wide">
                            Generated by <span className="font-extrabold text-indigo-600 mx-1">Reports Buddy Pro</span>
                            <span className="text-slate-300 mx-3">|</span>
                            Created by <span className="font-extrabold text-slate-800 mx-1 border-b-2 border-indigo-200">Yuvraj Singh Tomar</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
