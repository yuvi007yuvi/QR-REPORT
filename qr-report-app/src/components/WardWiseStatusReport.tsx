import React, { useState, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { Upload, FileDown, FileImage, Search, Target, CheckCircle, AlertCircle, Users, ChevronDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toPng } from 'html-to-image';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { WARD_TARGETS } from '../data/wardTargets';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';

interface WardStatusRow {
    sNo: number;
    wardNo: string;
    wardName: string;
    houseHoldTarget: number;
    kycCount: number;
    gap: number;
    coverage: number;
    zoneName?: string;
    supervisorName?: string;
}

const WardWiseStatusReport = () => {
    const [data, setData] = useState<WardStatusRow[]>([]);
    const [fileName, setFileName] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedZonals, setSelectedZonals] = useState<string[]>([]); // Empty = All, otherwise list of selected zones
    const [isZoneDropdownOpen, setIsZoneDropdownOpen] = useState(false);
    const [selectedWard, setSelectedWard] = useState('All');
    const reportRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    const statsRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsZoneDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);

        Papa.parse(file, {
            header: false, // Parse as arrays first to find the real header
            skipEmptyLines: true,
            complete: (results) => {
                const rawData = results.data as string[][];

                // Find the header row index (look for "WARD NO" or "S.NO." or "WARD NAME")
                let headerIndex = -1;
                for (let i = 0; i < Math.min(rawData.length, 10); i++) {
                    const rowStr = rawData[i].join(' ').toUpperCase();
                    if (rowStr.includes('WARD NO') || rowStr.includes('S.NO') || (rowStr.includes('WARD NAME') && rowStr.includes('AREA'))) {
                        headerIndex = i;
                        break;
                    }
                }

                if (headerIndex === -1) {
                    alert("Could not find valid headers (WARD NO, HOUSE HOLD, etc) in the file.");
                    return;
                }

                const headers = rawData[headerIndex].map(h => h.toUpperCase().trim());
                const parsedData: WardStatusRow[] = [];

                // Helper to find column index by keyword
                const findCol = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));

                let wardNoIdx = findCol(['WARD NO', 'WARD_NO']);
                let wardNameIdx = findCol(['WARD NAME', 'WARD_NAME']);
                const areaIdx = findCol(['AREA']);

                // Specific handling for "KYC_By_Wards.csv" where "Ward Name" is actually the Number (1,2,3)
                // and "Area" is the Ward Name (01-Birjapur) if Ward No specifically isn't found
                if (wardNoIdx === -1 && wardNameIdx !== -1) {
                    // Check first data row to see if "Ward Name" is numeric
                    const firstDataRow = rawData[headerIndex + 1];
                    if (firstDataRow) {
                        const val = firstDataRow[wardNameIdx]?.replace(/['"]/g, '').trim();
                        if (!isNaN(parseInt(val))) {
                            wardNoIdx = wardNameIdx; // Use "Ward Name" col as Ward No
                            wardNameIdx = areaIdx;   // Use "Area" col as Ward Name
                        }
                    }
                }

                // Target might be "HOUSE HOLD" or "HOUSE HOLD NAGAR NIGAM"
                const targetIdx = findCol(['HOUSE HOLD', 'TARGET', 'HH']);

                // KYC Count
                const kycIdx = findCol(['KYC COUNT', 'DONE', 'KYC', 'CUSTOMER COUNT']);

                // Process rows after header
                for (let i = headerIndex + 1; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (row.length < 2) continue; // Skip empty rows

                    const wardNoStr = row[wardNoIdx]?.toString().replace(/['"]/g, '') || '';
                    if (!wardNoStr || isNaN(parseInt(wardNoStr))) continue;

                    const wardName = wardNameIdx !== -1 ? row[wardNameIdx] : '';

                    // Parse numbers, remove commas if any
                    let targetVal = targetIdx !== -1 ? parseInt(row[targetIdx]?.replace(/,/g, '') || '0') : 0;
                    const kycVal = kycIdx !== -1 ? parseInt(row[kycIdx]?.replace(/,/g, '') || '0') : 0;

                    // Fallback to system targets if CSV has no target
                    if (targetVal === 0) {
                        const systemWard = WARD_TARGETS.find(w => w.wardNo === parseInt(wardNoStr));
                        if (systemWard) {
                            targetVal = systemWard.target;
                        }
                    }

                    parsedData.push({
                        sNo: parsedData.length + 1,
                        wardNo: wardNoStr,
                        wardName: wardName || (WARD_TARGETS.find(w => w.wardNo === parseInt(wardNoStr))?.wardName || ''),
                        houseHoldTarget: targetVal,
                        kycCount: kycVal,
                        gap: targetVal - kycVal,
                        coverage: targetVal > 0 ? Math.min((kycVal / targetVal) * 100, 100) : 0,
                        zoneName: WARD_TARGETS.find(w => w.wardNo === parseInt(wardNoStr))?.zoneName || 'Unmapped',
                        supervisorName: WARD_TARGETS.find(w => w.wardNo === parseInt(wardNoStr))?.supervisorName || 'Unmapped'
                    });
                }

                setData(parsedData);
            }
        });
    };

    const uniqueZonals = useMemo(() => Array.from(new Set(data.map(d => d.zoneName).filter(Boolean))).sort(), [data]);
    const uniqueWards = useMemo(() => Array.from(new Set(data.map(d => d.wardNo))).sort((a, b) => parseInt(a) - parseInt(b)), [data]);

    const filteredData = useMemo(() => {
        return data.filter(row => {
            const matchesSearch =
                row.wardName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.wardNo.toString().includes(searchTerm);

            const matchesZonal = selectedZonals.length === 0 || selectedZonals.includes(row.zoneName || 'Unmapped');
            const matchesWard = selectedWard === 'All' || row.wardNo.toString() === selectedWard;

            return matchesSearch && matchesZonal && matchesWard;
        });
    }, [data, searchTerm, selectedZonals, selectedWard]);

    const totals = useMemo(() => {
        return filteredData.reduce((acc, row) => ({
            target: acc.target + row.houseHoldTarget,
            done: acc.done + row.kycCount,
            gap: acc.gap + row.gap
        }), { target: 0, done: 0, gap: 0 });
    }, [filteredData]);

    const totalCoverage = totals.target > 0 ? Math.min((totals.done / totals.target) * 100, 100) : 0;

    const exportPDF = async () => {
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.width;
        let finalY = 15; // Starting Y position

        try {
            // 1. Capture Header
            if (headerRef.current) {
                const headerImg = await toPng(headerRef.current, { cacheBust: true, backgroundColor: '#ffffff' });
                const imgProps = doc.getImageProperties(headerImg);
                const pdfHeight = (imgProps.height * 190) / imgProps.width;
                doc.addImage(headerImg, 'PNG', 10, 10, 190, pdfHeight);
                finalY = 10 + pdfHeight + 5;
            } else {
                // Fallback Text Header
                doc.setFontSize(16);
                doc.text("MATHURA VRINDAVAN NAGAR NIGAM", pageWidth / 2, 15, { align: 'center' });
                doc.setFontSize(12);
                doc.text("Ward Wise KYC Status Report", pageWidth / 2, 22, { align: 'center' });
                finalY = 30;
            }

            // 2. Capture Stats Cards
            if (statsRef.current) {
                const statsImg = await toPng(statsRef.current, { cacheBust: true, backgroundColor: '#f9fafb' });
                const imgProps = doc.getImageProperties(statsImg);
                const pdfHeight = (imgProps.height * 190) / imgProps.width;

                // Check if it fits, else new page? (Unlikely for just cards)
                doc.addImage(statsImg, 'PNG', 10, finalY, 190, pdfHeight);
                finalY += pdfHeight + 10;
            }
        } catch (e) {
            console.error("Error capturing images for PDF", e);
        }

        const tableBody = filteredData.map((row, index) => [
            index + 1,
            row.wardNo,
            row.wardName,
            row.zoneName || '-',
            row.houseHoldTarget,
            row.kycCount,
            row.gap,
            `${row.coverage.toFixed(1)}%`
        ]);

        // Add Total Row
        tableBody.push([
            '', // S.No placeholder for total
            'TOTAL',
            '',
            '',
            totals.target,
            totals.done,
            totals.gap,
            `${totalCoverage.toFixed(1)}%`
        ]);

        autoTable(doc, {
            head: [['S.No', 'Ward', 'Ward Name', 'Zonal', 'Target', 'Done', 'Gap', '%']],
            body: tableBody as any,
            startY: finalY,
            theme: 'grid',
            headStyles: { fillColor: [22, 163, 74], halign: 'center' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 15 },
                1: { halign: 'center', fontStyle: 'bold' },
                3: { halign: 'left' }, // Zonal
                4: { halign: 'center' },
                5: { halign: 'center' },
                6: { halign: 'center', textColor: [220, 38, 38] },
                7: { halign: 'center', fontStyle: 'bold' }
            },
            didParseCell: (data) => {
                if (data.row.index === filteredData.length) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });

        doc.save(`Ward_KYC_Status_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const exportImage = async () => {
        if (!reportRef.current) return;
        try {
            const dataUrl = await toPng(reportRef.current, { cacheBust: true, backgroundColor: 'white' });
            const link = document.createElement('a');
            link.download = `Ward_KYC_Status.png`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6 space-y-6">
            {/* Header Card */}
            <div ref={headerRef} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <img src={NagarNigamLogo} alt="NN" className="h-20 object-contain hidden md:block" />

                    <div className="text-center">
                        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Mathura Vrindavan Nagar Nigam</h1>
                        <div className="inline-block border-b-4 border-green-500 pb-1 mt-2">
                            <h2 className="text-xl font-bold text-green-700 uppercase tracking-wide">Ward Wise KYC Status Report</h2>
                        </div>
                    </div>

                    <img src={NatureGreenLogo} alt="NG" className="h-20 object-contain hidden md:block" />
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col xl:flex-row gap-4 justify-between items-center no-print">
                {(data.length === 0 || !fileName) && (
                    <div className="flex gap-4 w-full xl:w-auto">
                        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors shadow-sm whitespace-nowrap">
                            <Upload size={18} />
                            <span className="font-semibold">{fileName || 'Upload CSV'}</span>
                            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                        </label>
                    </div>
                )}

                {data.length > 0 && (
                    <div className="flex flex-col md:flex-row gap-3 w-full xl:w-auto items-center flex-1 justify-end">
                        {/* Filters */}
                        <div className="flex gap-2 w-full md:w-auto">
                            {/* Zonal Multi-Select */}
                            <div className="relative" ref={dropdownRef}>
                                <button
                                    onClick={() => setIsZoneDropdownOpen(!isZoneDropdownOpen)}
                                    className="flex items-center justify-between gap-2 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white min-w-[160px] text-sm font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    <span>
                                        {selectedZonals.length === 0 ? 'All Zonals' : `${selectedZonals.length} Zones Selected`}
                                    </span>
                                    <ChevronDown size={16} className={`transition-transform ${isZoneDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isZoneDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-80 overflow-y-auto p-2">
                                        <div
                                            className="px-3 py-2 hover:bg-gray-50 rounded-md cursor-pointer flex items-center gap-2 mb-1"
                                            onClick={() => setSelectedZonals([])}
                                        >
                                            <div className={`w-4 h-4 border rounded flex items-center justify-center ${selectedZonals.length === 0 ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                                                {selectedZonals.length === 0 && <CheckCircle size={10} className="text-white" />}
                                            </div>
                                            <span className="text-sm font-medium">All Zonals</span>
                                        </div>
                                        <div className="h-px bg-gray-100 my-1" />
                                        {uniqueZonals.map(zone => {
                                            const isSelected = selectedZonals.includes(zone || '');
                                            return (
                                                <div
                                                    key={zone}
                                                    className="px-3 py-2 hover:bg-gray-50 rounded-md cursor-pointer flex items-center gap-2"
                                                    onClick={() => {
                                                        setSelectedZonals(prev =>
                                                            prev.includes(zone || '')
                                                                ? prev.filter(z => z !== (zone || ''))
                                                                : [...prev, (zone || '')]
                                                        );
                                                    }}
                                                >
                                                    <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                                                        {isSelected && <CheckCircle size={10} className="text-white" />}
                                                    </div>
                                                    <span className="text-sm text-gray-700">{zone}</span>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>

                            <select
                                value={selectedWard}
                                onChange={e => setSelectedWard(e.target.value)}
                                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white min-w-[120px] text-sm font-medium"
                            >
                                <option value="All">All Wards</option>
                                {uniqueWards.map(w => <option key={w} value={w}>Ward {w}</option>)}
                            </select>
                        </div>

                        {/* Search & Exports */}
                        <div className="relative w-full md:w-auto">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none w-full md:w-48"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button onClick={exportPDF} className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm" title="Export PDF">
                                <FileDown size={20} />
                            </button>
                            <button onClick={exportImage} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm" title="Export Image">
                                <FileImage size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Status Cards */}
            {data.length > 0 && (
                <div ref={statsRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 no-print bg-gray-50 p-1">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between gap-4">
                        <div>
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit mb-2">
                                <Target size={20} />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">Total Target</p>
                            <p className="text-2xl font-bold text-gray-900">{totals.target.toLocaleString()}</p>
                        </div>
                        <div className="h-16 w-16">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={[{ value: 1 }]} innerRadius={20} outerRadius={30} fill="#3b82f6" dataKey="value" stroke="none" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between gap-4">
                        <div>
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg w-fit mb-2">
                                <CheckCircle size={20} />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">KYC Done</p>
                            <p className="text-2xl font-bold text-emerald-600">{totals.done.toLocaleString()}</p>
                        </div>
                        <div className="h-16 w-16">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[{ value: totals.done }, { value: totals.gap }]}
                                        innerRadius={20}
                                        outerRadius={30}
                                        dataKey="value"
                                        stroke="none"
                                        startAngle={90}
                                        endAngle={-270}
                                    >
                                        <Cell fill="#10b981" />
                                        <Cell fill="#e5e7eb" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between gap-4">
                        <div>
                            <div className="p-2 bg-red-50 text-red-600 rounded-lg w-fit mb-2">
                                <AlertCircle size={20} />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">Gap / Pending</p>
                            <p className="text-2xl font-bold text-red-600">{totals.gap.toLocaleString()}</p>
                        </div>
                        <div className="h-16 w-16">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[{ value: totals.gap }, { value: totals.done }]}
                                        innerRadius={20}
                                        outerRadius={30}
                                        dataKey="value"
                                        stroke="none"
                                        startAngle={90}
                                        endAngle={-270}
                                    >
                                        <Cell fill="#ef4444" />
                                        <Cell fill="#e5e7eb" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between gap-4">
                        <div>
                            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg w-fit mb-2">
                                <Users size={20} />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">Total Wards</p>
                            <p className="text-2xl font-bold text-gray-900">{filteredData.length}</p>
                        </div>
                        <div className="h-16 w-16 opacity-50">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={[{ value: 1 }]} innerRadius={20} outerRadius={30} fill="#a855f7" dataKey="value" stroke="none" />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}

            {data.length > 0 ? (
                <div ref={reportRef} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                    {/* Report Content Header (Visible in Export) */}
                    {/* Report Content Header (Visible in Export) */}
                    <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-6">
                        <img src={NagarNigamLogo} alt="NN" className="h-16 object-contain" />
                        <div className="text-center">
                            <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Mathura Vrindavan Nagar Nigam</h1>
                            <div className="inline-block border-b-4 border-green-500 pb-1 mt-1">
                                <h2 className="text-lg font-bold text-green-700 uppercase tracking-wide">Ward Wise KYC Status Report</h2>
                            </div>
                        </div>
                        <img src={NatureGreenLogo} alt="NG" className="h-16 object-contain" />
                    </div>

                    <div className="overflow-x-auto p-4">
                        <table className="w-full text-sm text-left border-collapse border border-black">
                            <thead className="bg-gray-100 uppercase text-xs font-bold text-gray-900">
                                <tr>
                                    <th className="px-6 py-4 text-center border border-black">S.No</th>
                                    <th className="px-6 py-4 text-center border border-black">Ward No</th>
                                    <th className="px-6 py-4 border border-black">Ward Name</th>
                                    <th className="px-6 py-4 text-left border border-black">Zonal</th>
                                    <th className="px-6 py-4 text-center border border-black">Total HH (Target)</th>
                                    <th className="px-6 py-4 text-center border border-black">KYC Done</th>
                                    <th className="px-6 py-4 text-center border border-black">Gap</th>
                                    <th className="px-6 py-4 text-center border border-black">Coverage</th>
                                    <th className="px-6 py-4 text-center border border-black">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map((row, idx) => (
                                    <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                        <td className="px-6 py-3 text-center text-gray-500 font-medium border border-black">{idx + 1}</td>
                                        <td className="px-6 py-3 text-center font-bold text-blue-600 border border-black">{row.wardNo}</td>
                                        <td className="px-6 py-3 font-semibold text-gray-800 border border-black">{row.wardName}</td>
                                        <td className="px-6 py-3 text-left font-medium text-purple-600 border border-black">{row.zoneName || '-'}</td>
                                        <td className="px-6 py-3 text-center font-mono text-gray-600 border border-black">{row.houseHoldTarget}</td>
                                        <td className="px-6 py-3 text-center font-bold text-emerald-600 border border-black">{row.kycCount}</td>
                                        <td className={`px-6 py-3 text-center font-bold border border-black ${row.gap > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                            {row.gap}
                                        </td>
                                        <td className="px-6 py-3 text-center border border-black">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden border border-gray-400">
                                                    <div
                                                        className={`h-full ${row.coverage >= 80 ? 'bg-green-500' : row.coverage >= 50 ? 'bg-yellow-400' : 'bg-red-500'}`}
                                                        style={{ width: `${Math.min(row.coverage, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold">{row.coverage.toFixed(0)}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3 text-center border border-black">
                                            {row.coverage >= 100 ? (
                                                <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full border border-green-200">DONE</span>
                                            ) : (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded-full">PENDING</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-100 border-t-2 border-black">
                                <tr className="font-black text-gray-900">
                                    <td colSpan={4} className="px-6 py-4 text-right uppercase tracking-wider border border-black text-lg">Grand Total</td>
                                    <td className="px-6 py-4 text-center border border-black text-lg">{totals.target.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center text-emerald-700 border border-black text-lg">{totals.done.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center text-red-600 border border-black text-lg">{totals.gap.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-center text-blue-700 border border-black text-lg">{totalCoverage.toFixed(2)}%</td>
                                    <td className="px-6 py-4 border border-black"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border-2 border-dashed border-gray-300 text-gray-400">
                    <Upload size={48} className="mb-4 opacity-50" />
                    <p className="text-lg font-medium">Upload "WARD WISE status.csv" to generate report</p>
                </div>
            )}
        </div>
    );
};

export default WardWiseStatusReport;
