import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Upload, FileDown, Search, Filter, MapPin } from 'lucide-react';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';

interface TripData {
    sNo: number;
    vehicleNumber: string;
    vehicleType: string;
    wardName: string;
    tripCount: string;
    dumpSiteName: string;
    tripInTime: string;
    tripOutTime: string;
    tripDate: string;
}

const TripReport: React.FC = () => {
    const [data, setData] = useState<TripData[]>([]);
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

                    // Header mapping based on index:
                    // 0: S.No, 1: Zone, 2: Vehicle Number, 3: Type, 4: Ward, 5: Trip Count
                    // 6: Dump Site, 7: Date, 8: In Time, 9: Out Time

                    const formatDate = (val: any): string => {
                        if (!val) return '';

                        // Handle Excel Serial Date (numbers like 45312)
                        // 25569 is the offset for 1970-01-01
                        if (typeof val === 'number') {
                            const date = new Date(Math.round((val - 25569) * 864e5));
                            // Adjust for timezone offset if necessary, but usually this is rough enough for dates
                            const day = String(date.getUTCDate()).padStart(2, '0');
                            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
                            const year = date.getUTCFullYear();
                            return `${day}-${month}-${year}`;
                        }

                        // If it's already a string, try to standardize separators
                        const strVal = String(val).trim();

                        // If YYYY-MM-DD
                        if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
                            const [y, m, d] = strVal.split('-');
                            return `${d}-${m}-${y}`;
                        }

                        // If DD/MM/YYYY or DD.MM.YYYY
                        if (/^\d{1,2}[\/.]\d{1,2}[\/.]\d{4}$/.test(strVal)) {
                            return strVal.replace(/[./]/g, '-');
                        }

                        return strVal;
                    };

                    const processedData: TripData[] = jsonData.slice(1).map((row: any) => ({
                        sNo: row[0],
                        vehicleNumber: row[2] || '',
                        vehicleType: row[3] || '',
                        wardName: row[4] || '',
                        tripCount: row[5] || '0',
                        dumpSiteName: row[6] || '',
                        tripDate: formatDate(row[7]),
                        tripInTime: row[8] || '',
                        tripOutTime: row[9] || ''
                    })).filter((item: TripData) => item.vehicleNumber);

                    setData(processedData);
                }
            } catch (error) {
                console.error('Error parsing CSV:', error);
                alert('Error parsing CSV file');
            } finally {
                setIsLoading(false);
            }
        };

        reader.readAsText(file);
    };

    const exportToExcel = () => {
        const headers = [
            "S.No", "Vehicle Number", "Vehicle Type", "Ward Name",
            "Trip Count", "Dump Site", "Date", "In Time", "Out Time"
        ];

        const excelData = data.map(row => [
            row.sNo,
            row.vehicleNumber,
            row.vehicleType,
            row.wardName,
            row.tripCount,
            row.dumpSiteName,
            row.tripDate,
            row.tripInTime,
            row.tripOutTime
        ]);

        const reportTitle = [["Mathura Vrindavan Nagar Nigam"], ["Daily Trip Report"], [`Generated on: ${new Date().toLocaleDateString()}`], []];

        const ws = XLSX.utils.aoa_to_sheet([...reportTitle, headers, ...excelData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Trip Report");
        XLSX.writeFile(wb, "Trip_Report.xlsx");
    };

    const exportToPDF = async () => {
        const doc = new jsPDF('landscape');

        const loadImage = (src: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
            });
        };

        try {
            // Header
            doc.setFillColor(250, 245, 255); // light purple background
            doc.rect(0, 0, doc.internal.pageSize.width, 40, 'F');

            try {
                const nnLogo = await loadImage(nagarNigamLogo);
                const ngLogo = await loadImage(natureGreenLogo);
                doc.addImage(nnLogo, 'PNG', 14, 5, 25, 25);
                doc.addImage(ngLogo, 'PNG', doc.internal.pageSize.width - 39, 5, 25, 25);
            } catch (e) {
                console.error("Error loading logos", e);
            }

            doc.setFontSize(22);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(51, 65, 85);
            doc.text("Mathura Vrindavan Nagar Nigam", doc.internal.pageSize.width / 2, 18, { align: "center" });

            doc.setFontSize(16);
            doc.setTextColor(107, 33, 168); // Purple 800
            doc.text("Daily Trip Report", doc.internal.pageSize.width / 2, 28, { align: "center" });

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated on: ${new Date().toLocaleString()}`, doc.internal.pageSize.width / 2, 35, { align: "center" });

            doc.setDrawColor(107, 33, 168);
            doc.setLineWidth(0.5);
            doc.line(14, 42, doc.internal.pageSize.width - 14, 42);

            const tableHeaders = [
                "Veh No.", "Type", "Ward", "Trips", "Dump Site", "Date", "In Time", "Out Time"
            ];

            const tableData = data.map(row => [
                row.vehicleNumber,
                row.vehicleType.replace('Primary - ', '').replace('Secondary - ', ''),
                row.wardName,
                row.tripCount,
                row.dumpSiteName,
                row.tripDate,
                row.tripInTime,
                row.tripOutTime
            ]);

            (doc as any).autoTable({
                startY: 45,
                head: [tableHeaders],
                body: tableData,
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 2, valign: 'middle' },
                headStyles: { fillColor: [107, 33, 168], textColor: 255, fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [250, 245, 255] },
                margin: { top: 45 },
            });

            doc.save("Trip_Report.pdf");
        } catch (error) {
            console.error("PDF Generation Error", error);
            alert("Failed to generate PDF");
        }
    };

    const vehicleTypes = ['All', ...Array.from(new Set(data.map(item => item.vehicleType).filter(Boolean)))];

    const filteredData = data.filter(item => {
        const matchSearch = String(item.vehicleNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(item.wardName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            String(item.dumpSiteName || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchType = selectedVehicleType === 'All' || item.vehicleType === selectedVehicleType;

        return matchSearch && matchType;
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 rounded-lg">
                        <MapPin className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Trip Report</h1>
                        <p className="text-sm text-gray-500">Daily trip counts and dump site analysis</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                    >
                        <Upload className="w-4 h-4" />
                        Upload Trip Report
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
                    <div className="bg-white rounded-xl shadow-lg border-2 border-purple-100 p-6 mb-8">
                        <div className="grid grid-cols-3 items-center gap-6">
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

                            <div className="text-center flex flex-col items-center justify-center">
                                <div className="bg-purple-50 px-4 py-1 rounded-full mb-3">
                                    <span className="text-[10px] font-bold text-purple-600 uppercase tracking-[0.2em]">Official Report</span>
                                </div>
                                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight leading-none mb-2">
                                    DAILY TRIP<br />
                                    <span className="text-purple-600">REPORT</span>
                                </h1>
                                <div className="h-1 w-20 bg-purple-600 rounded-full mb-2"></div>
                            </div>

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

                    {/* Search & Filter */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by vehicle, ward, or dump site..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                            />
                        </div>

                        <div className="relative min-w-[200px]">
                            <select
                                value={selectedVehicleType}
                                onChange={(e) => setSelectedVehicleType(e.target.value)}
                                className="w-full pl-4 pr-10 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none appearance-none bg-white cursor-pointer"
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
                                <thead className="bg-purple-600 text-white font-bold text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-4 py-2 border border-purple-700 whitespace-nowrap text-center">S.No</th>
                                        <th className="px-4 py-2 border border-purple-700 whitespace-nowrap">Vehicle Number</th>
                                        <th className="px-4 py-2 border border-purple-700 whitespace-nowrap">Type</th>
                                        <th className="px-4 py-2 border border-purple-700 whitespace-nowrap">Ward</th>
                                        <th className="px-4 py-2 border border-purple-700 whitespace-nowrap text-center">Trip Count</th>
                                        <th className="px-4 py-2 border border-purple-700 whitespace-nowrap">Dump Site</th>
                                        <th className="px-4 py-2 border border-purple-700 whitespace-nowrap text-center">Date</th>
                                        <th className="px-4 py-2 border border-purple-700 whitespace-nowrap text-center w-32">In Time</th>
                                        <th className="px-4 py-2 border border-purple-700 whitespace-nowrap text-center w-32">Out Time</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs">
                                    {filteredData.map((row, index) => (
                                        <tr key={index} className="odd:bg-white even:bg-purple-50 hover:bg-purple-100 transition-colors">
                                            <td className="px-4 py-2 border border-gray-300 text-center text-gray-500 font-medium">{row.sNo}</td>
                                            <td className="px-4 py-2 border border-gray-300 font-bold text-gray-900">{row.vehicleNumber}</td>
                                            <td className="px-4 py-2 border border-gray-300 text-gray-600">{row.vehicleType}</td>
                                            <td className="px-4 py-2 border border-gray-300 text-gray-700">{row.wardName}</td>
                                            <td className="px-4 py-2 border border-gray-300 text-center font-bold text-purple-700 text-lg">{row.tripCount}</td>
                                            <td className="px-4 py-2 border border-gray-300 text-gray-700 font-medium">{row.dumpSiteName}</td>
                                            <td className="px-4 py-2 border border-gray-300 text-center font-bold text-gray-900 whitespace-nowrap">{row.tripDate}</td>
                                            <td className="px-4 py-2 border border-gray-300 text-center font-bold text-gray-800 font-mono text-xs whitespace-pre-wrap min-w-[120px]">{row.tripInTime}</td>
                                            <td className="px-4 py-2 border border-gray-300 text-center font-bold text-gray-800 font-mono text-xs whitespace-pre-wrap min-w-[120px]">{row.tripOutTime}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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
            ) : (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl border-2 border-dashed border-gray-300 text-gray-400 animate-in fade-in duration-500">
                    <div className={`p-4 rounded-full bg-gray-50 mb-4 ${isLoading ? 'animate-pulse' : ''}`}>
                        <Upload size={48} className="opacity-50" />
                    </div>
                    <p className="text-lg font-medium">{isLoading ? 'Processing File...' : 'Upload "Trip Report.csv" to generate report'}</p>
                    <p className="text-sm mt-2 text-gray-400">Supports CSV and Excel formats</p>
                </div>
            )}
        </div>
    );
};

export default TripReport;
