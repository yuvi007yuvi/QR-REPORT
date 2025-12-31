import React, { useState } from 'react';
import Papa from 'papaparse';
import {
    Upload,
    Download,
    User
} from 'lucide-react';
import { exportToJPEG } from '../utils/exporter';



import { MASTER_SUPERVISORS } from '../data/master-supervisors';

interface DailyKYCData {
    date: string;
    count: number;
    supervisors: { empId: string; name: string; department: string; count: number; records: any[] }[];
}

interface SupervisorDetail {
    empId: string;
    name: string;
    department: string;
    count: number;
    records: any[];
}

export const KYCCalendarView: React.FC = () => {
    const [fileName, setFileName] = useState<string | null>(null);

    const [dailyData, setDailyData] = useState<DailyKYCData[]>([]);
    const [loading, setLoading] = useState(false);

    // New State for Dashboard View
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedSupervisor, setSelectedSupervisor] = useState<SupervisorDetail | null>(null);

    // Auto-select latest date on data load
    React.useEffect(() => {
        if (dailyData.length > 0 && !selectedDate) {
            const sortedDates = [...dailyData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setSelectedDate(sortedDates[0].date);
        }
    }, [dailyData]);

    const currentDayData = React.useMemo(() => {
        return dailyData.find(d => d.date === selectedDate);
    }, [dailyData, selectedDate]);

    const sortedSupervisors = React.useMemo(() => {
        if (!currentDayData) return [];
        return [...currentDayData.supervisors].sort((a, b) => {
            // Sort by KYC Count (High to Low), then 0s at bottom
            if (a.count === 0 && b.count > 0) return 1;
            if (b.count === 0 && a.count > 0) return -1;
            return b.count - a.count;
        });
    }, [currentDayData]);


    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setLoading(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as any[];
                const dailyRecords: Record<string, DailyKYCData> = {};

                // Find the likely columns (flexible matching)
                const headers = results.meta.fields || [];
                const empIdHeader = headers.find(h =>
                    h.toLowerCase().includes('supervisor id') ||
                    h.toLowerCase().includes('employee display id') ||
                    (h.toLowerCase().includes('id') && !h.toLowerCase().includes('customer')) // Avoid 'Customer ID'
                );

                // Count logic: In 'customers.csv', each row is 1 count. 
                // Checks for specific count column or defaults to row-based counting.
                let countHeader = headers.find(h =>
                    h.toLowerCase().includes('customer count') ||
                    h.toLowerCase().includes('kyc done')
                );

                const nameHeader = headers.find(h =>
                    h.toLowerCase().includes('supervisor name') ||
                    h.toLowerCase().includes('employee name')
                );

                const dateHeader = headers.find(h =>
                    h.toLowerCase().includes('created date') || // Prioritize 'Created Date' for customers csv
                    h.toLowerCase().includes('date')
                );

                if (empIdHeader) {
                    data.forEach(row => {
                        const id = String(row[empIdHeader] || '').trim().toUpperCase();
                        const dateValue = dateHeader ? String(row[dateHeader] || '').trim() : '';

                        // If 'countHeader' exists (like in SupervisorKYC.csv), use it.
                        // Otherwise (like in customers.csv), each row is 1 count.
                        const count = countHeader ? (parseInt(row[countHeader]) || 0) : 1;

                        if (id) {


                            // Aggregate by date
                            if (dateValue) {
                                const normalizedDate = normalizeDate(dateValue);
                                if (!dailyRecords[normalizedDate]) {
                                    dailyRecords[normalizedDate] = {
                                        date: normalizedDate,
                                        count: 0,
                                        supervisors: []
                                    };
                                }
                                dailyRecords[normalizedDate].count += count;

                                const supIndex = dailyRecords[normalizedDate].supervisors.findIndex(s => s.empId === id);
                                if (supIndex >= 0) {
                                    dailyRecords[normalizedDate].supervisors[supIndex].count += count;
                                    dailyRecords[normalizedDate].supervisors[supIndex].records.push(row);
                                } else {
                                    // Try to find department from Master List
                                    const masterSup = MASTER_SUPERVISORS.find(ms => ms.empId === id);
                                    const dept = masterSup ? masterSup.department : 'UCC'; // Default to UCC if unknown

                                    dailyRecords[normalizedDate].supervisors.push({
                                        empId: id,
                                        name: nameHeader ? row[nameHeader] : id,
                                        department: dept,
                                        count: count,
                                        records: [row]
                                    });
                                }
                            }
                        }
                    });

                    setDailyData(Object.values(dailyRecords).sort((a, b) =>
                        new Date(a.date).getTime() - new Date(b.date).getTime()
                    ));
                } else {
                    alert("Could not find Employee ID column in the CSV. Please ensure the CSV has a column containing 'ID', 'EMP', or 'CODE'.");
                }
                setLoading(false);
            },
            error: (error) => {
                console.error("PapaParse error:", error);
                alert("Error parsing CSV file.");
                setLoading(false);
            }
        });
    };

    const normalizeDate = (dateStr: string): string => {
        if (!dateStr) return '';

        // Handle DD/MM/YYYY explicitly (common in this dataset)
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            // Check for DD/MM/YYYY (e.g. 31/12/2025)
            if (parts.length === 3) {
                // Assuming DD/MM/YYYY
                const day = parts[0].padStart(2, '0');
                const month = parts[1].padStart(2, '0');
                const year = parts[2];
                // basic validation
                if (parseInt(day) <= 31 && parseInt(month) <= 12) {
                    return `${year}-${month}-${day}`;
                }
            }
        }

        try {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
        } catch (e) {
            console.error("Date parse error", e);
        }
        return dateStr;
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-screen font-sans text-slate-900">
            {/* 1. Header & Controls */}
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Title & Upload Row */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Daily KYC Survey Report</h1>
                        <p className="text-slate-500 font-medium">Operational Dashboard & Management Review</p>
                    </div>
                    <div className="flex gap-3">
                        <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg shadow-sm hover:bg-slate-50 cursor-pointer transition text-sm font-semibold text-slate-700">
                            <Upload className="w-4 h-4" />
                            {fileName || "Upload CSV"}
                            <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={loading} />
                        </label>
                        <button onClick={() => exportToJPEG('daily-dashboard', `KYC_Report_${selectedDate}`)} className="p-2 bg-white border border-slate-300 rounded-lg text-slate-600 hover:text-blue-600 hover:border-blue-300 transition shadow-sm">
                            <Download className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 2. Date Selection & Key Metrics Bar */}
                {dailyData.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
                        {/* Date Picker */}
                        <div className="p-4 flex flex-col gap-1 min-w-[200px]">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Date</span>
                            <input
                                type="date"
                                className="font-bold text-slate-800 outline-none text-lg bg-transparent cursor-pointer"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>

                        {/* Day Display */}
                        <div className="p-4 flex flex-col gap-1 flex-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Day</span>
                            <span className="text-lg font-bold text-slate-700">
                                {selectedDate ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long' }) : '-'}
                            </span>
                        </div>

                        {/* Total KYC Count */}
                        <div className="p-4 flex flex-col gap-1 flex-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total KYC Count</span>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black text-emerald-600">
                                    {currentDayData?.count.toLocaleString() || 0}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase">
                                    Completed
                                </span>
                            </div>
                        </div>

                        {/* Active Supervisors */}
                        <div className="p-4 flex flex-col gap-1 flex-1">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Supervisors</span>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-black text-blue-600">
                                    {currentDayData?.supervisors.filter(s => s.count > 0).length || 0}
                                </span>
                                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase">
                                    On Duty
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. Supervisor Breakdown Grid */}
                {dailyData.length > 0 ? (
                    <div id="daily-dashboard" className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <User className="w-5 h-5 text-slate-500" />
                                Supervisor Performance
                            </h3>
                            <span className="text-xs font-semibold text-slate-500">
                                Showing {sortedSupervisors.length} Staff
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                            {sortedSupervisors.map((sup, index) => {
                                const isZero = sup.count === 0;
                                return (
                                    <div
                                        key={sup.empId}
                                        onClick={() => setSelectedSupervisor(sup)}
                                        className={`
                                            relative flex flex-col justify-between p-4 rounded-xl border transition-all cursor-pointer select-none
                                            ${isZero
                                                ? 'bg-slate-50 border-slate-100 opacity-70 hover:opacity-100 hover:border-slate-300'
                                                : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 hover:-translate-y-1'
                                            }
                                        `}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className={`
                                                w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                                                ${index < 3 && !isZero ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}
                                            `}>
                                                {index + 1}
                                            </div>
                                            {!isZero && (
                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                                            )}
                                        </div>

                                        <div className="mb-3">
                                            <p className={`font-bold text-sm leading-tight line-clamp-2 ${isZero ? 'text-slate-500' : 'text-slate-800'}`}>
                                                {sup.name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sup.department === 'UCC' ? 'bg-orange-100 text-orange-700' :
                                                    sup.department === 'C&T' ? 'bg-emerald-100 text-emerald-700' :
                                                        'bg-slate-100 text-slate-500'
                                                    }`}>
                                                    {sup.department}
                                                </span>
                                                <p className="text-[10px] text-slate-400 font-mono">{sup.empId}</p>
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-100 pt-3 flex items-end justify-between">
                                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">KYC Done</span>
                                            <span className={`text-2xl font-black leading-none ${isZero ? 'text-slate-300' : 'text-slate-900'}`}>
                                                {sup.count}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-xl border border-dashed border-slate-300">
                        <Upload className="w-12 h-12 mb-4 opacity-50" />
                        <p className="font-semibold">Upload a CSV file to view the report</p>
                    </div>
                )}
            </div>

            {/* Supervisor Detail Modal */}
            {selectedSupervisor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedSupervisor(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">{selectedSupervisor.name}</h3>
                                <p className="text-sm text-slate-500 font-medium">Employee ID: {selectedSupervisor.empId}</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-2xl font-black text-blue-600">{selectedSupervisor.count}</span>
                                <span className="text-xs font-bold text-slate-400 uppercase">Total KYC</span>
                            </div>
                        </div>

                        <div className="overflow-y-auto p-0 md:p-2">
                            {/* Simple Table of Records */}
                            {selectedSupervisor.records.length > 0 ? (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold uppercase text-xs sticky top-0">
                                        <tr>
                                            <th className="px-4 py-3">#</th>
                                            <th className="px-4 py-3">Customer Name / Details</th>
                                            <th className="px-4 py-3">Property / Mobile</th>
                                            <th className="px-4 py-3">Date/Time</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {selectedSupervisor.records.map((rec, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-800">{rec['Customer Name'] || rec['Party Name'] || "N/A"}</div>
                                                    <div className="text-xs text-slate-500">{rec['Property Type Name'] || ''}</div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-600">
                                                    <div>{rec['Property Number'] || rec['House Number'] || '-'}</div>
                                                    <div className="text-xs text-slate-400 font-mono">{rec['Mobile Number'] || rec['Customer Mobile Number'] || ''}</div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                                                    {rec['Created Time'] || rec['Time'] || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-8 text-center text-slate-400">No detailed record data available.</div>
                            )}
                        </div>

                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setSelectedSupervisor(null)}
                                className="px-6 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition shadow-sm"
                            >
                                Close Stats
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
