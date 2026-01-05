import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import {
    Upload,
    Search,
    Calendar as CalendarIcon,
    Filter,
    User,
    MapPin,
    Image as ImageIcon,
    X,
    ChevronLeft,
    ChevronRight,
    Building2,
    Map as MapIcon
} from 'lucide-react';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';

interface ScanRecord {
    qrId: string;
    date: string;
    time: string;
    beforeImage?: string;
    afterImage?: string;
    supervisor?: string;
    zone?: string;
    siteName?: string;
    ward?: string;
    category?: string;
    status: 'Scanned' | 'Pending';
}

interface CalendarDay {
    dateStr: string; // YYYY-MM-DD
    day: number;
    isCurrentMonth: boolean;
    hasScan: boolean;
    scanRecord?: ScanRecord;
}

export const QRStatusCalendar: React.FC = () => {
    const [scanData, setScanData] = useState<ScanRecord[]>([]);
    const [fileName, setFileName] = useState<string>('');
    const [loading, setLoading] = useState(false);

    // Filter States
    const [selectedZone, setSelectedZone] = useState<string>('All');
    const [selectedSupervisor, setSelectedSupervisor] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');

    // View State
    const [selectedQR, setSelectedQR] = useState<string | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [viewMode, setViewMode] = useState<'calendar' | 'table'>('calendar');

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setLoading(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const records: ScanRecord[] = [];
                const data = results.data as any[];
                const headers = results.meta.fields || [];

                // Improved Column Matching
                const qrKey = headers.find(h => /qr code id|qr id|qr code/i.test(h));
                const dateKey = headers.find(h => /date of scan|date/i.test(h));
                const timeKey = headers.find(h => /before clean time|time in|time/i.test(h));

                const beforeImgKey = headers.find(h => /before image|before photo/i.test(h));
                const afterImgKey = headers.find(h => /after image|after photo/i.test(h));
                // Fallback for single image
                const imgKey = headers.find(h => /image|photo|url/i.test(h));

                const supervisorKey = headers.find(h => /supervisor name|supervisor/i.test(h));
                const zoneKey = headers.find(h => /zone/i.test(h));

                // New Keys
                const siteNameKey = headers.find(h => /site name|site/i.test(h));
                const wardKey = headers.find(h => /ward name|ward/i.test(h));
                const categoryKey = headers.find(h => /category/i.test(h));

                data.forEach((row) => {
                    const qrId = row[qrKey || 'QR Code ID'];
                    if (!qrId) return;

                    let dateStr = row[dateKey || 'Date'];
                    // content cleaning for date
                    if (dateStr && dateStr.includes(' ')) dateStr = dateStr.split(' ')[0];

                    // Normalize Date to YYYY-MM-DD
                    if (dateStr) {
                        const ddmmyyyyPattern = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
                        const match = dateStr.match(ddmmyyyyPattern);

                        if (match) {
                            const day = match[1].padStart(2, '0');
                            const month = match[2].padStart(2, '0');
                            const year = match[3];
                            dateStr = `${year}-${month}-${day}`;
                        } else {
                            const d = new Date(dateStr);
                            if (!isNaN(d.getTime())) {
                                dateStr = d.toISOString().split('T')[0];
                            }
                        }
                    }

                    records.push({
                        qrId: String(qrId).trim(),
                        date: dateStr,
                        time: row[timeKey || 'Before Clean Time'] || '',
                        beforeImage: row[beforeImgKey || 'Before Image'] || row[imgKey || 'Image'] || '',
                        afterImage: row[afterImgKey || 'After Image'] || '',
                        supervisor: row[supervisorKey || 'Supervisor'] || '',
                        zone: row[zoneKey || 'Zone'] || '',
                        siteName: row[siteNameKey || 'Site Name'] || '',
                        ward: row[wardKey || 'Ward Name'] || '',
                        category: row[categoryKey || 'Category'] || '',
                        status: 'Scanned'
                    });
                });

                setScanData(records);
                setLoading(false);
            },
            error: (err) => {
                console.error(err);
                alert('Failed strictly parsing CSV');
                setLoading(false);
            }
        });
    };

    // --- Derived Data ---

    const uniqueZones = useMemo(() => Array.from(new Set(scanData.map(r => r.zone).filter(Boolean))).sort(), [scanData]);
    const uniqueSupervisors = useMemo(() => {
        return Array.from(new Set(scanData
            .filter(r => selectedZone === 'All' || r.zone === selectedZone)
            .map(r => r.supervisor).filter(Boolean)
        )).sort();
    }, [scanData, selectedZone]);

    const filteredQRs = useMemo(() => {
        // Group by QR ID to get unique list for selection
        const groups = new Map<string, ScanRecord>();

        scanData.forEach(r => {
            const matchZone = selectedZone === 'All' || r.zone === selectedZone;
            const matchSup = selectedSupervisor === 'All' || r.supervisor === selectedSupervisor;
            const matchSearch = !searchQuery || r.qrId.toLowerCase().includes(searchQuery.toLowerCase());

            if (matchZone && matchSup && matchSearch) {
                if (!groups.has(r.qrId)) {
                    groups.set(r.qrId, r);
                }
            }
        });
        return Array.from(groups.values());
    }, [scanData, selectedZone, selectedSupervisor, searchQuery]);

    // Use current selected QR details for display
    const selectedQRData = useMemo(() => {
        if (!selectedQR) return null;
        return scanData.find(s => s.qrId === selectedQR) || null;
    }, [selectedQR, scanData]);


    // --- Calendar Logic ---

    const getCalendarDays = (year: number, month: number, qrId: string | null): CalendarDay[] => {
        if (!qrId) return [];

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

        const days: CalendarDay[] = [];

        // Previous month filler
        for (let i = 0; i < startDayOfWeek; i++) {
            days.push({ dateStr: '', day: 0, isCurrentMonth: false, hasScan: false });
        }

        // Current month
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            // Check scan
            const scan = scanData.find(r => r.qrId === qrId && r.date === dateStr);

            days.push({
                dateStr,
                day: d,
                isCurrentMonth: true,
                hasScan: !!scan,
                scanRecord: scan
            });
        }

        return days;
    };

    const calendarDays = useMemo(() => {
        return getCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth(), selectedQR);
    }, [currentMonth, selectedQR, scanData]);

    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));


    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Main Header */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <img src={NagarNigamLogo} alt="Logo" className="h-12 w-auto" />
                            <div className="hidden md:block w-px h-10 bg-slate-200"></div>
                            <img src={NatureGreenLogo} alt="Logo" className="h-12 w-auto" />
                            <div className="hidden md:block w-px h-10 bg-slate-200"></div>
                            <div>
                                <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">QR Calendar Report</h1>
                                <p className="text-sm font-semibold text-slate-500">Scan History & Evidence Tracker</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {!fileName && (
                                <label className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg cursor-pointer hover:bg-blue-700 transition shadow-sm hover:shadow-md">
                                    <Upload className="w-4 h-4" />
                                    Upload Scan CSV
                                    <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} disabled={loading} />
                                </label>
                            )}
                            {fileName && (
                                <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold border border-slate-200">
                                    <span className="truncate max-w-[200px]">{fileName}</span>
                                    <button onClick={() => { setFileName(''); setScanData([]); }} className="hover:text-red-500"><X className="w-4 h-4" /></button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Content Body */}
                {scanData.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                        {/* List Sidebar */}
                        <div className={`lg:col-span-4 space-y-4 ${selectedQR ? 'hidden lg:block' : 'block'}`}>
                            {/* Filter Section */}
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search QR ID..."
                                        className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <select
                                            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-slate-50 outline-none appearance-none"
                                            value={selectedZone}
                                            onChange={e => setSelectedZone(e.target.value)}
                                        >
                                            <option value="All">All Zones</option>
                                            {uniqueZones.map(z => <option key={z} value={z}>{z}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <Filter className="w-3 h-3 text-slate-400" />
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <select
                                            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-slate-50 outline-none appearance-none"
                                            value={selectedSupervisor}
                                            onChange={e => setSelectedSupervisor(e.target.value)}
                                        >
                                            <option value="All">All Supervisors</option>
                                            {uniqueSupervisors.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <Filter className="w-3 h-3 text-slate-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* QR List */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[600px]">
                                <div className="p-3 border-b bg-slate-50 font-bold text-xs text-slate-500 uppercase flex justify-between">
                                    <span>Available QRs ({filteredQRs.length})</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                    {filteredQRs.slice(0, 100).map(qr => (
                                        <div
                                            key={qr.qrId}
                                            onClick={() => setSelectedQR(qr.qrId)}
                                            className={`p-3 rounded-lg cursor-pointer transition-colors border ${selectedQR === qr.qrId ? 'bg-blue-50 border-blue-200 shadow-sm' : 'hover:bg-slate-50 border-transparent hover:border-slate-100'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedQR === qr.qrId ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                                    QR
                                                </div>
                                                <div>
                                                    <p className={`text-sm font-bold ${selectedQR === qr.qrId ? 'text-blue-700' : 'text-slate-700'}`}>{qr.qrId}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">Zone: {qr.zone || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredQRs.length > 100 && (
                                        <p className="text-center text-xs text-slate-400 py-2">Showing first 100 results...</p>
                                    )}
                                    {filteredQRs.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                                            <Search className="w-8 h-8 mb-2 opacity-50" />
                                            <p className="text-sm">No QRs found</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Calendar / Table View */}
                        <div className={`lg:col-span-8 ${!selectedQR ? 'hidden lg:block' : 'block'}`}>
                            {selectedQR ? (
                                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden h-full min-h-[600px] flex flex-col">
                                    {/* Detailed Report Header */}
                                    <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white flex flex-col gap-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <button onClick={() => setSelectedQR(null)} className="lg:hidden p-1 hover:bg-white rounded-full"><ChevronLeft className="w-5 h-5" /></button>
                                                    <span className="text-xs font-bold text-blue-500 uppercase tracking-widest">Detail View</span>
                                                </div>
                                                <h2 className="text-3xl font-black text-slate-800">{selectedQR}</h2>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {/* Date Navigation */}
                                                <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm mr-4">
                                                    <button onClick={prevMonth} className="p-1 hover:bg-slate-100 rounded-full transition"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
                                                    <p className="text-sm font-bold text-slate-800 w-28 text-center select-none">
                                                        {currentMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                                                    </p>
                                                    <button onClick={nextMonth} className="p-1 hover:bg-slate-100 rounded-full transition"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
                                                </div>

                                                {/* View Toggle */}
                                                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                                                    <button
                                                        onClick={() => setViewMode('calendar')}
                                                        className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                    >
                                                        Calendar
                                                    </button>
                                                    <button
                                                        onClick={() => setViewMode('table')}
                                                        className={`px-3 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                    >
                                                        Table Report
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Info Grid */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white/50 p-4 rounded-xl border border-blue-100">
                                            <div>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Supervisor</p>
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-blue-500" />
                                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedQRData?.supervisor || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Site / Location</p>
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-blue-500" />
                                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedQRData?.siteName || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Ward</p>
                                                <div className="flex items-center gap-2">
                                                    <MapIcon className="w-4 h-4 text-blue-500" />
                                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedQRData?.ward || 'N/A'}</p>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Category</p>
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="w-4 h-4 text-blue-500" />
                                                    <p className="text-sm font-bold text-slate-700 truncate">{selectedQRData?.category || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Body */}
                                    {viewMode === 'calendar' ? (
                                        <div className="p-6">
                                            <div className="grid grid-cols-7 mb-4">
                                                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                                                    <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider py-2">{d}</div>
                                                ))}
                                            </div>
                                            <div className="grid grid-cols-7 gap-3">
                                                {calendarDays.map((day, idx) => {
                                                    if (!day.isCurrentMonth) return <div key={idx} className="bg-transparent" />;

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className={`relative overflow-hidden aspect-square rounded-xl border-2 transition-all group ${day.hasScan
                                                                ? 'border-emerald-100 bg-emerald-50 hover:border-emerald-500 cursor-pointer shadow-sm hover:shadow-emerald-200'
                                                                : 'border-slate-100 bg-slate-50 opacity-80'
                                                                }`}
                                                        >
                                                            <span className={`absolute top-2 left-3 text-sm font-bold ${day.hasScan ? 'text-emerald-700' : 'text-slate-400'}`}>
                                                                {day.day}
                                                            </span>

                                                            {day.hasScan ? (
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <div className="bg-emerald-100 p-2 rounded-full group-hover:scale-110 transition-transform">
                                                                        <ImageIcon className="w-5 h-5 text-emerald-600" />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="absolute inset-0 flex items-center justify-center">
                                                                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                                                                </div>
                                                            )}

                                                            {/* Tooltip / Image Preview on Hover (Simple implementation) */}
                                                            {day.hasScan && day.scanRecord?.beforeImage && (
                                                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
                                                                    <p className="text-[10px] text-white font-bold uppercase tracking-wider">View Image</p>
                                                                </div>
                                                            )}

                                                            {day.hasScan && day.scanRecord?.beforeImage && (
                                                                <a href={day.scanRecord.beforeImage} target="_blank" rel="noopener noreferrer" className="absolute inset-0 z-20" title={`View Scan: ${day.dateStr}`} />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Legend */}
                                            <div className="px-0 pt-6 flex gap-6">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200"></div>
                                                    <span className="text-xs font-bold text-slate-600">Scanned (With Image)</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-4 h-4 rounded bg-slate-50 border border-slate-200"></div>
                                                    <span className="text-xs font-bold text-slate-400">Not Scanned / No Data</span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // Table View
                                        <div className="flex-1 overflow-y-auto p-0">
                                            <table className="w-full text-left border-collapse">
                                                <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                                                    <tr>
                                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Date</th>
                                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Status</th>
                                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Time</th>
                                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">Supervisor</th>
                                                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 text-center">Evidence</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {calendarDays.filter(d => d.isCurrentMonth).map((day) => (
                                                        <tr key={day.dateStr} className={`hover:bg-slate-50 transition ${!day.hasScan ? 'bg-red-50/10' : ''}`}>
                                                            <td className="p-4 text-sm font-bold text-slate-700">
                                                                {day.dateStr.split('-').reverse().join('-')}
                                                            </td>
                                                            <td className="p-4">
                                                                {day.hasScan ? (
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></div>
                                                                        Scanned
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5"></div>
                                                                        Missed
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="p-4 text-sm text-slate-600 font-mono">
                                                                {day.hasScan ? (day.scanRecord?.time || '-') : '-'}
                                                            </td>
                                                            <td className="p-4 text-sm text-slate-600">
                                                                {day.hasScan ? (day.scanRecord?.supervisor || '-') : '-'}
                                                            </td>
                                                            <td className="p-4 text-center">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    {day.hasScan && day.scanRecord?.beforeImage ? (
                                                                        <a href={day.scanRecord.beforeImage} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                                                                            Before <ImageIcon className="w-3 h-3" />
                                                                        </a>
                                                                    ) : (
                                                                        <span className="text-xs text-slate-300">-</span>
                                                                    )}

                                                                    {day.hasScan && day.scanRecord?.afterImage && (
                                                                        <>
                                                                            <span className="text-slate-300">|</span>
                                                                            <a href={day.scanRecord.afterImage} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                                                                                After <ImageIcon className="w-3 h-3" />
                                                                            </a>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center bg-white rounded-xl border-dashed border-2 border-slate-200 text-slate-400">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                        <CalendarIcon className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <p className="font-bold text-lg text-slate-500">Select a QR Code</p>
                                    <p className="text-sm">Choose a QR from the list to view its monthly report.</p>
                                </div>
                            )}
                        </div>

                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-xl border-2 border-dashed border-slate-300">
                        <Upload className="w-16 h-16 mb-4 opacity-30" />
                        <p className="font-extrabold text-xl text-slate-500">No Scan Data Loaded</p>
                        <p className="font-medium text-slate-400 mt-2">Upload a CSV file to generate the Calendar Report</p>
                    </div>
                )}
            </div>
        </div>
    );
};
