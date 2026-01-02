import React, { useState, useMemo } from 'react';
import { Upload, Search, FileDown, FileImage } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { toJpeg } from 'html-to-image';
import Papa from 'papaparse';
import { WARD_TARGETS } from '../data/wardTargets';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';

export const WardWiseReport: React.FC = () => {
    const [kycData, setKycData] = useState<any[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedZone, setSelectedZone] = useState<string>('All');
    const [selectedSupervisor, setSelectedSupervisor] = useState<string>('All');
    const [selectedWard, setSelectedWard] = useState<string>('All');

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                setKycData(results.data);
            },
            error: () => {
                alert('Error parsing CSV');
            }
        });
    };

    const normalizeWardNumber = (wardStr: string): number | null => {
        if (!wardStr) return null;
        // Extract numbers only
        const match = wardStr.toString().match(/\d+/);
        return match ? parseInt(match[0], 10) : null;
    };

    const wardStats = useMemo(() => {
        // Initialize stats with targets
        const stats = WARD_TARGETS.map(target => ({
            ...target,
            currentKyc: 0,
            gap: 0,
            coverage: 0
        }));

        // Process KYC data
        kycData.forEach((row: any) => {
            // Check if this is an aggregated report (has 'Customer Count' or similar)
            const kycCount = row['Customer Count'] ? parseInt(row['Customer Count'], 10) : null;

            // Try different possible column names for Ward Number extraction
            // In the aggregate file, 'Ward Name' is just the number e.g. "1"
            let wardVal = row['Ward Name'] || row['Ward No'] || row['Ward'] || row['ward'] || row['WARD'] || '';

            // If wardVal is just a number, parse it
            let wardNum = normalizeWardNumber(wardVal);

            if (wardNum !== null && wardNum >= 1 && wardNum <= 70) {
                const targetIndex = stats.findIndex(s => s.wardNo === wardNum);
                if (targetIndex !== -1) {
                    if (kycCount !== null) {
                        // Aggregated Mode: Set the total count directly
                        // If multiple rows exist for same ward (unlikely in agg), we might want to add, but usually it's one row per ward.
                        // Let's safe add just in case there are split rows.
                        stats[targetIndex].currentKyc += kycCount;
                    } else {
                        // Row-per-household Mode: Increment count
                        stats[targetIndex].currentKyc++;
                    }
                }
            }
        });

        // Calculate Gap and Coverage
        return stats.map(s => {
            const gap = s.target - s.currentKyc;
            const coverage = s.target > 0 ? (s.currentKyc / s.target) * 100 : 0;
            return {
                ...s,
                gap: gap, // Negative gap means overachievement? Or just show 0? Usually Gap is Target - Done.
                coverage: coverage
            };
        });

    }, [kycData]);

    const uniqueZones = useMemo(() => {
        const zones = new Set<string>();
        WARD_TARGETS.forEach(t => t.zoneName && zones.add(t.zoneName));
        return Array.from(zones).sort();
    }, []);

    const uniqueSupervisors = useMemo(() => {
        const supervisors = new Set<string>();
        wardStats.forEach(s => {
            if (s.supervisorName) supervisors.add(s.supervisorName);
        });
        return Array.from(supervisors).sort();
    }, [wardStats]);

    const filteredStats = wardStats.filter(s => {
        const matchesSearch = s.wardName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.wardNo.toString().includes(searchTerm);
        const matchesZone = selectedZone === 'All' || s.zoneName === selectedZone;
        const matchesSupervisor = selectedSupervisor === 'All' || s.supervisorName === selectedSupervisor;
        const matchesWard = selectedWard === 'All' || s.wardNo.toString() === selectedWard;

        return matchesSearch && matchesZone && matchesSupervisor && matchesWard;
    });

    const totalTarget = filteredStats.reduce((sum, s) => sum + s.target, 0);
    const totalKyc = filteredStats.reduce((sum, s) => sum + s.currentKyc, 0);
    const totalPending = totalTarget - totalKyc;
    const totalCoverage = totalTarget > 0 ? (totalKyc / totalTarget) * 100 : 0;

    const reportRef = React.useRef<HTMLDivElement>(null);

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

            const pageWidth = doc.internal.pageSize.width;
            const logoHeight = 22;
            const width1 = (img1.width / img1.height) * logoHeight;
            const width2 = (img2.width / img2.height) * logoHeight;

            doc.addImage(img1, 'PNG', 15, 8, width1, logoHeight);
            doc.addImage(img2, 'PNG', pageWidth - 15 - width2, 8, width2, logoHeight);

            doc.setFontSize(18);
            doc.setTextColor(0, 0, 0);
            doc.text('Mathura Vrindavan Nagar Nigam', pageWidth / 2, 20, { align: 'center' });

            doc.setFontSize(12);
            doc.setTextColor(0, 100, 0);
            doc.text('Ward Wise Evaluation Report', pageWidth / 2, 28, { align: 'center' });

            const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
            let filterText = `Date: ${today}`;
            if (selectedZone !== 'All') filterText += ` | Zone: ${selectedZone}`;
            if (selectedSupervisor !== 'All') filterText += ` | Supervisor: ${selectedSupervisor}`;
            if (selectedWard !== 'All') filterText += ` | Ward: ${selectedWard}`;

            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.text(filterText, pageWidth / 2, 35, { align: 'center' });

        } catch (e) {
            console.error("Image Load Error", e);
        }

        const headers = [['S.No', 'Ward No', 'Ward Name', 'Supervisor', 'Zone', 'Target', 'Done', 'Gap', 'Coverage (%)']];
        const data = filteredStats.map((row, index) => [
            index + 1,
            row.wardNo,
            row.wardName,
            row.supervisorName || '-',
            row.zoneName || '-',
            row.target,
            row.currentKyc,
            row.gap,
            row.coverage.toFixed(2)
        ]);

        // Add Grand Total Row
        data.push([
            '', 'TOTAL', '', '', '',
            totalTarget,
            totalKyc,
            totalTarget - totalKyc,
            totalCoverage.toFixed(2)
        ]);

        (doc as any).autoTable({
            head: headers,
            body: data,
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
            bodyStyles: { fontSize: 9, textColor: 50, halign: 'center' },
            columnStyles: {
                0: { halign: 'center' },
                1: { halign: 'center', fontStyle: 'bold', textColor: [0, 0, 180] },
                2: { halign: 'left' },
                3: { halign: 'left' },
                4: { halign: 'left', fontStyle: 'bold', textColor: [128, 0, 128] },
                5: { halign: 'center' },
                6: { halign: 'center', fontStyle: 'bold', textColor: [0, 100, 0] },
                7: { halign: 'center' },
                8: { halign: 'center' }
            },
            didParseCell: (data: any) => {
                if (data.section === 'body' && data.row.index === filteredStats.length) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [240, 240, 240];
                }
            }
        });

        doc.save(`ward-wise-report-${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleExportJPEG = async () => {
        if (!reportRef.current) return;
        try {
            const dataUrl = await toJpeg(reportRef.current, { quality: 0.95, backgroundColor: '#ffffff' });
            const link = document.createElement('a');
            link.download = `ward-wise-report-${new Date().toISOString().split('T')[0]}.jpeg`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Error exporting JPEG', error);
        }
    };

    return (
        <div className="p-8 bg-white min-h-screen">
            <div className="max-w-full mx-auto space-y-6">

                {/* Header */}
                <div className="p-5 border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white flex flex-col items-center text-center gap-4 rounded-t-xl shadow-sm border border-gray-200">
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                        <div className="flex items-center gap-4">
                            <img src={NagarNigamLogo} alt="Logo" className="h-14 w-auto object-contain drop-shadow-sm" />
                            <div className="h-10 w-px bg-gray-300 hidden md:block"></div>
                        </div>

                        <div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight leading-none">Mathura Vrindavan Nagar Nigam</h3>
                            <p className="text-sm text-emerald-600 font-extrabold tracking-widest uppercase mt-1.5">Ward Wise Evaluation Report</p>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="h-10 w-px bg-gray-300 hidden md:block"></div>
                            <img src={NatureGreenLogo} alt="Nature Green" className="h-16 w-auto object-contain drop-shadow-sm" />
                        </div>
                    </div>
                </div>

                {/* Controls */}
                {/* Controls */}
                <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">

                    {/* Upload Button */}
                    <div className="w-full lg:w-auto">
                        {!fileName && (
                            <label className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer font-bold shadow-md hover:shadow-lg transition-all active:scale-95 w-full lg:w-auto">
                                <Upload className="w-4 h-4" />
                                <span>Upload Current KYC CSV</span>
                                <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                            </label>
                        )}
                    </div>

                    {/* Filters Container */}
                    <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto flex-1 justify-end">
                        {/* Search Bar */}
                        <div className="relative group w-full md:w-64 lg:w-96">
                            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                                <Search className="w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="text"
                                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5 shadow-sm transition-shadow placeholder-gray-400"
                                placeholder="Search Ward Name or Number..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Dropdowns */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
                            <select
                                value={selectedZone}
                                onChange={(e) => setSelectedZone(e.target.value)}
                                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 shadow-sm min-w-[140px]"
                            >
                                <option value="All">All Zones</option>
                                {uniqueZones.map(z => <option key={z} value={z}>{z}</option>)}
                            </select>

                            <select
                                value={selectedSupervisor}
                                onChange={(e) => setSelectedSupervisor(e.target.value)}
                                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 shadow-sm min-w-[160px]"
                            >
                                <option value="All">All Supervisors</option>
                                {uniqueSupervisors.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            <select
                                value={selectedWard}
                                onChange={(e) => setSelectedWard(e.target.value)}
                                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 shadow-sm min-w-[140px]"
                            >
                                <option value="All">All Wards</option>
                                {WARD_TARGETS.map(w => <option key={w.wardNo} value={w.wardNo}>{w.wardNo} - {w.wardName}</option>)}
                            </select>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExportPDF}
                                className="p-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm transition-all active:scale-95"
                                title="Export PDF"
                            >
                                <FileDown className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleExportJPEG}
                                className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm transition-all active:scale-95"
                                title="Export Image"
                            >
                                <FileImage className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div ref={reportRef} className="space-y-6 pt-2">
                {/* Stats Cards */}
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Target Households</p>
                        <h3 className="text-2xl font-black text-gray-800 mt-1">{totalTarget.toLocaleString()}</h3>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Total KYC Done</p>
                        <h3 className="text-2xl font-black text-emerald-700 mt-1">{totalKyc.toLocaleString()}</h3>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Pending Households</p>
                        <h3 className="text-2xl font-black text-red-600 mt-1">{totalPending.toLocaleString()}</h3>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <p className="text-xs font-bold text-blue-500 uppercase tracking-wider">KYC Till Now</p>
                        <h3 className="text-2xl font-black text-blue-600 mt-1">{totalCoverage.toFixed(2)}%</h3>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm bg-white">

                    {/* Table Header Section */}
                    <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 via-white to-blue-50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <img src={NagarNigamLogo} alt="NN" className="h-16 w-auto drop-shadow-md" />
                            <div>
                                <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Mathura Vrindavan Nagar Nigam</h4>
                                <p className="text-xs text-blue-600 font-extrabold uppercase tracking-wide mt-0.5">Ward Wise Evaluation Report</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6 bg-white/50 px-4 py-2 rounded-lg border border-gray-100 backdrop-blur-sm">
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Zone</p>
                                <p className="text-sm font-black text-purple-600 uppercase leading-tight">{selectedZone === 'All' ? 'All Zones' : selectedZone}</p>
                            </div>

                            {selectedWard !== 'All' && (
                                <>
                                    <div className="h-8 w-px bg-gray-300"></div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ward</p>
                                        <p className="text-sm font-black text-indigo-600 uppercase leading-tight">#{selectedWard}</p>
                                    </div>
                                </>
                            )}

                            <div className="h-8 w-px bg-gray-300"></div>
                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Date</p>
                                <p className="text-sm font-black text-gray-800 uppercase leading-tight">{new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}</p>
                            </div>
                            <img src={NatureGreenLogo} alt="NG" className="h-16 w-auto drop-shadow-md ml-2" />
                        </div>
                    </div>

                    <table className="w-full text-sm text-center text-gray-800 border-collapse">
                        <thead className="bg-gray-800 text-white uppercase text-xs font-bold tracking-wider">
                            <tr>
                                <th className="px-6 py-4 border-b border-gray-700">S.No</th>
                                <th className="px-6 py-4 border-b border-gray-700">Ward No</th>
                                <th className="px-6 py-4 border-b border-gray-700 text-left">Ward Name</th>
                                <th className="px-6 py-4 border-b border-gray-700 text-left">Supervisor Name</th>
                                <th className="px-6 py-4 border-b border-gray-700 text-left">Zone Name</th>
                                <th className="px-6 py-4 border-b border-gray-700">Target Households</th>
                                <th className="px-6 py-4 border-b border-gray-700">Current KYC Done</th>
                                <th className="px-6 py-4 border-b border-gray-700">Gap</th>
                                <th className="px-6 py-4 border-b border-gray-700">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {filteredStats.map((row, index) => (
                                <tr key={row.wardNo} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-3 font-medium text-gray-500">{index + 1}</td>
                                    <td className="px-6 py-3 font-bold text-blue-600 border-r border-gray-100">{row.wardNo}</td>
                                    <td className="px-6 py-3 text-left font-semibold text-gray-800 border-r border-gray-100">{row.wardName}</td>
                                    <td className="px-6 py-3 text-left text-gray-600 border-r border-gray-100">{row.supervisorName || '-'}</td>
                                    <td className="px-6 py-3 text-left font-bold text-purple-600 border-r border-gray-100">{row.zoneName || '-'}</td>
                                    <td className="px-6 py-3 font-mono text-gray-600 border-r border-gray-100">{row.target}</td>
                                    <td className="px-6 py-3 font-bold text-emerald-600 border-r border-gray-100">{row.currentKyc}</td>
                                    <td className={`px-6 py-3 font-bold border-r border-gray-100 ${row.gap > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                        {row.gap > 0 ? `-${row.gap}` : `+${Math.abs(row.gap)}`}
                                    </td>
                                    <td className="px-6 py-3">
                                        {row.coverage >= 100 ? (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-green-100 text-green-700 border border-green-200 shadow-sm">
                                                DONE
                                            </span>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full transition-all duration-500 ${row.coverage >= 50 ? 'bg-blue-500' : 'bg-red-500'}`}
                                                        style={{ width: `${Math.min(row.coverage, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold w-12 text-right">{row.coverage.toFixed(1)}%</span>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300">
                            <tr>
                                <td colSpan={5} className="px-6 py-4 text-right uppercase text-gray-600">Total</td>
                                <td className="px-6 py-4 text-center text-gray-800">{totalTarget.toLocaleString()}</td>
                                <td className="px-6 py-4 text-center text-emerald-700">{totalKyc.toLocaleString()}</td>
                                <td className="px-6 py-4 text-center text-gray-700">
                                    {totalTarget - totalKyc}
                                </td>
                                <td className="px-6 py-4 text-center text-blue-600">{totalCoverage.toFixed(2)}%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

            </div>
        </div>
    );
};
