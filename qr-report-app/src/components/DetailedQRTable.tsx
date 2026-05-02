import React, { useMemo, useState } from 'react';
import { 
    Search, 
    FileSpreadsheet, 
    LayoutGrid,
    Building2,
    Clock,
    CheckCircle2,
    Info
} from 'lucide-react';
import { type ReportRecord, type WardAssignment, formatDisplayDate } from '../utils/dataProcessor';
import * as XLSX from 'xlsx';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';

interface DetailedQRTableProps {
    data: ReportRecord[];
    date: string;
    wardAssignments?: Record<string, WardAssignment>;
}

export const DetailedQRTable: React.FC<DetailedQRTableProps> = ({ data, date }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'Scanned' | 'Pending'>('ALL');
    const [zoneFilter, setZoneFilter] = useState<'ALL' | 'MATHURA' | 'VRINDAVAN'>('ALL');
    const [wardFilter, setWardFilter] = useState<string>('ALL');
    const [specificZoneFilter, setSpecificZoneFilter] = useState<string>('ALL');
    const [zonalHeadFilter, setZonalHeadFilter] = useState<string>('ALL');
    const [evidenceFilter, setEvidenceFilter] = useState<'ALL' | 'BOTH' | 'ONLY_BEFORE' | 'ONLY_AFTER' | 'NONE'>('ALL');

    // Calculate Unique Wards for filtering
    const uniqueWards = useMemo(() => {
        const wards = Array.from(new Set(data.map(r => r.ward).filter(Boolean)));
        return wards.sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, '')) || 0;
            const numB = parseInt(b.replace(/\D/g, '')) || 0;
            return numA - numB;
        });
    }, [data]);

    // Calculate Unique Specific Zones
    const uniqueZones = useMemo(() => {
        const zones = Array.from(new Set(data.map(r => r.zone).filter(Boolean)));
        return zones.sort();
    }, [data]);

    // Calculate Unique Zonal Heads
    const uniqueHeads = useMemo(() => {
        const heads = Array.from(new Set(data.map(r => r.zonalHead).filter(Boolean)));
        return heads.sort();
    }, [data]);

    const filteredData = useMemo(() => {
        return data.filter(record => {
            const matchesSearch = 
                record.qrId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                record.buildingName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                record.ward.toLowerCase().includes(searchQuery.toLowerCase()) ||
                record.assignedTo.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesStatus = statusFilter === 'ALL' || record.status === statusFilter;
            
            const matchesWard = wardFilter === 'ALL' || record.ward === wardFilter;
            const matchesSpecificZone = specificZoneFilter === 'ALL' || record.zone === specificZoneFilter;
            const matchesZonalHead = zonalHeadFilter === 'ALL' || record.zonalHead === zonalHeadFilter;

            const zoneStr = String(record.zone || '');
            const headStr = String(record.zonalHead || '');
            const isVrindavan = zoneStr.includes('4') || zoneStr.toUpperCase().includes('VRINDAVAN') || headStr.toUpperCase().includes('VRINDAVAN');
            const zone = isVrindavan ? 'VRINDAVAN' : 'MATHURA';
            const matchesZone = zoneFilter === 'ALL' || zone === zoneFilter;

            const hasBefore = record.beforeScanStatus === 'Scanned';
            const hasAfter = record.afterScanStatus === 'Scanned';
            const matchesEvidence = 
                evidenceFilter === 'ALL' ||
                (evidenceFilter === 'BOTH' && hasBefore && hasAfter) ||
                (evidenceFilter === 'ONLY_BEFORE' && hasBefore && !hasAfter) ||
                (evidenceFilter === 'ONLY_AFTER' && !hasBefore && hasAfter) ||
                (evidenceFilter === 'NONE' && !hasBefore && !hasAfter);

            return matchesSearch && matchesStatus && matchesWard && matchesSpecificZone && matchesZonalHead && matchesZone && matchesEvidence;
        });
    }, [data, searchQuery, statusFilter, zoneFilter, evidenceFilter, wardFilter, specificZoneFilter, zonalHeadFilter]);

    const handleExportExcel = () => {
        const exportData = filteredData.map((record, index) => ({
            'S.No': index + 1,
            'QR Code ID': record.qrId,
            'Ward': record.ward,
            'Zone': record.zone,
            'Building/Street': record.buildingName,
            'Site Name': record.siteName,
            'Supervisor': record.assignedTo,
            'Zonal Head': record.zonalHead,
            'Status': record.status,
            'Before Clean Time': record.beforeScanTime,
            'After Clean Time': record.afterScanTime,
            'Time Difference': record.timeDifference,
            'Scanned By': record.scannedBy,
            'Date': record.scanTime
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Detailed QR List");
        XLSX.writeFile(wb, `Detailed_QR_Report_${date || 'Export'}.xlsx`);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
            <div className="max-w-[1600px] mx-auto space-y-6">
                
                {/* Header Section */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col xl:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-600/20 rotate-3">
                            <LayoutGrid className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight text-center xl:text-left">QR-Wise Detailed Audit</h1>
                            <div className="flex items-center justify-center xl:justify-start gap-3 mt-1">
                                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-full">Individual Tracking</span>
                                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                <span className="text-slate-500 font-bold text-sm">{formatDisplayDate(date)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4">
                        <div className="relative group flex-1 max-w-md">
                            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                            <input 
                                type="text"
                                placeholder="Search QR, Supervisor, Building..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-[2rem] text-sm font-bold text-slate-900 focus:ring-4 focus:ring-slate-900/5 focus:border-slate-900 outline-none transition-all"
                            />
                        </div>

                        {/* Ward Filter Dropdown */}
                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-slate-400">Ward</span>
                            <select 
                                value={wardFilter}
                                onChange={(e) => setWardFilter(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 min-w-[80px] cursor-pointer"
                            >
                                <option value="ALL">All Wards</option>
                                {uniqueWards.map(w => (
                                    <option key={w} value={w}>Ward {w}</option>
                                ))}
                            </select>
                        </div>

                        {/* Zonal Head Filter Dropdown */}
                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-slate-400">Head</span>
                            <select 
                                value={zonalHeadFilter}
                                onChange={(e) => setZonalHeadFilter(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm font-bold text-slate-700 min-w-[120px] cursor-pointer"
                            >
                                <option value="ALL">All Zonal Heads</option>
                                {uniqueHeads.map(h => (
                                    <option key={h} value={h}>{h}</option>
                                ))}
                            </select>
                        </div>

                        {/* Specific Zone Filter - Buttons for better UX */}
                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                            <button
                                onClick={() => setSpecificZoneFilter('ALL')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                    specificZoneFilter === 'ALL' 
                                    ? 'bg-white text-indigo-600 shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                All Zones
                            </button>
                            {uniqueZones.map(z => (
                                <button
                                    key={z}
                                    onClick={() => setSpecificZoneFilter(z)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        specificZoneFilter === z 
                                        ? 'bg-white text-indigo-600 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {z}
                                </button>
                            ))}
                        </div>

                        {/* Status Filter */}
                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                            {(['ALL', 'Scanned', 'Pending'] as const).map(s => (
                                <button
                                    key={s}
                                    onClick={() => setStatusFilter(s)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        statusFilter === s 
                                        ? 'bg-white text-indigo-600 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>

                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                            {(['ALL', 'MATHURA', 'VRINDAVAN'] as const).map(z => (
                                <button
                                    key={z}
                                    onClick={() => setZoneFilter(z)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        zoneFilter === z 
                                        ? 'bg-white text-slate-900 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {z}
                                </button>
                            ))}
                        </div>

                        {/* Evidence Filter */}
                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                            {[
                                { id: 'ALL', label: 'All Evidence' },
                                { id: 'BOTH', label: 'Both' },
                                { id: 'ONLY_BEFORE', label: 'Before Only' },
                                { id: 'ONLY_AFTER', label: 'After Only' },
                                { id: 'NONE', label: 'None' }
                            ].map(f => (
                                <button
                                    key={f.id}
                                    onClick={() => setEvidenceFilter(f.id as any)}
                                    className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        evidenceFilter === f.id 
                                        ? 'bg-indigo-600 text-white shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Export */}
                        <button 
                            onClick={handleExportExcel}
                            className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            EXPORT EXCEL
                        </button>
                    </div>
                </div>

                {/* Stats Grid - Softened Palette */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm group transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-slate-100 rounded-lg">
                                <LayoutGrid className="w-4 h-4 text-slate-400" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Filtered</p>
                        </div>
                        <p className="text-3xl font-black text-slate-800">{filteredData.length.toLocaleString()}</p>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border-l-4 border-l-emerald-400 border border-slate-200 shadow-sm group transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-emerald-50 rounded-lg">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Scanned Records</p>
                        </div>
                        <p className="text-3xl font-black text-slate-800">
                            {filteredData.filter(r => r.status === 'Scanned').length.toLocaleString()}
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border-l-4 border-l-amber-400 border border-slate-200 shadow-sm group transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-amber-50 rounded-lg">
                                <Clock className="w-4 h-4 text-amber-500" />
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Audit</p>
                        </div>
                        <p className="text-3xl font-black text-slate-800">
                            {filteredData.filter(r => r.status === 'Pending').length.toLocaleString()}
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] border-l-4 border-l-indigo-400 border border-slate-200 shadow-sm group transition-all">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-indigo-50 rounded-lg">
                                <div className="w-4 h-4 flex items-center justify-center text-indigo-500 font-black text-[10px]">%</div>
                            </div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Audit Score</p>
                        </div>
                        <div className="flex items-end gap-1">
                            <p className="text-3xl font-black text-slate-800">
                                {Math.round((filteredData.filter(r => r.status === 'Scanned').length / (filteredData.length || 1)) * 100)}
                            </p>
                            <span className="text-sm font-black text-slate-400 mb-1">%</span>
                        </div>
                    </div>
                </div>

                {/* Main Table Container - Light & Professional */}
                <div className="bg-white rounded-[1.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[65vh]">
                    <div className="overflow-auto flex-1 custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[1200px]">
                            <thead className="sticky top-0 z-20">
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-4 py-3.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-200 w-16 text-center bg-slate-50">S.No</th>
                                    <th className="px-6 py-3.5 text-[10px] font-black text-slate-600 uppercase tracking-widest border-r border-slate-200 bg-slate-50">QR ID & Location</th>
                                    <th className="px-6 py-3.5 text-[10px] font-black text-slate-600 uppercase tracking-widest border-r border-slate-200 bg-slate-50">Ward & Zone</th>
                                    <th className="px-6 py-3.5 text-[10px] font-black text-slate-600 uppercase tracking-widest border-r border-slate-200 bg-slate-50">Supervisor</th>
                                    <th className="px-6 py-3.5 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center border-r border-slate-200 bg-slate-50">Status</th>
                                    <th className="px-4 py-3.5 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center border-r border-slate-200 bg-slate-50">Before</th>
                                    <th className="px-4 py-3.5 text-[10px] font-black text-slate-600 uppercase tracking-widest text-center border-r border-slate-200 bg-slate-50">After</th>
                                    <th className="px-6 py-3.5 text-[10px] font-black text-slate-600 uppercase tracking-widest text-right bg-slate-50">Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-32 text-center bg-slate-50/30">
                                            <div className="flex flex-col items-center gap-3">
                                                <Info className="w-10 h-10 text-slate-200" />
                                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No results match filters</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((record, index) => (
                                        <tr 
                                            key={record.qrId} 
                                            className={`group transition-colors hover:bg-slate-50 ${
                                                index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                                            }`}
                                        >
                                            <td className="px-4 py-2.5 border-r border-slate-100 text-center font-bold text-slate-300 text-[11px]">
                                                {index + 1}
                                            </td>
                                            <td className="px-6 py-2.5 border-r border-slate-100 max-w-[300px]">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-xs tracking-tight">{record.qrId}</span>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 truncate">
                                                        <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                                                        <span className="truncate">{record.buildingName || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-2.5 border-r border-slate-100">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-800 text-xs">Ward {record.ward}</span>
                                                    <span className={`text-[9px] font-black uppercase tracking-wider ${
                                                        String(record.zone || '').includes('4') || String(record.zone || '').toUpperCase().includes('VRINDAVAN') 
                                                        ? 'text-rose-400' 
                                                        : 'text-blue-400'
                                                    }`}>
                                                        {record.zone}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-2.5 border-r border-slate-100">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 text-[10px] font-bold">
                                                        {(record.assignedTo || '?').charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="text-[11px] font-bold text-slate-600 tracking-tight">{record.assignedTo}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-2.5 text-center border-r border-slate-100">
                                                <div className={`py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                                    record.status === 'Scanned' 
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                                                    : 'bg-slate-100 text-slate-400 border-slate-200'
                                                }`}>
                                                    {record.status}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 text-center border-r border-slate-100">
                                                <span className={`text-[10px] font-bold ${record.beforeScanStatus === 'Scanned' ? 'text-slate-700' : 'text-slate-200'}`}>
                                                    {record.beforeScanTime || '--:--'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-center border-r border-slate-100">
                                                <span className={`text-[10px] font-bold ${record.afterScanStatus === 'Scanned' ? 'text-slate-700' : 'text-slate-200'}`}>
                                                    {record.afterScanTime || '--:--'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-2.5 text-right font-bold text-slate-800 text-[11px]">
                                                {record.timeDifference || '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Minimalist Scrollbar */}
                    <style>{`
                        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
                        .custom-scrollbar::-webkit-scrollbar-track { background: #ffffff; }
                        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                    `}</style>
                </div>

                {/* Footer Branding */}
                <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-xl flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="flex items-center gap-6">
                        <img src={nagarNigamLogo} alt="NNMV" className="h-12 w-auto" />
                        <div className="h-8 w-px bg-slate-200" />
                        <div>
                            <h3 className="text-lg font-black text-slate-900 uppercase">Nagar Nigam Mathura-Vrindavan</h3>
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-[8px]">QR-Level Detailed Audit Trail</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm font-black text-slate-900">Nature Green</span>
                        <img src={natureGreenLogo} alt="Nature Green" className="h-6 w-auto" />
                    </div>
                </div>
            </div>
        </div>
    );
};
