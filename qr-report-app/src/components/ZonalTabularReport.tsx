import React, { useMemo, useState } from 'react';
import { 
    Search, 
    FileSpreadsheet, 
    Table as TableIcon,
    MapPin,
    Users
} from 'lucide-react';

import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';
import { type ReportRecord, type WardAssignment, formatDisplayDate } from '../utils/dataProcessor';
import supervisorData from '../data/supervisorData.json';
import masterData from '../data/masterData.json';
import * as XLSX from 'xlsx';

interface ZonalTabularReportProps {
    data: ReportRecord[];
    date: string;
    onUpload: (data: any[], date: string) => void;
    wardAssignments?: Record<string, WardAssignment>;
}

interface WardStats {
    ward: string;
    wardName: string;
    supervisor: string;
    totalQr: number;
    scanned: number;
    pending: number;
    beforeDone: number;
    afterDone: number;
    percentage: number;
}

interface ZoneHeadStats {
    name: string;
    zone: string;
    wards: WardStats[];
    totalQr: number;
    scanned: number;
    pending: number;
    beforeDone: number;
    afterDone: number;
    percentage: number;
}

export const ZonalTabularReport: React.FC<ZonalTabularReportProps> = ({ data, date, wardAssignments }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedZone, setSelectedZone] = useState<'ALL' | 'MATHURA' | 'VRINDAVAN'>('ALL');
    const [selectedHead, setSelectedHead] = useState<string>('ALL');
    const [selectedWard, setSelectedWard] = useState<string>('ALL');

    const processedData = useMemo(() => {
        const zones: Record<string, Record<string, ZoneHeadStats>> = {
            'MATHURA': {},
            'VRINDAVAN': {}
        };

        const normalize = (s: string) => s ? s.trim().toUpperCase() : 'UNASSIGNED';

        // Robustly handle JSON imports that might be under .default
        const sData = Array.isArray(supervisorData) ? supervisorData : (supervisorData as any).default || [];
        const mData = Array.isArray(masterData) ? masterData : (masterData as any).default || [];

        // Pre-calculate counts from Master Data
        const wardCounts: Record<string, number> = {};
        mData.forEach((m: any) => {
            const mWardRaw = String(m['Ward'] || m['WARD'] || m['ward'] || m['Ward Name'] || '').trim();
            const wardMatch = mWardRaw.match(/(\d+)/);
            const mWardNo = wardMatch ? wardMatch[1].replace(/^0+/, '') : '';
            if (mWardNo) {
                wardCounts[mWardNo] = (wardCounts[mWardNo] || 0) + 1;
            }
        });

        // 1. Initialize from Supervisor Data (Ward List)
        (sData as any[]).forEach((mapping: any) => {
            const rawWardNo = String(mapping['Ward No'] || mapping['WARD NO.'] || mapping['ward'] || '').trim();
            const wardMatch = rawWardNo.match(/(\d+)/);
            const wardNo = wardMatch ? wardMatch[1].replace(/^0+/, '') : '';
            const wName = mapping['Ward Name'] || mapping['WARD NAME'] || mapping['Ward'] || `Ward ${wardNo}`;
            const masterTotal = wardCounts[wardNo] || 0;
            
            // If we don't have QR counts for this ward, only skip if it's also not in scan data
            if (masterTotal === 0 && !data.some(r => {
                const rWardRaw = String(r.ward || '').trim();
                const rWardMatch = rWardRaw.match(/(\d+)/);
                return rWardMatch && rWardMatch[1].replace(/^0+/, '') === wardNo;
            })) return;

            const override = wardAssignments?.[wardNo] || wardAssignments?.[`0${wardNo}`];
            const supervisorName = (override && (override.supervisor || override.supervisorName) && (override.supervisor !== 'Unassigned' && override.supervisorName !== 'Unassigned')) 
                ? (override.supervisor || override.supervisorName) 
                : (mapping['Supervisor'] || mapping['SUPERVISOR NAME'] || 'Unassigned');

            const headName = normalize((override && override.zonalHead && override.zonalHead !== 'Unassigned') 
                ? override.zonalHead 
                : (mapping['Zonal Head'] || 'Unassigned'));

            const isVrindavan = headName.includes('VRINDAVAN') || 
                               String(mapping['Zone'] || mapping['ZONE'] || '').includes('4') ||
                               String(mapping['Zone & Circle'] || '').includes('4') ||
                               String(mapping['zone'] || '').includes('4');
            const zoneKey = isVrindavan ? 'VRINDAVAN' : 'MATHURA';

            if (!zones[zoneKey][headName]) {
                zones[zoneKey][headName] = {
                    name: headName,
                    zone: zoneKey,
                    wards: [],
                    totalQr: 0,
                    scanned: 0,
                    pending: 0,
                    beforeDone: 0,
                    afterDone: 0,
                    percentage: 0
                };
            }

            const headStats = zones[zoneKey][headName];
            if (!headStats.wards.find(w => w.ward === wardNo)) {
                headStats.wards.push({
                    ward: wardNo,
                    wardName: wName,
                    supervisor: supervisorName,
                    totalQr: masterTotal,
                    scanned: 0,
                    pending: masterTotal,
                    beforeDone: 0,
                    afterDone: 0,
                    percentage: 0
                });
                headStats.totalQr += masterTotal;
                headStats.pending += masterTotal;
            }
        });

        // 2. Scan Data Processing
        data.forEach(record => {
            const wardRaw = String(record.ward || '').trim();
            const wardMatch = wardRaw.match(/(\d+)/);
            const wardNo = wardMatch ? wardMatch[1].replace(/^0+/, '') : '';
            
            const override = wardAssignments?.[wardNo] || wardAssignments?.[`0${wardNo}`];
            const headName = normalize(record.zonalHead && record.zonalHead !== 'Unassigned' ? record.zonalHead : (override?.zonalHead || 'Unassigned'));
            
            const isVrindavan = record.zone?.includes('4') || record.zone?.toUpperCase().includes('VRINDAVAN') || headName.includes('VRINDAVAN');
            const zoneKey = isVrindavan ? 'VRINDAVAN' : 'MATHURA';

            if (zones[zoneKey][headName]) {
                const headStats = zones[zoneKey][headName];
                const wardStats = headStats.wards.find(w => w.ward === wardNo);
                if (wardStats && record.status === 'Scanned') {
                    wardStats.scanned++;
                    if (record.beforeScanStatus === 'Scanned') {
                        wardStats.beforeDone++;
                        headStats.beforeDone++;
                    }
                    if (record.afterScanStatus === 'Scanned') {
                        wardStats.afterDone++;
                        headStats.afterDone++;
                    }
                    wardStats.pending = Math.max(0, wardStats.totalQr - wardStats.scanned);
                    wardStats.percentage = Math.round((wardStats.scanned / (wardStats.totalQr || 1)) * 100);
                    headStats.scanned++;
                    headStats.pending = Math.max(0, headStats.totalQr - headStats.scanned);
                }
            }
        });

        // Finalize percentages
        Object.values(zones).forEach(zoneHeads => {
            Object.values(zoneHeads).forEach(head => {
                head.percentage = Math.round((head.scanned / (head.totalQr || 1)) * 100);
            });
        });

        return zones;
    }, [data, wardAssignments]);

    const tabularHeads = useMemo(() => {
        let all: ZoneHeadStats[] = [];
        Object.entries(processedData).forEach(([zoneName, heads]) => {
            if (selectedZone !== 'ALL' && zoneName !== selectedZone) return;
            Object.entries(heads).forEach(([hName, h]) => {
                if (selectedHead !== 'ALL' && hName !== selectedHead) return;
                
                const filteredWards = h.wards.filter(w => {
                    const matchesWard = selectedWard === 'ALL' || w.ward === selectedWard;
                    return matchesWard;
                });

                if (filteredWards.length > 0) {
                    all.push({
                        ...h,
                        wards: filteredWards
                    });
                }
            });
        });

        // Get all unique values for filters
        const heads = new Set<string>();
        const wards = new Set<string>();
        Object.values(processedData).forEach(zoneHeads => {
            Object.values(zoneHeads).forEach(h => {
                heads.add(h.name);
                h.wards.forEach(w => wards.add(w.ward));
            });
        });

        const filterOptions = {
            heads: Array.from(heads).sort(),
            wards: Array.from(wards).sort((a, b) => parseInt(a) - parseInt(b))
        };

        let result = all;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(h => 
                h.name.toLowerCase().includes(q) || 
                h.wards.some(w => w.ward.includes(q) || w.wardName.toLowerCase().includes(q))
            );
        }

        return {
            data: result.sort((a, b) => b.percentage - a.percentage),
            filterOptions
        };
    }, [processedData, selectedZone, selectedHead, selectedWard, searchQuery]);

    const zoneSummary = useMemo(() => {
        const summary = {
            MATHURA: { total: 0, scanned: 0, wards: 0, before: 0, after: 0 },
            VRINDAVAN: { total: 0, scanned: 0, wards: 0, before: 0, after: 0 }
        };
        Object.entries(processedData).forEach(([zone, heads]) => {
            Object.values(heads).forEach(h => {
                summary[zone as 'MATHURA' | 'VRINDAVAN'].total += h.totalQr;
                summary[zone as 'MATHURA' | 'VRINDAVAN'].scanned += h.scanned;
                summary[zone as 'MATHURA' | 'VRINDAVAN'].before += h.beforeDone;
                summary[zone as 'MATHURA' | 'VRINDAVAN'].after += h.afterDone;
                summary[zone as 'MATHURA' | 'VRINDAVAN'].wards += h.wards.length;
            });
        });
        return summary;
    }, [processedData]);

    const handleExportExcel = () => {
        const exportData = tabularHeads.data.flatMap((head: ZoneHeadStats) => 
            head.wards.map((ward: WardStats) => ({
                'Zone': head.zone,
                'Zonal Head': head.name,
                'Ward No': ward.ward,
                'Ward Name': ward.wardName,
                'Supervisor': ward.supervisor,
                'Total QR': ward.totalQr,
                'Scanned': ward.scanned,
                'Before Done': ward.beforeDone,
                'After Done': ward.afterDone,
                'Pending': ward.pending,
                'Efficiency %': `${ward.percentage}%`
            }))
        );

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Zonal Tabular Report");
        XLSX.writeFile(wb, `Zonal_Tabular_Report_${date || 'Export'}.xlsx`);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
            <div id="tabular-report-content" className="max-w-[1600px] mx-auto space-y-8">
                
                {/* Header Section */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full -mr-32 -mt-32 opacity-50 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-50 rounded-full -ml-32 -mb-32 opacity-50 blur-3xl" />
                    
                    <div className="flex items-center gap-6 relative">
                        <div className="p-4 bg-slate-900 rounded-3xl shadow-xl shadow-slate-900/20 rotate-3">
                            <TableIcon className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Zonal Tabular Analysis</h1>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full">QR Coverage</span>
                                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                <span className="text-slate-500 font-bold text-sm">{formatDisplayDate(date)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 relative">
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                            {(['ALL', 'MATHURA', 'VRINDAVAN'] as const).map(z => (
                                <button
                                    key={z}
                                    onClick={() => setSelectedZone(z)}
                                    className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
                                        selectedZone === z 
                                        ? 'bg-white text-slate-900 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {z}
                                </button>
                            ))}
                        </div>

                        <select
                            value={selectedHead}
                            onChange={(e) => setSelectedHead(e.target.value)}
                            className="px-4 py-3 bg-slate-100 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-slate-900/10 min-w-[150px] cursor-pointer"
                        >
                            <option value="ALL">All Zonal Heads</option>
                            {tabularHeads.filterOptions.heads.map(h => (
                                <option key={h} value={h}>{h}</option>
                            ))}
                        </select>

                        <select
                            value={selectedWard}
                            onChange={(e) => setSelectedWard(e.target.value)}
                            className="px-4 py-3 bg-slate-100 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-slate-900/10 min-w-[120px] cursor-pointer"
                        >
                            <option value="ALL">All Wards</option>
                            {tabularHeads.filterOptions.wards.map(w => (
                                <option key={w} value={w}>Ward {w}</option>
                            ))}
                        </select>

                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                            <input 
                                type="text"
                                placeholder="Search Head/Ward..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-11 pr-6 py-3 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-slate-900/10 w-64 transition-all"
                            />
                        </div>

                        <button 
                            onClick={handleExportExcel}
                            className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
                        >
                            <FileSpreadsheet className="w-4 h-4" />
                            EXPORT EXCEL
                        </button>
                    </div>
                </div>

                {/* Zone Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['MATHURA', 'VRINDAVAN'] as const).map(zone => {
                        const s = zoneSummary[zone];
                        const eff = Math.round((s.scanned / (s.total || 1)) * 100);
                        return (
                            <div key={zone} className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl relative overflow-hidden group">
                                <div className={`absolute top-0 right-0 w-32 h-32 ${zone === 'MATHURA' ? 'bg-blue-50' : 'bg-rose-50'} rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150 duration-700`} />
                                
                                <div className="relative flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-2xl ${zone === 'MATHURA' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>
                                            <MapPin className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-slate-900">{zone} ZONE</h2>
                                            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">{s.wards} Total Wards</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-4xl font-black ${eff >= 90 ? 'text-emerald-600' : eff >= 50 ? 'text-blue-600' : 'text-rose-600'}`}>
                                            {eff}%
                                        </div>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 relative">
                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total QR</p>
                                        <p className="text-lg font-black text-slate-900">{s.total.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                        <p className="text-[10px] font-black text-emerald-400 uppercase mb-1 text-emerald-600/70">Scanned</p>
                                        <p className="text-lg font-black text-emerald-700">{s.scanned.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                        <p className="text-[10px] font-black text-blue-400 uppercase mb-1">Before Done</p>
                                        <p className="text-lg font-black text-blue-700">{s.before.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                                        <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">After Done</p>
                                        <p className="text-lg font-black text-indigo-700">{s.after.toLocaleString()}</p>
                                    </div>
                                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800">
                                        <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Pending</p>
                                        <p className="text-lg font-black text-white">{(s.total - s.scanned).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Main Tabular View */}
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl overflow-hidden">
                    <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-slate-900 rounded-full" />
                            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Zonal Head Wise Performance Matrix</h2>
                        </div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{tabularHeads.data.length} Personnel Listed</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-900 text-white">
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] w-20">S.No</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Zonal Head</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em]">Zone</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-center">Wards</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-center">Total QR</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-center">Scanned</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-center">Before Done</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-center">After Done</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-center">Pending</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-right">Efficiency</th>
                                </tr>
                            </thead>
                            <tbody>
                                {tabularHeads.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-8 py-20 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                                    <Users className="w-8 h-8 text-slate-300" />
                                                </div>
                                                <div>
                                                    <p className="text-slate-900 font-black">No Data Found</p>
                                                    <p className="text-slate-500 text-sm font-bold">Try adjusting your filters or upload a valid report.</p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : tabularHeads.data.map((head, index) => (
                                    <tr key={head.name} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-6 font-black text-slate-400 text-sm">{String(index + 1).padStart(2, '0')}</td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 font-black text-xs">
                                                    {head.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900">{head.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Administrative Head</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                head.zone === 'MATHURA' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                                            }`}>
                                                {head.zone}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className="font-black text-slate-900 text-sm">{head.wards.length}</span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className="font-black text-slate-900 text-sm">{head.totalQr.toLocaleString()}</span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className="font-black text-emerald-600 text-sm">{head.scanned.toLocaleString()}</span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className="font-black text-blue-600 text-sm">{head.beforeDone.toLocaleString()}</span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className="font-black text-indigo-600 text-sm">{head.afterDone.toLocaleString()}</span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <span className="font-black text-rose-600 text-sm">{head.pending.toLocaleString()}</span>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-3">
                                                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 ${
                                                            head.percentage >= 90 ? 'bg-emerald-500' : head.percentage >= 50 ? 'bg-blue-500' : 'bg-rose-500'
                                                        }`}
                                                        style={{ width: `${head.percentage}%` }}
                                                    />
                                                </div>
                                                <span className={`font-black text-sm w-12 ${
                                                    head.percentage >= 90 ? 'text-emerald-600' : head.percentage >= 50 ? 'text-blue-600' : 'text-rose-600'
                                                }`}>
                                                    {head.percentage}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Report Branding Footer */}
                <div className="bg-white rounded-[2rem] border border-slate-100 p-10 shadow-xl flex flex-col lg:flex-row items-center justify-between gap-10">
                    <div className="flex items-center gap-8">
                        <img src={nagarNigamLogo} alt="NNMV" className="h-16 w-auto" />
                        <div className="h-12 w-px bg-slate-200" />
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase">Nagar Nigam Mathura-Vrindavan</h3>
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Administrative Tabular Report</p>
                        </div>
                    </div>
                    
                    <div className="text-center lg:text-right">
                        <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.3em] mb-2">Systems Engineered By</p>
                        <div className="flex items-center justify-center lg:justify-end gap-3">
                            <span className="text-lg font-black text-slate-900">Nature Green</span>
                            <img src={natureGreenLogo} alt="Nature Green" className="h-8 w-auto" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
