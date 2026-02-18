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
    wardKycPoi: number;
    totalPoi: number;
    visitedPoi: number;
    coveragePercentage: number;
}

// Supervisor section with all their wards
interface SupervisorSection {
    supervisor: string;
    zonal: string;
    wards: WardDetail[];
    wardKycPoi: number;
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
    const [kycWardData, setKycWardData] = useState<Record<string, number>>({});
    const [selectedVehicleType, setSelectedVehicleType] = useState<string>('All');

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

    // Capacity/KYC Target per vehicle type
    const getCapacityTarget = (vehicleType: string): number => {
        const t = vehicleType.toUpperCase();
        if (t.includes('MANUAL RICKSHAW') || t.includes('WHEEL BARROW')) return 200;
        if (t.includes('3 WHEELER') || t.includes('THREE WHEELER')) return 250;
        // Auto Tipper, Euler Tipper, 4 Wheeler all get 700
        return 700;
    };

    const getVehicleRemark = (vehicleType: string, onRoute: number): { text: string; isOk: boolean } => {
        const target = getCapacityTarget(vehicleType);
        if (onRoute >= target) return { text: `\u2713 OK (${target})`, isOk: true };
        return { text: `\u26A0 Low (${onRoute}/${target})`, isOk: false };
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
                const vehicleType = String(row['Vehicle Type'] || '').trim();
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
                    wardKycPoi: 0,
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
                wardKycPoi: 0,
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
            console.error('Error processing file:', error);
            alert('Error processing file');
        } finally {
            setLoading(false);
        }
    };

    // Handle KYC By Wards CSV upload
    const handleKycUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);

            const kycMap: Record<string, number> = {};
            jsonData.forEach((row: any) => {
                const wardNum = String(row['Ward Name'] || '').trim();
                const customerCount = Number(row['Customer Count'] || 0);
                if (wardNum) {
                    kycMap[wardNum] = customerCount;
                }
            });
            setKycWardData(kycMap);
        } catch (err) {
            console.error('Error processing KYC file:', err);
            alert('Error processing KYC file');
        }
    };

    const hasData = sections.length > 0;
    const zonals = useMemo(() => Array.from(new Set(sections.map(s => s.zonal))).sort(), [sections]);

    // Merge KYC data into sections
    const sectionsWithKyc = useMemo(() => {
        if (Object.keys(kycWardData).length === 0) return sections;
        return sections.map(s => {
            const wards = s.wards.map(w => {
                const kycPoi = kycWardData[w.wardNumber] || 0;
                return { ...w, wardKycPoi: kycPoi };
            });
            const totalKyc = wards.reduce((sum, w) => sum + w.wardKycPoi, 0);
            return { ...s, wards, wardKycPoi: totalKyc };
        });
    }, [sections, kycWardData]);

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

    // All unique vehicle types for the filter
    const allVehicleTypes = useMemo(() => {
        const types = new Set<string>();
        sections.forEach(s => s.wards.forEach(w => w.vehicles.forEach(v => {
            if (v.vehicleType) types.add(v.vehicleType);
        })));
        return Array.from(types).sort();
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
        return sectionsWithKyc.filter(s => {
            const matchesSearch = s.supervisor.toLowerCase().includes(searchTerm.toLowerCase()) ||
                s.wards.some(w => w.wardName.toLowerCase().includes(searchTerm.toLowerCase()) || w.wardNumber.includes(searchTerm));
            const matchesZonal = selectedZonal === 'All' || s.zonal === selectedZonal;
            const matchesWard = selectedWards.size === 0 || s.wards.some(w => selectedWards.has(w.wardNumber));
            // Vehicle type filter: supervisor must have at least one vehicle matching
            const matchesVType = selectedVehicleType === 'All' || s.wards.some(w => w.vehicles.some(v => v.vehicleType === selectedVehicleType));
            return matchesSearch && matchesZonal && matchesWard && matchesVType;
        }).map(s => {
            let wards = s.wards;
            // If ward filter active, filter wards
            if (selectedWards.size > 0) wards = wards.filter(w => selectedWards.has(w.wardNumber));
            // If vehicle type filter active, filter vehicles within each ward
            if (selectedVehicleType !== 'All') {
                wards = wards.map(w => ({
                    ...w,
                    vehicles: w.vehicles.filter(v => v.vehicleType === selectedVehicleType)
                })).filter(w => w.vehicles.length > 0);
            }
            if (selectedWards.size > 0 || selectedVehicleType !== 'All') return { ...s, wards };
            return s;
        });
    }, [sectionsWithKyc, searchTerm, selectedZonal, selectedWards, selectedVehicleType]);

    // Ward-wise flat list for ward view mode
    const wardSections = useMemo(() => {
        const allWards: { wardName: string; wardNumber: string; supervisor: string; zonal: string; vehicles: { vehicleNumber: string; vehicleType: string; routeName: string; total: number; covered: number; coverage: number }[]; wardKycPoi: number; totalPoi: number; visitedPoi: number; coveragePercentage: number }[] = [];
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
                'Ward POI': section.wardKycPoi || '',
                'On Route': section.totalPoi,
                'Visited': section.visitedPoi,
                'Coverage %': `${section.coveragePercentage.toFixed(1)}%`,
                'Remark': ''
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
                        'Ward POI': vi === 0 ? (ward.wardKycPoi || '') : '',
                        'On Route': v.total,
                        'Visited': v.covered,
                        'Coverage %': `${v.coverage.toFixed(1)}%`,
                        'Remark': v.vehicleType ? (getVehicleRemark(v.vehicleType, v.total).isOk ? `OK (${getCapacityTarget(v.vehicleType)})` : `Low (${v.total}/${getCapacityTarget(v.vehicleType)})`) : ''
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
                    'Ward POI': ward.wardKycPoi || '',
                    'On Route': ward.totalPoi,
                    'Visited': ward.visitedPoi,
                    'Coverage %': `${ward.coveragePercentage.toFixed(1)}%`,
                    'Remark': ''
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
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.width;

        // Title
        doc.setFontSize(18);
        doc.setTextColor(41, 128, 185);
        doc.text('Mathura Vrindavan Nagar Nigam', pageWidth / 2, 15, { align: 'center' });

        doc.setFontSize(14);
        doc.setTextColor(60, 60, 60);
        doc.text('Supervisor Wards Coverage Report', pageWidth / 2, 22, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, pageWidth / 2, 28, { align: 'center' });

        let startY = 35;

        filteredSections.forEach((section, index) => {
            // Calculate Section Stats
            const secKycPoi = section.wards.reduce((s, w) => s + w.wardKycPoi, 0);
            const secOnRoute = section.wards.reduce((s, w) => s + w.vehicles.reduce((vs, v) => vs + v.total, 0), 0);
            const secVisited = section.wards.reduce((s, w) => s + w.vehicles.reduce((vs, v) => vs + v.covered, 0), 0);
            const secCoverage = secOnRoute > 0 ? (secVisited / secOnRoute) * 100 : 0;
            const totalRoutes = section.wards.reduce((s, w) => s + w.vehicles.length, 0);

            // Add new page if not enough space for header + partial table
            if (startY > 250) {
                doc.addPage();
                startY = 20;
            }

            // Supervisor Header Block
            doc.setFillColor(245, 247, 250);
            doc.setDrawColor(200, 200, 200);
            doc.roundedRect(14, startY, 182, 25, 2, 2, 'FD');

            // Name
            doc.setFontSize(12);
            doc.setTextColor(0, 0, 0);
            doc.setFont('helvetica', 'bold');
            doc.text(`${index + 1}. Supervisor :- ${section.supervisor}`, 18, startY + 8);

            // Stats Row
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');

            const stats = [
                { label: `Zonal: ${section.zonal}`, color: [107, 33, 168] }, // Purple
                { label: `Wards: ${section.wards.length}`, color: [71, 85, 105] }, // Slate
                { label: `Routes: ${totalRoutes}`, color: [8, 145, 178] }, // Cyan
                { label: `Ward POI: ${secKycPoi.toLocaleString()}`, color: [180, 83, 9] }, // Amber
                { label: `On Route: ${secOnRoute.toLocaleString()}`, color: [30, 64, 175] }, // Blue
                { label: `Visited: ${secVisited.toLocaleString()}`, color: [5, 150, 105] }, // Emerald
                { label: `Coverage: ${secCoverage.toFixed(1)}%`, color: [50, 50, 50] } // Gray
            ];

            let xPos = 18;
            stats.forEach(stat => {
                doc.setTextColor(stat.color[0], stat.color[1], stat.color[2]);
                doc.text(stat.label, xPos, startY + 18);
                xPos += (doc.getTextWidth(stat.label) + 6);
            });

            startY += 30;

            // Prepare Table Data
            const tableBody: any[] = [];

            section.wards.forEach(ward => {
                // Vehicle Rows
                ward.vehicles.forEach((v, vi) => {
                    const remarkNode = getVehicleRemark(v.vehicleType, v.total);
                    const remarkText = remarkNode.isOk ? 'OK' : remarkNode.text;

                    tableBody.push([
                        vi === 0 ? ward.wardName : '', // Ward Name only on first vehicle
                        v.vehicleNumber || '-',
                        v.vehicleType || '-',
                        v.routeName,
                        vi === 0 && ward.wardKycPoi > 0 ? ward.wardKycPoi.toLocaleString() : '',
                        v.total.toLocaleString(),
                        v.covered.toLocaleString(),
                        `${v.coverage.toFixed(1)}%`,
                        remarkText
                    ]);
                });

                // Ward Subtotal Row
                const wTotal = ward.vehicles.reduce((s, v) => s + v.total, 0);
                const wVisited = ward.vehicles.reduce((s, v) => s + v.covered, 0);
                const wCoverage = wTotal > 0 ? (wVisited / wTotal) * 100 : 0;

                tableBody.push([
                    { content: `Ward ${ward.wardNumber} Subtotal`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [239, 246, 255], textColor: [30, 64, 175] } },
                    { content: ward.wardKycPoi > 0 ? ward.wardKycPoi.toLocaleString() : '-', styles: { fontStyle: 'bold', fillColor: [239, 246, 255], textColor: [30, 64, 175], halign: 'center' } },
                    { content: wTotal.toLocaleString(), styles: { fontStyle: 'bold', fillColor: [239, 246, 255], textColor: [30, 64, 175], halign: 'center' } },
                    { content: wVisited.toLocaleString(), styles: { fontStyle: 'bold', fillColor: [239, 246, 255], textColor: [30, 64, 175], halign: 'center' } },
                    { content: `${wCoverage.toFixed(1)}%`, styles: { fontStyle: 'bold', fillColor: [239, 246, 255], textColor: [30, 64, 175], halign: 'center' } },
                    { content: '', styles: { fillColor: [239, 246, 255] } }
                ]);
            });

            // Grand Total Row
            tableBody.push([
                { content: `${section.supervisor} — Grand Total`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [31, 41, 55], textColor: [255, 255, 255] } },
                { content: secKycPoi > 0 ? secKycPoi.toLocaleString() : '-', styles: { fontStyle: 'bold', fillColor: [31, 41, 55], textColor: [255, 255, 255], halign: 'center' } },
                { content: secOnRoute.toLocaleString(), styles: { fontStyle: 'bold', fillColor: [31, 41, 55], textColor: [255, 255, 255], halign: 'center' } },
                { content: secVisited.toLocaleString(), styles: { fontStyle: 'bold', fillColor: [31, 41, 55], textColor: [255, 255, 255], halign: 'center' } },
                { content: `${secCoverage.toFixed(1)}%`, styles: { fontStyle: 'bold', fillColor: [31, 41, 55], textColor: [255, 255, 255], halign: 'center' } },
                { content: '', styles: { fillColor: [31, 41, 55] } }
            ]);

            autoTable(doc, {
                startY: startY,
                head: [['Ward', 'Vehicle', 'Type', 'Route', 'Ward POI', 'On Route', 'Visited', 'Coverage', 'Remark']],
                body: tableBody,
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    cellPadding: 3,
                    valign: 'middle',
                    halign: 'center',
                    lineColor: [220, 220, 220],
                    lineWidth: 0.1
                },
                headStyles: {
                    fillColor: [55, 65, 81],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    halign: 'center'
                },
                columnStyles: {
                    0: { cellWidth: 30, halign: 'left' }, // Ward
                    1: { cellWidth: 25 }, // Vehicle
                    2: { cellWidth: 30 }, // Type
                    3: { cellWidth: 15 }, // Route
                    8: { cellWidth: 25, fontSize: 7 } // Remark
                },
                didParseCell: (data) => {
                    // Color code coverage column
                    if (data.section === 'body' && data.column.index === 7) {
                        const raw = data.cell.raw as string;
                        if (typeof raw === 'string' && raw.includes('%')) {
                            const val = parseFloat(raw);
                            if (val < 50) data.cell.styles.textColor = [220, 38, 38]; // Red
                            else if (val < 80) data.cell.styles.textColor = [217, 119, 6]; // Orange
                            else data.cell.styles.textColor = [22, 163, 74]; // Green
                        }
                    }
                    // Color code remarks
                    if (data.section === 'body' && data.column.index === 8) {
                        const text = data.cell.raw as string;
                        if (text === 'OK') data.cell.styles.textColor = [22, 163, 74];
                        else data.cell.styles.textColor = [185, 28, 28];
                    }
                },
                margin: { left: 14, right: 14 }
            });

            startY = (doc as any).lastAutoTable.finalY + 15;
        });

        doc.save(`Supervisor_Wards_Coverage_Report_${new Date().toISOString().split('T')[0]}.pdf`);
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
                        <div className="flex flex-wrap gap-2 items-center">
                            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors shadow-sm cursor-pointer">
                                <Upload className="w-4 h-4" />
                                {Object.keys(kycWardData).length > 0 ? 'KYC ✓' : 'KYC File'}
                                <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleKycUpload} />
                            </label>
                            <button onClick={expandAll} className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">Expand All</button>
                            <button onClick={collapseAll} className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Collapse All</button>
                            <button onClick={exportToExcel} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                                <FileSpreadsheet className="w-4 h-4" /> Excel
                            </button>
                            <button onClick={exportToPDF} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                                <Download className="w-4 h-4" /> PDF
                            </button>
                            <button onClick={() => { setSections([]); setKycWardData({}); }} className="flex items-center gap-1.5 px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm">
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

                        {/* Vehicle Type Filter */}
                        <div className="flex items-center gap-2">
                            <select
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm"
                                value={selectedVehicleType}
                                onChange={(e) => setSelectedVehicleType(e.target.value)}
                            >
                                <option value="All">All Vehicle Types</option>
                                {allVehicleTypes.map(t => <option key={t} value={t}>{t}</option>)}
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
                                {filteredSections.map((section, sIndex) => {
                                    const isExpanded = expandedSupervisors.has(section.supervisor);
                                    const secKycPoi = section.wards.reduce((s, w) => s + w.wardKycPoi, 0);
                                    const secOnRoute = section.wards.reduce((s, w) => s + w.vehicles.reduce((vs, v) => vs + v.total, 0), 0);
                                    const secVisited = section.wards.reduce((s, w) => s + w.vehicles.reduce((vs, v) => vs + v.covered, 0), 0);
                                    const secCoverage = secOnRoute > 0 ? (secVisited / secOnRoute) * 100 : 0;
                                    const colors = getCoverageColor(secCoverage);

                                    return (
                                        <div key={section.supervisor} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-200">
                                            <div
                                                className="flex flex-col items-center p-4 cursor-pointer hover:bg-gradient-to-r hover:from-blue-50/60 hover:to-transparent transition-all duration-200 border-l-4 border-l-blue-500"
                                                onClick={() => toggleSupervisor(section.supervisor)}
                                            >
                                                {/* Top row: Sr.No + Icon + Name + Chevron */}
                                                <div className="flex items-center justify-center w-full mb-3 relative">
                                                    <div className="flex items-center gap-3">
                                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-700 text-xs font-bold">{sIndex + 1}</span>
                                                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-sm">
                                                            <User className="w-5 h-5" />
                                                        </div>
                                                        <h3 className="font-bold text-gray-900 text-base tracking-tight">Supervisor :- {section.supervisor}</h3>
                                                    </div>
                                                    <div className="absolute right-0">
                                                        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                                    </div>
                                                </div>

                                                {/* Bottom row: Stat chips centered */}
                                                <div className="flex items-center justify-center gap-3 flex-wrap w-full">
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-100 min-w-[90px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-purple-500 font-semibold">Zonal</div>
                                                        <div className="text-sm font-bold text-purple-800">{section.zonal}</div>
                                                    </div>
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 min-w-[70px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Wards</div>
                                                        <div className="text-sm font-bold text-slate-800">{section.wards.length}</div>
                                                    </div>
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-cyan-50 border border-cyan-100 min-w-[70px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-cyan-500 font-semibold">Routes</div>
                                                        <div className="text-sm font-bold text-cyan-800">{section.wards.reduce((s, w) => s + w.vehicles.length, 0)}</div>
                                                    </div>
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100 min-w-[80px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold">Ward POI</div>
                                                        <div className="text-sm font-bold text-amber-800">{secKycPoi > 0 ? secKycPoi.toLocaleString() : '-'}</div>
                                                    </div>
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[80px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-blue-500 font-semibold">On Route</div>
                                                        <div className="text-sm font-bold text-blue-800">{secOnRoute.toLocaleString()}</div>
                                                    </div>
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[80px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-emerald-500 font-semibold">Visited</div>
                                                        <div className="text-sm font-bold text-emerald-800">{secVisited.toLocaleString()}</div>
                                                    </div>
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 min-w-[100px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Coverage</div>
                                                        <div className="flex items-center justify-center gap-2 mt-0.5">
                                                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                                                                <div className={`h-full rounded-full ${colors.bar} transition-all duration-500`} style={{ width: `${Math.min(secCoverage, 100)}%` }}></div>
                                                            </div>
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-extrabold ${colors.bg} ${colors.text}`}>
                                                                {secCoverage.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="border-t border-black">
                                                    <table className="w-full text-left border-collapse border border-black">
                                                        <thead>
                                                            <tr className="bg-gray-800 text-white">
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border border-black">Ward</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border border-black">Vehicle</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border border-black">Type</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border border-black">Route</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right border border-black">Ward POI</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right border border-black">On Route</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right border border-black">Visited</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right border border-black">Coverage</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border border-black">Remark</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {section.wards.map((ward) => (
                                                                <React.Fragment key={ward.wardName}>
                                                                    {ward.vehicles.map((v, vi) => {
                                                                        const vColors = getCoverageColor(v.coverage);
                                                                        return (
                                                                            <tr key={`${ward.wardName}-${vi}`} className="hover:bg-gray-50 transition-colors">
                                                                                <td className="px-4 py-2 text-sm border border-black">
                                                                                    {vi === 0 ? <span className="font-semibold text-gray-900">{ward.wardName}</span> : null}
                                                                                </td>
                                                                                <td className="px-4 py-2 text-sm text-gray-700 font-mono border border-black">{v.vehicleNumber || '-'}</td>
                                                                                <td className="px-4 py-2 text-sm text-gray-500 text-xs border border-black">{v.vehicleType || '-'}</td>
                                                                                <td className="px-4 py-2 text-sm text-gray-500 border border-black">{v.routeName}</td>
                                                                                <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium border border-black">{vi === 0 && ward.wardKycPoi > 0 ? ward.wardKycPoi.toLocaleString() : vi === 0 ? '-' : ''}</td>
                                                                                <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium border border-black">{v.total}</td>
                                                                                <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium border border-black">{v.covered}</td>
                                                                                <td className="px-4 py-2 text-right border border-black">
                                                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${vColors.bg} ${vColors.text}`}>
                                                                                        {v.coverage.toFixed(1)}%
                                                                                    </span>
                                                                                </td>
                                                                                {(() => {
                                                                                    const remark = getVehicleRemark(v.vehicleType, v.total); return (
                                                                                        <td className={`px-4 py-2 text-xs font-semibold border border-black ${remark.isOk ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                                                                                            {remark.text}
                                                                                        </td>
                                                                                    );
                                                                                })()}
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                    <tr className="bg-blue-50">
                                                                        <td className="px-4 py-2 text-xs font-bold text-blue-800 border border-black" colSpan={4}>Ward {ward.wardNumber} Subtotal</td>
                                                                        <td className="px-4 py-2 text-xs font-bold text-blue-800 text-right border border-black">{ward.wardKycPoi > 0 ? ward.wardKycPoi.toLocaleString() : '-'}</td>
                                                                        <td className="px-4 py-2 text-xs font-bold text-blue-800 text-right border border-black">{ward.totalPoi}</td>
                                                                        <td className="px-4 py-2 text-xs font-bold text-blue-800 text-right border border-black">{ward.visitedPoi}</td>
                                                                        <td className="px-4 py-2 text-right border border-black">
                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${getCoverageColor(ward.coveragePercentage).bg} ${getCoverageColor(ward.coveragePercentage).text}`}>
                                                                                {ward.coveragePercentage.toFixed(1)}%
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-2 border border-black"></td>
                                                                    </tr>
                                                                </React.Fragment>
                                                            ))}
                                                            {(() => {
                                                                const gtKyc = section.wards.reduce((s, w) => s + w.wardKycPoi, 0);
                                                                const gtTotal = section.wards.reduce((s, w) => s + w.vehicles.reduce((vs, v) => vs + v.total, 0), 0);
                                                                const gtVisited = section.wards.reduce((s, w) => s + w.vehicles.reduce((vs, v) => vs + v.covered, 0), 0);
                                                                const gtCoverage = gtTotal > 0 ? (gtVisited / gtTotal) * 100 : 0;
                                                                return (
                                                                    <tr className="bg-gray-900 text-white">
                                                                        <td className="px-4 py-3 text-sm font-bold border border-black" colSpan={4}>{section.supervisor} — Grand Total</td>
                                                                        <td className="px-4 py-3 text-sm font-bold text-right border border-black">{gtKyc > 0 ? gtKyc.toLocaleString() : '-'}</td>
                                                                        <td className="px-4 py-3 text-sm font-bold text-right border border-black">{gtTotal.toLocaleString()}</td>
                                                                        <td className="px-4 py-3 text-sm font-bold text-right border border-black">{gtVisited.toLocaleString()}</td>
                                                                        <td className="px-4 py-3 text-right border border-black">
                                                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-gray-900">
                                                                                {gtCoverage.toFixed(1)}%
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-4 py-3 border border-black"></td>
                                                                    </tr>
                                                                );
                                                            })()}
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
                                {wardSections.map((ward, wIndex) => {
                                    const isExpanded = expandedSupervisors.has(ward.wardName);
                                    const wTotal = ward.vehicles.reduce((s, v) => s + v.total, 0);
                                    const wVisited = ward.vehicles.reduce((s, v) => s + v.covered, 0);
                                    const wCoverage = wTotal > 0 ? (wVisited / wTotal) * 100 : 0;
                                    const colors = getCoverageColor(wCoverage);

                                    return (
                                        <div key={ward.wardName} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow duration-200">
                                            <div
                                                className="flex flex-col items-center p-4 cursor-pointer hover:bg-gradient-to-r hover:from-indigo-50/60 hover:to-transparent transition-all duration-200 border-l-4 border-l-indigo-500"
                                                onClick={() => toggleSupervisor(ward.wardName)}
                                            >
                                                {/* Top row: Sr.No + Icon + Name + Chevron */}
                                                <div className="flex items-center justify-center w-full mb-3 relative">
                                                    <div className="flex items-center gap-3">
                                                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-700 text-xs font-bold">{wIndex + 1}</span>
                                                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                                                            <Building2 className="w-5 h-5" />
                                                        </div>
                                                        <h3 className="font-bold text-gray-900 text-base tracking-tight">Ward :- {ward.wardName}</h3>
                                                    </div>
                                                    <div className="absolute right-0">
                                                        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                                                    </div>
                                                </div>

                                                {/* Bottom row: Stat chips centered */}
                                                <div className="flex items-center justify-center gap-3 flex-wrap w-full">
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-100 min-w-[90px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-orange-500 font-semibold">Supervisor</div>
                                                        <div className="text-sm font-bold text-orange-800">{ward.supervisor}</div>
                                                    </div>
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-100 min-w-[90px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-purple-500 font-semibold">Zonal</div>
                                                        <div className="text-sm font-bold text-purple-800">{ward.zonal}</div>
                                                    </div>
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 min-w-[70px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Vehicles</div>
                                                        <div className="text-sm font-bold text-slate-800">{ward.vehicles.length}</div>
                                                    </div>
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-cyan-50 border border-cyan-100 min-w-[70px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-cyan-500 font-semibold">Routes</div>
                                                        <div className="text-sm font-bold text-cyan-800">{ward.vehicles.length}</div>
                                                    </div>
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100 min-w-[80px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-amber-500 font-semibold">Ward POI</div>
                                                        <div className="text-sm font-bold text-amber-800">{ward.wardKycPoi > 0 ? ward.wardKycPoi.toLocaleString() : '-'}</div>
                                                    </div>
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 min-w-[80px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-blue-500 font-semibold">On Route</div>
                                                        <div className="text-sm font-bold text-blue-800">{wTotal.toLocaleString()}</div>
                                                    </div>
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 min-w-[80px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-emerald-500 font-semibold">Visited</div>
                                                        <div className="text-sm font-bold text-emerald-800">{wVisited.toLocaleString()}</div>
                                                    </div>
                                                    <div className="text-center px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 min-w-[100px]">
                                                        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Coverage</div>
                                                        <div className="flex items-center justify-center gap-2 mt-0.5">
                                                            <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                                                                <div className={`h-full rounded-full ${colors.bar} transition-all duration-500`} style={{ width: `${Math.min(wCoverage, 100)}%` }}></div>
                                                            </div>
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-extrabold ${colors.bg} ${colors.text}`}>
                                                                {wCoverage.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="border-t border-black">
                                                    <table className="w-full text-left border-collapse border border-black">
                                                        <thead>
                                                            <tr className="bg-gray-800 text-white">
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border border-black">Vehicle</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border border-black">Type</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border border-black">Route</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right border border-black">On Route</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right border border-black">Visited</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-right border border-black">Coverage</th>
                                                                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border border-black">Remark</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {ward.vehicles.map((v, vi) => {
                                                                const vColors = getCoverageColor(v.coverage);
                                                                return (
                                                                    <tr key={vi} className="hover:bg-gray-50 transition-colors">
                                                                        <td className="px-4 py-2 text-sm text-gray-700 font-mono border border-black">{v.vehicleNumber || '-'}</td>
                                                                        <td className="px-4 py-2 text-sm text-gray-500 text-xs border border-black">{v.vehicleType || '-'}</td>
                                                                        <td className="px-4 py-2 text-sm text-gray-500 border border-black">{v.routeName}</td>
                                                                        <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium border border-black">{v.total}</td>
                                                                        <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium border border-black">{v.covered}</td>
                                                                        <td className="px-4 py-2 text-right border border-black">
                                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${vColors.bg} ${vColors.text}`}>
                                                                                {v.coverage.toFixed(1)}%
                                                                            </span>
                                                                        </td>
                                                                        {(() => {
                                                                            const remark = getVehicleRemark(v.vehicleType, v.total); return (
                                                                                <td className={`px-4 py-2 text-xs font-semibold border border-black ${remark.isOk ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'}`}>
                                                                                    {remark.text}
                                                                                </td>
                                                                            );
                                                                        })()}
                                                                    </tr>
                                                                );
                                                            })}
                                                            <tr className="bg-gray-900 text-white">
                                                                <td className="px-4 py-3 text-sm font-bold border border-black" colSpan={3}>Ward Total</td>
                                                                <td className="px-4 py-3 text-sm font-bold text-right border border-black">{wTotal.toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-sm font-bold text-right border border-black">{wVisited.toLocaleString()}</td>
                                                                <td className="px-4 py-3 text-right border border-black">
                                                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-gray-900">
                                                                        {wCoverage.toFixed(1)}%
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 border border-black"></td>
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
