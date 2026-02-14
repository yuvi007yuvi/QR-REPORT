import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import { Upload, FileText, Download, Users, MapPin, TrendingUp, ToggleLeft, ToggleRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toJpeg } from 'html-to-image';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';


interface WardInfo {
    name: string;
    count: number;
}

interface ProcessedRecord {
    id: string; // Supervisor Name
    supervisorName: string;
    wards: WardInfo[];
    kycCount: number;
    remark?: string;
    mobile?: string;
    supervisorId?: string;
    isDeploymentTarget?: boolean;
}

// Deployment / Target List (Hardcoded as per request)
const DEPLOYMENT_LIST = [
    { name: 'ABHISHEK', id: 'MVSID886', mobile: '9259785400', remark: 'ABHISHEK IS NOT READY TO DO KYC AND NOT RECIEVEING CALL', ward: 'NA' },
    { name: 'HARIOM', id: 'MVSID924', mobile: '8077632507', remark: 'HARIOM IS DEPLOYED IN WARD 29', ward: '29' },
    { name: 'DURGA VASHNEY', id: 'MVSID1328', mobile: '9756119424', remark: 'DURGA HAS I-PHONE APP CAN NOT INSTALL IN HIS PHONE AFTER HE IS SAYING HE WILL ARRANGE A ANDROID PHONE ASAP', ward: 'NA' },
    { name: 'HASAN', id: 'MVSID1326', mobile: '9634238931', remark: 'HAS IS DEPLOYED IN WARD 32', ward: '32' }
];

export const DailyKycStatusReport: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    // State for raw data to support toggling without re-parsing
    const [rawCsvData, setRawCsvData] = useState<any[]>([]);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);

    // Final processed records
    const [records, setRecords] = useState<ProcessedRecord[]>([]);

    const [reportDate, setReportDate] = useState<string>(new Date().toLocaleDateString('en-GB'));
    const [reportTime, setReportTime] = useState<string>(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
    const [showDeployment, setShowDeployment] = useState(true);
    const [showTime, setShowTime] = useState(false);

    // Filter Logic Re-run when toggle or data changes
    useEffect(() => {
        if (rawCsvData.length === 0) {
            setRecords([]);
            return;
        }
        processData(rawCsvData, csvHeaders);
    }, [rawCsvData, showDeployment, csvHeaders]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setLoading(true);

        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as any[];
                const headers = results.meta.fields || [];

                // Optional: Check for date in filename
                const dateMatch = selectedFile.name.match(/(\d{2}[-.]\d{2}[-.]\d{4})/);
                if (dateMatch) {
                    setReportDate(dateMatch[0].replace(/\./g, '/'));
                }
                setReportTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));

                setRawCsvData(data);
                setCsvHeaders(headers);
                setLoading(false);
            },
            error: (err) => {
                console.error(err);
                setLoading(false);
                alert("Failed to parse CSV");
            }
        });
    };

    const processData = (data: any[], headers: string[]) => {
        try {
            // Identify columns dynamically
            const supervisorHeader = headers.find(h =>
                h.toLowerCase().includes('supervisor name') ||
                h.toLowerCase().includes('surveyor') ||
                h.toLowerCase().includes('employee name') ||
                h.toLowerCase().includes('supervisor')
            );

            const wardHeader = headers.find(h =>
                h.toLowerCase().includes('ward') ||
                h.toLowerCase().includes('ward name')
            );

            const remarkHeader = headers.find(h =>
                h.toLowerCase().includes('remark') ||
                h.toLowerCase().includes('status') ||
                h.toLowerCase().includes('comment')
            );

            if (!supervisorHeader) {
                alert("Could not find 'Supervisor Name' column.");
                return;
            }

            // Aggregation Logic
            const map = new Map<string, ProcessedRecord>();

            data.forEach(row => {
                const name = (row[supervisorHeader] || 'Unknown').trim().toUpperCase();
                let ward = wardHeader ? (row[wardHeader] || 'NA').trim() : 'NA';

                // Handle various empty/unknown cases
                if (!ward || ward.toLowerCase() === 'unknown' || ward.toLowerCase() === 'null' || ward.toLowerCase() === 'undefined') {
                    ward = 'NA';
                }

                const remark = remarkHeader ? (row[remarkHeader] || '').trim() : '';

                if (!name || name === 'UNKNOWN') return;

                const key = name; // Key by Name only

                if (!map.has(key)) {
                    map.set(key, {
                        id: key,
                        supervisorName: name,
                        wards: [],
                        kycCount: 0,
                        remark: remark
                    });
                }

                const countHeader = headers.find(h => h.toLowerCase().includes('count') || h.toLowerCase().includes('total'));
                const countVal = countHeader ? (Number(row[countHeader]) || 1) : 1;

                const rec = map.get(key)!;
                rec.kycCount += countVal;

                // Track Ward Info
                const existingWard = rec.wards.find(w => w.name === ward);
                if (existingWard) {
                    existingWard.count += countVal;
                } else {
                    rec.wards.push({ name: ward, count: countVal });
                }

                if (!rec.remark && remark) {
                    rec.remark = remark;
                }
            });

            // Merge Deployment List if enabled
            if (showDeployment) {
                DEPLOYMENT_LIST.forEach(target => {
                    const key = target.name;
                    let rec = map.get(key);

                    if (!rec) {
                        // Supervisor NOT found in CSV
                        rec = {
                            id: key,
                            supervisorName: target.name,
                            wards: [{ name: target.ward, count: 0 }], // Use target ward
                            kycCount: 0,
                            remark: target.remark,
                            mobile: target.mobile,
                            supervisorId: target.id,
                            isDeploymentTarget: true
                        };
                        map.set(key, rec);
                    } else {
                        // Supervisor FOUND
                        if (!rec.remark) rec.remark = target.remark;
                        if (!rec.mobile) rec.mobile = target.mobile;
                        if (!rec.supervisorId) rec.supervisorId = target.id;
                        rec.isDeploymentTarget = true;
                    }
                });
            }

            let finalRecords = Array.from(map.values());

            // If deployment mode is ON, show ONLY the relevant employees
            if (showDeployment) {
                finalRecords = finalRecords.filter(r => r.isDeploymentTarget);
            }

            const sortedRecords = finalRecords.sort((a, b) => {
                if (showDeployment) {
                    // Priority sort for deployment targets
                    if (a.isDeploymentTarget && !b.isDeploymentTarget) return -1;
                    if (!a.isDeploymentTarget && b.isDeploymentTarget) return 1;
                }

                const wardA = parseInt((a.wards[0]?.name || '').replace(/\D/g, '')) || 0;
                const wardB = parseInt((b.wards[0]?.name || '').replace(/\D/g, '')) || 0;
                if (wardA !== wardB) return wardA - wardB;
                return a.supervisorName.localeCompare(b.supervisorName);
            });

            setRecords(sortedRecords);
        } catch (err) {
            console.error("Error processing data", err);
        }
    };

    const totalKYC = useMemo(() => records.reduce((acc, r) => acc + r.kycCount, 0), [records]);
    const totalSupervisors = useMemo(() => records.length, [records]);
    const totalWards = useMemo(() => {
        const uniqueWards = new Set<string>();
        records.forEach(r => r.wards.forEach(w => uniqueWards.add(w.name)));
        return uniqueWards.size;
    }, [records]);

    // Export Functions
    const exportPDF = () => {
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape for more columns

        doc.setFontSize(18);
        doc.text('Daily KYC Status Report', 14, 15);
        doc.setFontSize(12);
        const dateStr = `Date: ${reportDate}` + (showTime ? `  Time: ${reportTime}` : '');
        doc.text(dateStr, 14, 22);

        const tableColumn = ["S.No", "Supervisor Name", "ID", "Mobile", "Ward", "KYC Count"];
        const tableRows = records.map((r, i) => [
            i + 1,
            r.supervisorName,
            r.supervisorId || '-',
            r.mobile || '-',
            r.wards.map(w => w.name).join(', '),
            r.kycCount
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 30,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 2 },
            columnStyles: {
            },
            didParseCell: (data) => {
                if (data.section === 'body' && (data.row.raw as any[])[5] === 0) {
                    // Highlight 0 count rows
                    data.cell.styles.fillColor = [254, 242, 242]; // Red tint
                    data.cell.styles.textColor = [185, 28, 28];
                }
            },
            foot: [['', '', '', '', 'Total', totalKYC]],
            footStyles: { fillColor: [241, 245, 249], textColor: 0, fontStyle: 'bold' }
        });

        doc.save(`Daily_KYC_Status_${reportDate.replace(/\//g, '-')}.pdf`);
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(records.map((r, i) => ({
            "S.No": i + 1,
            "Supervisor Name": r.supervisorName,
            "ID": r.supervisorId || '-',
            "Mobile": r.mobile || '-',
            "Wards": r.wards.map(w => `${w.name} (${w.count})`).join(', '),
            "KYC Count": r.kycCount
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "KYC Status");
        XLSX.writeFile(wb, `Daily_KYC_Status_${reportDate.replace(/\//g, '-')}.xlsx`);
    };

    const exportToImage = async () => {
        const element = document.getElementById('daily-kyc-report-content');
        if (!element) return;
        let originalOverflow = '';
        // Handle scrolling capture
        const scrollContainer = document.querySelector('.overflow-x-auto') as HTMLElement;
        if (scrollContainer) {
            originalOverflow = scrollContainer.style.overflow;
            scrollContainer.style.overflow = 'visible';
        }

        try {
            const dataUrl = await toJpeg(element, { quality: 0.95, backgroundColor: '#ffffff', pixelRatio: 2 });
            const link = document.createElement('a');
            link.download = `Daily_KYC_Status_${reportDate.replace(/\//g, '-')}.jpeg`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Error exporting JPEG:', error);
            alert('Failed to export JPEG');
        } finally {
            if (scrollContainer) {
                scrollContainer.style.overflow = originalOverflow;
            }
        }
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen space-y-8">
            {/* Header Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-200">
                            <Users className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Daily KYC Status Report</h1>
                            <p className="text-slate-500 font-medium">Supervisor & Ward Wise Analysis</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${showTime ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-slate-200 text-slate-500'}`}
                            onClick={() => setShowTime(!showTime)}
                        >
                            {showTime ? <ToggleRight className="w-5 h-5 text-orange-600" /> : <ToggleLeft className="w-5 h-5" />}
                            <span className="font-semibold text-xs">Show Time</span>
                        </div>

                        <div
                            className={`flex items-center gap-3 px-4 py-2 rounded-lg border cursor-pointer transition-all ${showDeployment ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-500'}`}
                            onClick={() => setShowDeployment(!showDeployment)}
                        >
                            {showDeployment ? <ToggleRight className="w-6 h-6 text-indigo-600" /> : <ToggleLeft className="w-6 h-6" />}
                            <span className="font-semibold text-sm">Deployment Report</span>
                        </div>

                        <label className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg cursor-pointer transition-all shadow-md">
                            <Upload className="w-4 h-4" />
                            <span className="font-semibold">{file ? 'Change File' : 'Upload CSV'}</span>
                            <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                        </label>
                    </div>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <span className="ml-4 text-lg font-medium text-slate-600">Processing File...</span>
                </div>
            )}

            {!loading && records.length > 0 && (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-500 uppercase">Total KYC Count</p>
                                <p className="text-2xl font-bold text-slate-900">{totalKYC.toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-500 uppercase">Active Supervisors</p>
                                <p className="text-2xl font-bold text-slate-900">{totalSupervisors}</p>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                                <MapPin className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-500 uppercase">Wards Covered</p>
                                <p className="text-2xl font-bold text-slate-900">{totalWards}</p>
                            </div>
                        </div>
                    </div>

                    {/* Report Content */}
                    <div id="daily-kyc-report-content" className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                        {/* Report Header for Export */}
                        <div className="bg-slate-50 border-b border-slate-200 p-8 flex flex-col items-center justify-center text-center">
                            <div className="flex items-center justify-between w-full max-w-4xl mb-6">
                                <img src={nagarNigamLogo} alt="NN" className="h-20 w-auto object-contain" />
                                <div className="flex flex-col items-center">
                                    <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Daily KYC Status</h2>
                                    {showDeployment && (
                                        <div className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-xs font-bold mt-1 border border-yellow-200">
                                            NEW SUPERVISOR DEPLOYMENT REPORT
                                        </div>
                                    )}
                                    <div className="px-4 py-1 bg-white text-slate-700 rounded-full font-bold text-sm mt-4 border border-slate-200 shadow-sm">
                                        Date: {reportDate} {showTime && <span className="ml-2 pl-2 border-l border-slate-300 text-slate-500">Time: {reportTime}</span>}
                                    </div>
                                </div>
                                <img src={natureGreenLogo} alt="NG" className="h-20 w-auto object-contain" />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="p-0 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-800 text-white">
                                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider border-r border-slate-700 w-12 text-center">S.No</th>
                                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider border-r border-slate-700">Supervisor Number</th>
                                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider border-r border-slate-700 w-32 text-center">Supervisor ID</th>
                                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider border-r border-slate-700 w-32 text-center">Contact</th>
                                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider border-r border-slate-700 text-center w-24">Ward</th>
                                        <th className="px-4 py-4 text-xs font-bold uppercase tracking-wider text-center w-24">KYC Count</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {records.map((record, index) => {
                                        // Colors for critical rows
                                        const isCritical = record.isDeploymentTarget && record.kycCount === 0;
                                        const isWarning = record.isDeploymentTarget && record.kycCount > 0;

                                        let rowClass = "hover:bg-slate-50 transition-colors even:bg-slate-50/30";
                                        if (isCritical) rowClass = "bg-red-50 hover:bg-red-100 border-l-4 border-red-500";
                                        else if (isWarning) rowClass = "bg-yellow-50 hover:bg-yellow-100 border-l-4 border-yellow-500";

                                        return (
                                            <tr key={index} className={rowClass}>
                                                <td className="px-4 py-3 text-slate-500 font-medium text-center border-r border-slate-200">{index + 1}</td>
                                                <td className="px-4 py-3 font-bold text-slate-800 border-r border-slate-200">{record.supervisorName}</td>
                                                <td className="px-4 py-3 text-center text-slate-600 font-mono text-xs border-r border-slate-200">{record.supervisorId || '-'}</td>
                                                <td className="px-4 py-3 text-center text-slate-600 font-mono text-xs border-r border-slate-200">{record.mobile || '-'}</td>
                                                <td className="px-4 py-3 font-medium text-slate-600 border-r border-slate-200 text-center">
                                                    <div className="flex flex-wrap gap-1 justify-center">
                                                        {record.wards.map((w, wIdx) => (
                                                            <span key={wIdx} className="inline-block px-2 py-1 bg-white rounded text-xs font-bold border border-slate-200 shadow-sm" title={`${w.count} records`}>
                                                                {w.name}
                                                                {record.wards.length > 1 && <span className="ml-1 text-[10px] text-gray-500">({w.count})</span>}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {record.kycCount > 0 ? (
                                                        <span className="inline-flex items-center justify-center w-12 h-8 bg-emerald-100 text-emerald-800 rounded font-black border border-emerald-200 shadow-sm">
                                                            {record.kycCount}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center justify-center w-12 h-8 bg-red-100 text-red-800 rounded font-bold border border-red-200">
                                                            0
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Export Actions */}
                    <div className="flex justify-end gap-3 pb-8">
                        <button onClick={exportExcel} className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl shadow-lg hover:bg-emerald-700 hover:shadow-xl transition-all">
                            <Download className="w-5 h-5" /> Export Excel
                        </button>
                        <button onClick={exportPDF} className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl shadow-lg hover:bg-red-700 hover:shadow-xl transition-all">
                            <FileText className="w-5 h-5" /> Export PDF
                        </button>
                        <button onClick={exportToImage} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all">
                            <FileText className="w-5 h-5" /> Export JPEG
                        </button>
                    </div>
                </>
            )}

            {!file && (
                <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border-2 border-dashed border-slate-300">
                    <div className="p-6 bg-slate-50 rounded-full mb-6">
                        <Upload className="w-12 h-12 text-slate-400" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">Upload KYC Report CSV</h3>
                    <p className="text-slate-500 mb-8 max-w-md text-center">Upload the daily KYC dump file. The system will automatically group data by Supervisor and Ward.</p>
                    <label className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-lg shadow-blue-200">
                        Select CSV File
                        <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                    </label>
                </div>
            )}
        </div>
    );
};
