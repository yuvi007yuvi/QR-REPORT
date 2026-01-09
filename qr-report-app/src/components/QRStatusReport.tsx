import { useState, useMemo, useRef } from 'react';
import { FileUpload } from './FileUpload';
import { CheckCircle, FileDown, FileImage, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import masterDataJson from '../data/masterData.json';
import supervisorDataJson from '../data/supervisorData.json';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';

interface QRMasterRow {
    qrId: string;
    ward: string;
    zone: string;
    buildingName: string;
    siteName: string;
    type: string;
    supervisor: string;
    zonal: string;
}

interface ScanInfo {
    scanned: boolean;
    time: string;
    scannedBy: string;
}

const QRStatusReport = () => {
    const [scanFile, setScanFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [scanDataMap, setScanDataMap] = useState<Map<string, Map<string, ScanInfo>>>(new Map());
    const [availableDates, setAvailableDates] = useState<string[]>([]);

    // Export State
    const [isExporting, setIsExporting] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    // Filters
    const [selectedWard, setSelectedWard] = useState<string>('All');
    const [selectedZone, setSelectedZone] = useState<string>('All');
    const [selectedZonal, setSelectedZonal] = useState<string>('All');

    // 1. Process Master Data & Supervisor Mapping on Load
    const masterRecords: QRMasterRow[] = useMemo(() => {
        // Create Supervisor Map
        const wardMap = new Map<string, { supervisor: string; zonal: string }>();
        supervisorDataJson.forEach((row: any) => {
            let ward = row['Ward No'] ? String(row['Ward No']).trim() : (row['WARD NO.'] ? String(row['WARD NO.']).trim() : '');
            ward = ward.replace(/^0+/, ''); // Normalize "01" -> "1"
            const supervisor = row['Supervisor'] || row['SUPERVISOR NAME'] || '';
            const zonal = row['Zonal Head'] || '';
            if (ward) wardMap.set(ward, { supervisor, zonal });
        });

        // Zone Mapping
        const zoneMapping: Record<string, string> = {
            '1': '1-City',
            '2': '2-Bhuteswar',
            '3': '3-Aurangabad',
            '4': '4-Vrindavan'
        };

        // Process Master JSON
        return masterDataJson.map((row: any) => {
            const qrId = row['QR Code ID'] ? String(row['QR Code ID']).trim() : '';
            const wardRaw = row['Ward'] ? String(row['Ward']).trim() : '';

            // Extract Ward Number for lookup
            let wardNum = wardRaw.split('-')[0].trim();
            wardNum = wardNum.replace(/^0+/, '');

            const mapping = wardMap.get(wardNum) || { supervisor: '-', zonal: '-' };

            let zone = row['Zone & Circle'] ? String(row['Zone & Circle']).trim() : '';
            if (zoneMapping[zone]) zone = zoneMapping[zone];

            return {
                qrId,
                ward: wardRaw,
                zone,
                buildingName: row['Building/Street'] || '',
                siteName: row['Site Name'] || '',
                type: row['Type'] || '',
                supervisor: mapping.supervisor,
                zonal: mapping.zonal
            };
        }).filter(r => r.qrId); // Filter out empty IDs
    }, []);

    // Filter Options
    const { wards, zones, zonals } = useMemo(() => {
        const wards = Array.from(new Set(masterRecords.map(r => r.ward))).sort();
        const zones = Array.from(new Set(masterRecords.map(r => r.zone))).sort();
        const zonals = Array.from(new Set(masterRecords.map(r => r.zonal).filter(z => z !== '-'))).sort();
        return { wards, zones, zonals };
    }, [masterRecords]);

    // Helpers for Date Parsing (Copied from dataProcessor to ensure consistency)
    const formatExcelDate = (serial: number | string): string => {
        if (!serial) return '-';
        if (typeof serial === 'string' && (serial.includes('/') || serial.includes('-'))) return serial;
        const num = Number(serial);
        if (!isNaN(num)) {
            const date = new Date(Math.round((num - 25569) * 86400 * 1000));
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
        return String(serial);
    };

    const handleFileProcess = async () => {
        if (!scanFile) return;
        setLoading(true);

        try {
            const data = await scanFile.arrayBuffer();
            const workbook = XLSX.read(data, { type: 'binary' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            // Keys to look for
            const qrKeys = ['QR Code ID', 'QR Code', 'QR ID', 'qr_code_id', 'Content', 'Data', 'Serial Number', 'Barcode'];
            const dateKeys = ['Date Of Scan', 'Date', 'Scan Date', 'Timestamp', 'Time'];
            const supervisorKeys = ['Supervisor Name', 'Scan ID', 'Scanner', 'User', 'Employee Name'];

            const getValue = (row: any, keys: string[]) => {
                for (const key of keys) {
                    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return String(row[key]);
                }
                return undefined;
            };

            const scanMap = new Map<string, Map<string, ScanInfo>>();
            const datesSet = new Set<string>();

            jsonData.forEach((row: any) => {
                const qrId = getValue(row, qrKeys)?.trim();
                const rawDate = getValue(row, dateKeys);
                const scannedBy = getValue(row, supervisorKeys) || 'Unknown';

                if (qrId && rawDate) {
                    const dateStr = formatExcelDate(rawDate);
                    if (dateStr !== '-') {
                        datesSet.add(dateStr);

                        if (!scanMap.has(qrId)) {
                            scanMap.set(qrId, new Map());
                        }

                        scanMap.get(qrId)!.set(dateStr, {
                            scanned: true,
                            time: '-', // we could parse time if needed
                            scannedBy
                        });
                    }
                }
            });

            // Sort dates descending (newest first)
            const sortedDates = Array.from(datesSet).sort((a, b) => {
                const partsA = a.split(/[-/]/);
                const partsB = b.split(/[-/]/);
                if (partsA.length === 3 && partsB.length === 3) {
                    // dd/mm/yyyy
                    const dateA = new Date(`${partsA[2]}-${partsA[1]}-${partsA[0]}`);
                    const dateB = new Date(`${partsB[2]}-${partsB[1]}-${partsB[0]}`);
                    return dateB.getTime() - dateA.getTime();
                }
                return 0;
            });

            setAvailableDates(sortedDates);
            setScanDataMap(scanMap);
        } catch (error) {
            console.error(error);
            alert("Error processing file.");
        } finally {
            setLoading(false);
        }
    };

    // Filtered Rows
    const filteredRows = useMemo(() => {
        return masterRecords.filter(row => {
            if (selectedWard !== 'All' && row.ward !== selectedWard) return false;
            if (selectedZone !== 'All' && row.zone !== selectedZone) return false;
            if (selectedZonal !== 'All' && row.zonal !== selectedZonal) return false;
            return true;
        });
    }, [masterRecords, selectedWard, selectedZone, selectedZonal]);

    const exportToExcel = () => {
        if (filteredRows.length === 0) return;

        const excelData = filteredRows.map((row, index) => {
            const rowData: any = {
                'Sr. No.': index + 1,
                'QR ID': row.qrId,
                'Type': row.type,
                'Ward': row.ward,
                'Zone': row.zone,
                'Supervisor': row.supervisor,
                'Zonal': row.zonal,
                'Site Name': row.siteName,
                'Address': row.buildingName,
                'Total Scanned Days': 0
            };

            let daysScanned = 0;
            // Add columns for each date
            availableDates.forEach(date => {
                const status = scanDataMap.get(row.qrId)?.get(date);
                if (status?.scanned) daysScanned++;
                rowData[date] = status?.scanned ? 'Scanned' : 'Not Scanned';
            });
            rowData['Total Scanned Days'] = daysScanned;

            return rowData;
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'QR Master Status');
        XLSX.writeFile(wb, `QR_Master_Status_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleExportImage = async () => {
        if (!reportRef.current) return;
        setIsExporting(true);

        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for render

        try {
            const dataUrl = await toPng(reportRef.current, {
                cacheBust: true,
                backgroundColor: '#ffffff',
                width: reportRef.current.scrollWidth,
                height: reportRef.current.scrollHeight,
                style: {
                    overflow: 'visible',
                    maxWidth: 'none',
                    maxHeight: 'none'
                }
            });

            const link = document.createElement('a');
            link.download = `QR_Status_Report_${new Date().toISOString().split('T')[0]}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Image export failed:', error);
            alert('Failed to export image.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPDF = async () => {
        if (!reportRef.current) return;
        setIsExporting(true);

        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const dataUrl = await toPng(reportRef.current, {
                cacheBust: true,
                backgroundColor: '#ffffff',
                width: reportRef.current.scrollWidth,
                height: reportRef.current.scrollHeight,
                style: {
                    overflow: 'visible',
                    maxWidth: 'none',
                    maxHeight: 'none'
                }
            });

            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const imgProps = pdf.getImageProperties(dataUrl);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`QR_Status_Report_${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error('PDF export failed:', error);
            alert('Failed to export PDF.');
        } finally {
            setIsExporting(false);
        }
    };

    if (scanDataMap.size === 0) {
        return (
            <div className="max-w-2xl mx-auto mt-10 animate-in fade-in duration-500">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2 text-center">
                        QR Status Report (Master)
                    </h2>
                    <div className="flex justify-center items-center gap-2 mb-6">
                        <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-blue-400">Total QRs: {masterRecords.length}</span>
                    </div>
                    <p className="text-gray-500 mb-8 text-center max-w-md mx-auto">
                        Upload <strong>Bulk Collection Scan CSV</strong> to compare against the Master QR Database ({masterRecords.length} records).
                    </p>

                    <FileUpload
                        label="Bulk Collection Scan CSV"
                        file={scanFile}
                        onFileSelect={setScanFile}
                        required
                    />

                    <button
                        onClick={handleFileProcess}
                        disabled={!scanFile || loading}
                        className={`w-full mt-6 py-3 rounded-xl font-bold text-white transition-all shadow-lg ${!scanFile || loading
                            ? 'bg-gray-300 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 to-teal-700 hover:shadow-xl active:scale-95'
                            }`}
                    >
                        {loading ? 'Processing Scans...' : 'Generate Master Status Report'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${isExporting ? 'w-fit min-w-full' : ''}`} ref={reportRef}>
            {/* Header */}
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
                                Date Wise QR Scanned Status
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

            {/* Controls */}
            {/* Hide controls during export */}
            {!isExporting && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 no-print">
                    <div className="flex justify-between items-center mb-4">
                        <div className="space-x-4">
                            <span className="text-sm font-semibold text-gray-500">Total QRs in View: <span className="text-gray-900">{filteredRows.length}</span></span>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleExportImage}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-md flex items-center gap-2"
                            >
                                <FileImage size={18} />
                                Export Image
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-all shadow-md flex items-center gap-2"
                            >
                                <FileDown size={18} />
                                Export PDF
                            </button>
                            <button
                                onClick={exportToExcel}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all shadow-md flex items-center gap-2"
                            >
                                <FileSpreadsheet size={18} />
                                Export Excel
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Filter Ward</label>
                            <select
                                value={selectedWard}
                                onChange={(e) => setSelectedWard(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                            >
                                <option value="All">All Wards</option>
                                {wards.map(w => <option key={w} value={w}>{w}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Filter Zone</label>
                            <select
                                value={selectedZone}
                                onChange={(e) => setSelectedZone(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                            >
                                <option value="All">All Zones</option>
                                {zones.map(z => <option key={z} value={z}>Zone {z}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Filter Zonal</label>
                            <select
                                value={selectedZonal}
                                onChange={(e) => setSelectedZonal(e.target.value)}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                            >
                                <option value="All">All Zonals</option>
                                {zonals.map(z => <option key={z} value={z}>{z}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 transition-all duration-300 ${isExporting ? '' : ''}`}>
                {/* Conditionally remove max-h during export to show full table */}
                <div className={`${isExporting ? 'overflow-visible' : 'overflow-x-auto max-h-[600px]'} border border-gray-200 rounded-lg`}>
                    <table className="w-full border-collapse text-xs">
                        <thead className={isExporting ? '' : 'sticky top-0 z-20'}>
                            <tr className="bg-gradient-to-r from-green-600 to-teal-600 text-white shadow-sm">
                                <th className={`px-3 py-3 border-r border-green-700 ${isExporting ? '' : 'sticky left-0 bg-green-600 z-30'} w-16 text-center`}>Sr. No.</th>
                                <th className="px-3 py-3 border-r border-green-700 text-left min-w-[100px]">QR ID</th>
                                <th className="px-3 py-3 border-r border-green-700 text-left min-w-[80px]">Type</th>
                                <th className="px-3 py-3 border-r border-green-700 text-left min-w-[150px]">Ward</th>
                                <th className="px-3 py-3 border-r border-green-700 text-left min-w-[100px]">Zone</th>
                                <th className="px-3 py-3 border-r border-green-700 text-left min-w-[100px]">Zonal</th>
                                <th className="px-3 py-3 border-r border-green-700 text-left min-w-[100px]">Supervisor</th>
                                <th className="px-3 py-3 border-r border-green-700 text-left min-w-[150px]">Site Name</th>
                                <th className="px-3 py-3 border-r border-green-700 text-left min-w-[200px]">Address</th>
                                <th className="px-3 py-3 border-r border-green-700 text-center w-24">Scanned Days</th>
                                {availableDates.map(date => (
                                    <th key={date} className="px-2 py-3 border-r border-green-700 min-w-[90px] text-center whitespace-nowrap">
                                        {date}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredRows.length > 0 ? (
                                filteredRows.map((row, idx) => {
                                    // Calculate row stats
                                    const scanStatusMap = scanDataMap.get(row.qrId);
                                    let daysScanned = 0;
                                    availableDates.forEach(d => {
                                        if (scanStatusMap?.has(d)) daysScanned++;
                                    });

                                    return (
                                        <tr key={row.qrId} className={`hover:bg-blue-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                                            <td className={`px-3 py-2 border-r border-gray-200 text-center font-bold ${isExporting ? '' : 'sticky left-0 bg-inherit z-10'}`}>{idx + 1}</td>
                                            <td className="px-3 py-2 border-r border-gray-200 font-medium text-gray-900">{row.qrId}</td>
                                            <td className="px-3 py-2 border-r border-gray-200 text-gray-600">{row.type}</td>
                                            <td className="px-3 py-2 border-r border-gray-200 text-gray-600 truncate max-w-[150px]" title={row.ward}>{row.ward}</td>
                                            <td className="px-3 py-2 border-r border-gray-200 text-gray-600">{row.zone}</td>
                                            <td className="px-3 py-2 border-r border-gray-200 text-gray-600">{row.zonal}</td>
                                            <td className="px-3 py-2 border-r border-gray-200 text-gray-600">{row.supervisor}</td>
                                            <td className="px-3 py-2 border-r border-gray-200 text-gray-500 truncate max-w-[150px]" title={row.siteName}>{row.siteName}</td>
                                            <td className="px-3 py-2 border-r border-gray-200 text-gray-500 truncate max-w-[200px]" title={row.buildingName}>{row.buildingName}</td>
                                            <td className={`px-3 py-2 border-r border-gray-200 text-center font-bold ${daysScanned > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {daysScanned}
                                            </td>
                                            {availableDates.map(date => {
                                                const isScanned = scanStatusMap?.has(date);
                                                return (
                                                    <td key={date} className={`px-2 py-2 border-r border-gray-200 text-center`}>
                                                        {isScanned ? (
                                                            <div className="flex flex-col items-center justify-center">
                                                                <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mb-1">
                                                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                                                </div>
                                                                <span className="text-[10px] text-green-700 font-medium">Scanned</span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center">
                                                                <span className="bg-red-50 text-red-600 border border-red-100 px-2 py-1 rounded text-[10px] font-medium whitespace-nowrap">
                                                                    Not Scanned
                                                                </span>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10 + availableDates.length} className="px-6 py-10 text-center text-gray-500">
                                        No QRs found matching the filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default QRStatusReport;
