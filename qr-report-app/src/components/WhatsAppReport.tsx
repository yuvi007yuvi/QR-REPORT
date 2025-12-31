import React, { useState, useMemo, useRef } from 'react';
import { Upload, Search, Download, Filter, Calendar, Image as ImageIcon } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MASTER_SUPERVISORS } from '../data/master-supervisors';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';

export const WhatsAppReport: React.FC = () => {
    const [kycData, setKycData] = useState<any[]>([]);
    const [fileName, setFileName] = useState<string>('');

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedZone, setSelectedZone] = useState<string>('');
    const [selectedDepartment, setSelectedDepartment] = useState<string>('');
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data;
                setKycData(data);
            },
            error: () => {
                alert('Error parsing CSV');
            }
        });
    };

    const normalizeDate = (dateStr: string) => {
        if (!dateStr) return '';
        if (dateStr.includes('/')) {
            const [d, m, y] = dateStr.split('/');
            if (d && m && y) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        return dateStr.split(' ')[0];
    };

    const allAvailableDates = useMemo(() => {
        if (kycData.length === 0) return [];
        const dates = new Set<string>();
        kycData.forEach((row: any) => {
            const d = normalizeDate(row['Created Date'] || row['Date'] || '');
            if (d) dates.add(d);
        });
        return Array.from(dates).sort();
    }, [kycData]);

    const filteredDates = useMemo(() => {
        if (!startDate && !endDate) return allAvailableDates;

        return allAvailableDates.filter(date => {
            if (startDate && date < startDate) return false;
            if (endDate && date > endDate) return false;
            return true;
        });
    }, [allAvailableDates, startDate, endDate]);

    const reportData = useMemo(() => {
        return MASTER_SUPERVISORS.map((sup, index) => {
            const rowData: any = {
                sNo: (index + 1).toString(),
                zone: sup.zonal,
                ward: sup.ward,
                supervisorName: sup.name,
                department: sup.department,
                total: 0
            };

            filteredDates.forEach(date => {
                let count = 0;
                if (kycData.length > 0) {
                    count = kycData.filter((row: any) => {
                        const rowDate = normalizeDate(row['Created Date'] || row['Date'] || '');
                        const rowId = (row['Supervisor ID'] || row['Employee ID'] || '').toString().trim().toUpperCase();

                        return rowDate === date && rowId === sup.empId;
                    }).length;
                }
                rowData[date] = count;
                rowData.total += count;
            });

            return rowData;
        });

    }, [kycData, filteredDates]);

    const filteredReport = reportData.filter((row: any) => {
        const matchesSearch =
            row.supervisorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            row.ward.toLowerCase().includes(searchTerm.toLowerCase()) ||
            row.zone.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesZone = selectedZone ? row.zone === selectedZone : true;
        const matchesDept = selectedDepartment ? row.department === selectedDepartment : true;

        return matchesSearch && matchesZone && matchesDept;
    });

    const uniqueZones = useMemo(() => Array.from(new Set(MASTER_SUPERVISORS.map(s => s.zonal))).sort(), []);
    const uniqueDepartments = useMemo(() => Array.from(new Set(MASTER_SUPERVISORS.map(s => s.department))).sort(), []);

    const departmentSummary = useMemo(() => {
        const summary: Record<string, number> = {};
        let grandTotal = 0;

        uniqueDepartments.forEach(dept => summary[dept] = 0);

        filteredReport.forEach((row: any) => {
            if (summary[row.department] !== undefined) {
                summary[row.department] += row.total;
            }
            grandTotal += row.total;
        });

        return { summary, grandTotal };
    }, [filteredReport, uniqueDepartments]);

    const handleExportPDF = async () => {
        const doc = new jsPDF('l', 'mm', 'a4');

        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.src = src;
                img.onload = () => resolve(img);
                img.onerror = reject;
            });
        };

        try {
            const img1 = await loadImage(NagarNigamLogo);
            const img2 = await loadImage(NatureGreenLogo);

            doc.addImage(img1, 'PNG', 14, 10, 25, 25);
            doc.addImage(img2, 'PNG', 42, 12, 30, 20);

            doc.setFontSize(18);
            doc.setTextColor(0, 0, 0);
            doc.text('Mathura Vrindavan Nagar Nigam', 80, 20);

            doc.setFontSize(12);
            doc.setTextColor(0, 100, 0);
            doc.text('Daily KYC Target Monitoring Report', 80, 28);

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 250, 20);

        } catch (e) {
            console.warn("Could not load images for PDF", e);
            doc.setFontSize(18);
            doc.text('Ward-wise Daily Target Matrix', 14, 20);
        }

        const tableHead = [
            ['S.No', 'Zone', 'Ward', 'Supervisor', 'Department', ...filteredDates.map(d => d.split('-')[2]), 'Total']
        ];

        const tableBody = filteredReport.map((row: any) => [
            row.sNo,
            row.zone,
            row.ward,
            row.supervisorName,
            row.department,
            ...filteredDates.map(date => row[date] !== undefined ? row[date] : 0),
            row.total
        ]);

        // Dynamic column styles for dates to ensure they don't wrap and are uniform
        const dateColumnStyles: any = {};
        filteredDates.forEach((_, index) => {
            // column index starts at 5 (S.No, Zone, Ward, Supervisor, Dept are 0-4)
            // Use cellWidth: 5 (5mm) which fits 2 digits like '25' at font size 7 without wrapping if padding is small
            dateColumnStyles[5 + index] = { cellWidth: 5, minCellWidth: 5, cellPadding: { top: 1, bottom: 1, left: 0.5, right: 0.5 } };
        });

        autoTable(doc, {
            head: tableHead,
            body: tableBody,
            startY: 40,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, halign: 'center', lineWidth: 0.1, lineColor: [200, 200, 200] },
            styles: {
                fontSize: 7,
                cellPadding: 1,
                halign: 'center',
                lineColor: [200, 200, 200],
                lineWidth: 0.1,
                overflow: 'linebreak', // Default, but with fixed width it should fit
                cellWidth: 'wrap' // Try to fit content on one line if possible
            },
            columnStyles: {
                0: { cellWidth: 8 },  // S.No
                1: { cellWidth: 15 }, // Zone
                2: { cellWidth: 10 }, // Ward
                3: { minCellWidth: 35, halign: 'left', cellWidth: 'auto' }, // Supervisor
                4: { cellWidth: 12 }, // Dept
                ...dateColumnStyles
            },
            didParseCell: (data) => {
                const { section, column, cell } = data;
                const totalColIndex = 5 + filteredDates.length;

                if (section === 'body') {
                    if (column.index >= 5 && column.index < totalColIndex) {
                        const val = parseInt(cell.raw as string);

                        if (!isNaN(val)) {
                            // Ensure internal padding is minimal for numbers
                            cell.styles.cellPadding = 0.5;

                            if (val >= 20) {
                                cell.styles.fillColor = [209, 250, 229]; // emerald-100 (Green)
                                cell.styles.textColor = [4, 120, 87];   // emerald-700
                                cell.styles.fontStyle = 'bold';
                            } else if (val >= 1) {
                                cell.styles.fillColor = [254, 249, 195]; // yellow-100 (Yellow)
                                cell.styles.textColor = [161, 98, 7];   // yellow-700
                                cell.styles.fontStyle = 'bold';
                            } else {
                                // 0
                                cell.styles.fillColor = [254, 226, 226]; // red-100 (Red)
                                cell.styles.textColor = [185, 28, 28];  // red-700
                            }
                        }
                    }

                    if (column.index === totalColIndex) {
                        cell.styles.fillColor = [240, 240, 240]; // Light gray 
                        cell.styles.textColor = [0, 0, 0];       // Black
                        cell.styles.fontStyle = 'bold';
                        cell.styles.cellWidth = 10;
                    }
                }
            }
        });

        doc.save('daily-target-matrix.pdf');
    };

    const reportRef = useRef<HTMLDivElement>(null);

    const handleExportJPEG = async () => {
        if (!reportRef.current) return;

        try {
            const dataUrl = await toJpeg(reportRef.current, {
                quality: 0.95,
                backgroundColor: '#ffffff',
                pixelRatio: 2 // Improve quality
            });

            const link = document.createElement('a');
            link.download = `daily-target-matrix-${new Date().toISOString().split('T')[0]}.jpeg`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Error exporting JPEG:', error);
            alert('Failed to export JPEG.');
        }
    };

    return (
        <div className="p-8 bg-white min-h-screen" ref={reportRef}>
            <div className="max-w-full mx-auto space-y-6">

                {/* Header */}
                <div className="flex flex-col gap-6 border-b border-gray-200 pb-6">
                    {/* Top Row with Logos */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <img src={NagarNigamLogo} alt="Nagar Nigam" className="h-16 w-auto object-contain drop-shadow-sm" />
                            <div className="h-12 w-px bg-gray-300 mx-2 hidden md:block"></div>
                            <img src={NatureGreenLogo} alt="Nature Green" className="h-12 w-auto object-contain drop-shadow-sm" />
                            <div className="h-12 w-px bg-gray-300 mx-2 hidden md:block"></div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900 leading-tight uppercase tracking-tight">Mathura Vrindavan Nagar Nigam</h2>
                                <p className="text-sm text-emerald-600 font-bold tracking-wide">Daily KYC Target Monitoring Report</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 cursor-pointer font-medium transition text-sm">
                                <Upload className="w-4 h-4" />
                                {fileName || "Upload KYC CSV"}
                                <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                            </label>
                            <button
                                onClick={handleExportPDF}
                                disabled={filteredReport.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download className="w-4 h-4" />
                                Export PDF
                            </button>
                            <button
                                onClick={handleExportJPEG}
                                disabled={filteredReport.length === 0}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <ImageIcon className="w-4 h-4" />
                                Export JPEG
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white shadow-lg shadow-blue-200">
                        <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">Total KYC Done</p>
                        <h3 className="text-3xl font-black mt-1">{departmentSummary.grandTotal}</h3>
                        <p className="text-blue-100 text-[10px] mt-2 opacity-80">All Departments</p>
                    </div>
                    {uniqueDepartments.map(dept => (
                        <div key={dept} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">{dept} Department</p>
                            <h3 className="text-2xl font-black text-gray-800 mt-1">{departmentSummary.summary[dept] || 0}</h3>
                            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-3 overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${dept === 'UCC' ? 'bg-purple-500' :
                                        dept === 'KYC Team' ? 'bg-indigo-500' :
                                            'bg-orange-500'
                                        }`}
                                    style={{ width: `${departmentSummary.grandTotal ? ((departmentSummary.summary[dept] || 0) / departmentSummary.grandTotal * 100) : 0}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Controls */}
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4">

                        {/* Date Filters */}
                        <div className="lg:col-span-4 flex items-end gap-2">
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Start Date</label>
                                <div className="relative group">
                                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                                    <input
                                        type="date"
                                        className="pl-10 pr-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full transition-shadow shadow-sm"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <span className="text-gray-400 mb-3 font-medium">-</span>
                            <div className="flex-1">
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">End Date</label>
                                <div className="relative group">
                                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                                    <input
                                        type="date"
                                        className="pl-10 pr-3 py-2 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full transition-shadow shadow-sm"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Zone Filter */}
                        <div className="lg:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Zone</label>
                            <div className="relative group">
                                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                                <select
                                    className="pl-10 pr-8 py-2 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full appearance-none transition-shadow shadow-sm cursor-pointer"
                                    value={selectedZone}
                                    onChange={(e) => setSelectedZone(e.target.value)}
                                >
                                    <option value="">All Zones</option>
                                    {uniqueZones.map(z => <option key={z} value={z}>{z}</option>)}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>

                        {/* Department Filter */}
                        <div className="lg:col-span-2">
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Department</label>
                            <div className="relative group">
                                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                                <select
                                    className="pl-10 pr-8 py-2 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full appearance-none transition-shadow shadow-sm cursor-pointer"
                                    value={selectedDepartment}
                                    onChange={(e) => setSelectedDepartment(e.target.value)}
                                >
                                    <option value="">All Depts</option>
                                    {uniqueDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="lg:col-span-4">
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Search</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                    <Search className="w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2 shadow-sm transition-shadow placeholder-gray-400"
                                    placeholder="Search Zone, Ward or Supervisor..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm max-h-[600px]">
                    <table className="w-full text-sm text-center text-gray-800 border-collapse border border-gray-400">
                        <thead className="text-xs uppercase text-white sticky top-0 z-30 shadow-md">
                            <tr>
                                <th scope="col" className="px-4 py-4 border border-gray-400 bg-slate-700 sticky left-0 z-40">S.No</th>
                                <th scope="col" className="px-4 py-4 border border-gray-400 bg-slate-700 sticky left-[60px] z-40">Zone Name</th>
                                <th scope="col" className="px-4 py-4 border border-gray-400 bg-slate-700 sticky left-[160px] z-40">Ward No</th>
                                <th scope="col" className="px-4 py-4 border border-gray-400 bg-slate-700 text-left sticky left-[240px] z-40 min-w-[200px]">Supervisor Name</th>

                                {filteredDates.map(date => (
                                    <th key={date} scope="col" className="px-2 py-4 border border-gray-400 bg-blue-600 min-w-[40px] whitespace-nowrap">
                                        {date.split('-')[2]}
                                    </th>
                                ))}

                                <th scope="col" className="px-4 py-4 bg-emerald-700 font-extrabold text-white border border-gray-400 sticky right-0 z-30">
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredReport.length > 0 ? (
                                filteredReport.map((row: any, index: number) => (
                                    <tr key={index} className={`hover:bg-yellow-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                        <td className="px-4 py-3 font-mono border border-gray-300 sticky left-0 bg-inherit">{row.sNo}</td>
                                        <td className="px-4 py-3 font-semibold text-gray-700 border border-gray-300 sticky left-[60px] bg-inherit">{row.zone}</td>
                                        <td className="px-4 py-3 font-bold text-blue-800 border border-gray-300 sticky left-[160px] bg-inherit">{row.ward}</td>
                                        <td className="px-4 py-3 font-semibold text-left text-gray-900 border border-gray-300 sticky left-[240px] bg-inherit whitespace-nowrap flex items-center gap-2">
                                            {row.supervisorName}
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${row.department === 'UCC' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                                row.department === 'KYC Team' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                                    'bg-orange-50 text-orange-600 border-orange-200'
                                                }`}>
                                                {row.department}
                                            </span>
                                        </td>

                                        {filteredDates.map(date => {
                                            const count = row[date] || 0;
                                            // Conditional color based on count
                                            let cellClass = "bg-red-50 text-red-600 font-medium"; // Default zero (Red)

                                            if (count >= 20) cellClass = "text-emerald-700 font-black bg-emerald-100 ring-1 ring-inset ring-emerald-200"; // Green
                                            else if (count >= 1) cellClass = "text-yellow-700 font-bold bg-yellow-50"; // Yellow

                                            return (
                                                <td key={date} className="px-2 py-3 border border-gray-300">
                                                    <div className={`py-1 px-1 text-center rounded ${cellClass}`}>
                                                        {count}
                                                    </div>
                                                </td>
                                            );
                                        })}

                                        <td className="px-4 py-3 font-black text-gray-900 bg-gray-100 border border-gray-300 sticky right-0 shadow-[-2px_0_5px_rgba(0,0,0,0.1)]">
                                            {row.total}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4 + filteredDates.length + 1} className="px-6 py-12 text-center text-gray-400 bg-gray-50 border border-gray-200">
                                        <div className="flex flex-col items-center justify-center">
                                            <p className="font-medium text-lg text-gray-500 mb-1">{fileName ? "No records found matching your search." : "Ready to Generate Report"}</p>
                                            <p className="text-sm">Upload a CSV file above to populate the matrix.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    );
};
