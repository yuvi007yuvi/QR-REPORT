import React, { useMemo } from 'react';
import { Image as ImageIcon, Upload } from 'lucide-react';
import { exportToJPEG } from '../utils/exporter';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { parseFile, type ReportRecord, type WardAssignment } from '../utils/dataProcessor';
import supervisorData from '../data/supervisorData.json';
import masterData from '../data/masterData.json';

interface ZonalReportProps {
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
    scanTiming: string;
}

interface ZoneHeadStats {
    name: string;
    wards: WardStats[];
    totalQr: number;
    scanned: number;
    pending: number;
}

export const ZonalReport: React.FC<ZonalReportProps> = ({ data, date, onUpload, wardAssignments }) => {
    const [localData, setLocalData] = React.useState<ReportRecord[]>(data);
    const [localDate, setLocalDate] = React.useState<string>(date);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (data) {
            setLocalData(data);
            setLocalDate(date);
        }
    }, [data, date]);

    const [filterZone, setFilterZone] = React.useState<string>('ALL');
    const [filterHead, setFilterHead] = React.useState<string>('ALL');
    const [searchQuery, setSearchQuery] = React.useState('');

    React.useEffect(() => {
        document.title = "Zonal QR Report | Nagar Nigam Mathura-Vrindavan";
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const jsonData = await parseFile(file);
            // Identify first date in file for the header
            const dateKeys = ['Date Of Scan', 'Date', 'Scan Date', 'Timestamp'];
            let fileDate = '';
            if (jsonData.length > 0) {
                const firstRow = jsonData[0];
                for (const key of dateKeys) {
                    if (firstRow[key]) {
                        fileDate = firstRow[key];
                        break;
                    }
                }
            }
            onUpload(jsonData, fileDate);
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to process file");
        } finally {
            setLoading(false);
        }
    };

    const reportData = useMemo(() => {
        const zones: Record<string, Record<string, ZoneHeadStats>> = {
            'MATHURA': {},
            'VRINDAVAN': {}
        };

        const normalize = (s: string) => s ? s.trim() : 'Unknown';

        // Helper to get latest mapping for a ward
        const getMapping = (wardNo: string, wardName?: string) => {
            const normalizedNo = wardNo.replace(/^0+/, '');
            
            // 1. Check Firestore overrides first (highest priority)
            const override = wardAssignments?.[normalizedNo] || wardAssignments?.[`0${normalizedNo}`];
            if (override && override.zonalHead !== 'Unassigned') {
                return {
                    supervisor: override.supervisor || 'Unassigned',
                    zonalHead: override.zonalHead || 'Unassigned'
                };
            }
            
            // 2. Check static supervisorData
            const staticMatch = (supervisorData as any[]).find(s => {
                const sNo = String(s['Ward No'] || s['WARD NO.'] || '').replace(/^0+/, '');
                if (sNo === normalizedNo) return true;
                if (wardName && s['Ward Name'] && String(s['Ward Name']).trim().toUpperCase() === wardName.trim().toUpperCase()) return true;
                return false;
            });

            if (staticMatch) {
                return {
                    supervisor: staticMatch['Supervisor'] || 'Unassigned',
                    zonalHead: staticMatch['Zonal Head'] || 'Unassigned'
                };
            }
            
            return { supervisor: 'Unassigned', zonalHead: 'Unassigned' };
        };

        // Pre-populate wards from supervisor data
        (supervisorData as any[]).forEach((mapping: any) => {
            const rawWardNo = String(mapping['Ward No'] || mapping['WARD NO.'] || '');
            const wardNo = rawWardNo.replace(/^0+/, '');
            const wName = mapping['Ward Name'] || mapping['WARD NAME'] || '';
            if (!wardNo) return;

            // Check for overrides
            const override = wardAssignments?.[wardNo] || wardAssignments?.[`0${wardNo}`];
            const supervisorName = (override && override.supervisor && override.supervisor !== 'Unassigned') 
                ? override.supervisor 
                : (mapping['Supervisor'] || mapping['SUPERVISOR NAME'] || mapping['supervisor'] || 'Unassigned');
            const headName = (override && override.zonalHead && override.zonalHead !== 'Unassigned') 
                ? override.zonalHead 
                : (mapping['Zonal Head'] || mapping['ZONAL HEAD'] || mapping['zonalHead'] || 'Unassigned');
            
            // Count total QR codes for this ward from masterData
            const masterTotal = (masterData as any[]).filter(m => {
                const mWardRaw = String(m['Ward'] || m['WARD'] || m['ward'] || '');
                const mWardNo = mWardRaw.match(/^(\d+)/)?.[1].replace(/^0+/, '') || '';
                return mWardNo === wardNo;
            }).length;

            // Only show wards that have at least one QR code in master data
            if (masterTotal === 0) return;

            // Note: Vrindavan zone heuristics - prioritize Zonal Head name
            const isVrindavan = headName.toUpperCase().includes('VRINDAVAN') || 
                               (mapping['Zone'] && String(mapping['Zone']).includes('4')) ||
                               (mapping['ZONE'] && String(mapping['ZONE']).includes('4'));
            const zoneKey = isVrindavan ? 'VRINDAVAN' : 'MATHURA';

            if (!zones[zoneKey][headName]) {
                zones[zoneKey][headName] = {
                    name: headName,
                    wards: [],
                    totalQr: 0,
                    scanned: 0,
                    pending: 0
                };
            }

            const headStats = zones[zoneKey][headName];
            
            let wardStats = headStats.wards.find(w => w.ward === wardNo);
            if (!wardStats) {
                wardStats = {
                    ward: wardNo,
                    wardName: wName,
                    supervisor: supervisorName,
                    totalQr: masterTotal,
                    scanned: 0,
                    pending: masterTotal,
                    scanTiming: 'DAY'
                };
                headStats.wards.push(wardStats);
                headStats.totalQr += masterTotal;
                headStats.pending += masterTotal;
            }
        });

        // 2. Local Data Processing (Scans)
        localData.forEach(record => {
            const wardRaw = record.ward || '';
            const wardMatch = wardRaw.match(/^(\d+)/);
            const wardNo = wardMatch ? wardMatch[1].replace(/^0+/, '') : '';
            const wardNamePart = wardRaw.includes('-') ? wardRaw.split('-')[1].trim() : '';

            const { supervisor: mappedSupervisor, zonalHead: mappedHead } = getMapping(wardNo, wardNamePart);
            
            // Priority: Record assigned name -> Mapped name -> "Unassigned"
            const supervisorName = record.assignedTo && record.assignedTo !== 'Unassigned' 
                ? normalize(record.assignedTo) 
                : mappedSupervisor;
            const headName = record.zonalHead && record.zonalHead !== 'Unassigned' 
                ? normalize(record.zonalHead) 
                : mappedHead;
            
            const isVrindavan = record.zone.includes('4') || 
                               record.zone.toUpperCase().includes('VRINDAVAN') || 
                               headName.toUpperCase().includes('VRINDAVAN');
            const zoneKey = isVrindavan ? 'VRINDAVAN' : 'MATHURA';

            if (!zones[zoneKey][headName]) {
                zones[zoneKey][headName] = {
                    name: headName,
                    wards: [],
                    totalQr: 0,
                    scanned: 0,
                    pending: 0
                };
            }

            const headStats = zones[zoneKey][headName];
            
            let wardStats = headStats.wards.find(w => w.ward === wardNo);
            if (wardStats) {
                if (record.status === 'Scanned') {
                    wardStats.scanned++;
                    wardStats.pending = Math.max(0, wardStats.totalQr - wardStats.scanned);
                    headStats.scanned++;
                    headStats.pending = Math.max(0, headStats.totalQr - headStats.scanned);
                }
                
                // Update supervisor name if it was unassigned but we have a better name now
                if (supervisorName !== 'Unassigned') {
                    wardStats.supervisor = supervisorName;
                }
            }
        });

        return zones;
    }, [localData, wardAssignments]);

    // Calculate Grand Totals for Header using processed zones
    const grandTotals = useMemo(() => {
        let mathuraTotal = 0;
        let mathuraScanned = 0;
        let vrindavanTotal = 0;
        let vrindavanScanned = 0;

        Object.values(reportData.MATHURA).forEach(head => {
            mathuraTotal += head.totalQr;
            mathuraScanned += head.scanned;
        });

        Object.values(reportData.VRINDAVAN).forEach(head => {
            vrindavanTotal += head.totalQr;
            vrindavanScanned += head.scanned;
        });

        return { mathuraTotal, mathuraScanned, vrindavanTotal, vrindavanScanned };
    }, [reportData]);

    // Apply filters to reportData for display
    const filteredReportData = useMemo(() => {
        const filtered: Record<string, Record<string, ZoneHeadStats>> = {};
        
        Object.entries(reportData).forEach(([zoneName, heads]) => {
            if (filterZone !== 'ALL' && zoneName !== filterZone) return;
            
            const zoneHeads: Record<string, ZoneHeadStats> = {};
            Object.entries(heads).forEach(([headName, headStats]) => {
                if (filterHead !== 'ALL' && headName !== filterHead) return;
                
                if (searchQuery) {
                    const query = searchQuery.toLowerCase();
                    const filteredWards = headStats.wards.filter(w => 
                        w.ward.toLowerCase().includes(query) ||
                        w.wardName.toLowerCase().includes(query) ||
                        w.supervisor.toLowerCase().includes(query)
                    );
                    
                    if (filteredWards.length > 0) {
                        zoneHeads[headName] = {
                            ...headStats,
                            wards: filteredWards
                        };
                    }
                } else {
                    zoneHeads[headName] = headStats;
                }
            });
            
            if (Object.keys(zoneHeads).length > 0) {
                filtered[zoneName] = zoneHeads;
            }
        });
        
        return filtered;
    }, [reportData, filterZone, filterHead, searchQuery]);

    // Get all unique zonal heads for the filter dropdown
    const allHeads = useMemo(() => {
        const heads = new Set<string>();
        Object.values(reportData).forEach(zoneHeads => {
            Object.keys(zoneHeads).forEach(h => heads.add(h));
        });
        return Array.from(heads).sort();
    }, [reportData]);

    return (
        <div className="space-y-6">
            <div className="flex justify-end gap-2">
                <label className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors cursor-pointer shadow-sm">
                    <Upload className="w-4 h-4" />
                    <span>{loading ? 'Processing...' : 'Upload Data'}</span>
                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={loading}
                    />
                </label>
                <button
                    onClick={() => exportToJPEG('zonal-report-container', `Zonal_Report_${localDate.replace(/\//g, '-')}`)}
                    className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
                >
                    <ImageIcon className="w-4 h-4" />
                    Export JPEG
                </button>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white p-4 mb-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Filter by Zone</label>
                    <select 
                        value={filterZone}
                        onChange={(e) => {
                            setFilterZone(e.target.value);
                            setFilterHead('ALL'); // Reset head filter when zone changes
                        }}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="ALL">All Zones</option>
                        <option value="MATHURA">Mathura</option>
                        <option value="VRINDAVAN">Vrindavan</option>
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Filter Zonal Head</label>
                    <select 
                        value={filterHead}
                        onChange={(e) => setFilterHead(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[150px]"
                    >
                        <option value="ALL">All Zonal Heads</option>
                        {allHeads.map(head => (
                            <option key={head} value={head}>{head}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Search Ward / Supervisor</label>
                    <input 
                        type="text"
                        placeholder="Search by ward no, name or supervisor..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 opacity-0">-</label>
                    <button 
                        onClick={() => {
                            setFilterZone('ALL');
                            setFilterHead('ALL');
                            setSearchQuery('');
                        }}
                        className="px-4 py-2 text-blue-600 font-bold text-xs uppercase hover:bg-blue-50 rounded-lg transition-colors"
                    >
                        Reset Filters
                    </button>
                </div>
            </div>

            <div id="zonal-report-container" className="bg-white p-4 min-w-[800px] overflow-x-auto">
                {/* Professional Logo Header */}
                <div className="bg-white rounded-xl shadow-lg border-2 border-blue-100 p-6 mb-8">
                    <div className="grid grid-cols-3 items-center gap-6">
                        {/* Left Side - Nagar Nigam Logo */}
                        <div className="flex flex-col items-center sm:items-start">
                            <img
                                src={nagarNigamLogo}
                                alt="Nagar Nigam Logo"
                                className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm"
                            />

                            <p className="hidden sm:block text-[10px] font-bold text-blue-800 mt-2 uppercase tracking-tight text-center sm:text-left">
                                Nagar Nigam<br />Mathura-Vrindavan
                            </p>
                        </div>

                        {/* Center - Title Section */}
                        <div className="text-center flex flex-col items-center justify-center">
                            <div className="bg-blue-50 px-4 py-1 rounded-full mb-3">
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">Official Report</span>
                            </div>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">
                                ZONAL QR<br />
                                <span className="text-blue-600">REPORT</span>
                            </h1>
                            <div className="h-1 w-20 bg-blue-600 rounded-full mb-2"></div>
                            <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-widest">
                                Secondary Points Status
                            </p>
                        </div>

                        {/* Right Side - Nature Green Logo */}
                        <div className="flex flex-col items-center sm:items-end">
                            <img
                                src={natureGreenLogo}
                                alt="Nature Green Logo"
                                className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm"
                            />

                            <p className="hidden sm:block text-[10px] font-bold text-green-700 mt-2 uppercase tracking-tight text-center sm:text-right">
                                Nature Green<br />Waste Management
                            </p>
                        </div>
                    </div>
                </div>

                {/* ZONAL HEAD WISE COVERAGE - Reference Implementation */}
                <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-8 mb-10">
                    {/* Header with Title and Lines */}
                    <div className="flex items-center justify-between gap-6 mb-12">
                        <div className="flex items-center gap-4">
                            <img src={nagarNigamLogo} alt="Logo" className="h-16 w-auto object-contain" />
                        </div>
                        
                        <div className="flex-1 flex flex-col items-center">
                            <h2 className="text-xl font-extrabold text-[#334155] tracking-tight uppercase">
                                Zonal Head Wise Coverage
                            </h2>
                            <div className="flex items-center gap-4 w-full mt-2">
                                <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-[#10b981] to-[#10b981]"></div>
                                <span className="text-[10px] font-black text-[#10b981] uppercase tracking-[0.2em] whitespace-nowrap">
                                    QR Coverage Breakdown Per Zonal Head
                                </span>
                                <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-[#10b981] to-[#10b981]"></div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <img src={natureGreenLogo} alt="Logo" className="h-12 w-auto object-contain" />
                        </div>
                    </div>

                    {/* Horizontal Scrollable or Wrap Grid for Head Cards */}
                    <div className="flex flex-wrap justify-center gap-6">
                        {(() => {
                            const allHeadsList: ZoneHeadStats[] = [];
                            Object.values(reportData).forEach(zone => {
                                Object.values(zone).forEach(head => {
                                    if (head.totalQr > 0) allHeadsList.push(head);
                                });
                            });
                            
                            return allHeadsList.sort((a, b) => b.scanned - a.scanned).map((head) => {
                                const percentage = Math.round((head.scanned / head.totalQr) * 1000) / 10;

                                return (
                                    <div key={head.name} className="flex-1 min-w-[220px] max-w-[260px] bg-[#f8fafc] rounded-[2rem] p-6 shadow-sm border border-slate-50 flex flex-col items-center transition-transform hover:scale-[1.02]">
                                        {/* Donut Chart */}
                                        <div className="relative w-36 h-36 mb-6">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={[
                                                            { name: 'Scanned', value: head.scanned },
                                                            { name: 'Not Scanned', value: Math.max(0, head.totalQr - head.scanned) }
                                                        ]}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={45}
                                                        outerRadius={60}
                                                        paddingAngle={0}
                                                        dataKey="value"
                                                        stroke="none"
                                                        startAngle={90}
                                                        endAngle={450}
                                                    >
                                                        <Cell fill="#22c55e" /> {/* Covered - Green */}
                                                        <Cell fill="#ef4444" /> {/* Left - Red */}
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                            {/* Center Percentage */}
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="text-xl font-black text-black">
                                                    {percentage}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Head Info */}
                                        <h3 className="text-sm font-black text-black uppercase tracking-wider mb-1">
                                            {head.name}
                                        </h3>
                                        <p className="text-[10px] font-bold text-black uppercase tracking-tight mb-4">
                                            {head.scanned}/{head.totalQr} QR
                                        </p>

                                        {/* Custom Legend */}
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full bg-[#22c55e]"></div>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Scanned</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-2 h-2 rounded-full bg-[#ef4444]"></div>
                                                <span className="text-[9px] font-bold text-slate-500 uppercase">Not Scanned</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>

                {/* Header Section */}
                <div className="border-2 border-black">
                    <div className="grid grid-cols-[1fr_2fr] border-b border-black">
                        <div className="bg-[#d9ead3] p-2 font-bold border-r border-black">DATE:-</div>
                        <div className="bg-[#d9ead3] p-2 font-bold text-center">{localDate}</div>
                    </div>
                    <div className="bg-[#d9ead3] p-2 font-bold text-center border-b border-black text-xl">
                        Secondary Points Mathura - Vrindavan
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-black text-sm font-bold bg-[#ffe699]">
                        <div className="p-1 border-r border-black">MATHURA:-</div>
                        <div className="p-1 border-r border-black text-center">{grandTotals.mathuraScanned}</div>
                        <div className="p-1 border-r border-black text-center">Out of</div>
                        <div className="p-1 text-center">{grandTotals.mathuraTotal}</div>
                    </div>
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-black text-sm font-bold bg-[#ffe699]">
                        <div className="p-1 border-r border-black">VRINDAVAN :-</div>
                        <div className="p-1 border-r border-black text-center">{grandTotals.vrindavanScanned}</div>
                        <div className="p-1 border-r border-black text-center">Out of</div>
                        <div className="p-1 text-center">{grandTotals.vrindavanTotal}</div>
                    </div>
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-black text-sm font-bold bg-[#ffe699]">
                        <div className="p-1 border-r border-black">TOTAL QR SCAN</div>
                        <div className="p-1 border-r border-black text-center">{grandTotals.mathuraScanned + grandTotals.vrindavanScanned}</div>
                        <div className="p-1 border-r border-black text-center"></div>
                        <div className="p-1 text-center">{grandTotals.mathuraTotal + grandTotals.vrindavanTotal}</div>
                    </div>

                    {/* Zonal Sections Grouped by Zone */}
                    {Object.entries(filteredReportData).map(([zoneName, heads]) => {
                        const headList = Object.values(heads).sort((a, b) => a.name.localeCompare(b.name));
                        if (headList.length === 0) return null;

                        return (
                            <div key={zoneName} className="border-t-4 border-black">
                                {/* Zone Header Label */}
                                <div className="bg-[#4472c4] text-white p-2 font-bold text-center uppercase tracking-widest text-lg">
                                    {zoneName} ZONE
                                </div>

                                {headList.map((zone) => {
                                    // Sort wards numerically
                                    const sortedWards = [...zone.wards].sort((a, b) => {
                                        return parseInt(a.ward || '999') - parseInt(b.ward || '999');
                                    });

                                    return (
                                        <div key={zone.name}>
                                            {/* Zonal Head Header */}
                                            <div className="bg-[#ffc000] p-2 font-bold text-center border-b border-black uppercase border-t border-t-black">
                                                UNDER ZONAL MR. {zone.name}
                                            </div>

                                            {/* Table Header */}
                                            <div className="grid grid-cols-[2fr_1.5fr_1fr_2fr_1fr_1fr] bg-[#bdd7ee] text-xs font-bold border-b border-black text-center">
                                                <div className="p-1 border-r border-black">WARD (NO-NAME)</div>
                                                <div className="p-1 border-r border-black">SUPERVISOR</div>
                                                <div className="p-1 border-r border-black">TOTAL QR</div>
                                                <div className="p-1 border-r border-black">SCAN TIMING</div>
                                                <div className="p-1 border-r border-black">SCANNED</div>
                                                <div className="p-1">PENDING QR</div>
                                            </div>

                                            {/* Wards */}
                                            {sortedWards.map((wData, wIdx) => {
                                                const isZeroScanned = wData.scanned === 0;
                                                const scannedBg = isZeroScanned
                                                    ? 'bg-gradient-to-r from-red-500 via-orange-500 to-red-500 text-white'
                                                    : 'bg-white text-black';

                                                const pendingBg = wData.pending === 0 ? 'bg-green-400' : 'bg-white';
                                                
                                                const wardDisplay = wData.ward ? `${wData.ward}-${wData.wardName}` : wData.wardName;

                                                return (
                                                    <div key={`${wData.ward}-${wData.supervisor}-${wIdx}`} className="grid grid-cols-[2fr_1.5fr_1fr_2fr_1fr_1fr] text-xs font-bold border-b border-black text-center items-center">
                                                        <div className="p-1 border-r border-black bg-white text-left pl-1">
                                                            {wardDisplay}
                                                        </div>
                                                        <div className="p-1 border-r border-black bg-white">{wData.supervisor}</div>
                                                        <div className="p-1 border-r border-black bg-white">{wData.totalQr}</div>
                                                        <div className="p-1 border-r border-black bg-white">{wData.scanTiming}</div>
                                                        <div className={`p-1 border-r border-black ${scannedBg}`}>{wData.scanned}</div>
                                                        <div className={`p-1 ${pendingBg}`}>{wData.pending}</div>
                                                    </div>
                                                );
                                            })}

                                            {/* Zonal Total */}
                                            <div className="grid grid-cols-[2fr_1.5fr_1fr_2fr_1fr_1fr] bg-[#00b0f0] text-xs font-bold border-b border-black text-center">
                                                <div className="p-1 border-r border-black"></div>
                                                <div className="p-1 border-r border-black">TOTAL</div>
                                                <div className="p-1 border-r border-black">{zone.totalQr}</div>
                                                <div className="p-1 border-r border-black"></div>
                                                <div className="p-1 border-r border-black">{zone.scanned}</div>
                                                <div className="p-1">{zone.pending}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                </div>

                {/* Footer */}
                <div className="mt-12 mb-6 text-center">
                    <div className="inline-block bg-white px-8 py-4 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-slate-600 font-medium text-lg tracking-wide">
                            Generated by <span className="font-extrabold text-indigo-600 mx-1">Reports Buddy Pro</span>
                            <span className="text-slate-300 mx-3">|</span>
                            Created by <span className="font-extrabold text-slate-800 mx-1 border-b-2 border-indigo-200">Yuvraj Singh Tomar</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
