import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import { Upload, Download, TrendingUp, TrendingDown, CheckCircle, AlertCircle, MapPin, Image as ImageIcon, FileText, MessageCircle, Play, Pause, StopCircle, Bot, SkipForward, Camera } from 'lucide-react';
import supervisorDataJson from '../data/supervisorData.json';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportToJPEG } from '../utils/exporter';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend
} from 'recharts';

interface POIRow {
    "S.No.": string;
    "Zone & Circle": string;
    "Ward Name": string;
    "Vehicle Number": string;
    "Route Name": string;
    "Total": string;
    "Covered": string;
    "Not Covered": string;
    "Coverage": string;
    "Date": string;
    "Start Time": string;
    "End Time": string;
}

interface AggregatedStats {
    supervisorName: string;
    zonalHead: string;
    zone: string;
    total: number;
    covered: number;
    notCovered: number;
    wardCount: number;
    wards: string[];
    vehicles: string[];
}

interface WardStats {
    wardNumber: string;
    wardName: string;
    routeName: string;
    supervisorName: string;
    zonalHead: string;
    total: number;
    covered: number;
    notCovered: number;
    vehicles: string[];
}

interface CoverageReportProps {
    initialMode?: 'dashboard' | 'supervisor' | 'ward' | 'mapping' | 'all';
}

const getBase64ImageFromURL = (url: string) => {
    return new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.setAttribute("crossOrigin", "anonymous");
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                const dataURL = canvas.toDataURL("image/png");
                resolve(dataURL);
            } else {
                reject(new Error("Could not get canvas context"));
            }
        };
        img.onerror = (error) => reject(error);
        img.src = url;
    });
};

export const CoverageReport: React.FC<CoverageReportProps> = ({ initialMode = 'dashboard' }) => {
    const [stats, setStats] = useState<AggregatedStats[]>([]);
    const [wardStats, setWardStats] = useState<WardStats[]>([]);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState<string>('');
    const [viewType, setViewType] = useState<'dashboard' | 'supervisor' | 'ward' | 'mapping' | 'all'>(initialMode);

    // Sync view with prop when sidebar link is clicked
    React.useEffect(() => {
        if (initialMode) setViewType(initialMode);
    }, [initialMode]);


    const [selectedZone, setSelectedZone] = useState('All');
    const [selectedSupervisor, setSelectedSupervisor] = useState('All');
    const [selectedWard, setSelectedWard] = useState('All');

    const [isAutoSharing, setIsAutoSharing] = useState(false);
    const [currentShareIndex, setCurrentShareIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(false);

    // Create Ward -> Supervisor Lookup
    const wardLookup = useMemo(() => {
        const lookup = new Map<string, { supervisor: string; zonalHead: string }>();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        supervisorDataJson.forEach((item: any) => {
            // Normalize Ward No to string
            lookup.set(String(item["Ward No"]), {
                supervisor: item.Supervisor,
                zonalHead: item["Zonal Head"]
            });
        });
        return lookup;
    }, []);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setLoading(true);

        Papa.parse<POIRow>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                processData(results.data);
                setLoading(false);
            },
            error: (error) => {
                console.error('Error parsing CSV:', error);
                setLoading(false);
            }
        });
    };

    const processData = (rows: POIRow[]) => {
        const supervisorMap = new Map<string, AggregatedStats>();
        const wardMap = new Map<string, WardStats>();

        rows.forEach(row => {
            const wardNameStr = row["Ward Name"];
            if (!wardNameStr) return;

            // Extract Ward Number (e.g., "18" from "18-General ganj")
            const wardMatch = wardNameStr.match(/^(\d+)/);
            if (!wardMatch) return; // Skip if no number found

            // Normalize ward number by removing leading zeros (e.g., "01" -> "1")
            const wardNum = String(Number(wardMatch[1]));
            const vehicle = row["Vehicle Number"];
            const routeName = row["Route Name"] || "-";

            // Find Supervisor
            const supervisorInfo = wardLookup.get(wardNum) || {
                supervisor: 'Unmapped',
                zonalHead: 'Unmapped'
            };

            // --- Supervisor Aggregation ---
            const supKey = `${supervisorInfo.zonalHead}-${supervisorInfo.supervisor}`;

            if (!supervisorMap.has(supKey)) {
                supervisorMap.set(supKey, {
                    supervisorName: supervisorInfo.supervisor,
                    zonalHead: supervisorInfo.zonalHead,
                    zone: row["Zone & Circle"] || 'Unknown',
                    total: 0,
                    covered: 0,
                    notCovered: 0,
                    wardCount: 0,
                    wards: [],
                    vehicles: []
                });
            }

            const supEntry = supervisorMap.get(supKey)!;
            supEntry.total += Number(row.Total) || 0;
            supEntry.covered += Number(row.Covered) || 0;
            supEntry.notCovered += Number(row["Not Covered"]) || 0;

            if (!supEntry.wards.includes(wardNum)) {
                supEntry.wards.push(wardNum);
                supEntry.wardCount++;
            }
            if (vehicle && !supEntry.vehicles.includes(vehicle)) {
                supEntry.vehicles.push(vehicle);
            }

            // --- Ward Route Aggregation ---
            const wardRouteKey = `${wardNum}_${routeName}`;
            if (!wardMap.has(wardRouteKey)) {
                wardMap.set(wardRouteKey, {
                    wardNumber: wardNum,
                    wardName: row["Ward Name"],
                    routeName: routeName,
                    supervisorName: supervisorInfo.supervisor,
                    zonalHead: supervisorInfo.zonalHead,
                    total: 0,
                    covered: 0,
                    notCovered: 0,
                    vehicles: []
                });
            }

            const wardEntry = wardMap.get(wardRouteKey)!;
            wardEntry.total += Number(row.Total) || 0;
            wardEntry.covered += Number(row.Covered) || 0;
            wardEntry.notCovered += Number(row["Not Covered"]) || 0;
            if (vehicle && !wardEntry.vehicles.includes(vehicle)) {
                wardEntry.vehicles.push(vehicle);
            }
        });

        // Convert Maps to Arrays and Sort
        const sortedSupervisorStats = Array.from(supervisorMap.values()).sort((a, b) => {
            if (a.zonalHead !== b.zonalHead) {
                return a.zonalHead.localeCompare(b.zonalHead);
            }
            const covA = a.total > 0 ? (a.covered / a.total) : 0;
            const covB = b.total > 0 ? (b.covered / b.total) : 0;
            return covB - covA;
        });

        const sortedWardStats = Array.from(wardMap.values()).sort((a, b) => {
            // Sort by Zonal Head, then Supervisor, then Ward Number, then Route
            if (a.zonalHead !== b.zonalHead) return a.zonalHead.localeCompare(b.zonalHead);
            if (a.supervisorName !== b.supervisorName) return a.supervisorName.localeCompare(b.supervisorName);
            if (Number(a.wardNumber) !== Number(b.wardNumber)) return Number(a.wardNumber) - Number(b.wardNumber);
            return a.routeName.localeCompare(b.routeName);
        });

        setStats(sortedSupervisorStats);
        setWardStats(sortedWardStats);
    };

    // --- Filters & Derived Data ---
    const zones = useMemo(() => ['All', ...Array.from(new Set(stats.map(s => s.zonalHead))).sort()], [stats]);

    const supervisors = useMemo(() => {
        let filtered = stats;
        if (selectedZone !== 'All') filtered = filtered.filter(s => s.zonalHead === selectedZone);
        return ['All', ...Array.from(new Set(filtered.map(s => s.supervisorName))).sort()];
    }, [stats, selectedZone]);

    const wards = useMemo(() => {
        let filtered = wardStats;
        if (selectedZone !== 'All') filtered = filtered.filter(w => w.zonalHead === selectedZone);
        if (selectedSupervisor !== 'All') filtered = filtered.filter(w => w.supervisorName === selectedSupervisor);
        return ['All', ...Array.from(new Set(filtered.map(w => w.wardNumber))).sort((a, b) => Number(a) - Number(b))];
    }, [wardStats, selectedZone, selectedSupervisor]);

    const filteredStats = useMemo(() => {
        return stats.filter(item => {
            if (selectedZone !== 'All' && item.zonalHead !== selectedZone) return false;
            if (selectedSupervisor !== 'All' && item.supervisorName !== selectedSupervisor) return false;
            if (selectedWard !== 'All' && !item.wards.includes(selectedWard)) return false;
            return true;
        });
    }, [stats, selectedZone, selectedSupervisor, selectedWard]);

    // Keyboard Shortcuts for Bot
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isAutoSharing && !loading) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleAutoShare();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isAutoSharing, loading, currentShareIndex, filteredStats]);

    // Auto-Pilot Logic
    React.useEffect(() => {
        let timer: any;
        if (isAutoSharing && isAutoPlaying && !loading) {
            timer = setTimeout(() => {
                handleAutoShare();
            }, 3500); // 3.5 second delay for auto-pilot
        }
        return () => clearTimeout(timer);
    }, [isAutoSharing, isAutoPlaying, currentShareIndex, loading]);

    const filteredWardStats = useMemo(() => {
        return wardStats.filter(item => {
            if (selectedZone !== 'All' && item.zonalHead !== selectedZone) return false;
            if (selectedSupervisor !== 'All' && item.supervisorName !== selectedSupervisor) return false;
            if (selectedWard !== 'All' && item.wardNumber !== selectedWard) return false;
            return true;
        });
    }, [wardStats, selectedZone, selectedSupervisor, selectedWard]);

    // --- Chart Data Preparation ---
    const chartData = useMemo(() => {
        const total = filteredStats.reduce((sum, item) => sum + item.total, 0);
        const covered = filteredStats.reduce((sum, item) => sum + item.covered, 0);
        const notCovered = filteredStats.reduce((sum, item) => sum + item.notCovered, 0);
        const coverage = total > 0 ? Math.round((covered / total) * 100) : 0;

        // Group by Zonal Head for the Bar Chart
        const zonalData: Record<string, { total: number, covered: number, notCovered: number }> = {};
        filteredStats.forEach(stat => {
            const head = stat.zonalHead || 'Unassigned';
            if (!zonalData[head]) zonalData[head] = { total: 0, covered: 0, notCovered: 0 };
            zonalData[head].total += stat.total;
            zonalData[head].covered += stat.covered;
            zonalData[head].notCovered += stat.notCovered;
        });

        const barChartData = Object.entries(zonalData).map(([name, data]) => ({
            name,
            Covered: data.covered,
            NotCovered: data.notCovered,
            Total: data.total
        })).sort((a, b) => a.name.localeCompare(b.name));

        const pieChartData = [
            { name: 'Covered', value: covered, color: '#16a34a' },
            { name: 'Not Covered', value: notCovered, color: '#ef4444' }
        ];

        return {
            total,
            covered,
            notCovered,
            coverage,
            barChartData,
            pieChartData
        };
    }, [filteredStats]);

    const exportToExcel = () => {
        const wb = XLSX.utils.book_new();

        // Sheet 1: Supervisor Wise
        const supervisorData = stats.map(item => ({
            "Zonal Head": item.zonalHead,
            "Supervisor": item.supervisorName,
            "Wards Count": item.wardCount,
            "Assigned Vehicles": item.vehicles.join(", "),
            "Total POI": item.total,
            "Covered": item.covered,
            "Not Covered": item.notCovered,
            "Coverage %": item.total > 0 ? ((item.covered / item.total) * 100).toFixed(2) + '%' : '0%'
        }));
        const wsSupervisor = XLSX.utils.json_to_sheet(supervisorData);
        XLSX.utils.book_append_sheet(wb, wsSupervisor, "Supervisor Wise");

        // Sheet 2: Ward Route Wise
        const wardData = wardStats.map(item => ({
            "Zonal Head": item.zonalHead,
            "Supervisor": item.supervisorName,
            "Ward": item.wardName,
            "Route Name": item.routeName,
            "Assigned Vehicles": item.vehicles.join(", "),
            "Total POI": item.total,
            "Covered": item.covered,
            "Not Covered": item.notCovered,
            "Coverage %": item.total > 0 ? ((item.covered / item.total) * 100).toFixed(2) + '%' : '0%'
        }));
        const wsWard = XLSX.utils.json_to_sheet(wardData);
        XLSX.utils.book_append_sheet(wb, wsWard, "Ward & Route Wise");

        XLSX.writeFile(wb, "Coverage_Report.xlsx");
    };

    const exportToZonalPDF = () => {
        const doc = new jsPDF();

        // Group by Zonal Head
        const zonalSummary = stats.reduce((acc, curr) => {
            if (!acc[curr.zonalHead]) {
                acc[curr.zonalHead] = {
                    total: 0,
                    covered: 0,
                    notCovered: 0,
                    supervisorCount: 0
                };
            }
            acc[curr.zonalHead].total += curr.total;
            acc[curr.zonalHead].covered += curr.covered;
            acc[curr.zonalHead].notCovered += curr.notCovered;
            acc[curr.zonalHead].supervisorCount++;
            return acc;
        }, {} as Record<string, any>);

        const tableColumn = ["Zonal Head", "Supervisors", "Total POI", "Covered", "Not Covered", "Coverage %"];
        const tableRows = Object.entries(zonalSummary).sort((a, b) => a[0].localeCompare(b[0])).map(([head, data]) => [
            head,
            data.supervisorCount,
            data.total.toLocaleString(),
            data.covered.toLocaleString(),
            data.notCovered.toLocaleString(),
            (data.total > 0 ? (data.covered / data.total * 100).toFixed(2) : '0') + '%'
        ]);

        doc.setFontSize(18);
        doc.text("POI Coverage Zonal Summary Report", 14, 20);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            theme: 'striped',
            headStyles: { fillColor: [22, 163, 74], halign: 'center' },
            columnStyles: {
                0: { fontStyle: 'bold' },
                1: { halign: 'center' },
                2: { halign: 'center' },
                3: { halign: 'center' },
                4: { halign: 'center' },
                5: { halign: 'center', fontStyle: 'bold' }
            },
            didParseCell: (data) => {
                if (data.section === 'body' && data.column.index === 5) {
                    const rowRaw = data.cell.raw as string;
                    const val = parseFloat(rowRaw.replace('%', ''));
                    if (val >= 90) data.cell.styles.textColor = [22, 101, 52];
                    else if (val < 75) data.cell.styles.textColor = [153, 27, 27];
                }
            }
        });

        doc.save("Zonal_Coverage_Report.pdf");
    };

    const exportCompletePerformancePDF = async () => {
        if (filteredStats.length === 0) return;
        setLoading(true);
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        try {
            // Load logos
            const logoLeft = await getBase64ImageFromURL('/nagar-nigam-logo.png').catch(() => null);
            const logoRight = await getBase64ImageFromURL('/NatureGreen_Logo.png').catch(() => null);

            for (let i = 0; i < filteredStats.length; i++) {
                const supervisor = filteredStats[i];
                const supervisorWards = filteredWardStats.filter(w =>
                    w.supervisorName === supervisor.supervisorName &&
                    w.zonalHead === supervisor.zonalHead
                );

                if (supervisorWards.length === 0) continue;

                if (i > 0) doc.addPage();

                // 1. Draw Outer Border (Green)
                doc.setDrawColor(22, 163, 74);
                doc.setLineWidth(1.5);
                doc.rect(5, 5, pageWidth - 10, pageHeight - 10);

                // 2. Logos Section
                if (logoLeft) doc.addImage(logoLeft, 'PNG', 10, 10, 30, 15);
                if (logoRight) doc.addImage(logoRight, 'PNG', pageWidth - 40, 10, 30, 15);

                // 3. Header Title
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(31, 41, 55);
                doc.text("Coverage Report", pageWidth / 2, 18, { align: 'center' });
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(75, 85, 99);
                doc.text("Point of Interest Analysis", pageWidth / 2, 23, { align: 'center' });

                // 4. DESIGNATION SECTIONS
                doc.setDrawColor(22, 163, 74);
                doc.setLineWidth(0.5);

                // Zonal Head
                doc.line(10, 35, pageWidth - 10, 35);
                doc.setFontSize(7);
                doc.setTextColor(107, 114, 128);
                doc.text("ZONAL HEAD", pageWidth / 2, 40, { align: 'center' });
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(17, 24, 39);
                doc.text(supervisor.zonalHead, pageWidth / 2, 47, { align: 'center' });

                // Supervisor
                doc.line(10, 52, pageWidth - 10, 52);
                doc.setFontSize(7);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(107, 114, 128);
                doc.text("SUPERVISOR", pageWidth / 2, 57, { align: 'center' });
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(17, 24, 39);
                doc.text(supervisor.supervisorName, pageWidth / 2, 65, { align: 'center' });

                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(55, 65, 81);
                doc.text(`Vehicles: ${supervisor.vehicles.join(", ")}`, pageWidth / 2, 71, { align: 'center' });

                // 5. STATS ROW
                doc.line(10, 76, pageWidth - 10, 76);
                const statsY = 82;

                doc.setFontSize(7);
                doc.setTextColor(107, 114, 128);
                doc.text("WARDS", pageWidth / 2 - 45, statsY, { align: 'center' });
                doc.text("TOTAL POI", pageWidth / 2, statsY, { align: 'center' });
                doc.text("COVERAGE", pageWidth / 2 + 45, statsY, { align: 'center' });

                doc.setFontSize(13);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(17, 24, 39);
                doc.text(String(supervisor.wardCount), pageWidth / 2 - 45, statsY + 7, { align: 'center' });
                doc.text(supervisor.total.toLocaleString(), pageWidth / 2, statsY + 7, { align: 'center' });

                const cov = supervisor.total > 0 ? (supervisor.covered / supervisor.total * 100).toFixed(1) : '0';
                doc.setTextColor(22, 163, 74);
                doc.text(`${cov}%`, pageWidth / 2 + 45, statsY + 7, { align: 'center' });

                // 6. WARD TABLE
                const tableColumn = ["Ward Name", "Route Name", "Vehicles", "Total", "Covered", "Not Covered", "Coverage %"];
                const tableRows = supervisorWards.map(w => [
                    w.wardName,
                    w.routeName,
                    w.vehicles.join(", "),
                    w.total.toLocaleString(),
                    w.covered.toLocaleString(),
                    w.notCovered.toLocaleString(),
                    (w.total > 0 ? (w.covered / w.total * 100).toFixed(1) : '0') + '%'
                ]);

                autoTable(doc, {
                    head: [tableColumn],
                    body: tableRows,
                    startY: 95,
                    margin: { left: 10, right: 10, bottom: 15 },
                    theme: 'grid',
                    headStyles: {
                        fillColor: [22, 163, 74],
                        textColor: [255, 255, 255],
                        halign: 'center',
                        fontSize: 8,
                        fontStyle: 'bold'
                    },
                    styles: {
                        fontSize: 7.5,
                        halign: 'center',
                        cellPadding: 2,
                        minCellHeight: 8
                    },
                    columnStyles: {
                        0: { halign: 'center', fontStyle: 'bold', cellWidth: 30 },
                        1: { halign: 'center', cellWidth: 20 },
                        2: { halign: 'center', cellWidth: 45 },
                        6: { fontStyle: 'bold' }
                    },
                    didDrawPage: () => {
                        // Add page number to footer
                        doc.setFontSize(8);
                        doc.setTextColor(156, 163, 175);
                        doc.text(
                            `Page ${doc.getNumberOfPages()}`,
                            pageWidth / 2,
                            pageHeight - 7,
                            { align: 'center' }
                        );
                    }
                });
            }

            doc.save(`Complete_Coverage_Report_${new Date().toLocaleDateString()}.pdf`);
        } catch (err) {
            console.error("Complete PDF generation failed:", err);
            alert("Error generating complete PDF. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleAutoShare = async () => {
        if (currentShareIndex >= filteredStats.length) {
            setIsAutoSharing(false);
            setCurrentShareIndex(0);
            return;
        }

        setLoading(true);
        const supervisor = filteredStats[currentShareIndex];
        const cardId = `supervisor-bot-card`;

        try {
            // Give React a moment to render the hidden card if needed
            await new Promise(resolve => setTimeout(resolve, 500));

            // 1. Take Screenshot
            await exportToJPEG(cardId, `${supervisor.supervisorName}_Coverage_Report`);

            // 2. Prepare Text
            const cov = supervisor.total > 0 ? (supervisor.covered / supervisor.total * 100).toFixed(1) : '0';
            const text = `🚩 *POI Coverage Report*\n\n🏆 *Supervisor:* ${supervisor.supervisorName}\n🏢 *Zone:* ${supervisor.zonalHead}\n📍 *Total Wards:* ${supervisor.wardCount}\n📍 *Total POI:* ${supervisor.total}\n✅ *Covered:* ${supervisor.covered}\n❌ *Pending:* ${supervisor.notCovered}\n📊 *Coverage:* ${cov}%\n\n_Auto-shared by Coverage Bot_`;

            // 3. Open WhatsApp
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');

            // Move to next
            if (currentShareIndex < filteredStats.length - 1) {
                setCurrentShareIndex(prev => prev + 1);
            } else {
                setIsAutoSharing(false);
                setCurrentShareIndex(0);
            }
        } catch (err) {
            console.error("Bot screenshot failed:", err);
            alert("Could not capture screenshot. Sending text only.");
            const cov = supervisor.total > 0 ? (supervisor.covered / supervisor.total * 100).toFixed(1) : '0';
            const text = `🚩 *POI Coverage Report*\n\n🏆 *Supervisor:* ${supervisor.supervisorName}\n🏢 *Zone:* ${supervisor.zonalHead}\n📍 *Total Wards:* ${supervisor.wardCount}\n📍 *Total POI:* ${supervisor.total}\n✅ *Covered:* ${supervisor.covered}\n❌ *Pending:* ${supervisor.notCovered}\n📊 *Coverage:* ${cov}%\n\n_Auto-shared by Coverage Bot_`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
            if (currentShareIndex < filteredStats.length - 1) {
                setCurrentShareIndex(prev => prev + 1);
            } else {
                setIsAutoSharing(false);
                setCurrentShareIndex(0);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Header / Upload Section */}
            {stats.length === 0 && (
                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 text-center max-w-2xl mx-auto mt-8">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Upload className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Coverage Analysis</h2>
                    <p className="text-gray-500 mb-8">
                        Upload the POI Report CSV to visualize coverage across wards and supervisors.
                    </p>
                    <div className="flex items-center justify-center w-full mb-4">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <p className="mb-2 text-sm text-gray-500">
                                    <span className="font-semibold">Click to upload POI CSV</span>
                                </p>
                                <p className="text-xs text-gray-500">
                                    {fileName || "Supported format: .csv"}
                                </p>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                accept=".csv"
                                onChange={handleFileUpload}
                                disabled={loading}
                            />
                        </label>
                    </div>
                </div>
            )}

            {stats.length > 0 && (
                <>
                    {/* Hidden Bot Capture Area */}
                    {isAutoSharing && (
                        <div className="fixed -left-[2000px] top-0 w-[1000px]" data-html2canvas-ignore="false">
                            {filteredStats[currentShareIndex] && (
                                <div id="supervisor-bot-card" className="bg-white p-4">
                                    {(() => {
                                        const supervisor = filteredStats[currentShareIndex];
                                        const supervisorWards = wardStats.filter(w =>
                                            w.supervisorName === supervisor.supervisorName &&
                                            w.zonalHead === supervisor.zonalHead
                                        );
                                        const supCoverage = supervisor.total > 0 ? (supervisor.covered / supervisor.total) * 100 : 0;
                                        const isSupHigh = supCoverage >= 90;
                                        const isSupLow = supCoverage < 75;

                                        return (
                                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden w-[800px] mx-auto">
                                                {/* Replicating the professional card header */}
                                                <div className="bg-gray-100 p-8 border-4 border-green-600 shadow-lg">
                                                    <div className="grid grid-cols-3 items-center mb-6 pb-4 border-b-2 border-green-500 gap-4">
                                                        <div className="flex items-center justify-start">
                                                            <img src="/nagar-nigam-logo.png" alt="Logo" className="h-20 w-auto" />
                                                        </div>
                                                        <div className="text-center">
                                                            <h1 className="text-xl font-bold text-gray-900">Coverage Report</h1>
                                                            <p className="text-sm text-gray-600">Official Analysis Dashboard</p>
                                                        </div>
                                                        <div className="flex justify-end">
                                                            <img src="/NatureGreen_Logo.png" alt="Logo" className="h-20 w-auto" />
                                                        </div>
                                                    </div>
                                                    <div className="text-center mb-6 pb-4 border-b-2 border-green-500">
                                                        <span className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em] mb-2 block">Manager / Zonal Head</span>
                                                        <h2 className="text-2xl font-black text-gray-900 tracking-wider">{supervisor.zonalHead}</h2>
                                                    </div>
                                                    <div className="text-center mb-6 pb-4 border-b-2 border-green-500">
                                                        <span className="text-gray-500 text-xs font-bold uppercase tracking-[0.2em] mb-2 block">Field Supervisor</span>
                                                        <h3 className="text-3xl font-black text-gray-900 tracking-wider transition-all">{supervisor.supervisorName}</h3>
                                                    </div>
                                                    <div className="flex items-center justify-center gap-12 text-center">
                                                        <div>
                                                            <span className="block text-xs text-gray-500 font-bold uppercase mb-1">Total POI</span>
                                                            <span className="text-3xl font-black text-gray-900">{supervisor.total}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-xs text-gray-500 font-bold uppercase mb-1">Covered</span>
                                                            <span className="text-3xl font-black text-green-600">{supervisor.covered}</span>
                                                        </div>
                                                        <div>
                                                            <span className="block text-xs text-gray-500 font-bold uppercase mb-1">Percentage</span>
                                                            <span className={`text-3xl font-black ${isSupHigh ? 'text-green-600' : isSupLow ? 'text-red-600' : 'text-yellow-600'}`}>
                                                                {supCoverage.toFixed(1)}%
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="p-4">
                                                    <table className="w-full text-base border-collapse">
                                                        <thead className="bg-green-600 text-white">
                                                            <tr>
                                                                <th className="p-3 border border-gray-300 font-bold">Ward Name</th>
                                                                <th className="p-3 border border-gray-300 font-bold">Route</th>
                                                                <th className="p-3 border border-gray-300 font-bold text-center">Total</th>
                                                                <th className="p-3 border border-gray-300 font-bold text-center">Covered</th>
                                                                <th className="p-3 border border-gray-300 font-bold text-center">Coverage %</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {supervisorWards.map((w, idx) => (
                                                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-green-50/30'}>
                                                                    <td className="p-3 border border-gray-200 font-bold text-gray-800">{w.wardName}</td>
                                                                    <td className="p-3 border border-gray-200 text-gray-600 italic">{w.routeName}</td>
                                                                    <td className="p-3 border border-gray-200 text-center font-mono font-bold">{w.total}</td>
                                                                    <td className="p-3 border border-gray-200 text-center font-mono font-bold text-green-600">{w.covered}</td>
                                                                    <td className="p-3 border border-gray-200 text-center font-black">
                                                                        {(w.total > 0 ? (w.covered / w.total * 100) : 0).toFixed(1)}%
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Summary Cards - Only on Dashboard */}
                    {viewType === 'dashboard' && (
                        <div id="coverage-report-container" className="space-y-6 mb-8">
                            {/* Professional Logo Header */}
                            <div className="bg-white rounded-xl shadow-lg border-2 border-green-100 p-6">
                                <div className="grid grid-cols-3 items-center gap-6">
                                    {/* Left Side - Nagar Nigam Logo */}
                                    <div className="flex flex-col items-center sm:items-start">
                                        <img
                                            src="/nagar-nigam-logo.png"
                                            alt="Nagar Nigam Logo"
                                            className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm"
                                        />
                                        <p className="hidden sm:block text-[10px] font-bold text-blue-800 mt-2 uppercase tracking-tight text-center sm:text-left">
                                            Nagar Nigam<br />Mathura-Vrindavan
                                        </p>
                                    </div>

                                    {/* Center - Title Section */}
                                    <div className="text-center flex flex-col items-center justify-center">
                                        <div className="bg-green-50 px-4 py-1 rounded-full mb-3">
                                            <span className="text-[10px] font-bold text-green-600 uppercase tracking-[0.2em]">POI Coverage Report</span>
                                        </div>
                                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">
                                            POI COVERAGE<br />
                                            <span className="text-green-600">ANALYTICS</span>
                                        </h1>
                                        <div className="h-1 w-20 bg-green-600 rounded-full mb-2"></div>
                                        <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-widest">
                                            Point of Interest Monitoring
                                        </p>
                                    </div>

                                    {/* Right Side - Nature Green Logo */}
                                    <div className="flex flex-col items-center sm:items-end">
                                        <img
                                            src="/NatureGreen_Logo.png"
                                            alt="Nature Green Logo"
                                            className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm"
                                        />
                                        <p className="hidden sm:block text-[10px] font-bold text-green-700 mt-2 uppercase tracking-tight text-center sm:text-right">
                                            Nature Green<br />Waste Management
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white rounded-xl shadow-sm p-6 border border-blue-200 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Total POI</p>
                                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{chartData.total.toLocaleString()}</h3>
                                            <p className="text-[10px] text-gray-400 font-semibold mt-1 uppercase">Across All Zones</p>
                                        </div>
                                        <div className="p-2 bg-blue-50 rounded-lg">
                                            <MapPin className="w-5 h-5 text-blue-600" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm p-6 border border-green-200 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Covered POI</p>
                                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{chartData.covered.toLocaleString()}</h3>
                                            <p className="text-[10px] text-green-600 font-bold mt-1 uppercase flex items-center gap-1">
                                                <TrendingUp className="w-3 h-3" />
                                                {chartData.coverage}% Achieved
                                            </p>
                                        </div>
                                        <div className="p-2 bg-green-50 rounded-lg">
                                            <CheckCircle className="w-5 h-5 text-green-600" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm p-6 border border-red-200 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Not Covered</p>
                                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{chartData.notCovered.toLocaleString()}</h3>
                                            <p className="text-[10px] text-red-600 font-bold mt-1 uppercase flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" />
                                                {100 - chartData.coverage}% Remaining
                                            </p>
                                        </div>
                                        <div className="p-2 bg-red-50 rounded-lg">
                                            <AlertCircle className="w-5 h-5 text-red-600" />
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-xl shadow-sm p-6 border border-purple-200 hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">Overall Coverage</p>
                                            <h3 className="text-2xl font-bold text-gray-900 mt-1">{chartData.coverage}%</h3>
                                            <p className="text-[10px] text-purple-600 font-bold mt-1 uppercase">
                                                {chartData.covered.toLocaleString()} Points Scanned
                                            </p>
                                        </div>
                                        <div className="p-2 bg-purple-50 rounded-lg">
                                            <TrendingUp className="w-5 h-5 text-purple-600" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Zonal Coverage Performance - Split View */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Covered POIs Chart */}
                                <div className="bg-white rounded-xl shadow-sm border-2 border-green-500 p-6">
                                    <div className="h-[400px] w-full relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart margin={{ top: 5, right: 30, bottom: 5, left: 30 }}>
                                                <Pie
                                                    data={chartData.barChartData.map((item) => ({
                                                        name: item.name,
                                                        value: item.Covered,
                                                        total: item.Total,
                                                        coverage: item.Total > 0 ? ((item.Covered / item.Total) * 100).toFixed(1) : '0'
                                                    }))}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={70}
                                                    outerRadius={110}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                    label={(props: any) => {
                                                        const { cx, cy, midAngle, outerRadius, name, value, coverage, index } = props;
                                                        const RADIAN = Math.PI / 180;
                                                        const radius = outerRadius + 30;
                                                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
                                                        const color = colors[index % colors.length];

                                                        return (
                                                            <text
                                                                x={x}
                                                                y={y}
                                                                fill={color}
                                                                textAnchor={x > cx ? 'start' : 'end'}
                                                                dominantBaseline="central"
                                                                fontSize="12"
                                                                fontWeight="600"
                                                            >
                                                                <tspan x={x} dy="0">{name}:</tspan>
                                                                <tspan x={x} dy="14">{value} ({coverage}%)</tspan>
                                                            </text>
                                                        );
                                                    }}
                                                    labelLine={true}
                                                >
                                                    {chartData.barChartData.map((_entry, index) => {
                                                        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
                                                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                                    })}
                                                </Pie>
                                                <Tooltip
                                                    formatter={(_value: any, _name: any, props: any) => [
                                                        `${props.payload?.value || 0} POIs (${props.payload?.coverage || '0'}%)`,
                                                        'Covered'
                                                    ]}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Legend
                                                    verticalAlign="bottom"
                                                    height={36}
                                                />
                                                <text
                                                    x="50%"
                                                    y="46%"
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    style={{ fontSize: '18px', fontWeight: 'bold', fill: '#15803d' }}
                                                >
                                                    Covered
                                                </text>
                                                <text
                                                    x="50%"
                                                    y="54%"
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    style={{ fontSize: '14px', fontWeight: '600', fill: '#16a34a' }}
                                                >
                                                    by Zonals
                                                </text>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Not Covered (Left) POIs Chart */}
                                <div className="bg-white rounded-xl shadow-sm border-2 border-red-500 p-6">
                                    <div className="h-[400px] w-full relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart margin={{ top: 5, right: 30, bottom: 5, left: 30 }}>
                                                <Pie
                                                    data={chartData.barChartData.map((item) => ({
                                                        name: item.name,
                                                        value: item.NotCovered,
                                                        total: item.Total,
                                                        percentage: item.Total > 0 ? (((item.Total - item.Covered) / item.Total) * 100).toFixed(1) : '0'
                                                    }))}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={70}
                                                    outerRadius={110}
                                                    paddingAngle={3}
                                                    dataKey="value"
                                                    label={(props: any) => {
                                                        const { cx, cy, midAngle, outerRadius, name, value, percentage, index } = props;
                                                        const RADIAN = Math.PI / 180;
                                                        const radius = outerRadius + 30;
                                                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                                        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
                                                        const color = colors[index % colors.length];

                                                        return (
                                                            <text
                                                                x={x}
                                                                y={y}
                                                                fill={color}
                                                                textAnchor={x > cx ? 'start' : 'end'}
                                                                dominantBaseline="central"
                                                                fontSize="12"
                                                                fontWeight="600"
                                                            >
                                                                <tspan x={x} dy="0">{name}:</tspan>
                                                                <tspan x={x} dy="14">{value} ({percentage}%)</tspan>
                                                            </text>
                                                        );
                                                    }}
                                                    labelLine={true}
                                                >
                                                    {chartData.barChartData.map((_entry, index) => {
                                                        const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];
                                                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                                                    })}
                                                </Pie>
                                                <Tooltip
                                                    formatter={(_value: any, _name: any, props: any) => [
                                                        `${props.payload?.value || 0} POIs (${props.payload?.percentage || '0'}%)`,
                                                        'Not Covered'
                                                    ]}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Legend
                                                    verticalAlign="bottom"
                                                    height={36}
                                                />
                                                <text
                                                    x="50%"
                                                    y="46%"
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    style={{ fontSize: '18px', fontWeight: 'bold', fill: '#b91c1c' }}
                                                >
                                                    Left
                                                </text>
                                                <text
                                                    x="50%"
                                                    y="54%"
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    style={{ fontSize: '14px', fontWeight: '600', fill: '#dc2626' }}
                                                >
                                                    by Zonals
                                                </text>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            {/* Overall Coverage Chart with Detailed Stats */}
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                                <div className="flex flex-col md:flex-row items-center gap-8">
                                    {/* Left Side: Chart */}
                                    <div className="w-full md:w-1/2">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4">Overall Coverage Status</h3>
                                        <div className="h-[300px] w-full relative">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={chartData.pieChartData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={75}
                                                        outerRadius={105}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                        stroke="none"
                                                    >
                                                        {chartData.pieChartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                                    />
                                                    <Legend verticalAlign="bottom" height={36} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                            {/* Centered Percentage */}
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none mb-8">
                                                <div className="text-center">
                                                    <span className="block text-4xl font-black text-gray-900 leading-none">{chartData.coverage}%</span>
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Total Progress</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Side: Detailed Breakdown */}
                                    <div className="w-full md:w-1/2 space-y-4">
                                        <div className="grid grid-cols-1 gap-3">
                                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-semibold text-gray-600">Total Points of Interest</span>
                                                    <MapPin className="w-4 h-4 text-gray-400" />
                                                </div>
                                                <div className="text-2xl font-bold text-gray-900">{chartData.total.toLocaleString()}</div>
                                                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-gray-400 h-full w-full"></div>
                                                </div>
                                            </div>

                                            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-semibold text-green-700">Successfully Covered</span>
                                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                                </div>
                                                <div className="text-2xl font-bold text-green-900">{chartData.covered.toLocaleString()}</div>
                                                <div className="mt-2 w-full bg-green-200 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-green-600 h-full transition-all duration-1000" style={{ width: `${chartData.coverage}%` }}></div>
                                                </div>
                                            </div>

                                            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-semibold text-red-700">Points Remaining (Left)</span>
                                                    <AlertCircle className="w-4 h-4 text-red-500" />
                                                </div>
                                                <div className="text-2xl font-bold text-red-900">{chartData.notCovered.toLocaleString()}</div>
                                                <div className="mt-2 w-full bg-red-200 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-red-600 h-full transition-all duration-1000" style={{ width: `${100 - chartData.coverage}%` }}></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className={`rounded-lg p-3 text-center text-sm font-bold uppercase tracking-wider ${chartData.coverage >= 90 ? 'bg-green-100 text-green-700' :
                                            chartData.coverage >= 75 ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-red-100 text-red-700'
                                            }`}>
                                            {chartData.coverage >= 90 ? 'Excellent Performance' :
                                                chartData.coverage >= 75 ? 'Satisfactory Progress' :
                                                    'Needs Immediate Attention'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div id="coverage-report-container" className="space-y-6">
                        {/* Bot Status Panel */}
                        {isAutoSharing && (
                            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-6 shadow-sm animate-in slide-in-from-top duration-300">
                                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
                                            <Bot className="w-6 h-6 text-green-600" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-green-900">WhatsApp Sharing Bot Active</h4>
                                                {isAutoPlaying && (
                                                    <span className="bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded animate-pulse">AUTO-PILOT ON</span>
                                                )}
                                            </div>
                                            <p className="text-sm text-green-700">
                                                Current: <span className="font-bold underline">{filteredStats[currentShareIndex]?.supervisorName}</span> ({currentShareIndex + 1} of {filteredStats.length})
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {/* Auto-Pilot Toggle */}
                                        <button
                                            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg font-bold text-xs border-2 transition-all ${isAutoPlaying
                                                ? 'bg-red-50 border-red-200 text-red-600'
                                                : 'bg-white border-green-200 text-green-600'
                                                }`}
                                        >
                                            {isAutoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                            {isAutoPlaying ? 'Stop Auto-Pilot' : 'Start Auto-Pilot'}
                                        </button>

                                        <button
                                            onClick={() => {
                                                if (currentShareIndex < filteredStats.length - 1) {
                                                    setCurrentShareIndex(prev => prev + 1);
                                                } else {
                                                    setIsAutoSharing(false);
                                                    setIsAutoPlaying(false);
                                                    setCurrentShareIndex(0);
                                                }
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-semibold text-xs transition-colors"
                                            title="Skip this supervisor"
                                        >
                                            <SkipForward className="w-3 h-3" />
                                            Skip
                                        </button>

                                        <button
                                            onClick={() => {
                                                setIsAutoSharing(false);
                                                setIsAutoPlaying(false);
                                                setCurrentShareIndex(0);
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-semibold text-xs transition-colors"
                                        >
                                            <StopCircle className="w-3 h-3" />
                                            Stop Bot
                                        </button>

                                        {!isAutoPlaying && (
                                            <button
                                                onClick={handleAutoShare}
                                                disabled={loading}
                                                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold text-sm shadow-md hover:shadow-lg transform active:scale-95 transition-all animate-bounce-subtle disabled:opacity-50"
                                            >
                                                {loading ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Camera className="w-4 h-4" />
                                                )}
                                                {loading ? 'Capturing...' : 'Capture & Share'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center gap-4">
                                    <div className="flex-1 bg-white/50 rounded-full h-2 overflow-hidden border border-green-100">
                                        <div
                                            className="bg-green-500 h-full transition-all duration-500"
                                            style={{ width: `${((currentShareIndex) / filteredStats.length) * 100}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-bold text-green-600 uppercase tracking-tighter">
                                            {Math.round(((currentShareIndex) / filteredStats.length) * 100)}% Complete
                                        </span>
                                        <span className="text-[8px] text-gray-500 font-semibold">Press SPACE to share next manually</span>
                                    </div>
                                </div>

                                <div className="mt-2 flex flex-col gap-1">
                                    <div className="text-[10px] text-red-600 font-bold flex items-center gap-1 animate-pulse">
                                        <AlertCircle className="w-3 h-3" />
                                        CRITICAL: Click Address Bar &gt; Pop-ups &gt; "Always allow" to make Auto-Pilot work!
                                    </div>
                                    <div className="text-[9px] text-green-600 font-medium opacity-75">
                                        Bot will capture, download, and open WhatsApp every 3.5 seconds.
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Filter Controls & Table Actions */}
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm" data-html2canvas-ignore="true">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                {viewType !== 'mapping' && (
                                    <>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Zonal Head</label>
                                            <select
                                                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                value={selectedZone}
                                                onChange={(e) => {
                                                    setSelectedZone(e.target.value);
                                                    setSelectedSupervisor('All');
                                                    setSelectedWard('All');
                                                }}
                                            >
                                                {zones.map(z => <option key={z} value={z}>{z}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Supervisor</label>
                                            <select
                                                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                value={selectedSupervisor}
                                                onChange={(e) => {
                                                    setSelectedSupervisor(e.target.value);
                                                    setSelectedWard('All');
                                                }}
                                            >
                                                {supervisors.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Ward Number</label>
                                            <select
                                                className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                value={selectedWard}
                                                onChange={(e) => setSelectedWard(e.target.value)}
                                            >
                                                {wards.map(w => <option key={w} value={w}>{w}</option>)}
                                            </select>
                                        </div>
                                    </>
                                )}
                                {viewType === 'mapping' && (
                                    <div className="col-span-3">
                                        <p className="text-sm text-gray-500 italic">Showing master supervisor-ward mapping data.</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-100">
                                {!initialMode && (
                                    <div className="flex bg-gray-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => setViewType('supervisor')}
                                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewType === 'supervisor'
                                                ? 'bg-white text-blue-600 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                        >
                                            Supervisor Wise
                                        </button>
                                        <button
                                            onClick={() => setViewType('ward')}
                                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewType === 'ward'
                                                ? 'bg-white text-blue-600 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                        >
                                            Ward Wise
                                        </button>
                                        <button
                                            onClick={() => setViewType('mapping')}
                                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewType === 'mapping'
                                                ? 'bg-white text-blue-600 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                        >
                                            Mapping
                                        </button>
                                    </div>
                                )}
                                <div className={`${!initialMode ? 'w-full flex justify-end' : 'w-full'} flex items-center justify-end gap-2`}>
                                    <button
                                        onClick={() => {
                                            setStats([]);
                                            setWardStats([]);
                                            setFileName('');
                                            setSelectedZone('All');
                                            setSelectedSupervisor('All');
                                            setSelectedWard('All');
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors shadow-sm"
                                    >
                                        <Upload className="w-4 h-4" />
                                        Upload New
                                    </button>
                                    <button
                                        onClick={() => setIsAutoSharing(true)}
                                        disabled={loading || stats.length === 0}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        <Bot className="w-4 h-4" />
                                        WhatsApp Bot
                                    </button>
                                    <button
                                        onClick={exportCompletePerformancePDF}
                                        disabled={loading || stats.length === 0}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors shadow-sm disabled:opacity-50"
                                    >
                                        <FileText className="w-4 h-4" />
                                        {loading ? 'Generating...' : 'Export Complete PDF'}
                                    </button>
                                    <button
                                        onClick={exportToZonalPDF}
                                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                                    >
                                        <FileText className="w-4 h-4" />
                                        Export Zonal PDF
                                    </button>
                                    <button
                                        onClick={exportToExcel}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                                    >
                                        <Download className="w-4 h-4" />
                                        Export Excel
                                    </button>
                                    <button
                                        onClick={() => exportToJPEG('coverage-report-container', 'Coverage_Analysis')}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                    >
                                        <ImageIcon className="w-4 h-4" />
                                        Export JPEG
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Table Sections */}
                        {viewType === 'supervisor' && (
                            <div className="overflow-x-auto rounded-lg border-2 border-gray-300 shadow-sm">
                                <table className="w-full text-sm border-collapse">
                                    <thead className="bg-blue-600 text-white">
                                        <tr>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Zonal Head</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Supervisor Name</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Wards(Count)</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Assigned Vehicles</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Total POI</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Covered</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Not Covered</th>
                                            <th className="p-3 border border-gray-300 font-semibold text-center">Coverage %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStats.map((row, index) => {
                                            const coverage = row.total > 0 ? (row.covered / row.total) * 100 : 0;
                                            const isHigh = coverage >= 90;
                                            const isLow = coverage < 75;

                                            return (
                                                <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
                                                    <td className="p-3 border border-gray-300 font-medium text-gray-900 text-center">{row.zonalHead}</td>
                                                    <td className="p-3 border border-gray-300 font-semibold text-gray-800 text-center">{row.supervisorName}</td>
                                                    <td className="p-3 border border-gray-300 text-center text-gray-700 font-medium">
                                                        {row.wardCount}
                                                    </td>
                                                    <td className="p-3 border border-gray-300 text-gray-600 text-xs text-center">
                                                        {row.vehicles.join(", ")}
                                                    </td>
                                                    <td className="p-3 border border-gray-300 text-center font-mono text-gray-700">{row.total.toLocaleString()}</td>
                                                    <td className="p-3 border border-gray-300 text-center font-mono font-semibold text-green-700">{row.covered.toLocaleString()}</td>
                                                    <td className="p-3 border border-gray-300 text-center font-mono font-semibold text-red-600">{row.notCovered.toLocaleString()}</td>
                                                    <td className="p-3 border border-gray-300 text-center">
                                                        <div className="flex items-center justify-between gap-2 px-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`font-bold ${isHigh ? 'text-green-600' : isLow ? 'text-red-600' : 'text-yellow-600'}`}>
                                                                    {coverage.toFixed(1)}%
                                                                </span>
                                                                {isHigh ? <TrendingUp className="w-4 h-4 text-green-500" /> :
                                                                    isLow ? <AlertCircle className="w-4 h-4 text-red-500" /> :
                                                                        <TrendingDown className="w-4 h-4 text-yellow-500" />}
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    const text = `📊 *Coverage Summary*\n\n🏆 *Supervisor:* ${row.supervisorName}\n🏢 *Zone:* ${row.zonalHead}\n📍 *Total POI:* ${row.total}\n✅ *Covered:* ${row.covered}\n❌ *Pending:* ${row.notCovered}\n📈 *Achieved:* ${coverage.toFixed(1)}%\n\n_Generated from QR Analysis Tool_`;
                                                                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                                                }}
                                                                title="Share to WhatsApp"
                                                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-full transition-colors flex-shrink-0"
                                                            >
                                                                <MessageCircle className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {viewType === 'mapping' && (
                            <div className="overflow-x-auto rounded-lg border-2 border-gray-300 shadow-sm">
                                <table className="w-full text-sm border-collapse">
                                    <thead className="bg-slate-800 text-white">
                                        <tr>
                                            <th className="p-3 border border-gray-600 font-semibold text-center">Ward No</th>
                                            <th className="p-3 border border-gray-600 font-semibold text-center">Ward Name</th>
                                            <th className="p-3 border border-gray-600 font-semibold text-center">Supervisor</th>
                                            <th className="p-3 border border-gray-600 font-semibold text-center">Zonal Head</th>
                                            <th className="p-3 border border-gray-600 font-semibold text-center">Manager</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {supervisorDataJson.map((row, index) => (
                                            <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-slate-50 transition-colors`}>
                                                <td className="p-3 border border-gray-300 text-center font-medium text-gray-900">{row["Ward No"]}</td>
                                                <td className="p-3 border border-gray-300 text-center text-gray-800">{row["Ward Name"]}</td>
                                                <td className="p-3 border border-gray-300 text-center text-gray-700">{row.Supervisor}</td>
                                                <td className="p-3 border border-gray-300 text-center text-gray-700">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                                                        {row["Zonal Head"]}
                                                    </span>
                                                </td>
                                                <td className="p-3 border border-gray-300 text-center text-gray-600">{row.Manager}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {(viewType === 'ward' || viewType === 'all') && (
                            <div className="space-y-8">
                                {filteredStats.map((supervisor, sIndex) => {
                                    const supervisorWards = filteredWardStats.filter(w =>
                                        w.supervisorName === supervisor.supervisorName &&
                                        w.zonalHead === supervisor.zonalHead
                                    );
                                    if (supervisorWards.length === 0) return null;

                                    const supCoverage = supervisor.total > 0 ? (supervisor.covered / supervisor.total) * 100 : 0;
                                    const isSupHigh = supCoverage >= 90;
                                    const isSupLow = supCoverage < 75;

                                    return (
                                        <div key={sIndex} id={`supervisor-card-${sIndex}`} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                            {/* Supervisor Header */}
                                            <div className="bg-gray-100 p-5 border-4 border-green-600 shadow-lg">
                                                {/* Logos Section */}
                                                <div className="grid grid-cols-3 items-center mb-4 pb-3 border-b-2 border-green-500 gap-4">
                                                    {/* Left Side - Logo */}
                                                    <div className="flex items-center justify-start">
                                                        <img
                                                            src="/nagar-nigam-logo.png"
                                                            alt="Nagar Nigam Logo"
                                                            className="h-16 w-auto object-contain"
                                                        />
                                                    </div>

                                                    {/* Center - Title */}
                                                    <div className="text-center">
                                                        <h1 className="text-lg font-bold text-gray-900">Coverage Report</h1>
                                                        <p className="text-xs text-gray-600">Point of Interest Analysis</p>
                                                    </div>

                                                    {/* Right Side - Logo */}
                                                    <div className="flex justify-end">
                                                        <img
                                                            src="/NatureGreen_Logo.png"
                                                            alt="Nature Green Logo"
                                                            className="h-16 w-auto object-contain"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Top Section - Zonal Head (Centered) */}
                                                <div className="text-center mb-4 pb-3 border-b-2 border-green-500">
                                                    <div className="mb-1">
                                                        <span className="text-gray-600 text-xs font-semibold uppercase tracking-wider">Zonal Head</span>
                                                    </div>
                                                    <h2 className="text-xl font-bold text-gray-900 tracking-wide">{supervisor.zonalHead}</h2>
                                                </div>

                                                {/* Middle Section - Supervisor (Centered) */}
                                                <div className="text-center mb-4 pb-3 border-b-2 border-green-500">
                                                    <div className="mb-1">
                                                        <span className="text-gray-600 text-xs font-semibold uppercase tracking-wider">Supervisor</span>
                                                    </div>
                                                    <h3 className="text-2xl font-bold text-gray-900 tracking-wide mb-2">{supervisor.supervisorName}</h3>
                                                    <p className="text-sm text-gray-700 font-medium">
                                                        Vehicles: {supervisor.vehicles.join(", ")}
                                                    </p>
                                                </div>

                                                {/* Bottom Section - Stats */}
                                                <div className="flex items-center justify-center gap-8 text-sm mb-4">
                                                    <div className="text-center">
                                                        <span className="block text-xs text-gray-600 uppercase font-semibold mb-1">Wards</span>
                                                        <span className="font-bold text-lg text-gray-900">{supervisor.wardCount}</span>
                                                    </div>
                                                    <div className="text-center">
                                                        <span className="block text-xs text-gray-600 uppercase font-semibold mb-1">Total POI</span>
                                                        <span className="font-mono font-bold text-lg text-gray-900">{supervisor.total}</span>
                                                    </div>
                                                    <div className="text-center">
                                                        <span className="block text-xs text-gray-600 uppercase font-semibold mb-1">Coverage</span>
                                                        <div className={`font-bold text-lg ${isSupHigh ? 'text-green-600' : isSupLow ? 'text-red-600' : 'text-yellow-600'}`}>
                                                            {supCoverage.toFixed(1)}%
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Export & Share Buttons */}
                                                <div className="flex justify-center gap-3" data-html2canvas-ignore="true">
                                                    <button
                                                        onClick={() => exportToJPEG(`supervisor-card-${sIndex}`, `${supervisor.supervisorName}_Coverage_Report`)}
                                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
                                                    >
                                                        <ImageIcon className="w-4 h-4" />
                                                        Export as JPEG
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const text = `🚩 *POI Coverage Report*\n\n🏆 *Supervisor:* ${supervisor.supervisorName}\n🏢 *Zone:* ${supervisor.zonalHead}\n📍 *Total Wards:* ${supervisor.wardCount}\n📍 *Total POI:* ${supervisor.total}\n✅ *Covered:* ${supervisor.covered}\n❌ *Pending:* ${supervisor.notCovered}\n📊 *Coverage:* ${supCoverage.toFixed(1)}%\n\n_Generated from QR Analysis Tool_`;
                                                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                                        }}
                                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm text-sm font-medium"
                                                    >
                                                        <MessageCircle className="w-4 h-4" />
                                                        Share to WhatsApp
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Wards Table */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm border-collapse">
                                                    <thead className="bg-green-600 text-white">
                                                        <tr>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Ward Name</th>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Route Name</th>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Assigned Vehicles</th>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Total POI</th>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Covered</th>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Not Covered</th>
                                                            <th className="p-2.5 border border-gray-300 font-semibold text-center">Coverage %</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {supervisorWards.map((ward, wIndex) => {
                                                            const coverage = ward.total > 0 ? (ward.covered / ward.total) * 100 : 0;
                                                            const isHigh = coverage >= 90;
                                                            const isLow = coverage < 75;

                                                            return (
                                                                <tr key={wIndex} className={`${wIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-green-50 transition-colors`}>
                                                                    <td className="p-2.5 border border-gray-300 font-medium text-gray-800 text-center">{ward.wardName}</td>
                                                                    <td className="p-2.5 border border-gray-300 text-gray-700 text-center">{ward.routeName}</td>
                                                                    <td className="p-2.5 border border-gray-300 text-gray-600 text-xs text-center">{ward.vehicles.join(", ")}</td>
                                                                    <td className="p-2.5 border border-gray-300 text-center font-mono text-gray-700">{ward.total.toLocaleString()}</td>
                                                                    <td className="p-2.5 border border-gray-300 text-center font-mono font-semibold text-green-700">{ward.covered.toLocaleString()}</td>
                                                                    <td className="p-2.5 border border-gray-300 text-center font-mono font-semibold text-red-600">{ward.notCovered.toLocaleString()}</td>
                                                                    <td className="p-2.5 border border-gray-300 text-center">
                                                                        <span className={`font-semibold ${isHigh ? 'text-green-600' : isLow ? 'text-red-600' : 'text-yellow-600'}`}>
                                                                            {coverage.toFixed(1)}%
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
