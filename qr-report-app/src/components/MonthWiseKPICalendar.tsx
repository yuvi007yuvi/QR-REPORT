import React, { useState, useRef, useMemo, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import type { WardAssignment } from '../utils/dataProcessor';
import Papa from 'papaparse';
import {
    Upload, Download, Calendar, ChevronLeft, ChevronRight,
    ClipboardCheck, Trash2, Users, TrendingUp, AlertCircle, CheckCircle2,
    BarChart3, X, Image as ImageIcon, FileSpreadsheet
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toJpeg } from 'html-to-image';
import * as XLSX from 'xlsx';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';
import { MASTER_SUPERVISORS } from '../data/master-supervisors';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface KPIRecord {
    'Supervisor Name': string;
    'Supervisor Id': string;
    'Supervisor Number': string;
    'Zone-Circle': string;
    'Ward': string;
    'Date': string;
    'Time': string;
    'Remark': string;
}

interface DayEntry {
    uniform: number;
    segregation: number;
}

interface SupervisorMonthData {
    name: string;
    id: string;
    mobile: string;
    zone: string;
    zonalName: string;
    ward: string;
    // key = 'YYYY-MM-DD'
    days: Record<string, DayEntry>;
    totalUniform: number;
    totalSegregation: number;
    daysUniformDone: number;
    daysSegregationDone: number;
    bothDone: number;
    neitherDone: number;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
const normalizeDate = (raw: string): string => {
    if (!raw) return '';
    if (raw.includes('/')) {
        const parts = raw.split('/');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
            if (parseInt(day) <= 31 && parseInt(month) <= 12) return `${year}-${month}-${day}`;
        }
    }
    try {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch { }
    return raw;
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ─────────────────────────────────────────────
// Cell color logic
// ─────────────────────────────────────────────
const getCellColor = (u: number, s: number, isToday?: boolean): string => {
    if (u > 0 && s > 0) return 'bg-emerald-500 text-white';   // Both done
    if (u > 0) return 'bg-emerald-400 text-white';                // Uniform only
    if (s > 0) return 'bg-amber-400 text-white';               // Segregation only
    if (isToday) return 'bg-white border-2 border-emerald-500 text-emerald-600';
    return 'bg-red-50 text-red-300';                           // Neither / Missed
};

// ─────────────────────────────────────────────
// Mini day legend tooltip
// ─────────────────────────────────────────────
const Legend: React.FC = () => (
    <div className="flex flex-wrap gap-3 text-xs font-medium items-center">
        <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
            Both Done
        </span>
        <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />
            Uniform Only
        </span>
        <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-400 inline-block" />
            Segregation Only
        </span>
        <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-100 flex items-center justify-center text-[6px] text-red-400 font-bold" >✕</span>
            Missed
        </span>
    </div>
);

// ─────────────────────────────────────────────
// Mini supervisor calendar card
// ─────────────────────────────────────────────
interface SupCardProps {
    sup: SupervisorMonthData;
    year: number;
    month: number;
    daysInMonth: number;
    firstDay: number;
    onClick: () => void;
}

const SupCard: React.FC<SupCardProps> = ({ sup, year, month, daysInMonth, firstDay, onClick }) => {
    const today = new Date().toISOString().split('T')[0];
    const compliance = daysInMonth > 0
        ? Math.round((sup.bothDone / daysInMonth) * 100)
        : 0;
    const hasZeroUploads = sup.totalUniform === 0 && sup.totalSegregation === 0;

    return (
        <div
            onClick={onClick}
            className={`bg-white rounded-xl border transition-all cursor-pointer group overflow-hidden ${
                hasZeroUploads 
                ? 'border-red-200 bg-red-50 shadow-sm hover:shadow-red-200/50' 
                : 'border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-emerald-300'
            }`}
        >
            {/* Colored top bar */}
            <div className={`h-1 w-full ${compliance >= 80 ? 'bg-emerald-500' : compliance >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} />

            <div className="p-3">
                {/* Name + compliance */}
                <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-xs leading-tight truncate group-hover:text-emerald-600 transition-colors">
                            {sup.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{sup.id}</p>
                    </div>
                    <span className={`ml-2 text-[10px] font-black px-1.5 py-0.5 rounded flex-shrink-0 ${
                        hasZeroUploads ? 'bg-red-600 text-white shadow-sm' :
                        compliance >= 80 ? 'bg-emerald-100 text-emerald-700' : 
                        compliance >= 50 ? 'bg-amber-100 text-amber-700' : 
                        'bg-red-100 text-red-700'
                    }`}>
                        {compliance}%
                    </span>
                </div>

                {/* Mini calendar grid */}
                <div className="grid grid-cols-7 gap-0.5 mb-2">
                    {DAY_ABBR.map(d => (
                        <span key={d} className="text-center text-[8px] text-slate-400 font-bold">{d}</span>
                    ))}
                    {/* Empty cells for first day offset */}
                    {Array.from({ length: firstDay }).map((_, i) => (
                        <span key={`empty-${i}`} />
                    ))}
                    {/* Day cells */}
                    {Array.from({ length: daysInMonth }, (_, i) => {
                        const dayNum = i + 1;
                        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                        const entry = sup.days[dateKey];
                        const u = entry?.uniform ?? 0;
                        const s = entry?.segregation ?? 0;
                        const isToday = dateKey === today;
                        const cellColor = getCellColor(u, s, isToday);
                        return (
                            <span
                                key={dayNum}
                                title={`${dayNum} — U:${u} S:${s}`}
                                className={`aspect-square w-full text-center text-[7px] font-black rounded-sm flex items-center justify-center ${cellColor}`}
                            >
                                {u > 0 || s > 0 ? dayNum : '✕'}
                            </span>
                        );
                    })}
                </div>

                {/* Mini stats row */}
                <div className="flex justify-between text-[10px] font-semibold border-t border-slate-100 pt-2">
                    <span className="text-emerald-600">U: {sup.totalUniform}</span>
                    <span className="text-amber-600">S: {sup.totalSegregation}</span>
                    <span className="text-emerald-700">✓: {sup.bothDone}d</span>
                    <span className="text-red-600">✗: {sup.neitherDone}d</span>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Detail modal
// ─────────────────────────────────────────────
interface DetailModalProps {
    sup: SupervisorMonthData;
    year: number;
    month: number;
    daysInMonth: number;
    firstDay: number;
    onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ sup, year, month, daysInMonth, firstDay, onClose }) => {
    const today = new Date().toISOString().split('T')[0];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-start justify-between rounded-t-2xl z-10">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">{sup.name}</h3>
                        <p className="text-sm text-slate-500 font-mono mt-0.5">{sup.id} · {sup.mobile}</p>
                        <p className="text-xs text-slate-400 mt-1">{sup.zonalName} · Ward: {sup.ward}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* KPI Stats */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: 'Uniform Uploads', value: sup.totalUniform, color: 'emerald' },
                            { label: 'Segregation Uploads', value: sup.totalSegregation, color: 'amber' },
                            { label: 'Days Both Done', value: sup.bothDone, color: 'emerald' },
                            { label: 'Days Neither Done', value: sup.neitherDone, color: 'red' },
                        ].map(({ label, value, color }) => (
                            <div key={label} className={`p-3 rounded-xl bg-${color}-50 border border-${color}-100`}>
                                <p className={`text-xs font-semibold text-${color}-600 mb-1`}>{label}</p>
                                <p className={`text-2xl font-black text-${color}-700`}>{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Large calendar */}
                    <div>
                        <h4 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            {MONTH_NAMES[month]} {year} — Day-by-Day
                        </h4>
                        <div className="grid grid-cols-7 gap-1">
                            {DAY_ABBR.map(d => (
                                <span key={d} className="text-center text-xs text-slate-400 font-bold py-1">{d}</span>
                            ))}
                            {Array.from({ length: firstDay }).map((_, i) => <span key={`e${i}`} />)}
                            {Array.from({ length: daysInMonth }, (_, i) => {
                                const dayNum = i + 1;
                                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                const entry = sup.days[dateKey];
                                const u = entry?.uniform ?? 0;
                                const s = entry?.segregation ?? 0;
                                const isToday = dateKey === today;
                                const cellColor = getCellColor(u, s, isToday);
                                return (
                                    <div
                                        key={dayNum}
                                        className={`rounded-lg p-1.5 text-center transition-all ${cellColor}`}
                                    >
                                        <div className="text-xs font-bold">{dayNum}</div>
                                        {(u > 0 || s > 0) && (
                                            <div className="text-[9px] mt-0.5 opacity-90">
                                                {u > 0 && <span>U:{u}</span>}
                                                {u > 0 && s > 0 && ' '}
                                                {s > 0 && <span>S:{s}</span>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <Legend />
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
export const MonthWiseKPICalendar: React.FC = () => {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [uniformFileName, setUniformFileName] = useState<string | null>(null);
    const [segregationFileName, setSegregationFileName] = useState<string | null>(null);
    const [rawUniform, setRawUniform] = useState<KPIRecord[]>([]);
    const [rawSegregation, setRawSegregation] = useState<KPIRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedSup, setSelectedSup] = useState<SupervisorMonthData | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterZonal, setFilterZonal] = useState('All');
    const [filterCompliance, setFilterCompliance] = useState<'all' | 'great' | 'ok' | 'poor'>('all');
    const uniformRef = useRef<HTMLInputElement>(null);
    const segregationRef = useRef<HTMLInputElement>(null);
    const reportRef = useRef<HTMLDivElement>(null);
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
    const [wardAssignments, setWardAssignments] = useState<Record<string, WardAssignment>>({});

    // Fetch Ward Assignments from Firestore
    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'ward_assignments'), (snapshot) => {
            const mapping: Record<string, WardAssignment> = {};
            snapshot.forEach((doc) => {
                mapping[doc.id] = doc.data() as WardAssignment;
            });
            setWardAssignments(mapping);
            console.log('MonthWiseKPICalendar: Loaded ward assignments from Firestore:', Object.keys(mapping).length);
        });

        return () => unsubscribe();
    }, []);

    // ── parse & merge ──
    const buildSupervisorData = (uRecs: KPIRecord[], sRecs: KPIRecord[], targetYear: number, targetMonth: number): SupervisorMonthData[] => {
        const map = new Map<string, SupervisorMonthData>();

        // Seed from master
        MASTER_SUPERVISORS.forEach(ms => {
            if (ms.department === 'UCC') return;
            const id = ms.empId.trim().toUpperCase();

            // Try to find if this supervisor is in the dynamic ward assignments
            const assignedWards: string[] = [];
            let dynamicZonal = ms.zonal;

            Object.entries(wardAssignments).forEach(([wardNum, assignment]) => {
                if (assignment.supervisor.toLowerCase().includes(ms.name.toLowerCase())) {
                    assignedWards.push(wardNum);
                    dynamicZonal = assignment.zonalHead;
                }
            });

            map.set(id, {
                name: ms.name, id: ms.empId, mobile: ms.mobile,
                zone: 'N/A', zonalName: dynamicZonal, 
                ward: assignedWards.length > 0 ? assignedWards.sort((a,b) => parseInt(a)-parseInt(b)).join(',') : ms.ward,
                days: {}, totalUniform: 0, totalSegregation: 0,
                daysUniformDone: 0, daysSegregationDone: 0, bothDone: 0, neitherDone: 0
            });
        });

        const addRecord = (rec: KPIRecord, type: 'uniform' | 'segregation') => {
            const rawId = (rec['Supervisor Id'] || '').trim().toUpperCase();
            const name = (rec['Supervisor Name'] || '').trim();
            if (!rawId && !name) return;
            const id = rawId || name.toUpperCase();
            const dateKey = normalizeDate(rec['Date'] || '');
            if (!dateKey) return;

            if (!map.has(id)) {
                map.set(id, {
                    name, id: rawId || 'N/A', mobile: rec['Supervisor Number'] || 'N/A',
                    zone: rec['Zone-Circle'] || 'N/A', zonalName: 'IEC TEAM',
                    ward: rec['Ward'] || 'N/A', days: {},
                    totalUniform: 0, totalSegregation: 0,
                    daysUniformDone: 0, daysSegregationDone: 0, bothDone: 0, neitherDone: 0
                });
            }
            const sup = map.get(id)!;
            if (!sup.days[dateKey]) sup.days[dateKey] = { uniform: 0, segregation: 0 };
            if (type === 'uniform') {
                sup.days[dateKey].uniform += 1;
                sup.totalUniform += 1;
            } else {
                sup.days[dateKey].segregation += 1;
                sup.totalSegregation += 1;
            }
        };

        uRecs.forEach(r => addRecord(r, 'uniform'));
        sRecs.forEach(r => addRecord(r, 'segregation'));

        // Calculate day-level stats for the target month
        const daysInMonth = getDaysInMonth(targetYear, targetMonth);
        map.forEach(sup => {
            let both = 0, neither = 0, uDays = 0, sDays = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                const dk = `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const entry = sup.days[dk];
                const u = entry?.uniform ?? 0;
                const s = entry?.segregation ?? 0;
                if (u > 0) uDays++;
                if (s > 0) sDays++;
                if (u > 0 && s > 0) both++;
                if (u === 0 && s === 0) neither++;
            }
            sup.daysUniformDone = uDays;
            sup.daysSegregationDone = sDays;
            sup.bothDone = both;
            sup.neitherDone = neither;
        });

        return Array.from(map.values()).sort((a, b) => b.bothDone - a.bothDone);
    };

    const handleFile = (file: File, type: 'uniform' | 'segregation') => {
        setLoading(true);
        Papa.parse<KPIRecord>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const recs = results.data;
                if (type === 'uniform') {
                    setUniformFileName(file.name);
                    setRawUniform(recs);
                } else {
                    setSegregationFileName(file.name);
                    setRawSegregation(recs);
                }
                setLoading(false);
            },
            error: () => setLoading(false)
        });
    };

    const supervisors = useMemo(
        () => buildSupervisorData(rawUniform, rawSegregation, viewYear, viewMonth),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [rawUniform, rawSegregation, viewYear, viewMonth, wardAssignments]
    );

    const uniqueZonals = useMemo(() =>
        ['All', ...Array.from(new Set(supervisors.map(s => s.zonalName))).sort()],
        [supervisors]
    );

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

    const filteredSups = useMemo(() => {
        return supervisors.filter(s => {
            const compliance = daysInMonth > 0 ? (s.bothDone / daysInMonth) * 100 : 0;
            const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.ward.toLowerCase().includes(searchTerm.toLowerCase());
            const matchZonal = filterZonal === 'All' || s.zonalName === filterZonal;
            const matchCompliance =
                filterCompliance === 'all' ||
                (filterCompliance === 'great' && compliance >= 80) ||
                (filterCompliance === 'ok' && compliance >= 50 && compliance < 80) ||
                (filterCompliance === 'poor' && compliance < 50);
            return matchSearch && matchZonal && matchCompliance;
        });
    }, [supervisors, searchTerm, filterZonal, filterCompliance, daysInMonth]);

    // ── Navigation ──
    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    // ── Aggregated monthly stats ──
    const monthStats = useMemo(() => {
        const totalDays = daysInMonth;
        const active = supervisors.filter(s => s.bothDone > 0 || s.daysUniformDone > 0 || s.daysSegregationDone > 0).length;
        const avgCompliance = supervisors.length > 0
            ? Math.round(supervisors.reduce((acc, s) => acc + (s.bothDone / totalDays) * 100, 0) / supervisors.length)
            : 0;
        const topPerformer = supervisors.find(s => s.bothDone === Math.max(...supervisors.map(x => x.bothDone)));
        return { active, avgCompliance, topPerformer };
    }, [supervisors, daysInMonth]);

    // ── Export PDF ──
    const exportPDF = () => {
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFontSize(16);
        doc.text(`KPI Monthly Calendar — ${MONTH_NAMES[viewMonth]} ${viewYear}`, 14, 18);
        doc.setFontSize(9);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24);

        const tableData = filteredSups.map((s, i) => {
            const comp = daysInMonth > 0 ? Math.round((s.bothDone / daysInMonth) * 100) : 0;
            return [
                i + 1,
                s.name,
                s.id,
                s.zonalName,
                s.ward,
                s.totalUniform,
                s.totalSegregation,
                `${s.daysUniformDone}d`,
                `${s.daysSegregationDone}d`,
                `${s.bothDone}d`,
                `${s.neitherDone}d`,
                `${comp}%`
            ];
        });

        autoTable(doc, {
            startY: 30,
            head: [['#', 'Supervisor', 'ID', 'Zonal', 'Ward', 'U-Uploads', 'S-Uploads', 'U-Days', 'S-Days', 'Both Days', 'Neither', 'Compliance']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 7 },
            styles: { fontSize: 7 },
        });

        doc.save(`KPI_Monthly_Calendar_${MONTH_NAMES[viewMonth]}_${viewYear}.pdf`);
    };

    // ── Export JPEG ──
    const exportJPEG = async () => {
        if (!reportRef.current) return;
        try {
            const url = await toJpeg(reportRef.current, { quality: 0.95, backgroundColor: '#f8fafc' });
            const a = document.createElement('a');
            a.download = `KPI_Monthly_${MONTH_NAMES[viewMonth]}_${viewYear}.jpeg`;
            a.href = url;
            a.click();
        } catch (e) {
            alert('JPEG export failed.');
        }
    };

    // ── Export Excel ──
    const handleExportAllMonths = () => {
        if (!rawUniform.length && !rawSegregation.length) return;

        // 1. Find all unique months in the data
        const uniqueMonthsSet = new Set<string>();
        const collectMonths = (recs: KPIRecord[]) => {
            recs.forEach(r => {
                const dateKey = normalizeDate(r['Date'] || '');
                if (dateKey) {
                    uniqueMonthsSet.add(dateKey.substring(0, 7)); // YYYY-MM
                }
            });
        };
        collectMonths(rawUniform);
        collectMonths(rawSegregation);

        const sortedMonths = Array.from(uniqueMonthsSet).sort();
        if (sortedMonths.length === 0) return;

        const wb = XLSX.utils.book_new();

        sortedMonths.forEach(mStr => {
            const [y, m] = mStr.split('-').map(Number);
            const data = buildSupervisorData(rawUniform, rawSegregation, y, m - 1);
            const dim = getDaysInMonth(y, m - 1);

            // Create Summary Sheet data for this month
            const sheetData: (string | number)[][] = [
                ["Mathura Vrindavan Nagar Nigam"],
                [`KPI Performance Report - ${MONTH_NAMES[m - 1]} ${y}`],
                [""],
                ["#", "Supervisor Name", "ID", "Zone/Ward", "Total Uniform", "Total Segregation", "Compliance Days", "Accuracy %"]
            ];

            data.forEach((sup, idx) => {
                const compliance = dim > 0 ? Math.round((sup.bothDone / dim) * 100) : 0;
                sheetData.push([
                    idx + 1,
                    sup.name,
                    sup.id,
                    sup.zonalName,
                    sup.totalUniform,
                    sup.totalSegregation,
                    sup.bothDone,
                    `${compliance}%`
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(sheetData);
            const safeMonthName = `${MONTH_NAMES[m - 1]} ${y}`.substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, safeMonthName);
        });

        XLSX.writeFile(wb, `Multi-Month-KPI-Report-${new Date().getTime()}.xlsx`);
    };

    const exportExcel = () => {
        const wb = XLSX.utils.book_new();

        // ── Sheet 1: Monthly Summary ──
        const summaryRows: any[][] = [
            [`KPI Monthly Calendar — ${MONTH_NAMES[viewMonth]} ${viewYear}`],
            [`Generated: ${new Date().toLocaleString()}`],
            [],
            ['#', 'Supervisor Name', 'Supervisor ID', 'Mobile', 'Zonal', 'Ward',
             'Uniform Uploads', 'Segregation Uploads',
             'Days Uniform Done', 'Days Segregation Done',
             'Days Both Done', 'Days Neither Done', 'Compliance %']
        ];

        filteredSups.forEach((s, i) => {
            const comp = daysInMonth > 0 ? Math.round((s.bothDone / daysInMonth) * 100) : 0;
            summaryRows.push([
                i + 1, s.name, s.id, s.mobile, s.zonalName, s.ward,
                s.totalUniform, s.totalSegregation,
                s.daysUniformDone, s.daysSegregationDone,
                s.bothDone, s.neitherDone, `${comp}%`
            ]);
        });

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
        wsSummary['!cols'] = [4, 28, 12, 14, 28, 20, 14, 14, 14, 14, 14, 14, 12].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, wsSummary, 'Monthly Summary');

        // ── Sheet 2: Day-wise Detail (all supervisors × all days) ──
        const dayHeaders = ['Supervisor', 'ID', 'Zonal'];
        for (let d = 1; d <= daysInMonth; d++) dayHeaders.push(String(d));
        dayHeaders.push('Total U', 'Total S', 'Both Days', 'Compliance %');

        const dayRowsU: any[][] = [['=== UNIFORM COMPLIANCE ==='], dayHeaders];
        const dayRowsS: any[][] = [['=== SEGREGATION COMPLIANCE ==='], dayHeaders];

        filteredSups.forEach(s => {
            const uRow: (string | number)[] = [s.name, s.id, s.zonalName];
            const sRow: (string | number)[] = [s.name, s.id, s.zonalName];
            for (let d = 1; d <= daysInMonth; d++) {
                const dk = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const entry = s.days[dk];
                uRow.push(entry?.uniform ?? 0);
                sRow.push(entry?.segregation ?? 0);
            }
            const comp = daysInMonth > 0 ? Math.round((s.bothDone / daysInMonth) * 100) : 0;
            uRow.push(s.totalUniform, s.totalSegregation, s.bothDone, `${comp}%`);
            sRow.push(s.totalUniform, s.totalSegregation, s.bothDone, `${comp}%`);
            dayRowsU.push(uRow);
            dayRowsS.push(sRow);
        });

        const wsDetail = XLSX.utils.aoa_to_sheet([...dayRowsU, [], ...dayRowsS]);
        XLSX.utils.book_append_sheet(wb, wsDetail, 'Day-wise Detail');

        XLSX.writeFile(wb, `KPI_Monthly_Calendar_${MONTH_NAMES[viewMonth]}_${viewYear}.xlsx`);
    };

    const hasData = supervisors.length > 0 && (rawUniform.length > 0 || rawSegregation.length > 0);

    return (
        <div className="min-h-screen bg-slate-50 p-4 sm:p-6 font-sans">
            <div className="max-w-screen-2xl mx-auto space-y-5">

                {/* ── Header ── */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <img src={NagarNigamLogo} alt="NN" className="h-14 object-contain" />
                        <div>
                            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">
                                Mathura Vrindavan Nagar Nigam
                            </h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <BarChart3 className="w-4 h-4 text-emerald-500" />
                                <span className="text-base font-bold text-emerald-500 uppercase tracking-wide">
                                    Month Wise KPI Calendar
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                Uniform &amp; Segregation compliance per supervisor — calendar heatmap view
                            </p>
                        </div>
                    </div>
                    <img src={NatureGreenLogo} alt="NG" className="h-14 object-contain hidden md:block" />
                </div>

                {/* ── Upload + Controls ── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-center gap-4 flex-wrap">
                    {/* File uploads */}
                    <input type="file" ref={uniformRef} accept=".csv" className="hidden"
                        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], 'uniform')} />
                    <input type="file" ref={segregationRef} accept=".csv" className="hidden"
                        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], 'segregation')} />

                    <button onClick={() => uniformRef.current?.click()}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${uniformFileName ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                        <Upload className="w-4 h-4" />
                        {uniformFileName ? `✓ ${uniformFileName.slice(0, 20)}...` : 'Upload Uniform CSV'}
                    </button>

                    <button onClick={() => segregationRef.current?.click()}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm ${segregationFileName ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
                        <Upload className="w-4 h-4" />
                        {segregationFileName ? `✓ ${segregationFileName.slice(0, 20)}...` : 'Upload Segregation CSV'}
                    </button>

                    {hasData && (
                        <>
                            <button onClick={handleExportAllMonths}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-all shadow-sm border border-slate-200">
                                <Download className="w-4 h-4" />
                                Export All Months
                            </button>
                            <button onClick={exportExcel}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm">
                                <FileSpreadsheet className="w-4 h-4" />
                                Export Current Month
                            </button>
                            <button onClick={exportPDF}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-all shadow-sm">
                                <Download className="w-4 h-4" />
                                Export PDF
                            </button>
                            <button onClick={exportJPEG}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-all shadow-sm border border-slate-200">
                                <ImageIcon className="w-4 h-4" />
                                Export JPEG
                            </button>
                        </>
                    )}
                </div>

                {/* ── Month Navigator ── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button onClick={prevMonth}
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                            <ChevronLeft className="w-5 h-5 text-slate-600" />
                        </button>
                        <div className="text-center min-w-[180px]">
                            <span className="text-xl font-black text-slate-900">
                                {MONTH_NAMES[viewMonth]} {viewYear}
                            </span>
                            <p className="text-xs text-slate-400">{daysInMonth} days</p>
                        </div>
                        <button onClick={nextMonth}
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                            <ChevronRight className="w-5 h-5 text-slate-600" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setViewMode('cards')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'cards' ? 'bg-white shadow-sm text-emerald-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Heatmap Cards
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-emerald-600 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Detailed Table
                        </button>
                    </div>

                    <Legend />
                </div>

                {/* ── Summary Stats ── */}
                {hasData && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Total Supervisors', value: supervisors.length, icon: Users, color: 'emerald', sub: 'in master list' },
                            { label: 'Active This Month', value: monthStats.active, icon: CheckCircle2, color: 'emerald', sub: 'at least 1 upload' },
                            { label: 'Avg Compliance', value: `${monthStats.avgCompliance}%`, icon: TrendingUp, color: 'purple', sub: 'both KPIs done' },
                            { label: 'Top Performer', value: monthStats.topPerformer?.name?.split(' ')[0] || '-', icon: ClipboardCheck, color: 'amber', sub: `${monthStats.topPerformer?.bothDone ?? 0} days complete` },
                        ].map(({ label, value, icon: Icon, color, sub }) => (
                            <div key={label} className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 relative overflow-hidden hover:shadow-md transition-shadow`}>
                                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-${color}-400 to-${color}-600`} />
                                <div className="flex items-center gap-2 mb-1">
                                    <Icon className={`w-4 h-4 text-${color}-500`} />
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{label}</span>
                                </div>
                                <p className={`text-2xl font-black text-${color}-700 truncate`}>{value}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Filters ── */}
                {hasData && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3 items-center">
                        <input
                            type="text"
                            placeholder="Search supervisor, ID, ward…"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <select
                            value={filterZonal}
                            onChange={e => setFilterZonal(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            {uniqueZonals.map(z => <option key={z}>{z}</option>)}
                        </select>
                        <select
                            value={filterCompliance}
                            onChange={e => setFilterCompliance(e.target.value as any)}
                            className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="all">All Compliance</option>
                            <option value="great">≥ 80% (Great)</option>
                            <option value="ok">50–79% (OK)</option>
                            <option value="poor">&lt; 50% (Poor)</option>
                        </select>
                        <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">
                            Showing {filteredSups.length} / {supervisors.length}
                        </span>
                    </div>
                )}

                {/* ── Calendar Grid ── */}
                {loading && (
                    <div className="flex justify-center py-16">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
                    </div>
                )}

                {!loading && hasData && (
                    <div ref={reportRef} className="space-y-4">
                        {/* Report header for export */}
                        <div className="hidden-for-print bg-white rounded-xl border border-slate-100 p-4 flex items-center justify-between text-xs text-slate-400">
                            <span className="font-semibold text-slate-600">{MONTH_NAMES[viewMonth]} {viewYear} — KPI Calendar Report</span>
                            <span>Generated: {new Date().toLocaleString()}</span>
                        </div>

                        {viewMode === 'cards' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3">
                                {filteredSups.map(sup => (
                                    <SupCard
                                        key={sup.id}
                                        sup={sup}
                                        year={viewYear}
                                        month={viewMonth}
                                        daysInMonth={daysInMonth}
                                        firstDay={firstDay}
                                        onClick={() => setSelectedSup(sup)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                                <div className="p-6 bg-white border-b border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <img src={NagarNigamLogo} alt="NN" className="h-16 object-contain" />
                                    
                                    <div className="text-center flex-1">
                                        <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-none">
                                            Mathura Vrindavan Nagar Nigam
                                        </h2>
                                        <div className="flex items-center justify-center gap-2 mt-1">
                                            <div className="h-px w-8 bg-emerald-100" />
                                            <span className="text-sm font-bold text-emerald-700 uppercase tracking-widest">
                                                KPI Performance Matrix — {MONTH_NAMES[viewMonth]} {viewYear}
                                            </span>
                                            <div className="h-px w-8 bg-emerald-100" />
                                        </div>
                                        {filterZonal !== 'All' && (
                                            <p className="text-xs font-black text-slate-500 mt-1 uppercase tracking-widest bg-slate-100 py-1 px-4 rounded-full inline-block">
                                                Zone: {filterZonal}
                                            </p>
                                        )}
                                    </div>

                                    <img src={NatureGreenLogo} alt="NG" className="h-16 object-contain" />
                                </div>
                                
                                <div className="px-6 py-2 bg-slate-50 border-b border-slate-200 flex justify-between text-[10px] font-bold text-slate-400">
                                    <span>Supervisor Coverage: {filteredSups.length} Records found</span>
                                    <span>Report Generated on: {new Date().toLocaleString()}</span>
                                </div>
                                <table className="w-full text-[10px] border-collapse min-w-[1500px] border border-slate-800">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-800">
                                            <th className="sticky left-0 z-20 bg-slate-50 px-2 py-3 text-left font-bold text-slate-800 border-r border-slate-800 w-12">#</th>
                                            <th className="sticky left-12 z-20 bg-slate-50 px-3 py-3 text-left font-bold text-slate-800 border-r border-slate-800 w-48">Supervisor</th>
                                            <th className="sticky left-60 z-20 bg-slate-50 px-2 py-3 text-center font-bold text-slate-800 border-r border-slate-800 w-24">ID</th>
                                            {Array.from({ length: daysInMonth }).map((_, i) => (
                                                <th key={i} className="px-1 py-3 text-center font-bold text-slate-800 border-r border-slate-800 min-w-[30px]">{i + 1}</th>
                                            ))}
                                            <th className="px-2 py-3 text-center font-bold text-emerald-900 bg-emerald-50 border-r border-slate-800">Both</th>
                                            <th className="px-2 py-3 text-center font-bold text-slate-700 bg-slate-50 border-r border-slate-800">U</th>
                                            <th className="px-2 py-3 text-center font-bold text-amber-900 bg-amber-50 border-r border-slate-800">S</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredSups.map((sup, idx) => {
                                            const hasZeroUploads = sup.totalUniform === 0 && sup.totalSegregation === 0;
                                            return (
                                                <tr key={sup.id} className={`border-b border-slate-800 transition-colors ${hasZeroUploads ? 'bg-red-50/50 hover:bg-red-100/50' : 'hover:bg-slate-50'}`}>
                                                    <td className={`sticky left-0 z-10 px-2 py-2 font-mono text-center border-r border-slate-800 ${hasZeroUploads ? 'bg-red-50 text-red-600' : 'bg-white text-slate-600'}`}>{idx + 1}</td>
                                                    <td className={`sticky left-12 z-10 px-3 py-2 font-bold border-r border-slate-800 truncate max-w-[192px] ${hasZeroUploads ? 'bg-red-50 text-red-700' : 'bg-white text-slate-800'}`}>{sup.name}</td>
                                                    <td className={`sticky left-60 z-10 px-2 py-2 text-center font-mono border-r border-slate-800 ${hasZeroUploads ? 'bg-red-50 text-red-600' : 'bg-white text-slate-600'}`}>{sup.id}</td>
                                                    {Array.from({ length: daysInMonth }).map((_, i) => {
                                                        const dayNum = i + 1;
                                                        const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                                        const entry = sup.days[dateKey];
                                                        const u = entry?.uniform ?? 0;
                                                        const s = entry?.segregation ?? 0;
                                                        
                                                        let bgColor = 'bg-red-50';
                                                        let textColor = 'text-red-400';
                                                        let label = '✕';

                                                        if (u > 0 && s > 0) { bgColor = 'bg-emerald-500'; label = 'B'; textColor = 'text-white'; }
                                                        else if (u > 0) { bgColor = 'bg-emerald-400'; label = 'U'; textColor = 'text-white'; }
                                                        else if (s > 0) { bgColor = 'bg-amber-400'; label = 'S'; textColor = 'text-white'; }

                                                        return (
                                                            <td key={i} className="p-0.5 border-r border-slate-800">
                                                                <div 
                                                                    className={`w-full aspect-square flex items-center justify-center rounded-sm font-black text-[9px] ${bgColor} ${textColor}`}
                                                                    title={`Day ${dayNum}: U:${u} S:${s}`}
                                                                >
                                                                    {label}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-2 py-2 text-center font-black text-emerald-800 bg-emerald-50 border-r border-slate-800">{sup.bothDone}</td>
                                                    <td className="px-2 py-2 text-center font-bold text-slate-700 bg-slate-50 border-r border-slate-800">{sup.daysUniformDone}</td>
                                                    <td className="px-2 py-2 text-center font-bold text-amber-800 bg-amber-50 border-r border-slate-800">{sup.daysSegregationDone}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {filteredSups.length === 0 && (
                            <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400">
                                <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
                                <p className="font-semibold">No supervisors match your filters</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Monthly Summary Table ── */}
                {!loading && hasData && filteredSups.length > 0 && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-slate-400" />
                            <h3 className="font-bold text-slate-800">Monthly Summary Table</h3>
                            <span className="text-xs text-slate-400 ml-auto">{MONTH_NAMES[viewMonth]} {viewYear}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="px-3 py-3 text-left font-bold text-slate-600 border-r border-slate-100">#</th>
                                        <th className="px-3 py-3 text-left font-bold text-slate-600 border-r border-slate-100">Supervisor</th>
                                        <th className="px-3 py-3 text-center font-bold text-slate-600 border-r border-slate-100">ID</th>
                                        <th className="px-3 py-3 text-center font-bold text-slate-600 border-r border-slate-100">Zonal</th>
                                        <th className="px-3 py-3 text-center font-bold text-emerald-700 border-r border-slate-100 bg-emerald-50">
                                            <ClipboardCheck className="w-3 h-3 inline mr-1" />
                                            U-Uploads
                                        </th>
                                        <th className="px-3 py-3 text-center font-bold text-amber-700 border-r border-slate-100 bg-amber-50">
                                            <Trash2 className="w-3 h-3 inline mr-1" />
                                            S-Uploads
                                        </th>
                                        <th className="px-3 py-3 text-center font-bold text-emerald-600 border-r border-slate-100">U-Days</th>
                                        <th className="px-3 py-3 text-center font-bold text-amber-600 border-r border-slate-100">S-Days</th>
                                        <th className="px-3 py-3 text-center font-bold text-emerald-700 border-r border-slate-100 bg-emerald-50">Both Done</th>
                                        <th className="px-3 py-3 text-center font-bold text-red-600 border-r border-slate-100">Neither</th>
                                        <th className="px-3 py-3 text-center font-bold text-slate-700">Compliance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSups.map((sup, i) => {
                                        const compliance = daysInMonth > 0 ? Math.round((sup.bothDone / daysInMonth) * 100) : 0;
                                        const hasZeroUploads = sup.totalUniform === 0 && sup.totalSegregation === 0;
                                        return (
                                            <tr
                                                key={sup.id}
                                                onClick={() => setSelectedSup(sup)}
                                                className={`border-b border-slate-100 cursor-pointer transition-colors ${
                                                    hasZeroUploads ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-emerald-50/30'
                                                }`}
                                            >
                                                <td className={`px-3 py-2.5 font-mono border-r border-slate-100 ${hasZeroUploads ? 'text-red-400' : 'text-slate-400'}`}>{i + 1}</td>
                                                <td className={`px-3 py-2.5 font-semibold border-r border-slate-100 ${hasZeroUploads ? 'text-red-700' : 'text-slate-800'}`}>{sup.name}</td>
                                                <td className={`px-3 py-2.5 text-center font-mono border-r border-slate-100 ${hasZeroUploads ? 'text-red-400' : 'text-slate-500'}`}>{sup.id}</td>
                                                <td className="px-3 py-2.5 text-center text-purple-700 font-medium border-r border-slate-100 text-[10px]">{sup.zonalName}</td>
                                                <td className="px-3 py-2.5 text-center font-bold text-emerald-700 bg-emerald-50 border-r border-slate-100">{sup.totalUniform}</td>
                                                <td className="px-3 py-2.5 text-center font-bold text-amber-700 bg-amber-50 border-r border-slate-100">{sup.totalSegregation}</td>
                                                <td className="px-3 py-2.5 text-center text-emerald-600 border-r border-slate-100">{sup.daysUniformDone}</td>
                                                <td className="px-3 py-2.5 text-center text-amber-600 border-r border-slate-100">{sup.daysSegregationDone}</td>
                                                <td className="px-3 py-2.5 text-center bg-emerald-50 border-r border-slate-100">
                                                    <span className="font-black text-emerald-700">{sup.bothDone}</span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center border-r border-slate-100">
                                                    <span className={`font-bold ${sup.neitherDone > daysInMonth / 2 ? 'text-red-600' : 'text-slate-500'}`}>{sup.neitherDone}</span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className={`inline-block px-2 py-0.5 rounded font-black text-[11px] ${
                                                        hasZeroUploads ? 'bg-red-600 text-white shadow-sm' :
                                                        compliance >= 80 ? 'bg-emerald-100 text-emerald-700' : 
                                                        compliance >= 50 ? 'bg-amber-100 text-amber-700' : 
                                                        'bg-red-100 text-red-600'
                                                    }`}>
                                                        {compliance}%
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-slate-100 text-center">
                            <p className="text-xs text-slate-400">
                                Designed by <span className="font-bold text-slate-600">Reports Buddy Pro</span>
                                {' · '}Created by <span className="font-bold text-emerald-600">Yuvraj Singh Tomar</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* ── Empty state ── */}
                {!loading && !hasData && (
                    <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-16 text-center">
                        <Calendar className="w-14 h-14 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-700 mb-2">Upload KPI CSV files to start</h3>
                        <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                            Upload the <strong>Uniform Compliance</strong> and/or <strong>Waste Segregation</strong> CSV exports
                            to see a month-by-month supervisor KPI heatmap calendar.
                        </p>
                        <div className="flex gap-3 justify-center flex-wrap">
                            <button onClick={() => uniformRef.current?.click()}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition-all shadow-md font-semibold">
                                <Upload className="w-4 h-4" /> Upload Uniform CSV
                            </button>
                            <button onClick={() => segregationRef.current?.click()}
                                className="flex items-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-xl hover:bg-amber-600 transition-all shadow-md font-semibold">
                                <Upload className="w-4 h-4" /> Upload Segregation CSV
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Detail Modal ── */}
            {selectedSup && (
                <DetailModal
                    sup={selectedSup}
                    year={viewYear}
                    month={viewMonth}
                    daysInMonth={daysInMonth}
                    firstDay={firstDay}
                    onClose={() => setSelectedSup(null)}
                />
            )}
        </div>
    );
};

export default MonthWiseKPICalendar;
