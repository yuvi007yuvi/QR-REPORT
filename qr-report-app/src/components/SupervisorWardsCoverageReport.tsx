import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Upload, FileSpreadsheet, Download, Search, User, Filter, Trash2, ChevronDown, ChevronUp, Building2, Users, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MASTER_SUPERVISORS } from '../data/master-supervisors';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';

// Per-ward detail within a supervisor
interface WardDetail {
    wardName: string;
    wardNumber: string;
    vehicles: { vehicleNumber: string; vehicleType: string; routeName: string; total: number; covered: number; coverage: number }[];
    totalPoi: number;
    visitedPoi: number;
    coveragePercentage: number;
}

// Supervisor section with all their wards
interface SupervisorSection {
    supervisor: string;
    zonal: string;
    wards: WardDetail[];
    totalPoi: number;
    visitedPoi: number;
    coveragePercentage: number;
}

const SupervisorWardsCoverageReport: React.FC = () => {
    const [sections, setSections] = useState<SupervisorSection[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedZonal, setSelectedZonal] = useState<string>('All');
    const [expandedSupervisors, setExpandedSupervisors] = useState<Set<string>>(new Set());
    const [viewMode, setViewMode] = useState<'supervisor' | 'ward'>('supervisor');
    const [selectedWards, setSelectedWards] = useState<Set<string>>(new Set());
    const [wardDropdownOpen, setWardDropdownOpen] = useState(false);
    const wardDropdownRef = useRef<HTMLDivElement>(null);

    // Close ward dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wardDropdownRef.current && !wardDropdownRef.current.contains(e.target as Node)) {
                setWardDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const extractWardNumber = (wardStr: string): string => {
        const match = wardStr.match(/(\d+)/);
        return match ? String(parseInt(match[0], 10)) : '';
    };

    const getSupervisorInfo = (wardName: string) => {
        const wardNumber = extractWardNumber(wardName);
        if (!wardNumber) return { supervisor: 'Unknown', zonal: 'Unknown' };
        const supervisor = MASTER_SUPERVISORS.find(s => {
            if (s.department !== 'C&T') return false;
            const wards = s.ward.split(',').map(w => extractWardNumber(w));
            return wards.includes(wardNumber);
        });
        return {
            supervisor: supervisor?.name || 'Unassigned',
            zonal: supervisor?.zonal || 'Unassigned'
        };
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);

            // Step 1: Build ward -> vehicles mapping
            const wardMap: Record<string, {
                wardName: string;
                vehicles: { vehicleNumber: string; vehicleType: string; routeName: string; total: number; covered: number; coverage: number }[];
                totalPoi: number;
                visitedPoi: number;
            }> = {};

            jsonData.forEach((row: any) => {
                const wardName = String(row['Ward Name'] || '').trim();
                if (!wardName) return;
                const vehicleNumber = String(row['Vehicle Number'] || '').trim();
                const vehicleType = String(row['Vehicle Type'] || '').trim().replace('Primary - ', '');
                const routeName = String(row['Route Name'] || '').trim();
                const total = Number(row['Total'] || 0);
                const covered = Number(row['Covered'] || 0);
                const coverage = total > 0 ? (covered / total) * 100 : 0;

                if (!wardMap[wardName]) {
                    wardMap[wardName] = { wardName, vehicles: [], totalPoi: 0, visitedPoi: 0 };
                }
                wardMap[wardName].vehicles.push({ vehicleNumber, vehicleType, routeName, total, covered, coverage });
                wardMap[wardName].totalPoi += total;
                wardMap[wardName].visitedPoi += covered;
            });

            // Step 2: Group wards by supervisor
            const supervisorMap: Record<string, {
                supervisor: string;
                zonal: string;
                wards: WardDetail[];
                totalPoi: number;
                visitedPoi: number;
            }> = {};

            Object.values(wardMap).forEach(ward => {
                const { supervisor, zonal } = getSupervisorInfo(ward.wardName);
                if (!supervisorMap[supervisor]) {
                    supervisorMap[supervisor] = { supervisor, zonal, wards: [], totalPoi: 0, visitedPoi: 0 };
                }
                const wardDetail: WardDetail = {
                    wardName: ward.wardName,
                    wardNumber: extractWardNumber(ward.wardName),
                    vehicles: ward.vehicles.sort((a, b) => b.coverage - a.coverage),
                    totalPoi: ward.totalPoi,
                    visitedPoi: ward.visitedPoi,
                    coveragePercentage: ward.totalPoi > 0 ? (ward.visitedPoi / ward.totalPoi) * 100 : 0
                };
                supervisorMap[supervisor].wards.push(wardDetail);
                supervisorMap[supervisor].totalPoi += ward.totalPoi;
                supervisorMap[supervisor].visitedPoi += ward.visitedPoi;
            });

            // Step 3: Convert to array
            const result: SupervisorSection[] = Object.values(supervisorMap).map(s => ({
                ...s,
                wards: s.wards.sort((a, b) => parseInt(a.wardNumber) - parseInt(b.wardNumber)),
                coveragePercentage: s.totalPoi > 0 ? (s.visitedPoi / s.totalPoi) * 100 : 0
            }));

            result.sort((a, b) => {
                if (a.zonal === b.zonal) return a.supervisor.localeCompare(b.supervisor);
                return a.zonal.localeCompare(b.zonal);
            });

            setSections(result);
            // Expand all by default
            setExpandedSupervisors(new Set(result.map(s => s.supervisor)));
        } catch (error) {
            console.error(error);
            alert('Error processing file');
        } finally {
            setLoading(false);
        }
    };

    const hasData = sections.length > 0;
    const zonals = useMemo(() => Array.from(new Set(sections.map(s => s.zonal))).sort(), [sections]);

    // All unique ward numbers for the multi-select dropdown
    const allWardNumbers = useMemo(() => {
        const wards: { number: string; name: string }[] = [];
        const seen = new Set<string>();
        sections.forEach(s => s.wards.forEach(w => {
            if (!seen.has(w.wardNumber)) {
                seen.add(w.wardNumber);
                wards.push({ number: w.wardNumber, name: w.wardName });
            }
        }));
        wards.sort((a, b) => parseInt(a.number) - parseInt(b.number));
        return wards;
    }, [sections]);

    const toggleWardSelection = (wardNum: string) => {
        setSelectedWards(prev => {
            const next = new Set(prev);
            if (next.has(wardNum)) next.delete(wardNum);
            else next.add(wardNum);
            return next;
        });
    };

    const filteredSections = useMemo(() => {
        return sections.filter(s => {
            const matchesSearch = s.supervisor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.wards.some(w => w.wardName.toLowerCase().includes(searchTerm.toLowerCase()) || w.wardNumber.includes(searchTerm));
            const matchesZonal = selectedZonal === 'All' || s.zonal === selectedZonal;
            // Ward filter: if wards selected, supervisor must have at least one matching ward
            const matchesWard = selectedWards.size === 0 || s.wards.some(w => selectedWards.has(w.wardNumber));
            return matchesSearch && matchesZonal && matchesWard;
        }).map(s => {
            // If ward filter active, also filter the wards inside each supervisor section
            if (selectedWards.size === 0) return s;
            return { ...s, wards: s.wards.filter(w => selectedWards.has(w.wardNumber)) };
        });
    }, [sections, searchTerm, selectedZonal, selectedWards]);

    // Ward-wise flat list for ward view mode
    const wardSections = useMemo(() => {
        const allWards: { wardName: string; wardNumber: string; supervisor: string; zonal: string; vehicles: { vehicleNumber: string; vehicleType: string; routeName: string; total: number; covered: number; coverage: number }[]; totalPoi: number; visitedPoi: number; coveragePercentage: number }[] = [];
        filteredSections.forEach(s => {
            s.wards.forEach(w => {
                allWards.push({ ...w, supervisor: s.supervisor, zonal: s.zonal });
            });
        });
        allWards.sort((a, b) => parseInt(a.wardNumber) - parseInt(b.wardNumber));
        return allWards;
    }, [filteredSections]);

    const toggleSupervisor = (name: string) => {
        setExpandedSupervisors(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const expandAll = () => {
        if (viewMode === 'supervisor') setExpandedSupervisors(new Set(filteredSections.map(s => s.supervisor)));
        else setExpandedSupervisors(new Set(wardSections.map(w => w.wardName)));
    };
    const collapseAll = () => setExpandedSupervisors(new Set());

    const getCoverageColor = (pct: number) => {
        if (pct >= 80) return { bg: 'bg-green-100', text: 'text-green-800', bar: 'bg-green-500' };
        if (pct >= 50) return { bg: 'bg-yellow-100', text: 'text-yellow-800', bar: 'bg-yellow-500' };
        return { bg: 'bg-red-100', text: 'text-red-800', bar: 'bg-red-500' };
    };

    const exportToExcel = () => {
        const rows: any[] = [];
        let sno = 0;
        filteredSections.forEach(section => {
            // Supervisor header row
            sno++;
            rows.push({
                'S.No.': sno,
                'Supervisor': section.supervisor,
                'Zonal Head': section.zonal,
                'Ward': '',
                'Vehicle': '',
                'Vehicle Type': '',
                'Route': '',
                'Total POI': section.totalPoi,
                'Visited POI': section.visitedPoi,
                'Coverage %': `${section.coveragePercentage.toFixed(1)}%`
            });
            section.wards.forEach(ward => {
                ward.vehicles.forEach((v, vi) => {
                    rows.push({
                        'S.No.': '',
                        'Supervisor': vi === 0 ? '' : '',
                        'Zonal Head': '',
                        'Ward': vi === 0 ? ward.wardName : '',
                        'Vehicle': v.vehicleNumber,
                        'Vehicle Type': v.vehicleType,
                        'Route': v.routeName,
                        'Total POI': v.total,
                        'Visited POI': v.covered,
                        'Coverage %': `${v.coverage.toFixed(1)}%`
                    });
                });
                // Ward subtotal
                rows.push({
                    'S.No.': '',
                    'Supervisor': '',
                    'Zonal Head': '',
                    'Ward': `${ward.wardName} Total`,
                    'Vehicle': '',
                    'Vehicle Type': '',
                    'Route': '',
                    'Total POI': ward.totalPoi,
                    'Visited POI': ward.visitedPoi,
                    'Coverage %': `${ward.coveragePercentage.toFixed(1)}%`
                });
            });
            // Empty separator row
            rows.push({});
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Coverage Report");
        XLSX.writeFile(wb, `Supervisor_Wards_Coverage_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Mathura Vrindavan Nagar Nigam', 14, 15);
        doc.setFontSize(12);
        doc.text('Supervisor Wards Coverage Report', 14, 23);
        doc.setFontSize(9);
        doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

        let startY = 36;

        filteredSections.forEach(section => {
            // Check if we need a new page
            if (startY > 260) {
                doc.addPage();
                startY = 15;
            }

            // Supervisor header
            doc.setFillColor(41, 128, 185);
            doc.rect(14, startY, 182, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(10);
            doc.text(`${section.supervisor} | Zonal: ${section.zonal} | Coverage: ${section.coveragePercentage.toFixed(1)}%`, 16, startY + 5.5);
            startY += 10;

            const tableRows = section.wards.flatMap(ward =>
                ward.vehicles.map((v, vi) => [
                    vi === 0 ? ward.wardName : '',
                    v.vehicleNumber,
                    v.vehicleType,
                    v.routeName,
                    v.total,
                    v.covered,
                    `${v.coverage.toFixed(1)}%`
                ])
            );

            autoTable(doc, {
                head: [['Ward', 'Vehicle', 'Type', 'Route', 'Total', 'Visited', 'Coverage']],
                body: tableRows,
                startY,
                theme: 'grid',
                styles: { fontSize: 7, cellPadding: 2 },
                headStyles: { fillColor: [52, 73, 94], fontSize: 7 },
                margin: { left: 14, right: 14 },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 6) {
                        const val = parseFloat(data.cell.raw as string);
                        if (val < 50) data.cell.styles.textColor = [220, 38, 38];
                        else if (val < 80) data.cell.styles.textColor = [217, 119, 6];
                        else data.cell.styles.textColor = [22, 163, 74];
                    }
                }
            });

            startY = (doc as any).lastAutoTable.finalY + 8;
        });

        doc.save(`Supervisor_Wards_Coverage_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Processing Report...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 h-full flex flex-col bg-gray-50">
            {/* Header */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 mb-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <img src={nagarNigamLogo} alt="Logo" className="h-14 w-auto" />
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Supervisor Wards Coverage</h1>
                            <p className="text-gray-500 text-sm">Each supervisor section with all ward details</p>
                        </div>
                    </div>

                    {!hasData && (
                        <div className="flex-1 max-w-xl text-center">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                                <Upload className="w-8 h-8 mb-3 text-gray-500" />
                                <p className="mb-1 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> POI Report</p>
                                <p className="text-xs text-gray-400">CSV or Excel file</p>
                                <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
                            </label>
                        </div>
                    )}

                    {hasData && (
                        <div className="flex flex-wrap gap-2">
                            <button onClick={expandAll} className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">Expand All</button>
                            <button onClick={collapseAll} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Collapse All</button>
                            <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                                <FileSpreadsheet className="w-4 h-4" /> Excel
                            </button>
                            <button onClick={exportToPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                                <Download className="w-4 h-4" /> PDF
                            </button>
                            <button onClick={() => setSections([])} className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm">
                                <Trash2 className="w-4 h-4" /> Clear
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {hasData && (
                <>
                    {/* Filters */}
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 mb-4 flex flex-wrap gap-3 items-center">
                        {/* View Mode Toggle */}
                        <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                            <button
                                onClick={() => setViewMode('supervisor')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${viewMode === 'supervisor' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Users className="w-4 h-4" /> Supervisor
                            </button>
                            <button
                                onClick={() => setViewMode('ward')}
                                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${viewMode === 'ward' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <Building2 className="w-4 h-4" /> Ward
                            </button>
                        </div>

                        <div className="flex-1 min-w-[200px] relative">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder={viewMode === 'supervisor' ? "Search supervisor or ward..." : "Search ward..."}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-gray-500" />
                            <select
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                                value={selectedZonal}
                                onChange={(e) => setSelectedZonal(e.target.value)}
                            >
                                <option value="All">All Zonals</option>
                                {zonals.map(z => <option key={z} value={z}>{z}</option>)}
                            </select>
                        </div>

                        {/* Multi-Select Ward Dropdown */}
                        <div className="relative" ref={wardDropdownRef}>
                            <button
                                onClick={() => setWardDropdownOpen(!wardDropdownOpen)}
                                className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${selectedWards.size > 0
                                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <Building2 className="w-4 h-4" />
                                {selectedWards.size === 0
                                    ? 'All Wards'
                                    : `${selectedWards.size} Ward${selectedWards.size > 1 ? 's' : ''}`}
                                <ChevronDown className="w-3 h-3" />
                            </button>

                            {selectedWards.size > 0 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedWards(new Set()); }}
                                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}

                            {wardDropdownOpen && (
                                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-72 overflow-hidden flex flex-col">
                                    <div className="p-2 border-b border-gray-100 flex gap-2">
                                        <button
                                            onClick={() => setSelectedWards(new Set(allWardNumbers.map(w => w.number)))}
                                            className="flex-1 text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 font-medium"
                                        >Select All</button>
                                        <button
                                            onClick={() => setSelectedWards(new Set())}
                                            className="flex-1 text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 font-medium"
                                        >Clear All</button>
                                    </div>
                                    <div className="overflow-auto flex-1 p-1">
                                        {allWardNumbers.map(w => (
                                            <label
                                                key={w.number}
                                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-sm"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedWards.has(w.number)}
                                                    onChange={() => toggleWardSelection(w.number)}
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-gray-700">{w.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="text-sm text-gray-500">
                            {viewMode === 'supervisor'
                                ? `${filteredSections.length} supervisor${filteredSections.length !== 1 ? 's' : ''}`
                                : `${wardSections.length} ward${wardSections.length !== 1 ? 's' : ''}`
                            }
                        </div>
                    </div>

                    {/* Sections */}
                    <div className="flex-1 overflow-auto space-y-4 pb-4">
                        {viewMode === 'supervisor' ? (
                            /* ===== SUPERVISOR WISE VIEW ===== */
                            <>
                                {filteredSections.map((section) => {
                                    const isExpanded = expandedSupervisors.has(section.supervisor);
                                    const colors = getCoverageColor(section.coveragePercentage);

                                    return (
                                        <div key={section.supervisor} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                            <div
                                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                                onClick={() => toggleSupervisor(section.supervisor)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                                        <User className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-900">{section.supervisor}</h3>
                                                        <p className="text-xs text-gray-500">Zonal: {section.zonal} &middot; {section.wards.length} ward{section.wards.length !== 1 ? 's' : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right hidden md:block">
                                                        <div className="text-xs text-gray-500">Total / Visited</div>
                                                        <div className="text-sm font-semibold text-gray-800">{section.totalPoi.toLocaleString()} / {section.visitedPoi.toLocaleString()}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${Math.min(section.coveragePercentage, 100)}%` }}></div>
                                                        </div>
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}>
                                                            {section.coveragePercentage.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="border-t border-gray-200">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-gray-800 text-white">
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Ward</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Vehicle</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Type</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Route</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right">Total</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right">Visited</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right">Coverage</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {section.wards.map((ward) => (
                                                                <React.Fragment key={ward.wardName}>
                                                                    {ward.vehicles.map((v, vi) => {
                                                                        const vColors = getCoverageColor(v.coverage);
                                                                        return (
                                                                            <tr key={`${ward.wardName}-${vi}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                                                <td className="px-4 py-2 text-sm">
                                                                                    {vi === 0 ? <span className="font-semibold text-gray-900">{ward.wardName}</span> : null}
                                                                                </td>
                                                                                <td className="px-4 py-2 text-sm text-gray-700 font-mono">{v.vehicleNumber || '-'}</td>
                                                                                <td className="px-4 py-2 text-sm text-gray-500 text-xs">{v.vehicleType || '-'}</td>
                                                                                <td className="px-4 py-2 text-sm text-gray-500">{v.routeName}</td>
                                                                                <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">{v.total}</td>
                                                                                <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">{v.covered}</td>
                                                                                <td className="px-4 py-2 text-right">
                                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${vColors.bg} ${vColors.text}`}>
                                                                                        {v.coverage.toFixed(1)}%
                                                                                    </span>
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                    <tr className="bg-blue-50 border-b-2 border-blue-200">
                                                                        <td className="px-4 py-2 text-xs font-bold text-blue-800" colSpan={4}>Ward {ward.wardNumber} Subtotal</td>
                                                                        <td className="px-4 py-2 text-xs font-bold text-blue-800 text-right">{ward.totalPoi}</td>
                                                                        <td className="px-4 py-2 text-xs font-bold text-blue-800 text-right">{ward.visitedPoi}</td>
                                                                        <td className="px-4 py-2 text-right">
                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${getCoverageColor(ward.coveragePercentage).bg} ${getCoverageColor(ward.coveragePercentage).text}`}>
                                                                                {ward.coveragePercentage.toFixed(1)}%
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                </React.Fragment>
                                                            ))}
                                                            <tr className="bg-gray-900 text-white">
                                                                <td className="px-4 py-3 text-sm font-bold" colSpan={4}>{section.supervisor} — Grand Total</td>
                                                                <td className="px-4 py-3 text-sm font-bold text-right">{section.totalPoi.toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-sm font-bold text-right">{section.visitedPoi.toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-gray-900">
                                                                        {section.coveragePercentage.toFixed(1)}%
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {filteredSections.length === 0 && (
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">No supervisors found matching your filters.</div>
                                )}
                            </>
                        ) : (
                            /* ===== WARD WISE VIEW ===== */
                            <>
                                {wardSections.map((ward) => {
                                    const isExpanded = expandedSupervisors.has(ward.wardName);
                                    const colors = getCoverageColor(ward.coveragePercentage);

                                    return (
                                        <div key={ward.wardName} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                            <div
                                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                                onClick={() => toggleSupervisor(ward.wardName)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                                        <Building2 className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-900">{ward.wardName}</h3>
                                                        <p className="text-xs text-gray-500">Supervisor: {ward.supervisor} &middot; Zonal: {ward.zonal} &middot; {ward.vehicles.length} vehicle{ward.vehicles.length !== 1 ? 's' : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right hidden md:block">
                                                        <div className="text-xs text-gray-500">Total / Visited</div>
                                                        <div className="text-sm font-semibold text-gray-800">{ward.totalPoi.toLocaleString()} / {ward.visitedPoi.toLocaleString()}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                            <div className={`h-full rounded-full ${colors.bar}`} style={{ width: `${Math.min(ward.coveragePercentage, 100)}%` }}></div>
                                                        </div>
                                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}>
                                                            {ward.coveragePercentage.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                    {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="border-t border-gray-200">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-gray-800 text-white">
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Vehicle</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Type</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Route</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right">Total</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right">Visited</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right">Coverage</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {ward.vehicles.map((v, vi) => {
                                                                const vColors = getCoverageColor(v.coverage);
                                                                return (
                                                                    <tr key={vi} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                                                        <td className="px-4 py-2 text-sm text-gray-700 font-mono">{v.vehicleNumber || '-'}</td>
                                                                        <td className="px-4 py-2 text-sm text-gray-500 text-xs">{v.vehicleType || '-'}</td>
                                                                        <td className="px-4 py-2 text-sm text-gray-500">{v.routeName}</td>
                                                                        <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">{v.total}</td>
                                                                        <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">{v.covered}</td>
                                                                        <td className="px-4 py-2 text-right">
                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${vColors.bg} ${vColors.text}`}>
                                                                                {v.coverage.toFixed(1)}%
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                            <tr className="bg-gray-900 text-white">
                                                                <td className="px-4 py-3 text-sm font-bold" colSpan={3}>Ward Total</td>
                                                                <td className="px-4 py-3 text-sm font-bold text-right">{ward.totalPoi.toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-sm font-bold text-right">{ward.visitedPoi.toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-right">
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-gray-900">
                                                                        {ward.coveragePercentage.toFixed(1)}%
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {wardSections.length === 0 && (
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">No wards found matching your filters.</div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default SupervisorWardsCoverageReport;
