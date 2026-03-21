import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, Download, Plus, Trash2, Image } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toJpeg } from 'html-to-image';
import { MASTER_SUPERVISORS } from '../data/master-supervisors';

interface FileData {
    id: string;
    file: File;
    date: string; // "DD" or "YYYY-MM-DD"
    data: any[];
}

interface SupervisorStats {
    id: string;
    name: string;
    number: string;
    dept: string;
    ward: string;
    counts: { [date: string]: string | number };
    total: number;
}

export const NewKycTeamReport: React.FC = () => {
    const [uploadedFiles, setUploadedFiles] = useState<FileData[]>([]);
    const [loading, setLoading] = useState(false);
    const [isGenerated, setIsGenerated] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [wardFilter, setWardFilter] = useState('');
    const [supervisorFilter, setSupervisorFilter] = useState('');

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        setLoading(true);
        const newFiles: FileData[] = [];
        let processedCount = 0;

        Array.from(files).forEach((file) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    // Try to guess date from filename (e.g., "21", "22")
                    const dateMatch = file.name.match(/(\d{1,2})/);
                    const guessedDate = dateMatch ? dateMatch[1] : new Date().getDate().toString();

                    newFiles.push({
                        id: Math.random().toString(36).substr(2, 9),
                        file: file,
                        date: guessedDate,
                        data: results.data
                    });

                    processedCount++;
                    if (processedCount === files.length) {
                        setUploadedFiles(prev => [...prev, ...newFiles]);
                        setLoading(false);
                    }
                }
            });
        });
    };

    const removeFile = (id: string) => {
        setUploadedFiles(prev => prev.filter(f => f.id !== id));
    };

    const updateFileDate = (id: string, newDate: string) => {
        setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, date: newDate } : f));
    };

    const sortedDates = useMemo(() => {
        const dates = uploadedFiles.map(f => f.date);
        return [...new Set(dates)].sort((a, b) => parseInt(a) - parseInt(b));
    }, [uploadedFiles]);

    const reportData = useMemo(() => {
        if (!isGenerated) return [];

        const supervisorMap = new Map<string, SupervisorStats>();

        uploadedFiles.forEach(fileData => {
            fileData.data.forEach(row => {
                const empId = (row['Employee Display ID'] || row['Employee ID'] || row['ID'] || '').trim();
                const name = (row['Employee Name'] || row['Supervisor Name'] || '').trim();
                const mobile = (row['Employee Mobile Number'] || row['Mobile'] || '').trim();
                const count = parseInt(row['Customer Count'] || row['Count'] || '0');

                if (!empId && !name) return;

                const key = empId || name;

                if (!supervisorMap.has(key)) {
                    // Try to find in master data
                    const master = MASTER_SUPERVISORS.find(m => m.empId === empId || m.name.toLowerCase() === name.toLowerCase());

                    supervisorMap.set(key, {
                        id: empId || (master?.empId || 'N/A'),
                        name: name || (master?.name || 'Unknown'),
                        number: mobile || (master?.mobile || 'N/A'),
                        dept: "KYC TEAM", // As per screenshot
                        ward: master?.ward || "3", // Default or from master
                        counts: {},
                        total: 0
                    });
                }

                const stats = supervisorMap.get(key)!;
                stats.counts[fileData.date] = count;
                stats.total += count;
            });
        });

        return Array.from(supervisorMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [isGenerated, uploadedFiles]);

    const filteredReportData = useMemo(() => {
        return reportData.filter(row => {
            const matchesSearch = row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.id.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesWard = wardFilter === '' || row.ward === wardFilter;
            const matchesSupervisor = supervisorFilter === '' || row.name === supervisorFilter;
            return matchesSearch && matchesWard && matchesSupervisor;
        });
    }, [reportData, searchTerm, wardFilter, supervisorFilter]);

    const uniqueWards = useMemo(() => {
        const wards = reportData.map(r => r.ward).filter(w => w && w !== 'NA' && w !== 'N/A');
        return [...new Set(wards)].sort((a, b) => parseInt(a) - parseInt(b));
    }, [reportData]);

    const uniqueSupervisors = useMemo(() => {
        const supervisors = reportData.map(r => r.name).filter(n => n && n !== 'Unknown');
        return [...new Set(supervisors)].sort((a, b) => a.localeCompare(b));
    }, [reportData]);

    const dateTotals = useMemo(() => {
        const totals: { [date: string]: number } = {};
        sortedDates.forEach(date => {
            totals[date] = filteredReportData.reduce((acc, curr) => {
                const val = curr.counts[date];
                return acc + (typeof val === 'number' ? val : 0);
            }, 0);
        });
        return totals;
    }, [filteredReportData, sortedDates]);

    const grandTotal = useMemo(() => {
        return filteredReportData.reduce((acc, curr) => acc + curr.total, 0);
    }, [filteredReportData]);

    const exportPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4');
        const element = document.getElementById('report-table');
        if (!element) return;

        autoTable(doc, {
            html: '#report-table',
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [255, 255, 0], textColor: [0, 0, 0], fontStyle: 'bold' },
            footStyles: { fillColor: [255, 255, 0], textColor: [0, 0, 0], fontStyle: 'bold' },
            didParseCell: (data) => {
                if (data.cell.text[0] === 'ABSENT') {
                    data.cell.styles.fillColor = [255, 204, 203];
                }
                if (data.cell.text[0] === 'NEW JOINING') {
                    data.cell.styles.fillColor = [255, 235, 200];
                }
                // Highlight ward column
                if (data.column.index === 5) {
                    data.cell.styles.fillColor = [255, 165, 0];
                }
            }
        });

        doc.save(`KYC_Team_Report_${new Date().toLocaleDateString()}.pdf`);
    };

    const exportToImage = async () => {
        const element = document.getElementById('report-container');
        if (!element) return;
        try {
            const dataUrl = await toJpeg(element, { quality: 0.95, backgroundColor: '#ffffff', pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `KYC_Team_Report_${new Date().toLocaleDateString()}.jpeg`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Error exporting JPEG:', error);
            alert('Failed to export JPEG');
        }
    };

    const getWardColor = (ward: string) => {
        if (ward === '3') return 'bg-[#ff9900]';
        if (ward === '8') return 'bg-[#ccffcc]';
        return 'bg-[#e2e8f0]';
    };

    const exportExcel = () => {
        const wsData = [
            ["NEW KYC TEAM REPORT"],
            ["S NO", "Supervisor ID", "Supervisor Name", "Supervisor Number", "DEPARTMENT", "WARD", ...sortedDates, "TOTAL"],
            ...filteredReportData.map((r, i) => [
                i + 1,
                r.id,
                r.name,
                r.number,
                r.dept,
                r.ward,
                ...sortedDates.map(d => r.counts[d] || "ABSENT"),
                r.total
            ]),
            ["TOTAL", "", "", "", "", "", ...sortedDates.map(d => dateTotals[d]), grandTotal]
        ];

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Report");
        XLSX.writeFile(wb, "KYC_Team_Report.xlsx");
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-500 rounded-xl shadow-lg shadow-yellow-200">
                            <FileText className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">New KYC Team Report</h1>
                            <p className="text-slate-500 font-medium">Aggregate multiple daily reports</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg cursor-pointer transition-all shadow-md">
                            <Plus className="w-4 h-4" />
                            <span className="font-semibold">Add CSV Files</span>
                            <input type="file" className="hidden" accept=".csv" multiple onChange={handleFileUpload} />
                        </label>

                        {uploadedFiles.length > 0 && (
                            <button
                                onClick={() => setIsGenerated(true)}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-md transition-all"
                            >
                                Generate Report
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {uploadedFiles.length > 0 && !isGenerated && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-bold text-slate-700 mb-4">Uploaded Files</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {uploadedFiles.map((file) => (
                            <div key={file.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-medium text-slate-700 truncate">{file.file.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold">Report Date:</span>
                                            <input
                                                type="text"
                                                value={file.date}
                                                onChange={(e) => updateFileDate(file.id, e.target.value)}
                                                className="w-12 text-xs border border-slate-200 rounded px-1 focus:ring-1 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => removeFile(file.id)} className="p-1 hover:bg-red-50 text-red-500 rounded transition-colors text-xs">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isGenerated && reportData.length > 0 && (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-4 flex-1">
                            <div className="relative flex-1 max-w-sm">
                                <input
                                    type="text"
                                    placeholder="Search by name or ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-3 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <select
                                value={wardFilter}
                                onChange={(e) => setWardFilter(e.target.value)}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all min-w-[120px]"
                            >
                                <option value="">All Wards</option>
                                {uniqueWards.map(ward => (
                                    <option key={ward} value={ward}>Ward {ward}</option>
                                ))}
                            </select>
                            <select
                                value={supervisorFilter}
                                onChange={(e) => setSupervisorFilter(e.target.value)}
                                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all min-w-[160px]"
                            >
                                <option value="">All Supervisors</option>
                                {uniqueSupervisors.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end gap-3 w-full md:w-auto">
                            <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow hover:bg-emerald-700 transition-all">
                                <Download className="w-4 h-4" /> Excel
                            </button>
                            <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold shadow hover:bg-red-700 transition-all">
                                <FileText className="w-4 h-4" /> PDF
                            </button>
                            <button onClick={exportToImage} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow hover:bg-blue-700 transition-all">
                                <Image className="w-4 h-4" /> JPEG
                            </button>
                        </div>
                    </div>

                    <div id="report-container" className="bg-white rounded-xl overflow-hidden shadow-lg border border-slate-200">
                        <div className="overflow-x-auto">
                            <table id="report-table" className="w-full text-center border-collapse">
                                <thead>
                                    <tr className="bg-[#ffff00]">
                                        <th colSpan={7 + sortedDates.length} className="py-3 text-xl font-black text-black border-b border-black">
                                            NEW KYC TEAM REPORT
                                        </th>
                                    </tr>
                                    <tr className="bg-[#ffff00]">
                                        <th className="px-2 py-3 text-xs font-bold border border-black">S NO</th>
                                        <th className="px-3 py-3 text-xs font-bold border border-black">Supervisor ID</th>
                                        <th className="px-4 py-3 text-xs font-bold border border-black">Supervisor Name</th>
                                        <th className="px-4 py-3 text-xs font-bold border border-black">Supervisor Number</th>
                                        <th className="px-3 py-3 text-xs font-bold border border-black">DEPARTMENT</th>
                                        <th className="px-2 py-3 text-xs font-bold border border-black bg-[#ff9900]">WARD</th>
                                        {sortedDates.map(date => (
                                            <th key={date} className="px-2 py-3 text-xs font-bold border border-black">{date}</th>
                                        ))}
                                        <th className="px-3 py-3 text-xs font-bold border border-black bg-[#99ff99]">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredReportData.map((row, index) => (
                                        <tr key={index} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-2 py-2 text-xs font-bold border border-black">{index + 1}</td>
                                            <td className="px-3 py-2 text-xs font-medium border border-black">{row.id}</td>
                                            <td className="px-4 py-2 text-xs font-medium text-left border border-black">{row.name}</td>
                                            <td className="px-4 py-2 text-xs font-medium border border-black">{row.number}</td>
                                            <td className="px-3 py-2 text-xs font-bold border border-black uppercase text-slate-600">{row.dept}</td>
                                            <td className={`px-2 py-2 text-xs font-bold border border-black ${getWardColor(row.ward)}`}>{row.ward}</td>
                                            {sortedDates.map(date => {
                                                const val = row.counts[date];
                                                let bgColor = "bg-white";
                                                let text = val || "ABSENT";

                                                if (!val) bgColor = "bg-[#ffcccc] text-red-700 font-bold";
                                                if (val === "NEW JOINING") bgColor = "bg-[#ffe5b4] text-orange-800 font-bold";

                                                return (
                                                    <td key={date} className={`px-2 py-2 text-xs border border-black ${bgColor}`}>
                                                        {text}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-3 py-2 text-xs font-black border border-black bg-[#90ee90]">{row.total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-[#ffff00] font-black italic">
                                        <td colSpan={6} className="px-4 py-3 text-lg text-center border border-black">TOTAL</td>
                                        {sortedDates.map(date => (
                                            <td key={date} className="px-2 py-3 text-sm border border-black">{dateTotals[date]}</td>
                                        ))}
                                        <td className="px-3 py-3 text-sm border border-black">{grandTotal}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {!loading && uploadedFiles.length === 0 && (
                <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border-2 border-dashed border-slate-300">
                    <div className="p-6 bg-slate-50 rounded-full mb-6">
                        <Upload className="w-12 h-12 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">Upload Daily Reports</h3>
                    <p className="text-slate-500 mb-8 max-w-md text-center">Upload one or more CSV files. Each file should represent one day's data.</p>
                    <label className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-lg shadow-blue-200">
                        Select CSV Files
                        <input type="file" className="hidden" accept=".csv" multiple onChange={handleFileUpload} />
                    </label>
                </div>
            )}

            {loading && (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <span className="ml-4 text-lg font-medium text-slate-600">Processing Files...</span>
                </div>
            )}
        </div>
    );
};

export default NewKycTeamReport;
