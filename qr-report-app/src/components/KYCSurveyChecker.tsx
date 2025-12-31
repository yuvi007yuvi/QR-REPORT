import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import {
    Upload,
    FileText,
    Search,
    CheckCircle,
    Download,
    User,
    BarChart3,
    TrendingUp
} from 'lucide-react';
import { exportToJPEG } from '../utils/exporter';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';

import { MASTER_SUPERVISORS } from '../data/master-supervisors';

interface KYCRecord {
    empId: string;
    count: number;
    name?: string;
    mobile?: string;
    date?: string;
}

export const KYCSurveyChecker: React.FC = () => {
    const [fileName, setFileName] = useState<string | null>(null);
    const [kycData, setKycData] = useState<KYCRecord[]>([]);

    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedZonal, setSelectedZonal] = useState('All');


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
                const empIdRecords: Record<string, KYCRecord> = {};


                // Find the likely columns (flexible matching)
                const headers = results.meta.fields || [];
                const empIdHeader = headers.find(h =>
                    h.toLowerCase().includes('supervisor id') ||
                    h.toLowerCase().includes('employee display id') ||
                    (h.toLowerCase().includes('id') && !h.toLowerCase().includes('customer')) // Prioritize 'Supervisor ID', avoid 'Customer ID'
                );

                const countHeader = headers.find(h =>
                    h.toLowerCase().includes('customer count') ||
                    h.toLowerCase().includes('kyc done')
                );

                const nameHeader = headers.find(h =>
                    h.toLowerCase().includes('supervisor name') ||
                    h.toLowerCase().includes('employee name')
                );

                const mobileHeader = headers.find(h =>
                    h.toLowerCase().includes('supervisor number') || // Prioritize 'Supervisor Number'
                    h.toLowerCase().includes('mobile') ||
                    h.toLowerCase().includes('phone')
                );



                if (empIdHeader) {
                    data.forEach(row => {
                        const id = String(row[empIdHeader] || '').trim().toUpperCase();
                        const count = countHeader ? (parseInt(row[countHeader]) || 0) : 1;

                        if (id) {
                            // Aggregate by employee ID
                            if (!empIdRecords[id]) {
                                empIdRecords[id] = {
                                    empId: id,
                                    count: 0,
                                    name: nameHeader ? row[nameHeader] : undefined,
                                    mobile: mobileHeader ? row[mobileHeader] : undefined
                                };
                            }
                            empIdRecords[id].count += count;

                        }
                    });

                    setKycData(Object.values(empIdRecords));
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



    const zonals = useMemo(() => {
        return ['All', ...new Set(MASTER_SUPERVISORS.map(s => s.zonal))].sort();
    }, []);

    const matchedResults = useMemo(() => {
        // Start with the Master List
        const results = MASTER_SUPERVISORS.map(sup => {
            const kycMatch = kycData.find(k => k.empId === sup.empId);
            return {
                ...sup,
                // Prioritize the name from the CSV if it exists
                name: kycMatch?.name || sup.name,
                kycCount: kycMatch ? kycMatch.count : 0,
                isMaster: true
            };
        });

        // Add supervisors from CSV that are NOT in the Master List
        kycData.forEach(kyc => {
            if (!results.some(r => r.empId === kyc.empId)) {
                results.push({
                    sNo: "EXT",
                    empId: kyc.empId,
                    department: "UCC",
                    name: kyc.name || "NEW SUPERVISOR (" + kyc.empId + ")",
                    mobile: kyc.mobile || "N/A",
                    ward: "Unmapped",
                    zonal: "UNASSIGNED",
                    kycCount: kyc.count,
                    isMaster: false
                });
            }
        });

        return results.filter(res => {
            const nameMatch = res.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                res.empId.toLowerCase().includes(searchTerm.toLowerCase());
            const zonalMatch = selectedZonal === 'All' || res.zonal === selectedZonal;
            return nameMatch && zonalMatch;
        }).sort((a, b) => b.kycCount - a.kycCount);
    }, [kycData, searchTerm, selectedZonal]);

    const totalUploadedSupervisors = kycData.length;
    const totalKYCCount = kycData.reduce((acc, curr) => acc + curr.count, 0);
    const activeSurveyors = matchedResults.filter(r => r.kycCount > 0).length;

    const ctTotal = matchedResults
        .filter(r => r.department === 'C&T')
        .reduce((acc, curr) => acc + curr.kycCount, 0);

    const uccTotal = matchedResults
        .filter(r => r.department === 'UCC')
        .reduce((acc, curr) => acc + curr.kycCount, 0);

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-white min-h-screen">
            {/* Title Section */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-slate-700 rounded-lg">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            KYC Survey Checker
                        </h2>
                        <p className="text-slate-600 mt-2 font-medium flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-slate-500" />
                            Match and verify supervisor-wise KYC survey counts from uploaded CSV.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="relative flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition-all cursor-pointer group">
                            <Upload className="w-5 h-5" />
                            <span className="font-semibold">{fileName ? "Update CSV" : "Upload KYC CSV"}</span>
                            <input
                                type="file"
                                className="hidden"
                                accept=".csv"
                                onChange={handleFileUpload}
                                disabled={loading}
                            />
                        </label>

                        <button
                            onClick={() => exportToJPEG('kyc-checker-container', 'KYC_Survey_Report')}
                            className="p-3 bg-white border-2 border-slate-300 rounded-lg hover:border-slate-400 hover:bg-slate-50 transition-all text-slate-700"
                            title="Export as JPEG"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div id="kyc-checker-container" className="max-w-7xl mx-auto space-y-6">
                {/* Professional Logos Header - MASSIVE SIZE */}
                <div className="bg-white rounded-xl border border-slate-200 p-10 flex items-center justify-between shadow-md">
                    <div className="flex flex-col items-center gap-3">
                        <img src={nagarNigamLogo} alt="Nagar Nigam" className="h-32 w-auto object-contain" />
                        <span className="text-sm font-black text-slate-800 uppercase leading-none mt-2 tracking-wide">Nagar Nigam Mathura</span>
                    </div>

                    <div className="text-center px-8">
                        <h1 className="text-6xl font-black text-slate-900 leading-tight tracking-tighter drop-shadow-sm">KYC SURVEY</h1>
                        {selectedZonal !== 'All' && (
                            <div className="inline-block bg-slate-100 px-6 py-2 rounded-full mt-4 border border-slate-200">
                                <p className="text-xl font-bold text-slate-700 uppercase tracking-widest">
                                    Zonal: {selectedZonal}
                                </p>
                            </div>
                        )}
                        <div className="h-2 w-32 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mt-6 rounded-full shadow-sm"></div>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                        <img src={natureGreenLogo} alt="Nature Green" className="h-32 w-auto object-contain" />
                        <span className="text-sm font-black text-slate-800 uppercase leading-none mt-2 tracking-wide">Nature Green Waste</span>
                    </div>
                </div>

                {/* Status Cards - PROPER GRADIENT CARDS (MASSIVE) */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
                    {/* Total KYC - Blue Gradient */}
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 rounded-3xl shadow-2xl shadow-blue-500/40 flex flex-col items-start gap-4 hover:scale-[1.03] transition-transform group cursor-pointer relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/10 transition-colors"></div>
                        <div className="p-5 bg-white/25 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
                            <BarChart3 className="w-12 h-12 text-white" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-sm font-bold text-blue-50 uppercase tracking-widest mb-1">Total KYC</p>
                            <h2 className="text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">{totalKYCCount.toLocaleString()}</h2>
                        </div>
                    </div>

                    {/* C&T Total - Emerald Gradient */}
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 p-8 rounded-3xl shadow-2xl shadow-emerald-500/40 flex flex-col items-start gap-4 hover:scale-[1.03] transition-transform group cursor-pointer relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/10 transition-colors"></div>
                        <div className="p-5 bg-white/25 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
                            <User className="w-12 h-12 text-white" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-sm font-bold text-emerald-50 uppercase tracking-widest mb-1">C&T Total</p>
                            <h2 className="text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">{ctTotal.toLocaleString()}</h2>
                        </div>
                    </div>

                    {/* UCC Total - Orange Gradient */}
                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 rounded-3xl shadow-2xl shadow-orange-500/40 flex flex-col items-start gap-4 hover:scale-[1.03] transition-transform group cursor-pointer relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/10 transition-colors"></div>
                        <div className="p-5 bg-white/25 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
                            <User className="w-12 h-12 text-white" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-sm font-bold text-orange-50 uppercase tracking-widest mb-1">UCC Total</p>
                            <h2 className="text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">{uccTotal.toLocaleString()}</h2>
                        </div>
                    </div>

                    {/* Active - Violet Gradient */}
                    <div className="bg-gradient-to-br from-violet-500 to-violet-600 p-8 rounded-3xl shadow-2xl shadow-violet-500/40 flex flex-col items-start gap-4 hover:scale-[1.03] transition-transform group cursor-pointer relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/10 transition-colors"></div>
                        <div className="p-5 bg-white/25 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
                            <div className="w-12 h-12 flex items-center justify-center font-black text-2xl text-white">AS</div>
                        </div>
                        <div className="relative z-10">
                            <p className="text-sm font-bold text-violet-50 uppercase tracking-widest mb-1">Active</p>
                            <h2 className="text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">{activeSurveyors}</h2>
                        </div>
                    </div>

                    {/* Avg Perf - Rose Gradient */}
                    <div className="bg-gradient-to-br from-rose-500 to-pink-600 p-8 rounded-3xl shadow-2xl shadow-rose-500/40 flex flex-col items-start gap-4 hover:scale-[1.03] transition-transform group cursor-pointer relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/10 transition-colors"></div>
                        <div className="p-5 bg-white/25 rounded-2xl backdrop-blur-md shadow-inner border border-white/20">
                            <TrendingUp className="w-12 h-12 text-white" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-sm font-bold text-rose-50 uppercase tracking-widest mb-1">Avg Perf</p>
                            <h2 className="text-5xl font-black text-white tracking-tight leading-none drop-shadow-md">
                                {activeSurveyors > 0 ? (totalKYCCount / activeSurveyors).toFixed(1) : 0}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search Supervisor Name or Emp ID..."
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none transition-all font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <select
                                className="bg-slate-50 border border-slate-200 rounded-lg px-6 py-3 font-semibold text-slate-700 outline-none focus:border-slate-400 cursor-pointer w-full"
                                value={selectedZonal}
                                onChange={(e) => setSelectedZonal(e.target.value)}
                            >
                                {zonals.map(z => <option key={z} value={z}>{z === 'All' ? 'All Zonals' : z}</option>)}
                            </select>
                        </div>
                    </div>

                </div>


                {/* Main Content Area - Table View */}
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-8 py-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row items-center justify-center gap-12 text-center">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Supervisors</span>
                            <span className="text-2xl font-bold text-slate-900">{totalUploadedSupervisors}</span>
                        </div>
                        <div className="w-px h-10 bg-slate-200 hidden md:block"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Total KYC Counts</span>
                            <span className="text-2xl font-bold text-slate-900">{totalKYCCount.toLocaleString()}</span>
                        </div>
                    </div>

                    {fileName && (
                        <div className="px-8 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-slate-700 text-sm font-semibold flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Analyzing CSV: {fileName}
                            </span>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest bg-white px-3 py-1 rounded-md border border-slate-200">
                                {matchedResults.length} Matched Master Entries
                            </span>
                        </div>
                    )}

                    <div className="overflow-x-auto border-2 border-slate-300 rounded-lg shadow-lg">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-900 text-white">
                                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest border-r border-indigo-600/50 text-center w-14">SN</th>
                                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest border-r border-indigo-600/50 text-center text-yellow-300">Employee ID</th>
                                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest border-r border-indigo-600/50 text-center">Supervisor / Surveyor</th>
                                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest border-r border-indigo-600/50 text-center">Dept</th>
                                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest border-r border-indigo-600/50 text-center">Mobile No</th>
                                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest border-r border-indigo-600/50 text-center">Zonal Head</th>
                                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest border-r border-indigo-600/50 text-center">Wards</th>
                                    <th className="px-4 py-4 text-xs font-bold uppercase tracking-widest text-center text-green-300">KYC Done</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {matchedResults.length > 0 ? (
                                    matchedResults.map((row, idx) => {
                                        return (
                                            <tr key={idx} className="hover:bg-blue-50/60 transition-colors border-b border-slate-200 even:bg-slate-50/50">
                                                <td className="px-4 py-3 text-slate-500 font-bold border-r border-slate-200 text-center text-xs">{idx + 1}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-slate-700 font-mono border-r border-slate-200 text-center tracking-tight">{row.empId}</td>
                                                <td className="px-4 py-3 border-r border-slate-200 text-center">
                                                    <span className="font-bold text-slate-800 text-xs uppercase tracking-tight">{row.name}</span>
                                                </td>
                                                <td className="px-4 py-3 text-center border-r border-slate-200">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${row.department === 'UCC'
                                                        ? 'bg-orange-50 text-orange-700 border-orange-200'
                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        }`}>
                                                        {row.department}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs font-semibold text-slate-600 border-r border-slate-200 text-center font-mono">{row.mobile}</td>
                                                <td className="px-4 py-3 border-r border-slate-200 text-center">
                                                    <span className="inline-block px-2 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200 uppercase tracking-tight whitespace-nowrap">
                                                        {row.zonal}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs font-semibold text-slate-500 border-r border-slate-200 text-center">{row.ward}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {row.kycCount > 0 ? (
                                                        <div className="inline-flex items-center justify-center w-10 h-8 bg-green-100 text-green-700 rounded-lg border border-green-200 font-black text-sm shadow-sm">
                                                            {row.kycCount}
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex items-center justify-center w-10 h-8 bg-red-50 text-red-400 rounded-lg border border-red-100 font-bold text-sm">
                                                            0
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="px-8 py-24 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="p-8 bg-slate-50 rounded-full text-slate-300">
                                                    <Search className="w-16 h-16" />
                                                </div>
                                                <p className="font-bold text-slate-400 text-lg">No data found. Upload a CSV to start the audit.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
