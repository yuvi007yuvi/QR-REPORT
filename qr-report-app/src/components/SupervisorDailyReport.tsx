import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { LoadingScreen } from './LoadingScreen';
import { Upload, Table as TableIcon, FileSpreadsheet, Download, Search, User, IndianRupee } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

import { toPng } from 'html-to-image';

interface WardStats {
    amount: number;
    count: number;
}

interface SupervisorDailyRecord {
    date: string;
    supervisorName: string;
    supervisorId: string;
    amount: number;
    transactionCount: number;
    wardStats: { [wardName: string]: WardStats };
}

interface RawCSVRecord {
    "Date": string;
    "Supervisor Name": string;
    "Supervisor ID": string;
    "Amount Collected": string;
    "Ward Name": string;
    [key: string]: string;
}

const SupervisorDailyReport: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<SupervisorDailyRecord[]>([]);

    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [viewMode, setViewMode] = useState<'list' | 'matrix'>('list');
    const [matrixGroupBy, setMatrixGroupBy] = useState<'date' | 'month'>('date');

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;


        setLoading(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rawData = results.data as RawCSVRecord[];
                processData(rawData);
                setTimeout(() => setLoading(false), 1500);
            },
            error: (error) => {
                console.error("Error parsing CSV:", error);
                setLoading(false);
                alert("Failed to parse CSV file.");
            }
        });
    };

    const processData = (rawData: RawCSVRecord[]) => {
        const aggregated: { [key: string]: SupervisorDailyRecord } = {};

        rawData.forEach(row => {
            const date = row["Date"];
            const name = row["Supervisor Name"];
            const id = row["Supervisor ID"];
            const amount = parseFloat(row["Amount Collected"] || "0");
            const ward = row["Ward Name"];

            if (!date || !name) return;

            // Simple validation to ensure date format is DD/MM/YYYY
            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) return;

            const key = `${date}-${id}`;

            if (!aggregated[key]) {
                aggregated[key] = {
                    date,
                    supervisorName: name,
                    supervisorId: id,
                    amount: 0,
                    transactionCount: 0,
                    wardStats: {}
                };
            }

            aggregated[key].amount += amount;
            aggregated[key].transactionCount += 1;

            if (ward) {
                if (!aggregated[key].wardStats[ward]) {
                    aggregated[key].wardStats[ward] = { amount: 0, count: 0 };
                }
                aggregated[key].wardStats[ward].amount += amount;
                aggregated[key].wardStats[ward].count += 1;
            }
        });

        const result = Object.values(aggregated).sort((a, b) => {
            const dateA = new Date(a.date.split('/').reverse().join('-'));
            const dateB = new Date(b.date.split('/').reverse().join('-'));
            return dateB.getTime() - dateA.getTime() || a.supervisorName.localeCompare(b.supervisorName);
        });

        setData(result);
    };

    const filteredData = useMemo(() => {
        return data.filter(item => {
            const matchesSearch =
                item.supervisorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.supervisorId.toLowerCase().includes(searchTerm.toLowerCase());

            let matchesDate = true;
            if (startDate || endDate) {
                const [day, month, year] = item.date.split('/');
                const itemDate = new Date(`${year}-${month}-${day}`);

                if (startDate) {
                    const start = new Date(startDate);
                    if (itemDate < start) matchesDate = false;
                }

                if (endDate && matchesDate) {
                    const end = new Date(endDate);
                    if (itemDate > end) matchesDate = false;
                }
            }

            return matchesSearch && matchesDate;
        });
    }, [data, searchTerm, startDate, endDate]);

    const totalStats = useMemo(() => {
        return filteredData.reduce((acc, curr) => ({
            amount: acc.amount + curr.amount,
            count: acc.count + curr.transactionCount
        }), { amount: 0, count: 0 });
    }, [filteredData]);

    // Matrix Data Calculation
    const matrixData = useMemo(() => {
        if (viewMode !== 'matrix') return { headers: [], rows: [] };

        const headerSet = new Set<string>();
        // Modified map structure to include wardStats in cell data
        const supervisorMap = new Map<string, { name: string, data: { [key: string]: { amount: number, count: number, wardStats: { [ward: string]: WardStats } } } }>();

        filteredData.forEach(item => {
            let headerKey = item.date;

            if (matrixGroupBy === 'month') {
                const [day, month, year] = item.date.split('/');
                const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                headerKey = dateObj.toLocaleString('default', { month: 'short', year: 'numeric' });
            }

            headerSet.add(headerKey);

            if (!supervisorMap.has(item.supervisorId)) {
                supervisorMap.set(item.supervisorId, {
                    name: item.supervisorName,
                    data: {}
                });
            }

            const supervisor = supervisorMap.get(item.supervisorId)!;
            if (!supervisor.data[headerKey]) {
                supervisor.data[headerKey] = { amount: 0, count: 0, wardStats: {} };
            }
            supervisor.data[headerKey].amount += item.amount;
            supervisor.data[headerKey].count += item.transactionCount;

            // Merge ward stats
            Object.entries(item.wardStats).forEach(([ward, stats]) => {
                if (!supervisor.data[headerKey].wardStats[ward]) {
                    supervisor.data[headerKey].wardStats[ward] = { amount: 0, count: 0 };
                }
                supervisor.data[headerKey].wardStats[ward].amount += stats.amount;
                supervisor.data[headerKey].wardStats[ward].count += stats.count;
            });
        });

        // Sort Headers
        const sortedHeaders = Array.from(headerSet).sort((a, b) => {
            if (matrixGroupBy === 'date') {
                const dateA = new Date(a.split('/').reverse().join('-'));
                const dateB = new Date(b.split('/').reverse().join('-'));
                return dateA.getTime() - dateB.getTime();
            } else {
                const dateA = new Date(a);
                const dateB = new Date(b);
                return dateA.getTime() - dateB.getTime();
            }
        });

        // Sort Rows (Supervisors)
        const sortedRows = Array.from(supervisorMap.entries()).sort((a, b) =>
            a[1].name.localeCompare(b[1].name)
        );

        return { headers: sortedHeaders, rows: sortedRows };
    }, [filteredData, viewMode, matrixGroupBy]);

    const exportToExcel = () => {
        if (viewMode === 'list') {
            const ws = XLSX.utils.json_to_sheet(filteredData.map(item => ({
                "Date": item.date,
                "Supervisor Name": item.supervisorName,
                "Supervisor ID": item.supervisorId,
                "Total Amount": item.amount,
                "Transactions": item.transactionCount,
                "Ward Details": Object.entries(item.wardStats).map(([w, s]) => `${w}: ₹${s.amount}(${s.count})`).join(" | ")
            })));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Supervisor Analysis");
            XLSX.writeFile(wb, "Supervisor_Work_Analysis.xlsx");
        } else {
            // Matrix Export
            const headers = ['Supervisor ID', 'Supervisor Name', ...matrixData.headers];
            const dataRows = matrixData.rows.map(([id, { name, data }]) => {
                const row: any = { 'Supervisor ID': id, 'Supervisor Name': name };
                matrixData.headers.forEach(header => {
                    const cell = data[header];
                    if (cell) {
                        const wardDetails = Object.entries(cell.wardStats)
                            .map(([w, s]) => `${w.replace(/^\d+-/, '')}: ₹${s.amount}(${s.count})`)
                            .join('\n');
                        row[header] = `Total: ₹${cell.amount} (${cell.count})\n${wardDetails}`;
                    } else {
                        row[header] = 'No Collection';
                    }
                });
                return row;
            });
            const ws = XLSX.utils.json_to_sheet(dataRows, { header: headers });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Matrix Analysis");
            XLSX.writeFile(wb, `Supervisor_Matrix_${matrixGroupBy}.xlsx`);
        }
    };

    const exportToPDF = async () => {
        const tableElement = document.getElementById('supervisor-report-table');
        if (!tableElement) {
            alert('Table not found for export');
            return;
        }

        try {
            const originalCursor = document.body.style.cursor;
            document.body.style.cursor = 'wait';


            // Capture the table as PNG
            const dataUrl = await toPng(tableElement, {
                quality: 1.0,
                pixelRatio: 2,
                cacheBust: true,
                backgroundColor: '#ffffff' // Ensure white background
            });

            const img = new Image();
            img.src = dataUrl;
            await new Promise((resolve) => { img.onload = resolve; });

            // A4 landscape dimensions
            const pdfWidth = 297;
            const pdfHeight = 210;
            const margin = 5;
            const availableWidth = pdfWidth - (2 * margin);
            const availableHeight = pdfHeight - (2 * margin);

            let imgWidth = availableWidth;
            let imgHeight = (img.height * imgWidth) / img.width;

            const pdf = new jsPDF('l', 'mm', 'a4');

            if (imgHeight <= availableHeight) {
                pdf.addImage(dataUrl, 'PNG', margin, margin, imgWidth, imgHeight);
            } else {
                let currentY = 0;
                while (currentY < img.height) {
                    if (currentY > 0) pdf.addPage();

                    const sliceHeight = (availableHeight * img.width) / availableWidth;
                    const remainingHeight = img.height - currentY;
                    const actualSliceHeight = Math.min(sliceHeight, remainingHeight);

                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = actualSliceHeight;
                    const ctx = canvas.getContext('2d');

                    if (ctx) {
                        ctx.drawImage(img, 0, currentY, img.width, actualSliceHeight, 0, 0, img.width, actualSliceHeight);
                        const sliceDataUrl = canvas.toDataURL('image/png');
                        const sliceImgHeight = (actualSliceHeight * availableWidth) / img.width;
                        pdf.addImage(sliceDataUrl, 'PNG', margin, margin, availableWidth, sliceImgHeight);
                    }
                    currentY += actualSliceHeight;
                }
            }

            pdf.save(`Supervisor_Daily_Report_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.style.cursor = originalCursor;

        } catch (error) {
            console.error('Error exporting PDF:', error);
            alert('Failed to export PDF.');

            document.body.style.cursor = 'default';
        }
    };

    if (loading) {
        return <LoadingScreen title="Processing Supervisor Data" />;
    }

    if (data.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <div className="bg-blue-100 p-4 rounded-full mb-4 animate-bounce">
                    <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Upload Supervisor Report</h2>
                <p className="text-gray-500 mb-6 text-center max-w-md">
                    Upload the daily UCC report CSV to analyze supervisor performance.
                </p>
                <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-lg transition-all flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    <span>Select CSV File</span>
                    <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                </label>
            </div>
        );
    }

    // Only replacing the render part for matrix view to show wards stats
    const renderMatrixView = () => (
        <div className="overflow-auto flex-1">
            <table id="supervisor-report-table" className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 shadow-sm">
                    {/* Header with Logos */}
                    <tr className="bg-white border-b border-gray-200">
                        <th colSpan={2 + matrixData.headers.length} className="py-4 px-6">
                            <div className="flex items-center justify-between">
                                <div className="flex-shrink-0">
                                    <img src="/src/assets/nagar-nigam-logo.png" alt="Nagar Nigam Logo" className="h-16 w-auto object-contain" />
                                </div>
                                <div className="flex-grow text-center px-4">
                                    <h1 className="text-xl font-bold text-gray-800">Mathura Vrindavan Nagar Nigam</h1>
                                    <h2 className="text-sm font-semibold text-blue-700">Supervisor Daily Performance Report</h2>
                                </div>
                                <div className="flex-shrink-0">
                                    <img src="/src/assets/NatureGreen_Logo.png" alt="Nature Green Logo" className="h-16 w-auto object-contain" />
                                </div>
                            </div>
                        </th>
                    </tr>
                    <tr className="sticky top-0 z-20 bg-gray-50">
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-30 border-r border-gray-200 min-w-[200px]">
                            Supervisor Name
                        </th>
                        {matrixData.headers.map(header => (
                            <th key={header} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right min-w-[180px] whitespace-nowrap">
                                {header}
                            </th>
                        ))}
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right sticky right-0 bg-gray-100 z-30 border-l border-gray-200 min-w-[100px]">
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {matrixData.rows.map(([id, { name, data }]) => {
                        const rowTotal = Object.values(data).reduce((acc, curr) => acc + curr.amount, 0);
                        return (
                            <tr key={id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap sticky left-0 bg-white z-10 border-r border-gray-200 group-hover:bg-gray-50 align-top">
                                    <div className="flex flex-col">
                                        <span>{name}</span>
                                        <span className="text-xs text-gray-500 font-mono">{id}</span>
                                    </div>
                                </td>
                                {matrixData.headers.map(header => {
                                    const cell = data[header];
                                    return (
                                        <td key={header} className="px-4 py-3 text-sm text-right border-r border-gray-100 last:border-0 align-top">
                                            {cell ? (
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex justify-between items-baseline gap-2 border-b border-gray-100 pb-1 mb-1">
                                                        <span className="text-xs text-gray-500 font-medium">Total</span>
                                                        <div className="text-right">
                                                            <span className="font-bold text-green-700 block">₹{cell.amount.toLocaleString()}</span>
                                                            <span className="text-[10px] text-gray-400 block leading-none">{cell.count} txns</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {Object.entries(cell.wardStats).map(([ward, stats]) => (
                                                            <div key={ward} className="flex justify-between items-start text-xs group/ward hover:bg-gray-50 rounded px-1 -mx-1">
                                                                <span className="text-gray-600 truncate max-w-[80px] my-auto" title={ward}>
                                                                    {ward.replace(/^\d+-/, '')}
                                                                </span>
                                                                <div className="text-right">
                                                                    <span className="font-medium text-gray-800 block">₹{stats.amount}</span>
                                                                    <span className="text-[10px] text-gray-400 block leading-none">{stats.count} slips</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-300 text-xs italic text-center block py-2">No Collection</span>
                                            )}
                                        </td>
                                    );
                                })}
                                <td className="px-4 py-3 text-sm text-gray-900 font-bold text-right sticky right-0 bg-gray-50 z-10 border-l border-gray-200 align-top">
                                    ₹{rowTotal.toLocaleString('en-IN')}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="p-6 space-y-6 h-full flex flex-col">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <IndianRupee className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-sm font-medium text-blue-100">Total Collection</h3>
                    </div>
                    <p className="text-3xl font-bold">₹{totalStats.amount.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <TableIcon className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-sm font-medium text-green-100">Total Transactions</h3>
                    </div>
                    <p className="text-3xl font-bold">{totalStats.count.toLocaleString('en-IN')}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <User className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-sm font-medium text-purple-100">Active Supervisors</h3>
                    </div>
                    <p className="text-3xl font-bold">{new Set(filteredData.map(d => d.supervisorId)).size}</p>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex gap-4 flex-1 min-w-[300px]">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search supervisor..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                    </div>
                    {/* Date Range Filter */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs font-medium bg-white px-1">From</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm w-[160px]"
                            />
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs font-medium bg-white px-1">To</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm w-[150px]"
                            />
                        </div>
                    </div>

                    {/* View Toggles */}
                    <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            List View
                        </button>
                        <button
                            onClick={() => setViewMode('matrix')}
                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'matrix' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Matrix View
                        </button>
                    </div>

                    {viewMode === 'matrix' && (
                        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                            <button
                                onClick={() => setMatrixGroupBy('date')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${matrixGroupBy === 'date' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Date Wise
                            </button>
                            <button
                                onClick={() => setMatrixGroupBy('month')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${matrixGroupBy === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Month Wise
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={exportToExcel}
                        className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg font-medium transition-colors"
                    >
                        <FileSpreadsheet className="w-4 h-4" /> Excel
                    </button>
                    <button
                        onClick={exportToPDF}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-medium transition-colors"
                    >
                        <Download className="w-4 h-4" /> PDF
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                {viewMode === 'list' ? (
                    <div className="overflow-x-auto flex-1">
                        <table id="supervisor-report-table" className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                {/* Header with Logos */}
                                <tr className="bg-white border-b border-gray-200">
                                    <th colSpan={5} className="py-4 px-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-shrink-0">
                                                <img src="/src/assets/nagar-nigam-logo.png" alt="Nagar Nigam Logo" className="h-16 w-auto object-contain" />
                                            </div>
                                            <div className="flex-grow text-center px-4">
                                                <h1 className="text-xl font-bold text-gray-800">Mathura Vrindavan Nagar Nigam</h1>
                                                <h2 className="text-sm font-semibold text-blue-700">Supervisor Daily Performance Report</h2>
                                            </div>
                                            <div className="flex-shrink-0">
                                                <img src="/src/assets/NatureGreen_Logo.png" alt="Nature Green Logo" className="h-16 w-auto object-contain" />
                                            </div>
                                        </div>
                                    </th>
                                </tr>
                                <tr className="sticky top-0 z-10 bg-gray-50">
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Supervisor Name</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Supervisor ID</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Transactions</th>
                                    <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Amount Collected</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 overflow-y-auto">
                                {filteredData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-sm text-gray-900 font-medium whitespace-nowrap">{row.date}</td>
                                        <td className="px-6 py-4 text-sm text-gray-700">{row.supervisorName}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500 font-mono text-xs">{row.supervisorId}</td>
                                        <td className="px-6 py-4 text-sm text-gray-900 text-right font-medium">{row.transactionCount}</td>
                                        <td className="px-6 py-4 text-sm text-green-600 text-right font-bold">₹{row.amount.toLocaleString('en-IN')}</td>
                                    </tr>
                                ))}
                                {filteredData.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                            No data found matching your filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    renderMatrixView()
                )}
            </div>
        </div>
    );
};

export default SupervisorDailyReport;
