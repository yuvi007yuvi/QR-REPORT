import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Upload, FileDown, Search, Filter, MapPin } from 'lucide-react';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';

interface DistanceData {
    sNo: number;
    vehicleNumber: string;
    vehicleType: string;
    routeId: string;
    routeName: string;
    wardName: string;
    routeLengthKM: number;
    routeCoveredKM: number;
    totalDistanceKM: number;
    routeCoveragePercent: string;
    routeInTime: string;
    routeOutTime: string;
    routeTime: string;

}

const DistanceReport: React.FC = () => {
    const [data, setData] = useState<DistanceData[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVehicleType, setSelectedVehicleType] = useState('All');
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);


    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const csvData = e.target?.result;
                if (typeof csvData === 'string') {
                    const workbook = XLSX.read(csvData, { type: 'string' });
                    const sheetName = workbook.SheetNames[0];
                    const sheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                    // Skip header row and process data
                    const processedData: DistanceData[] = jsonData.slice(1).map((row: any) => ({
                        sNo: row[0],
                        vehicleNumber: row[1] || '',
                        vehicleType: row[2] || '',
                        routeId: row[3] || '',
                        routeName: row[4] || '',
                        wardName: row[5] || '',
                        routeLengthKM: parseFloat(row[6]) || 0,
                        routeCoveredKM: parseFloat(row[7]) || 0,
                        totalDistanceKM: parseFloat(row[8]) || 0,
                        routeCoveragePercent: row[9] || '0%',
                        routeInTime: row[10] || '',
                        routeOutTime: row[11] || '',
                        routeTime: row[12] || ''
                    })).filter((item: DistanceData) => item.vehicleNumber || item.routeName); // Filter empty rows

                    setData(processedData);
                }
            } catch (error) {
                console.error('Error parsing CSV:', error);
                alert('Error parsing CSV file');
            } finally {
                setIsLoading(false);
            }
        };

        reader.readAsText(file); // Use readAsText for CSV
    };





    const exportToExcel = () => {
        const headers = [
            "S.No", "Vehicle Number", "Vehicle Type", "Route ID", "Route Name",
            "Ward Name", "Route Length(KM)", "Route Covered(KM)",
            "Total Distance(KM)", "Route Coverage(%)", "Route In Time",
            "Route Out Time", "Route Time"
        ];

        // Create display data array with all columns
        const excelData = data.map(row => [
            row.sNo,
            row.vehicleNumber,
            row.vehicleType,
            row.routeId,
            row.routeName,
            row.wardName,
            row.routeLengthKM,
            row.routeCoveredKM,
            row.totalDistanceKM,
            row.routeCoveragePercent,
            row.routeOutTime,
            row.routeTime
        ]);

        // Add headers for the report layout (Title, etc.)
        const reportTitle = [["Mathura Vrindavan Nagar Nigam"], ["Distance & Route Coverage Report"], [`Generated on: ${new Date().toLocaleDateString()}`], []];

        const ws = XLSX.utils.aoa_to_sheet([...reportTitle, headers, ...excelData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Distance Report");
        XLSX.writeFile(wb, "Distance_Report.xlsx");
    };

    const exportToPDF = async () => {
        const doc = new jsPDF('landscape');

        // Helper to load image
        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
            });
        };

        try {
            // Add Header
            doc.setFillColor(240, 253, 244); // light green background
            doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');

            // Logos
            try {
                const nnLogo = await loadImage(nagarNigamLogo);
                const ngLogo = await loadImage(natureGreenLogo);

                doc.addImage(nnLogo, 'PNG', 14, 5, 25, 25);
                doc.addImage(ngLogo, 'PNG', doc.internal.pageSize.width - 39, 5, 25, 25);
            } catch (e) {
                console.error("Error loading logos", e);
            }

            // Titles
            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(51, 65, 85); // Slate 700
            doc.text("Mathura Vrindavan Nagar Nigam", doc.internal.pageSize.width / 2, 18, { align: "center" });

            doc.setFontSize(16);
            doc.setTextColor(22, 163, 74); // Green 600
            doc.text("Distance & Route Coverage Report", doc.internal.pageSize.width / 2, 28, { align: "center" });

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 35, { align: "center" });

            doc.setDrawColor(22, 163, 74);
            doc.setLineWidth(0.5);
            doc.line(14, 42, doc.internal.pageSize.width - 14, 42);

            // Table
            const tableHeaders = [
                "Veh No.", "Type", "Route", "Ward", "Len(KM)", "Cov(KM)",
                "Total(KM)", "Cov %", "In Time", "Out Time", "Dur"
            ];

            const tableData = data.map(row => [
                row.vehicleNumber,
                row.vehicleType.replace('Primary - ', ''), // Shorten for PDF
                row.routeName,
                row.wardName,
                row.routeLengthKM.toString(),
                row.routeCoveredKM.toString(),
                row.totalDistanceKM.toString(),
                row.routeCoveragePercent,
                row.routeOutTime,
                row.routeTime
            ]);

            (doc as any).autoTable({
                startY: 45,
                head: [tableHeaders],
                body: tableData,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
                headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [240, 253, 244] },
                margin: { top: 45 },
            });

            doc.save("Distance_Report.pdf");
        } catch (error) {
            console.error("PDF Generation Error", error);
            alert("Failed to generate PDF");
        }
    };

    // Extract unique vehicle types
    const vehicleTypes = ['All', ...Array.from(new Set(data.map(item => item.vehicleType).filter(Boolean)))];

    const filteredData = data.filter(item => {
        const matchSearch = String(item.vehicleNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(item.routeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(item.wardName || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchType = selectedVehicleType === 'All' || item.vehicleType === selectedVehicleType;

        return matchSearch && matchType;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <MapPin className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Distance & Route Report</h1>
                        <p className="text-sm text-gray-500">Vehicle route coverage and distance analysis</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Upload className="w-4 h-4" />
                        Upload Report
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                    />



                    {data.length > 0 && (
                        <>
                            <button
                                onClick={exportToExcel}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                            >
                                <FileDown className="w-4 h-4" />
                                Excel
                            </button>
                            <button
                                onClick={exportToPDF}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                            >
                                <FileDown className="w-4 h-4" />
                                PDF
                            </button>
                        </>
                    )}
                </div>
            </div>

            {data.length > 0 ? (
                <div className="space-y-4">
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
                                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none mb-2">
                                    DISTANCE & ROUTE<br />
                                    <span className="text-blue-600">COVERAGE REPORT</span>
                                </h1>
                                <div className="h-1 w-20 bg-blue-600 rounded-full mb-2"></div>
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
                    {/* Search */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by vehicle, route, or ward..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>

                        {/* Vehicle Type Filter */}
                        <div className="relative min-w-[200px]">
                            <select
                                value={selectedVehicleType}
                                onChange={(e) => setSelectedVehicleType(e.target.value)}
                                className="w-full pl-4 pr-10 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none appearance-none bg-white cursor-pointer"
                            >
                                {vehicleTypes.map(type => (
                                    <option key={type} value={type}>{type}</option>
                                ))}
                            </select>
                            <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <Filter className="w-4 h-4" />
                            <span>Showing {filteredData.length} records</span>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-300 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-green-600 text-white font-bold text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-2 border border-green-700 whitespace-nowrap text-center">S.No</th>
                                        <th className="px-4 py-2 border border-green-700 whitespace-nowrap">Vehicle Number</th>
                                        <th className="px-4 py-2 border border-green-700 whitespace-nowrap">Type</th>
                                        <th className="px-4 py-2 border border-green-700 whitespace-nowrap text-center">Route ID</th>
                                        <th className="px-4 py-2 border border-green-700 whitespace-nowrap">Route Name</th>
                                        <th className="px-4 py-2 border border-green-700 whitespace-nowrap text-center">Ward</th>
                                        <th className="px-4 py-2 border border-green-700 whitespace-nowrap text-right">Route Len (KM)</th>
                                        <th className="px-4 py-2 border border-green-700 whitespace-nowrap text-right">Covered (KM)</th>
                                        <th className="px-4 py-2 border border-green-700 whitespace-nowrap text-right">Total Dist (KM)</th>
                                        <th className="px-4 py-2 border border-green-700 whitespace-nowrap text-center">Coverage %</th>
                                        <th className="px-4 py-2 border border-green-700 whitespace-nowrap text-center">In Time</th>
                                        <th className="px-4 py-2 border border-green-700 whitespace-nowrap text-center">Out Time</th>
                                        <th className="px-4 py-2 border border-green-700 whitespace-nowrap text-center">Duration</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {filteredData.map((row, index) => {
                                        const coverageVal = parseFloat(String(row.routeCoveragePercent).replace('%', ''));
                                        const coverageColor = coverageVal >= 90 ? 'text-green-700 bg-green-100' :
                                            coverageVal >= 75 ? 'text-blue-700 bg-blue-100' :
                                                coverageVal >= 50 ? 'text-orange-700 bg-orange-100' :
                                                    'text-red-700 bg-red-100';

                                        return (
                                            <tr key={index} className="odd:bg-white even:bg-slate-50 hover:bg-yellow-50 transition-colors">
                                                <td className="px-4 py-2 border border-gray-300 text-center text-gray-500 font-medium">{row.sNo}</td>
                                                <td className="px-4 py-2 border border-gray-300 font-bold text-gray-900">{row.vehicleNumber}</td>
                                                <td className="px-4 py-2 border border-gray-300 text-gray-600">{row.vehicleType}</td>
                                                <td className="px-4 py-2 border border-gray-300 text-center text-gray-600 font-mono">{row.routeId}</td>
                                                <td className="px-4 py-2 border border-gray-300 font-medium text-blue-700">{row.routeName}</td>
                                                <td className="px-4 py-2 border border-gray-300 text-center font-bold text-gray-700">{row.wardName}</td>
                                                <td className="px-4 py-2 border border-gray-300 text-right font-mono text-gray-700">{row.routeLengthKM}</td>
                                                <td className="px-4 py-2 border border-gray-300 text-right font-mono text-gray-700">{row.routeCoveredKM}</td>
                                                <td className="px-4 py-2 border border-gray-300 text-right font-mono font-bold text-gray-900 bg-slate-100">{row.totalDistanceKM}</td>
                                                <td className={`px-4 py-2 border border-gray-300 text-center font-bold ${coverageColor}`}>
                                                    {row.routeCoveragePercent}
                                                </td>
                                                <td className="px-4 py-2 border border-gray-300 text-center text-gray-600 font-mono">{row.routeInTime}</td>
                                                <td className="px-4 py-2 border border-gray-300 text-center text-gray-600 font-mono">{row.routeOutTime}</td>
                                                <td className="px-4 py-2 border border-gray-300 text-center font-bold text-gray-800 font-mono">{row.routeTime}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Table 2 was removed */}

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
            ) : (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border-2 border-dashed border-gray-300 text-gray-400 animate-in fade-in duration-500">
                    <div className={`p-4 rounded-full bg-gray-50 mb-4 ${isLoading ? 'animate-pulse' : ''}`}>
                        <Upload size={48} className="opacity-50" />
                    </div>
                    <p className="text-lg font-medium">{isLoading ? 'Processing File...' : 'Upload "Distance-Report-xx-xx-xxxx.csv" to generate report'}</p>
                    <p className="text-sm mt-2 text-gray-400">Supports CSV and Excel formats</p>
                </div>
            )}
        </div>
    );
};

export default DistanceReport;
