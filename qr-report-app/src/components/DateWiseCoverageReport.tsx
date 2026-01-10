import { useState, useMemo } from 'react';
import { FileUpload } from './FileUpload';
import { Calendar, Filter, Table as TableIcon, Download, FileImage, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportToJPEG } from '../utils/exporter';
import { MASTER_SUPERVISORS } from '../data/master-supervisors';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';

interface POIRecord {
    sno: string;
    zone: string;
    wardName: string;
    vehicleNumber: string;
    routeName: string;
    total: number;
    covered: number;
    notCovered: number;
    coverage: number;
    date: string;
    routeInTime: string;
    routeOutTime: string;
}

const DateWiseCoverageReport = () => {
    const [poiFile, setPoiFile] = useState<File | null>(null);
    const [poiData, setPoiData] = useState<POIRecord[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [selectedWard, setSelectedWard] = useState<string>('All');
    const [selectedZone, setSelectedZone] = useState<string>('All');
    const [selectedZonal, setSelectedZonal] = useState<string>('All');
    const [sortOrder, setSortOrder] = useState<'ward' | 'high-to-low' | 'low-to-high'>('ward');
    const [minPercentage, setMinPercentage] = useState<number>(0);
    const [maxPercentage, setMaxPercentage] = useState<number>(100);

    // Helper function to get supervisor and zonal from ward name
    const getSupervisorInfo = (wardName: string) => {
        // Extract ward number from ward name (e.g., "65-Holi Gali" -> "65")
        const wardNumberRaw = wardName.split('-')[0].trim();
        // Remove leading zeros (e.g., "01" -> "1")
        const wardNumber = String(parseInt(wardNumberRaw, 10));

        // Find supervisor for this ward (C&T department only)
        const supervisor = MASTER_SUPERVISORS.find(s => {
            if (s.department !== 'C&T') return false; // Only C&T department
            const wards = s.ward.split(',').map(w => w.trim());
            return wards.includes(wardNumber);
        });

        return {
            supervisor: supervisor?.name || '-',
            zonal: supervisor?.zonal || '-'
        };
    };

    // Helper function to convert Excel serial date to DD-MM-YYYY
    const excelDateToJSDate = (serial: number): string => {
        // Excel date formula: days since 1900-01-01 (with 1900 leap year bug)
        const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
        const days = Math.floor(serial);
        const milliseconds = days * 24 * 60 * 60 * 1000;
        const date = new Date(excelEpoch.getTime() + milliseconds);

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        return `${day}-${month}-${year}`;
    };

    const getZoneName = (val: any): string => {
        const v = String(val || '').trim();
        const mapping: Record<string, string> = {
            '1': '1-City',
            '2': '2-Bhuteswar',
            '3': '3-Aurangabad',
            '4': '4-Vrindavan'
        };
        return mapping[v] || v;
    };

    const handleFileProcess = async () => {
        if (!poiFile) return;

        setLoading(true);
        try {
            const data = await poiFile.arrayBuffer();
            const workbook = XLSX.read(data);
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            const records: POIRecord[] = jsonData.map((row: any) => {
                // Handle date - could be string or Excel serial number
                let dateValue = row['Date'];
                let formattedDate = '';

                if (typeof dateValue === 'number') {
                    // It's an Excel serial date
                    formattedDate = excelDateToJSDate(dateValue);
                } else if (typeof dateValue === 'string') {
                    // It's already a string, use as-is
                    formattedDate = dateValue;
                } else {
                    formattedDate = String(dateValue || '');
                }

                return {
                    sno: String(row['S.No.'] || ''),
                    zone: getZoneName(row['Zone & Circle']),
                    wardName: String(row['Ward Name'] || ''),
                    vehicleNumber: String(row['Vehicle Number'] || ''),
                    routeName: String(row['Route Name'] || ''),
                    total: Number(row['Total']) || 0,
                    covered: Number(row['Covered']) || 0,
                    notCovered: Number(row['Not Covered']) || 0,
                    coverage: Number(row['Coverage']) || 0,
                    date: formattedDate,
                    routeInTime: String(row['Route In Time'] || ''),
                    routeOutTime: String(row['Route Out Time'] || ''),
                };
            });

            setPoiData(records);
        } catch (error) {
            console.error('Error processing file:', error);
            alert('Error processing file. Please check the format.');
        } finally {
            setLoading(false);
        }
    };

    // Get unique values for filters
    const { wards, zones, dates, zonals } = useMemo(() => {
        const wards = Array.from(new Set(poiData.map(r => r.wardName))).sort();
        const zones = Array.from(new Set(poiData.map(r => r.zone))).sort();
        const dates = Array.from(new Set(poiData.map(r => r.date))).sort((a, b) => {
            // Parse DD-MM-YYYY format
            const [dayA, monthA, yearA] = a.split('-').map(Number);
            const [dayB, monthB, yearB] = b.split('-').map(Number);
            const dateA = new Date(yearA, monthA - 1, dayA);
            const dateB = new Date(yearB, monthB - 1, dayB);
            return dateA.getTime() - dateB.getTime();
        });

        // Get unique zonals from C&T supervisors
        const zonalSet = new Set<string>();
        wards.forEach(ward => {
            const { zonal } = getSupervisorInfo(ward);
            if (zonal !== '-') zonalSet.add(zonal);
        });
        const zonals = Array.from(zonalSet).sort();

        return { wards, zones, dates, zonals };
    }, [poiData]);

    // Filter data based on selections
    const filteredData = useMemo(() => {
        return poiData.filter(record => {
            if (selectedWard !== 'All' && record.wardName !== selectedWard) return false;
            if (selectedZone !== 'All' && record.zone !== selectedZone) return false;

            // Filter by zonal
            if (selectedZonal !== 'All') {
                const { zonal } = getSupervisorInfo(record.wardName);
                if (zonal !== selectedZonal) return false;
            }

            return true;
        });
    }, [poiData, selectedWard, selectedZone, selectedZonal]);

    // Table data: Each unique route as a row with date values as columns
    const tableData = useMemo(() => {
        const routeMap = new Map<string, {
            wardName: string;
            vehicleNumber: string;
            routeName: string;
            supervisor: string;
            zonal: string;
            zone: string;
            total: number;
            dateValues: Map<string, number>;
        }>();

        filteredData.forEach(record => {
            // Create unique key for each route
            const key = `${record.wardName}|${record.vehicleNumber}|${record.routeName}`;

            if (!routeMap.has(key)) {
                const { supervisor, zonal } = getSupervisorInfo(record.wardName);
                routeMap.set(key, {
                    wardName: record.wardName,
                    vehicleNumber: record.vehicleNumber,
                    routeName: record.routeName,
                    supervisor: supervisor,
                    zonal: zonal,
                    zone: record.zone,
                    total: 0,
                    dateValues: new Map(),
                });
            }

            const routeData = routeMap.get(key)!;
            routeData.total = record.total; // Use total from record (same for all dates)
            const coverage = record.total > 0 ? Math.round((record.covered / record.total) * 100) : 0;
            routeData.dateValues.set(record.date, coverage);
        });

        // Convert to array
        let result = Array.from(routeMap.entries())
            .map(([key, data]) => {
                // Calculate average coverage across all dates
                const coverages = Array.from(data.dateValues.values());
                const avgCoverage = coverages.length > 0
                    ? Math.round(coverages.reduce((sum, val) => sum + val, 0) / coverages.length)
                    : 0;
                return { key, ...data, avgCoverage };
            });

        // Apply percentage filter
        result = result.filter(row =>
            row.avgCoverage >= minPercentage && row.avgCoverage <= maxPercentage
        );

        // Apply sorting
        if (sortOrder === 'high-to-low') {
            result.sort((a, b) => b.avgCoverage - a.avgCoverage);
        } else if (sortOrder === 'low-to-high') {
            result.sort((a, b) => a.avgCoverage - b.avgCoverage);
        } else {
            result.sort((a, b) => a.wardName.localeCompare(b.wardName));
        }

        return result;
    }, [filteredData, dates, sortOrder, minPercentage, maxPercentage]);

    // Helper to load image for PDF with dimensions
    const loadImage = (src: string): Promise<{ dataUrl: string; width: number; height: number }> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return reject('Canvas error');
                ctx.drawImage(img, 0, 0);
                resolve({
                    dataUrl: canvas.toDataURL('image/png'),
                    width: img.width,
                    height: img.height
                });
            };
            img.onerror = reject;
            img.src = src;
        });
    };

    // Export to Excel
    const exportToExcel = () => {
        if (tableData.length === 0) return;

        // Create header rows
        const headerRows = [
            ['Mathura Vrindavan Nagar Nigam'],
            ['Date Wise Coverage Report'],
            [`Generated on: ${new Date().toLocaleDateString()}`],
            ['Active Filters:',
                `Ward: ${selectedWard !== 'All' ? selectedWard : 'None'}`,
                `Zone: ${selectedZone !== 'All' ? selectedZone : 'None'}`,
                `Zonal: ${selectedZonal !== 'All' ? selectedZonal : 'None'}`,
                `Coverage: ${minPercentage}% - ${maxPercentage}%`
            ],
            [''] // Empty row for spacing
        ];

        // Prepare data rows
        const dataRows = tableData.map((row, index) => {
            const rowData: any = {
                'Sr. No.': index + 1,
                'Ward Name': row.wardName,
                'Vehicle Number': `${row.vehicleNumber} (${row.avgCoverage}%)`,
                'Route Name': row.routeName,
                'Supervisor': row.supervisor,
                'Zonal': row.zonal,
                'Zone Name': row.zone,
                'Total': row.total,
                'Avg Coverage': `${row.avgCoverage}%`,
            };

            dates.forEach(date => {
                const coverage = row.dateValues.get(date);
                rowData[date] = coverage !== undefined ? `${coverage}%` : '0%';
            });

            return rowData;
        });

        // Convert data rows to AoA (Array of Arrays) to merge with headers


        // Create a new workbook
        const wb = XLSX.utils.book_new();

        // We need to manually construct the sheet to add custom headers at the top
        // But for simplicity with xlsx, we can't easily prepend without recreating the sheet data
        // Let's create a new sheet with headers + data

        // Extract headers from the first data row keys
        const dataKeys = Object.keys(dataRows[0]);
        const finalData = [
            ...headerRows,
            dataKeys, // The table headers
            ...dataRows.map(row => dataKeys.map(key => (row as any)[key])) // Map data to array based on keys
        ];

        const ws = XLSX.utils.aoa_to_sheet(finalData);
        XLSX.utils.book_append_sheet(wb, ws, 'Route Coverage');
        XLSX.writeFile(wb, `Coverage_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Export to PDF
    const exportToPDF = async () => {
        if (tableData.length === 0) return;

        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
        const pageWidth = doc.internal.pageSize.getWidth();
        const headerHeight = 40;

        // Add Header Background
        doc.setFillColor(240, 253, 244); // Light Green Background (green-50)
        doc.rect(0, 0, pageWidth, headerHeight, 'F');

        // Add Border line
        doc.setDrawColor(34, 197, 94); // Green-500
        doc.setLineWidth(0.5);
        doc.line(0, headerHeight, pageWidth, headerHeight);

        // Add Logos and Header
        try {
            const nagarNigamImg = await loadImage(nagarNigamLogo);
            const natureGreenImg = await loadImage(natureGreenLogo);

            // Calculate ratios to fit within a 25mm height box, maintaining aspect ratio
            const maxLogoHeight = 25;

            const nnRatio = nagarNigamImg.width / nagarNigamImg.height;
            const nnWidth = maxLogoHeight * nnRatio;

            const ngRatio = natureGreenImg.width / natureGreenImg.height;
            const ngWidth = maxLogoHeight * ngRatio;

            // Logos
            doc.addImage(nagarNigamImg.dataUrl, 'PNG', 14, 7, nnWidth, maxLogoHeight);
            doc.addImage(natureGreenImg.dataUrl, 'PNG', pageWidth - ngWidth - 14, 7, ngWidth, maxLogoHeight);

            // Text
            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(31, 41, 55); // Gray-800
            doc.text('Mathura Vrindavan Nagar Nigam', pageWidth / 2, 15, { align: 'center' });

            doc.setFontSize(14);
            doc.setTextColor(22, 101, 52); // Green-800
            doc.text('Date Wise Coverage Report', pageWidth / 2, 22, { align: 'center' });

            // Generated Details & Filters
            doc.setFontSize(9);
            doc.setTextColor(75, 85, 99); // Gray-600
            doc.setFont('helvetica', 'normal');

            const dateText = `Generated on: ${new Date().toLocaleDateString()}`;
            doc.text(dateText, 14, headerHeight - 8);

            // Filter Text Construction
            doc.setFont('helvetica', 'bold');
            doc.text('Active Filters:', 14, headerHeight - 3);

            doc.setFont('helvetica', 'normal');
            let filterText = '';
            if (selectedWard !== 'All') filterText += ` Ward: ${selectedWard} |`;
            if (selectedZone !== 'All') filterText += ` Zone: ${selectedZone} |`;
            if (selectedZonal !== 'All') filterText += ` Zonal: ${selectedZonal} |`;
            filterText += ` Coverage: ${minPercentage}%-${maxPercentage}%`;

            doc.text(filterText, 36, headerHeight - 3);

        } catch (e) {
            console.error("Error loading images for PDF", e);
            // Fallback text if images fail
            doc.setFontSize(16);
            doc.text('Mathura Vrindavan Nagar Nigam', pageWidth / 2, 15, { align: 'center' });
        }

        const tableColumn = [
            "Sr. No.",
            "Ward Name",
            "Vehicle Number",
            "Route Name",
            "Supervisor",
            "Zonal",
            "Zone Name",
            "Total",
            ...dates
        ];

        const tableRows: any[][] = [];

        tableData.forEach((row, index) => {
            const rowData = [
                index + 1,
                row.wardName,
                `${row.vehicleNumber}\n(${row.avgCoverage}%)`,
                row.routeName,
                row.supervisor,
                row.zonal,
                row.zone,
                row.total,
                ...dates.map(date => {
                    const val = row.dateValues.get(date);
                    return val !== undefined ? `${val}%` : '0%';
                })
            ];
            tableRows.push(rowData);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40, // Move table down to accommodate header
            styles: {
                fontSize: 8,
                cellPadding: 2,
                valign: 'middle',
                lineWidth: 0.1, // Border width
                lineColor: [0, 0, 0] // Black border
            },
            headStyles: {
                fillColor: [74, 222, 128], // Green-400
                textColor: [255, 255, 255],
                lineWidth: 0.1,
                lineColor: [0, 0, 0]
            },
            theme: 'grid',
            didParseCell: (data) => {
                // Ensure all cells have black borders
                data.cell.styles.lineColor = [0, 0, 0];
                data.cell.styles.lineWidth = 0.1;

                // Check if it's a date column (index 8 and above)
                if (data.section === 'body' && data.column.index >= 8) {
                    const cellText = data.cell.text[0];
                    const percentage = parseInt(cellText.replace('%', ''));

                    if (percentage === 0) {
                        data.cell.styles.fillColor = [254, 202, 202]; // Red-200
                        data.cell.styles.textColor = [127, 29, 29]; // Red-900
                    } else if (percentage < 50) {
                        data.cell.styles.fillColor = [254, 242, 242]; // Red-50
                        data.cell.styles.textColor = [153, 27, 27]; // Red-800
                    } else if (percentage <= 70) {
                        data.cell.styles.fillColor = [254, 252, 232]; // Yellow-100
                        data.cell.styles.textColor = [133, 77, 14]; // Yellow-800
                    } else if (percentage <= 90) {
                        data.cell.styles.fillColor = [220, 252, 231]; // Green-100
                        data.cell.styles.textColor = [22, 101, 52]; // Green-800
                    } else {
                        data.cell.styles.fillColor = [74, 222, 128]; // Green-400
                        data.cell.styles.textColor = [255, 255, 255]; // White
                    }
                }
            }
        });

        doc.save(`Coverage_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    // Export to JPEG
    const exportToImage = () => {
        exportToJPEG('date-wise-coverage-report', `Coverage_Report_${new Date().toISOString().split('T')[0]}`);
    };

    const getCellColor = (percentage: number) => {
        if (percentage === 0) return 'bg-red-200 text-red-900';
        if (percentage < 50) return 'bg-red-50 text-red-800';
        if (percentage <= 70) return 'bg-yellow-100 text-yellow-800';
        if (percentage <= 90) return 'bg-green-100 text-green-800';
        return 'bg-green-400 text-white';
    };

    if (poiData.length === 0) {
        return (
            <div className="max-w-2xl mx-auto mt-10">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Calendar className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">
                        Date-wise Coverage Report
                    </h2>
                    <p className="text-gray-500 mb-8 text-center max-w-md mx-auto">
                        Upload POI report CSV to view route-level coverage data across all dates.
                    </p>

                    <FileUpload
                        label="POI Report CSV"
                        file={poiFile}
                        onFileSelect={setPoiFile}
                        required
                    />

                    <button
                        onClick={handleFileProcess}
                        disabled={!poiFile || loading}
                        className={`w-full mt-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${!poiFile || loading
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 hover:shadow-xl active:scale-95'
                            }`}
                    >
                        {loading ? 'Processing...' : 'Generate Report'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6" id="date-wise-coverage-report">
            {/* Nagar Nigam Header */}
            <div className="bg-white border-b-4 border-gray-300 p-6">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    {/* Left Logo - Nagar Nigam */}
                    <div className="flex-shrink-0">
                        <div className="flex flex-col items-center">
                            <img
                                src={nagarNigamLogo}
                                alt="Nagar Nigam Logo"
                                className="w-24 h-24 object-contain"
                            />
                            <div className="text-xs font-bold text-gray-800 mt-2 text-center uppercase tracking-wider">
                                Nagar Nigam<br />Mathura-Vrindavan
                            </div>
                        </div>
                    </div>

                    {/* Center Heading */}
                    <div className="flex-1 text-center px-8">
                        <h1 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight mb-2 uppercase scale-y-110">
                            Mathura Vrindavan Nagar Nigam
                        </h1>
                        <div className="inline-block border-b-2 border-green-600 pb-1">
                            <h2 className="text-xl md:text-2xl font-bold text-green-700 tracking-widest uppercase">
                                Date Wise Coverage Report
                            </h2>
                        </div>
                    </div>

                    {/* Right Logo - Nature Green */}
                    <div className="flex-shrink-0">
                        <div className="flex flex-col items-center">
                            <img
                                src={natureGreenLogo}
                                alt="Nature Green Logo"
                                className="w-24 h-24 object-contain"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                            <TableIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">Route-wise Coverage Report</h2>
                            <p className="text-sm text-gray-500">{dates.length} dates • {tableData.length} routes</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={exportToExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                            title="Export to Excel"
                        >
                            <Download className="w-4 h-4" />
                            Excel
                        </button>
                        <button
                            onClick={exportToPDF}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                            title="Export to PDF"
                        >
                            <FileText className="w-4 h-4" />
                            PDF
                        </button>
                        <button
                            onClick={exportToImage}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                            title="Export to JPEG"
                        >
                            <FileImage className="w-4 h-4" />
                            JPEG
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Filter by Ward
                        </label>
                        <select
                            value={selectedWard}
                            onChange={(e) => setSelectedWard(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                        >
                            <option value="All">All Wards ({wards.length})</option>
                            {wards.map(ward => (
                                <option key={ward} value={ward}>{ward}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Filter by Zone
                        </label>
                        <select
                            value={selectedZone}
                            onChange={(e) => setSelectedZone(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                        >
                            <option value="All">All Zones ({zones.length})</option>
                            {zones.map(zone => (
                                <option key={zone} value={zone}>Zone {zone}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Filter by Zonal
                        </label>
                        <select
                            value={selectedZonal}
                            onChange={(e) => setSelectedZonal(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                        >
                            <option value="All">All Zonals ({zonals.length})</option>
                            {zonals.map(zonal => (
                                <option key={zonal} value={zonal}>{zonal}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Sort Order
                        </label>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as 'ward' | 'high-to-low' | 'low-to-high')}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                        >
                            <option value="ward">Ward Name (A-Z)</option>
                            <option value="high-to-low">Coverage: High to Low</option>
                            <option value="low-to-high">Coverage: Low to High</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Coverage Range
                        </label>
                        <div className="flex gap-2 items-center">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={minPercentage}
                                onChange={(e) => setMinPercentage(Number(e.target.value))}
                                className="w-20 px-2 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                placeholder="Min"
                            />
                            <span className="text-gray-500">-</span>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={maxPercentage}
                                onChange={(e) => setMaxPercentage(Number(e.target.value))}
                                className="w-20 px-2 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                placeholder="Max"
                            />
                            <span className="text-xs text-gray-500">%</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                {/* Report Header with Logos and Filters */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100">
                        <img src={nagarNigamLogo} alt="Nagar Nigam" className="w-20 h-20 object-contain" />
                        <div className="text-center">
                            <h3 className="text-2xl font-black text-gray-800 uppercase tracking-tight mb-1">Date Wise Coverage Report</h3>
                            <p className="text-sm font-bold text-gray-500 tracking-wider uppercase">Mathura Vrindavan Nagar Nigam</p>
                        </div>
                        <img src={natureGreenLogo} alt="Nature Green" className="w-20 h-20 object-contain" />
                    </div>

                    <div className="bg-green-50 rounded-lg p-4 border border-green-100 mb-6">
                        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
                            <span className="font-bold text-green-800 uppercase tracking-wider text-xs">Active Filters:</span>
                            {selectedWard === 'All' && selectedZone === 'All' && selectedZonal === 'All' && minPercentage === 0 && maxPercentage === 100 ? (
                                <span className="text-gray-400 italic font-medium">None Applied</span>
                            ) : (
                                <>
                                    {selectedWard !== 'All' && (
                                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-green-200 shadow-sm">
                                            <span className="text-xs text-gray-500 uppercase font-bold">Ward</span>
                                            <span className="font-bold text-gray-800">{selectedWard}</span>
                                        </div>
                                    )}
                                    {selectedZone !== 'All' && (
                                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-green-200 shadow-sm">
                                            <span className="text-xs text-gray-500 uppercase font-bold">Zone</span>
                                            <span className="font-bold text-gray-800">{selectedZone}</span>
                                        </div>
                                    )}
                                    {selectedZonal !== 'All' && (
                                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-green-200 shadow-sm">
                                            <span className="text-xs text-gray-500 uppercase font-bold">Zonal</span>
                                            <span className="font-bold text-gray-800">{selectedZonal}</span>
                                        </div>
                                    )}
                                    {(minPercentage > 0 || maxPercentage < 100) && (
                                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-green-200 shadow-sm">
                                            <span className="text-xs text-gray-500 uppercase font-bold">Coverage</span>
                                            <span className="font-bold text-gray-800">{minPercentage}% - {maxPercentage}%</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs border border-black font-sans">
                        <thead>
                            <tr className="bg-green-400 text-white shadow-sm">
                                <th className="px-3 py-3 text-center font-bold border border-black sticky left-0 bg-green-400 z-10 min-w-[60px]">
                                    Sr. No.
                                </th>
                                <th className="px-3 py-3 text-left font-bold border border-black min-w-[150px]">
                                    Ward Name
                                </th>
                                <th className="px-3 py-3 text-left font-bold border border-black min-w-[120px]">
                                    Vehicle Number
                                </th>
                                <th className="px-3 py-3 text-left font-bold border border-black min-w-[100px]">
                                    Route Name
                                </th>
                                <th className="px-3 py-3 text-left font-bold border border-black min-w-[100px]">
                                    Supervisor
                                </th>
                                <th className="px-3 py-3 text-left font-bold border border-black min-w-[100px]">
                                    Zonal
                                </th>
                                <th className="px-3 py-3 text-center font-bold border border-black">
                                    Zone Name
                                </th>
                                <th className="px-3 py-3 text-center font-bold border border-black">
                                    Total
                                </th>
                                {dates.map((date) => (
                                    <th key={date} className="px-2 py-3 text-center font-bold border border-black min-w-[90px]">
                                        {date}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {tableData.map((row, rowIndex) => (
                                <tr key={row.key} className="hover:bg-green-50/50 transition-colors">
                                    <td className="px-3 py-3 text-center font-bold text-gray-700 border border-black bg-gray-50/50 sticky left-0 z-0">
                                        {rowIndex + 1}
                                    </td>
                                    <td className="px-3 py-3 font-bold text-gray-900 border border-black">
                                        {row.wardName}
                                    </td>
                                    <td className="px-3 py-3 text-gray-800 border border-black font-semibold text-xs bg-green-50/30">
                                        <div>{row.vehicleNumber}</div>
                                        <div className={`text-[10px] font-bold mt-1 ${row.avgCoverage >= 90 ? 'text-green-700' :
                                            row.avgCoverage >= 70 ? 'text-green-700' :
                                                row.avgCoverage >= 50 ? 'text-yellow-700' :
                                                    row.avgCoverage === 0 ? 'text-red-800' :
                                                        'text-red-700'
                                            }`}>
                                            Avg: {row.avgCoverage}%
                                        </div>
                                    </td>
                                    <td className="px-3 py-3 text-gray-800 border border-black font-semibold text-xs uppercase">
                                        {row.routeName}
                                    </td>
                                    <td className="px-3 py-3 text-gray-700 border border-black font-medium uppercase bg-blue-50/20">
                                        {row.supervisor}
                                    </td>
                                    <td className="px-3 py-3 text-gray-700 border border-black font-medium uppercase">
                                        {row.zonal}
                                    </td>
                                    <td className="px-3 py-3 text-center text-gray-800 font-bold border border-black bg-gray-50">
                                        {row.zone}
                                    </td>
                                    <td className="px-3 py-3 text-center font-black text-gray-900 border border-black bg-gray-100/50">
                                        {row.total}
                                    </td>
                                    {dates.map(date => {
                                        const value = row.dateValues.get(date) || 0;
                                        return (
                                            <td
                                                key={date}
                                                className={`px-2 py-3 text-center font-bold border border-black ${getCellColor(value)}`}
                                            >
                                                {value}%
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Footer */}
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
    );
};

export default DateWiseCoverageReport;
