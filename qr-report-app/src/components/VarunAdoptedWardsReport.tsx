import React, { useState, useMemo, useRef } from 'react';
import { Download, FileDown, Upload, ImageIcon, Loader2, Calendar, FileText, Wand2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { toJpeg } from 'html-to-image';

// Import logos
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';

interface POIRecord {
    sNo: string;
    zoneCircle: string;
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

interface WardAggregate {
    zone: string;
    wardName: string;
    totalScheduled: number;
    totalCovered: number;
    totalNotCovered: number;
    averageCoverage: number;
    entriesCount: number;
    totalRoutes: number;
}

interface DateAggregate {
    date: string;
    totalScheduled: number;
    totalCovered: number;
    totalNotCovered: number;
    averageCoverage: number;
    totalRoutes: number;
}

interface VehicleAggregate {
    vehicleNumber: string;
    wardName: string;
    totalScheduled: number;
    totalCovered: number;
    totalNotCovered: number;
    averageCoverage: number;
    totalRoutes: number;
    routes: Set<string>;
}

const ADOPTED_WARDS = [
    "29-Koyla Alipur",
    "08-Atas",
    "28-Aurangabad Second",
    "57-Balajipuram",
    "45-Birla Mandir"
];

const VarunAdoptedWardsReport: React.FC = () => {
    const [poiData, setPoiData] = useState<POIRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [fileName, setFileName] = useState<string>('');
    const reportRef = useRef<HTMLDivElement>(null);
    const [viewMode, setViewMode] = useState<'ward' | 'date' | 'matrix' | 'vehicle'>('ward');
    const originalDataRef = useRef<POIRecord[]>([]);
    const [isSimulated, setIsSimulated] = useState(false);

    // ... (existing code)




    // Filters
    // Filters
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');

    // Parse helper
    const parseNumber = (val: string | number) => {
        if (typeof val === 'number') return val;
        return parseFloat(val?.toString().replace(/,/g, '') || '0');
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setFileName(file.name);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const ZONE_MAPPING: Record<string, string> = {
                    '1': 'City Zone',
                    '2': 'Bhuteswar Zone',
                    '3': 'Aurangabad Zone',
                    '4': 'Vrindavan Zone'
                };

                const parsedData: POIRecord[] = results.data.map((row: any) => {
                    const rawZone = row['Zone & Circle'] ? String(row['Zone & Circle']).trim() : '';
                    return {
                        sNo: row['S.No.'] || '',
                        zoneCircle: ZONE_MAPPING[rawZone] || rawZone, // Apply mapping
                        wardName: row['Ward Name'] || '',
                        vehicleNumber: row['Vehicle Number'] || '',
                        routeName: row['Route Name'] || '',
                        total: parseNumber(row['Total']),
                        covered: parseNumber(row['Covered']),
                        notCovered: parseNumber(row['Not Covered']),
                        coverage: parseNumber(row['Coverage']),
                        date: row['Date'] || '',
                        routeInTime: row['Route In Time'] || '',
                        routeOutTime: row['Route Out Time'] || ''
                    };
                }).filter(r => r.wardName);

                originalDataRef.current = JSON.parse(JSON.stringify(parsedData)); // Deep copy safety
                setPoiData(parsedData);
                setIsSimulated(false);
                setLoading(false);
            },
            error: (error) => {
                console.error('Error parsing CSV:', error);
                alert('Error parsing CSV file');
                setLoading(false);
            }
        });
    };

    const filteredData = useMemo(() => {
        let filtered = [...poiData];

        if (dateFrom || dateTo) {
            filtered = filtered.filter(item => {
                const [day, month, year] = item.date.split('-').map(Number);
                const itemDate = new Date(year, month - 1, day);
                itemDate.setHours(0, 0, 0, 0);

                let matchesFrom = true;
                let matchesTo = true;

                if (dateFrom) {
                    const [fYear, fMonth, fDay] = dateFrom.split('-').map(Number);
                    const fromDate = new Date(fYear, fMonth - 1, fDay);
                    fromDate.setHours(0, 0, 0, 0);
                    matchesFrom = itemDate.getTime() >= fromDate.getTime();
                }
                if (dateTo) {
                    const [tYear, tMonth, tDay] = dateTo.split('-').map(Number);
                    const toDate = new Date(tYear, tMonth - 1, tDay);
                    toDate.setHours(0, 0, 0, 0);
                    matchesTo = itemDate.getTime() <= toDate.getTime();
                }
                return matchesFrom && matchesTo;
            });
        }

        // Strictly filter for Adopted Wards
        filtered = filtered.filter(item => ADOPTED_WARDS.includes(item.wardName));

        return filtered;
    }, [poiData, dateFrom, dateTo]);

    // Derived Data: Aggregated by Ward
    const wardAggregatedData = useMemo(() => {
        // Find the latest date in the filtered data to show "Today's" snapshot
        let targetRecords = filteredData;
        let latestDateStr = '';

        if (filteredData.length > 0) {
            // Sort to find latest
            const sortedDates = [...new Set(filteredData.map(r => r.date))].sort((a, b) => {
                const [d1, m1, y1] = a.split('-').map(Number);
                const [d2, m2, y2] = b.split('-').map(Number);
                return new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
            });
            latestDateStr = sortedDates[0];
            targetRecords = filteredData.filter(r => r.date === latestDateStr);
        }

        const wardMap = new Map<string, WardAggregate & { routes: Set<string> }>();

        targetRecords.forEach(record => {
            if (!wardMap.has(record.wardName)) {
                wardMap.set(record.wardName, {
                    zone: record.zoneCircle,
                    wardName: record.wardName,
                    totalScheduled: 0,
                    totalCovered: 0,
                    totalNotCovered: 0,
                    averageCoverage: 0,
                    entriesCount: 0,
                    totalRoutes: 0,
                    routes: new Set()
                });
            }
            const current = wardMap.get(record.wardName)!;
            current.totalScheduled += record.total;
            current.totalCovered += record.covered;
            current.totalNotCovered += record.notCovered;
            current.entriesCount += 1;
            if (record.routeName) {
                current.routes.add(record.routeName);
            }
        });

        const result = Array.from(wardMap.values()).map(ward => ({
            ...ward,
            totalRoutes: ward.routes.size,
            averageCoverage: ward.totalScheduled > 0
                ? (ward.totalCovered / ward.totalScheduled) * 100
                : 0
        }));

        result.sort((a, b) => a.wardName.localeCompare(b.wardName));
        // Attach the latest date to the result array object itself for display if needed? 
        // Hacky but effective: strictly speaking we just return the array.
        // We will expose latestDate via a separate variable or hook if needed, 
        // but for now the user just wants the DATA to be filtered.
        return result;
    }, [filteredData]);

    // Derived Data: Aggregated by Date
    const dateAggregatedData = useMemo(() => {
        const dateMap = new Map<string, DateAggregate & { routes: Set<string> }>();

        filteredData.forEach(record => {
            const dateKey = record.date;
            if (!dateMap.has(dateKey)) {
                dateMap.set(dateKey, {
                    date: dateKey,
                    totalScheduled: 0,
                    totalCovered: 0,
                    totalNotCovered: 0,
                    averageCoverage: 0,
                    totalRoutes: 0,
                    routes: new Set()
                });
            }
            const current = dateMap.get(dateKey)!;
            current.totalScheduled += record.total;
            current.totalCovered += record.covered;
            current.totalNotCovered += record.notCovered;
            if (record.routeName) {
                current.routes.add(record.routeName);
            }
        });

        // Fill in missing dates if range is selected
        if (dateFrom && dateTo) {
            const [fYear, fMonth, fDay] = dateFrom.split('-').map(Number);
            const start = new Date(fYear, fMonth - 1, fDay);

            const [tYear, tMonth, tDay] = dateTo.split('-').map(Number);
            const end = new Date(tYear, tMonth - 1, tDay);

            // Loop through dates
            // eslint-disable-next-line no-unmodified-loop-condition
            for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
                // Format to DD-MM-YYYY to match CSV format
                const day = String(dt.getDate()).padStart(2, '0');
                const month = String(dt.getMonth() + 1).padStart(2, '0');
                const year = dt.getFullYear();
                const dateKey = `${day} -${month} -${year} `;

                if (!dateMap.has(dateKey)) {
                    dateMap.set(dateKey, {
                        date: dateKey,
                        totalScheduled: 0,
                        totalCovered: 0,
                        totalNotCovered: 0,
                        averageCoverage: 0,
                        totalRoutes: 0,
                        routes: new Set()
                    });
                }
            }
        }

        const result = Array.from(dateMap.values()).map(d => ({
            ...d,
            totalRoutes: d.routes.size,
            averageCoverage: d.totalScheduled > 0
                ? (d.totalCovered / d.totalScheduled) * 100
                : 0
        }));

        // Sort by Date
        result.sort((a, b) => {
            const [d1, m1, y1] = a.date.split('-').map(Number);
            const [d2, m2, y2] = b.date.split('-').map(Number);
            return new Date(y1, m1 - 1, d1).getTime() - new Date(y2, m2 - 1, d2).getTime();
        });

        return result;
    }, [filteredData, dateFrom, dateTo]);

    // Derived Data: Aggregated by Vehicle
    const vehicleAggregatedData = useMemo(() => {
        let targetRecords = filteredData;

        // Similar to Ward view, we might want to prioritize "Today's" snapshot if we aren't filtering dates?
        // Or should we show aggregate over selected date range? The user didn't specify, but usually "Vehicle Wise Coverage" implies aggregate performance or daily snapshot.
        // Let's stick to the same logic as Ward view: latest date snapshot if no custom date filters (or even if there are filters, finding the latest in that range is safer for "current status").
        // actually, for coverage reports over a period, we often sum up. But coverage % is tricky.
        // Let's follow Ward View Pattern: "Latest Snapshot" strategy for consistency.

        if (filteredData.length > 0) {
            const sortedDates = [...new Set(filteredData.map(r => r.date))].sort((a, b) => {
                const [d1, m1, y1] = a.split('-').map(Number);
                const [d2, m2, y2] = b.split('-').map(Number);
                return new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
            });
            const latestDateStr = sortedDates[0];
            targetRecords = filteredData.filter(r => r.date === latestDateStr);
        }

        const vehicleMap = new Map<string, VehicleAggregate>();

        targetRecords.forEach(record => {
            // Group Key: Vehicle + Ward (since a vehicle might cover parts of different wards, though usually 1:1)
            // Ideally Vehicle Number is unique enough. Let's group by Vehicle Number primarily.
            const key = record.vehicleNumber || 'Unknown';

            if (!vehicleMap.has(key)) {
                vehicleMap.set(key, {
                    vehicleNumber: key,
                    wardName: record.wardName, // taking first ward encountered
                    totalScheduled: 0,
                    totalCovered: 0,
                    totalNotCovered: 0,
                    averageCoverage: 0,
                    totalRoutes: 0,
                    routes: new Set()
                });
            }
            const current = vehicleMap.get(key)!;
            // If vehicle spans multiple wards, maybe append ward name?
            if (!current.wardName.includes(record.wardName)) {
                // For now, simple keeps the first one or we can concat (e.g. Ward A, Ward B)
                // maximizing simplicity: if it's different, maybe it's better to group by Ward? 
                // User asked "Vehicle Wise", so Vehicle is the primary key.
            }

            current.totalScheduled += record.total;
            current.totalCovered += record.covered;
            current.totalNotCovered += record.notCovered;
            if (record.routeName) {
                current.routes.add(record.routeName);
            }
        });

        const result = Array.from(vehicleMap.values()).map(v => ({
            ...v,
            totalRoutes: v.routes.size,
            averageCoverage: v.totalScheduled > 0
                ? (v.totalCovered / v.totalScheduled) * 100
                : 0
        }));

        result.sort((a, b) => a.vehicleNumber.localeCompare(b.vehicleNumber));
        return result;
    }, [filteredData]);

    // Derived Data: Matrix View (Rows = Wards, Cols = Dates)
    const matrixData = useMemo(() => {
        // 1. Get all dates from dateAggregatedData (which already handles range filling and sorting)
        const allDates = dateAggregatedData.map(d => d.date);

        // 2. Group by Ward
        const wardMap = new Map<string, {
            zone: string;
            wardName: string;
            totalRoutes: number;
            totalScheduled: number;
            routes: Set<string>;
            dailyStats: { [date: string]: { connected: boolean, coverage: number, covered: number, total: number } };
        }>();

        // Initialize wards from filteredData (or wardAggregatedData to ensure all wards are present)
        wardAggregatedData.forEach(ward => {
            wardMap.set(ward.wardName, {
                zone: ward.zone,
                wardName: ward.wardName,
                totalRoutes: ward.totalRoutes, // Use Today's Route Count
                totalScheduled: ward.totalScheduled, // Use Today's Assigned POI
                routes: new Set(),
                dailyStats: {}
            });
        });

        // 3. Populate Data (Only Daily Stats, don't accumulate Totals/Routes as we use Today's snapshot)
        filteredData.forEach(record => {
            const wardEntry = wardMap.get(record.wardName);
            if (wardEntry) {
                if (!wardEntry.dailyStats[record.date]) {
                    wardEntry.dailyStats[record.date] = { connected: true, coverage: 0, covered: 0, total: 0 };
                }
                const dayStat = wardEntry.dailyStats[record.date];
                dayStat.covered += record.covered;
                dayStat.total += record.total;
                // Recalculate coverage for this day
                dayStat.coverage = dayStat.total > 0 ? (dayStat.covered / dayStat.total) * 100 : 0;
            }
        });

        // 4. Convert to Array and Sort
        const rows = Array.from(wardMap.values()).map(row => ({
            ...row
        })).sort((a, b) => a.wardName.localeCompare(b.wardName));

        return {
            dates: allDates,
            rows
        };
    }, [dateAggregatedData, wardAggregatedData, filteredData]);



    // Export Excel
    const handleSimulate70 = () => {
        if (isSimulated) {
            // Restore
            if (originalDataRef.current.length > 0) {
                setPoiData(JSON.parse(JSON.stringify(originalDataRef.current)));
            }
            setIsSimulated(false);
        } else {
            // Apply Simulation
            if (!poiData.length) return;

            // Base calculation on original data
            const baseData = originalDataRef.current.length > 0
                ? JSON.parse(JSON.stringify(originalDataRef.current))
                : [...poiData];

            // Helper to check filter match
            const isMatch = (item: POIRecord) => {
                let matchesDate = true;
                if (dateFrom || dateTo) {
                    const [day, month, year] = item.date.split('-').map(Number);
                    const itemDate = new Date(year, month - 1, day);
                    itemDate.setHours(0, 0, 0, 0);

                    if (dateFrom) {
                        const [fYear, fMonth, fDay] = dateFrom.split('-').map(Number);
                        const fromDate = new Date(fYear, fMonth - 1, fDay);
                        fromDate.setHours(0, 0, 0, 0);
                        if (itemDate.getTime() < fromDate.getTime()) matchesDate = false;
                    }
                    if (dateTo && matchesDate) {
                        const [tYear, tMonth, tDay] = dateTo.split('-').map(Number);
                        const toDate = new Date(tYear, tMonth - 1, tDay);
                        toDate.setHours(0, 0, 0, 0);
                        if (itemDate.getTime() > toDate.getTime()) matchesDate = false;
                    }
                }

                // Match only Adopted Wards
                const matchesWard = ADOPTED_WARDS.includes(item.wardName);

                return matchesDate && matchesWard;
            };

            // Calculate stats for FILTERED set
            const filteredSet = baseData.filter(isMatch);
            const totalScheduled = filteredSet.reduce((acc: number, r: POIRecord) => acc + r.total, 0);
            const totalCovered = filteredSet.reduce((acc: number, r: POIRecord) => acc + r.covered, 0);

            if (totalScheduled === 0) {
                alert("No data matches current filters to simulate.");
                return;
            }

            const currentCoverage = totalCovered / totalScheduled;
            const targetCoverage = 0.70;

            if (currentCoverage >= targetCoverage) {
                alert(`Current filtered coverage (${(currentCoverage * 100).toFixed(2)}%) is already above 70%.`);
                return;
            }

            const factor = targetCoverage / currentCoverage;

            const simulatedData = baseData.map((record: POIRecord) => {
                // Only modify if it matches filters!
                if (!isMatch(record)) return record;

                let newCovered = Math.floor(record.covered * factor);
                // Clamp
                if (newCovered > record.total) newCovered = record.total;

                // Artificial boost for zeros to ensure movement
                if (record.covered === 0 && record.total > 0) {
                    newCovered = Math.floor(record.total * 0.60);
                }

                return {
                    ...record,
                    covered: newCovered,
                    notCovered: record.total - newCovered,
                    coverage: record.total > 0 ? (newCovered / record.total) * 100 : 0
                };
            });

            setPoiData(simulatedData);
            setIsSimulated(true);
        }
    };

    const handleExportExcel = () => {
        if (viewMode === 'ward') {
            const ws = XLSX.utils.json_to_sheet(wardAggregatedData.map((item, index) => ({
                'S.No': index + 1,
                'Zone': item.zone,
                'Wards': item.wardName,
                'Total POI': item.totalScheduled,
                'Covered POI': item.totalCovered,
                'Not Covered': item.totalNotCovered,
                'Coverage %': item.averageCoverage.toFixed(2)
            })));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Varun Adopted Ward Report');
            XLSX.writeFile(wb, `Varun_Adopted_Ward_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
        } else if (viewMode === 'vehicle') {
            const ws = XLSX.utils.json_to_sheet(vehicleAggregatedData.map((item, index) => ({
                'S.No': index + 1,
                'Vehicle Number': item.vehicleNumber,
                'Ward Name': item.wardName,
                'Total Routes': item.totalRoutes,
                'Total POI': item.totalScheduled,
                'Covered POI': item.totalCovered,
                'Not Covered': item.totalNotCovered,
                'Coverage %': item.averageCoverage.toFixed(2)
            })));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Vehicle Wise Adopted Report');
            XLSX.writeFile(wb, `Vehicle_Wise_Adopted_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
        } else {
            const ws = XLSX.utils.json_to_sheet(dateAggregatedData.map((item, index) => ({
                'S.No': index + 1,
                'Date': item.date,
                'Total POI': item.totalScheduled,
                'Covered POI': item.totalCovered,
                'Not Covered': item.totalNotCovered,
                'Coverage %': `${item.averageCoverage.toFixed(2)}% (${item.totalCovered})`
            })));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Date Wise Adopted Report');
            XLSX.writeFile(wb, `Date_Wise_Adopted_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
        }
    };

    const handleExportRawCSV = () => {
        if (!filteredData.length) {
            alert("No data to export");
            return;
        }

        const csvData = filteredData.map((item, index) => ({
            'S.No.': index + 1,
            'Zone & Circle': item.zoneCircle,
            'Ward Name': item.wardName,
            'Vehicle Number': item.vehicleNumber,
            'Route Name': item.routeName,
            'Total': item.total,
            'Covered': item.covered,
            'Not Covered': item.notCovered,
            'Coverage': item.coverage,
            'Date': item.date,
            'Route In Time': item.routeInTime,
            'Route Out Time': item.routeOutTime
        }));

        const ws = XLSX.utils.json_to_sheet(csvData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "POI Data");
        XLSX.writeFile(wb, `Filtered_Adopted_Report_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handleExportGeneric = async (type: 'jpeg' | 'pdf_image') => {
        if (!reportRef.current) return;
        try {
            const element = reportRef.current;

            const filter = (node: HTMLElement) => {
                return !node.classList?.contains('no-print');
            }

            const dataUrl = await toJpeg(element, {
                quality: 0.95,
                backgroundColor: '#ffffff',
                width: element.scrollWidth,
                height: element.scrollHeight,
                style: {
                    overflow: 'visible',
                    height: 'auto',
                    maxHeight: 'none'
                },
                filter: filter as any
            });

            if (type === 'jpeg') {
                const link = document.createElement('a');
                link.download = `${viewMode}_Varun_Adopted_Report.jpeg`;
                link.href = dataUrl;
                link.click();
            } else {
                const pdf = new jsPDF('l', 'mm', 'a4');
                const imgProps = pdf.getImageProperties(dataUrl);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                pdf.save(`${viewMode}_Varun_Adopted_Report.pdf`);
            }
        } catch (e) {
            console.error("Export Error", e);
            alert("Export failed. Please try " + (type === 'jpeg' ? "Excel" : "JPEG") + " export instead.");
        }
    }

    const aggregatedData = viewMode === 'ward' ? wardAggregatedData
        : viewMode === 'vehicle' ? vehicleAggregatedData
            : dateAggregatedData;

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 items-center relative">
            {/* Loading Overlay */}
            {loading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                    <p className="text-lg font-semibold text-gray-700">Processing POI Data...</p>
                </div>
            )}

            {/* Header */}
            <div className="w-[98%] bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-6 shrink-0 shadow-sm mb-4 mt-2 rounded-xl">
                <img src={NagarNigamLogo} alt="NN" className="h-20 object-contain" />
                <div className="text-center">
                    <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Mathura Vrindavan Nagar Nigam</h1>
                    <div className="inline-block border-b-4 border-emerald-500 pb-1 mt-1">
                        <h2 className="text-xl font-bold text-emerald-700 uppercase tracking-wide">
                            {viewMode === 'ward' ? 'Varun Adopted Ward Report' : 'Date Wise Adopted Report'}
                        </h2>
                    </div>
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-2">{dateFrom && dateTo ? `${dateFrom} to ${dateTo} ` : 'Monthly Report'}</h3>
                </div>
                <img src={NatureGreenLogo} alt="NG" className="h-20 object-contain" />
            </div>

            {/* Controls */}
            <div className="w-[98%] bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-2 shrink-0 no-print">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="csv-upload"
                            />
                            <label
                                htmlFor="csv-upload"
                                className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 cursor-pointer flex items-center gap-2 transition-colors"
                            >
                                <Upload className="w-5 h-5" />
                                <span>Upload POI CSV</span>
                            </label>
                        </div>
                        {fileName && <span className="text-sm text-gray-600 font-medium">File: {fileName}</span>}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={handleSimulate70}
                            className={`p-2.5 text-white rounded-lg shadow-sm transition-colors ${isSimulated ? 'bg-purple-800 ring-2 ring-purple-400' : 'bg-purple-600 hover:bg-purple-700'}`}
                            title={isSimulated ? "Restore Original Data" : "Simulate 70% Coverage"}
                        >
                            <Wand2 className="w-5 h-5" />
                        </button>
                        <button onClick={handleExportExcel} className="p-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm" title="Export Excel">
                            <Download className="w-5 h-5" />
                        </button>
                        <button onClick={handleExportRawCSV} className="p-2.5 bg-slate-600 text-white rounded-lg hover:bg-slate-700 shadow-sm" title="Export Raw CSV">
                            <FileText className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleExportGeneric('pdf_image')} className="p-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm" title="Export PDF">
                            <FileDown className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleExportGeneric('jpeg')} className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm" title="Export JPEG">
                            <ImageIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('ward')}
                            className={`px - 4 py - 2 text - sm font - semibold rounded - md transition - all ${viewMode === 'ward' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'} `}
                        >
                            Ward Wise
                        </button>
                        <button
                            onClick={() => setViewMode('date')}
                            className={`px - 4 py - 2 text - sm font - semibold rounded - md transition - all ${viewMode === 'date' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'} `}
                        >
                            Date Wise
                        </button>
                        <button
                            onClick={() => setViewMode('matrix')}
                            className={`px - 4 py - 2 text - sm font - semibold rounded - md transition - all ${viewMode === 'matrix' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'} `}
                        >
                            Day Wise Matrix
                        </button>
                        <button
                            onClick={() => setViewMode('vehicle')}
                            className={`px - 4 py - 2 text - sm font - semibold rounded - md transition - all ${viewMode === 'vehicle' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'} `}
                        >
                            Vehicle Wise
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
                        {/* Zone/Ward Filters Removed for Adopted Report */}

                        {/* From Date */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Calendar className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="w-full pl-10 pr-3 py-2.5 text-sm font-medium border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-gray-50 hover:bg-white transition-all shadow-sm text-gray-700 h-11"
                                placeholder="From Date"
                            />
                        </div>

                        {/* To Date */}
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Calendar className="h-5 w-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
                            </div>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="w-full pl-10 pr-3 py-2.5 text-sm font-medium border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 bg-gray-50 hover:bg-white transition-all shadow-sm text-gray-700 h-11"
                                placeholder="To Date"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Stats Cards */}
            <div className="w-[98%] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4 shrink-0 no-print">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Zones</p>
                    <h3 className="text-2xl font-black text-purple-600 mt-1">
                        {new Set(wardAggregatedData.map(d => d.zone)).size}
                    </h3>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Wards</p>
                    <h3 className="text-2xl font-black text-blue-600 mt-1">
                        {wardAggregatedData.length}
                    </h3>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total POIs</p>
                    <h3 className="text-2xl font-black text-gray-800 mt-1">
                        {wardAggregatedData.reduce((acc, curr) => acc + curr.totalScheduled, 0).toLocaleString()}
                    </h3>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Covered POIs</p>
                    <h3 className="text-2xl font-black text-emerald-600 mt-1">
                        {wardAggregatedData.reduce((acc, curr) => acc + curr.totalCovered, 0).toLocaleString()}
                    </h3>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Avg Coverage</p>
                    <h3 className={`text-2xl font-black mt-1 ${(wardAggregatedData.length > 0
                        ? (wardAggregatedData.reduce((acc, curr) => acc + curr.totalCovered, 0) / wardAggregatedData.reduce((acc, curr) => acc + curr.totalScheduled, 0) * 100)
                        : 0) >= 90 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                        {(wardAggregatedData.length > 0
                            ? (wardAggregatedData.reduce((acc, curr) => acc + curr.totalCovered, 0) / wardAggregatedData.reduce((acc, curr) => acc + curr.totalScheduled, 0) * 100)
                            : 0
                        ).toFixed(2)}%
                    </h3>
                </div>
            </div>

            {/* Report Content */}
            <div className="w-[98%] flex flex-col bg-white rounded-xl shadow-lg border border-gray-200 mb-4" ref={reportRef}>
                {/* Internal Header for Export context */}
                {/* Internal Header for Export context */}
                <div className="bg-white border-b border-gray-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
                    <img src={NagarNigamLogo} alt="NN" className="h-16 object-contain" />

                    <div className="text-center flex-1">
                        <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Mathura Vrindavan Nagar Nigam</h1>
                        <h2 className="text-sm font-bold text-emerald-700 uppercase tracking-wide mt-1">
                            {viewMode === 'ward' ? 'Ward Wise POI Coverage Report' : viewMode === 'vehicle' ? 'Vehicle Wise Coverage Report' : viewMode === 'date' ? 'Date Wise POI Coverage Report' : 'Day Wise Matrix Coverage Report'}
                        </h2>

                        <div className="flex flex-wrap justify-center gap-2 mt-2 text-xs font-medium text-gray-600">
                            {dateFrom && dateTo && (
                                <span className="bg-gray-100 px-2 py-1 rounded">Date: {dateFrom} to {dateTo}</span>
                            )}
                            <span className="bg-gray-100 px-2 py-1 rounded">Filter: Adopted Wards Only</span>
                            {/* Summary count */}
                            <span className="bg-gray-100 px-2 py-1 rounded">
                                {viewMode === 'ward' ? `Total Wards: ${aggregatedData.length} ` : viewMode === 'date' ? `Total Days: ${aggregatedData.length} ` : `Total Wards: ${matrixData.rows.length} `}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <img src={NatureGreenLogo} alt="NG" className="h-16 object-contain" />
                        <p className="text-[10px] text-gray-400 font-medium">Generated: {new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <div className="w-full">
                    <table className="w-full text-sm text-center text-gray-800 relative border border-gray-300">
                        <thead className="bg-gray-800 text-white uppercase text-xs font-bold tracking-wider sticky top-0 z-10 shadow-sm">
                            {viewMode === 'ward' ? (
                                <tr>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">S.No.</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Zone</th>
                                    <th className="px-3 py-3 border-b border-gray-600 text-left bg-gray-800">Wards</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Total Routes</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Assigned POI</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Covered</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Not Covered</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Coverage %</th>
                                </tr>
                            ) : viewMode === 'vehicle' ? (
                                <tr>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">S.No.</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Vehicle Number</th>
                                    <th className="px-3 py-3 border-b border-gray-600 text-left bg-gray-800">Ward Name</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Total Routes</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Assigned POI</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Covered</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Not Covered</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Coverage %</th>
                                </tr>
                            ) : viewMode === 'date' ? (
                                <tr>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">S.No.</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Date</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Total Routes</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Assigned POI</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Covered</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Not Covered</th>
                                    <th className="px-3 py-3 border-b border-gray-600 bg-gray-800">Coverage Status</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="px-3 py-3 border border-gray-500 bg-gray-800">S.No.</th>
                                    <th className="px-3 py-3 border border-gray-500 bg-gray-800">Zone</th>
                                    <th className="px-3 py-3 border border-gray-500 text-left bg-gray-800 min-w-[150px]">Wards</th>
                                    <th className="px-3 py-3 border border-gray-500 bg-gray-800">Total Routes</th>
                                    <th className="px-3 py-3 border border-gray-500 bg-gray-800">Assigned POI</th>
                                    {matrixData.dates.map(date => (
                                        <th key={date} className="px-2 py-3 border border-gray-500 bg-gray-800 min-w-[80px] whitespace-nowrap">
                                            {date}
                                        </th>
                                    ))}
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {viewMode === 'ward' ? (
                                (aggregatedData as WardAggregate[]).map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-3 py-2 font-medium text-gray-500">{index + 1}</td>
                                        <td className="px-3 py-2 font-bold text-gray-800">{row.zone}</td>
                                        <td className="px-3 py-2 text-left font-semibold text-gray-800">{row.wardName}</td>
                                        <td className="px-3 py-2 font-mono text-gray-600">{(row as WardAggregate).totalRoutes}</td>
                                        <td className="px-3 py-2 font-mono text-gray-600">{row.totalScheduled}</td>
                                        <td className="px-3 py-2 font-bold text-emerald-600">{row.totalCovered}</td>
                                        <td className="px-3 py-2 font-bold text-red-500">{row.totalNotCovered}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h - full ${row.averageCoverage >= 90 ? 'bg-emerald-500' : row.averageCoverage >= 75 ? 'bg-yellow-500' : 'bg-red-500'} `}
                                                        style={{ width: `${Math.min(row.averageCoverage, 100)}% ` }}
                                                    />
                                                </div>
                                                <span className={`text - xs font - bold ${row.averageCoverage >= 90 ? 'text-emerald-700' : row.averageCoverage >= 75 ? 'text-yellow-700' : 'text-red-700'} `}>
                                                    {row.averageCoverage.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : viewMode === 'vehicle' ? (
                                (aggregatedData as VehicleAggregate[]).map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-3 py-2 font-medium text-gray-500">{index + 1}</td>
                                        <td className="px-3 py-2 font-bold text-gray-800">{row.vehicleNumber}</td>
                                        <td className="px-3 py-2 text-left font-semibold text-gray-800">{row.wardName}</td>
                                        <td className="px-3 py-2 font-mono text-gray-600">{(row as VehicleAggregate).totalRoutes}</td>
                                        <td className="px-3 py-2 font-mono text-gray-600">{row.totalScheduled}</td>
                                        <td className="px-3 py-2 font-bold text-emerald-600">{row.totalCovered}</td>
                                        <td className="px-3 py-2 font-bold text-red-500">{row.totalNotCovered}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${row.averageCoverage >= 90 ? 'bg-emerald-500' : row.averageCoverage >= 75 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                        style={{ width: `${Math.min(row.averageCoverage, 100)}%` }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-bold ${row.averageCoverage >= 90 ? 'text-emerald-700' : row.averageCoverage >= 75 ? 'text-yellow-700' : 'text-red-700'}`}>
                                                    {row.averageCoverage.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : viewMode === 'date' ? (
                                (aggregatedData as DateAggregate[]).map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-3 py-2 font-medium text-gray-500">{index + 1}</td>
                                        <td className="px-3 py-2 font-bold text-gray-800">{row.date}</td>
                                        <td className="px-3 py-2 font-mono text-gray-600">{(row as DateAggregate).totalRoutes}</td>
                                        <td className="px-3 py-2 font-mono text-gray-600">{row.totalScheduled}</td>
                                        <td className="px-3 py-2 font-bold text-emerald-600">{row.totalCovered}</td>
                                        <td className="px-3 py-2 font-bold text-red-500">{row.totalNotCovered}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h - full ${row.averageCoverage >= 90 ? 'bg-emerald-500' : row.averageCoverage >= 75 ? 'bg-yellow-500' : 'bg-red-500'} `}
                                                        style={{ width: `${Math.min(row.averageCoverage, 100)}% ` }}
                                                    />
                                                </div>
                                                <span className={`text - xs font - bold ${row.averageCoverage >= 90 ? 'text-emerald-700' : row.averageCoverage >= 75 ? 'text-yellow-700' : 'text-red-700'} `}>
                                                    {row.averageCoverage.toFixed(2)}% <span className="text-gray-800 font-bold">({row.totalCovered})</span>
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                matrixData.rows.map((row, index) => (
                                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-3 py-2 font-medium text-gray-500 border border-gray-400">{index + 1}</td>
                                        <td className="px-3 py-2 font-bold text-gray-800 text-xs border border-gray-400">{row.zone}</td>
                                        <td className="px-3 py-2 text-left font-semibold text-gray-800 text-xs border border-gray-400">{row.wardName}</td>
                                        <td className="px-3 py-2 font-mono text-gray-600 border border-gray-400">{row.totalRoutes}</td>
                                        <td className="px-3 py-2 font-mono text-gray-600 border border-gray-400">{row.totalScheduled}</td>
                                        {matrixData.dates.map(date => {
                                            const stat = row.dailyStats[date];
                                            const coverage = stat ? stat.coverage : 0;
                                            const covered = stat ? stat.covered : 0;

                                            let colorClass = 'text-gray-400';
                                            let bgClass = '';
                                            if (stat && stat.total > 0) {
                                                if (coverage >= 75) {
                                                    colorClass = 'text-emerald-800 font-bold';
                                                    bgClass = 'bg-emerald-200';
                                                }
                                                else if (coverage >= 60) {
                                                    colorClass = 'text-green-700 font-bold';
                                                    bgClass = 'bg-green-100';
                                                }
                                                else if (coverage >= 40) {
                                                    colorClass = 'text-yellow-700 font-bold';
                                                    bgClass = 'bg-yellow-100';
                                                }
                                                else if (coverage > 0) {
                                                    colorClass = 'text-red-600 font-bold';
                                                    bgClass = 'bg-red-50';
                                                }
                                                else {
                                                    colorClass = 'text-red-900 font-bold';
                                                    bgClass = 'bg-red-200';
                                                }
                                            }

                                            return (
                                                <td key={date} className={`px - 2 py - 2 text - xs border border - gray - 400 ${bgClass} ${colorClass} `}>
                                                    {stat && stat.total > 0 ? (
                                                        <div className="flex flex-col items-center">
                                                            <span>{coverage.toFixed(0)}%</span>
                                                            <span className="text-[10px] opacity-75">({covered})</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                            {aggregatedData.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-gray-500 italic">No data available. Please upload a CSV file.</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-gray-800 text-white font-bold border-t-2 border-gray-600 shadow-md">
                            {viewMode === 'matrix' ? (
                                <tr>
                                    <td colSpan={3} className="px-3 py-4 text-right uppercase tracking-wider text-gray-300 border border-gray-600">Grand Total</td>
                                    <td className="px-3 py-4 border border-gray-600 font-mono text-center text-lg">
                                        {matrixData.rows.reduce((acc, row) => acc + row.totalRoutes, 0)}
                                    </td>
                                    <td className="px-3 py-4 border border-gray-600 font-mono text-center text-lg">
                                        {matrixData.rows.reduce((acc, row) => acc + row.totalScheduled, 0)}
                                    </td>
                                    {matrixData.dates.map(date => {
                                        let totalScheduled = 0;
                                        let totalCovered = 0;
                                        matrixData.rows.forEach(row => {
                                            const stat = row.dailyStats[date];
                                            if (stat) {
                                                totalScheduled += stat.total;
                                                totalCovered += stat.covered;
                                            }
                                        });

                                        const coverage = totalScheduled > 0 ? (totalCovered / totalScheduled) * 100 : 0;

                                        let colorClass = 'text-gray-500';
                                        if (totalScheduled > 0) {
                                            if (coverage >= 75) colorClass = 'text-emerald-400 font-extrabold';
                                            else if (coverage >= 60) colorClass = 'text-green-400 font-bold';
                                            else if (coverage >= 40) colorClass = 'text-yellow-400 font-bold';
                                            else if (coverage > 0) colorClass = 'text-red-400 font-bold';
                                            else colorClass = 'text-red-300 font-bold';
                                        }

                                        return (
                                            <td key={date} className={`px-2 py-4 text-xs border border-gray-600 text-center ${colorClass}`}>
                                                {totalScheduled > 0 ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-sm">{coverage.toFixed(0)}%</span>
                                                        <span className="text-[10px] text-gray-400 font-normal">({totalCovered})</span>
                                                    </div>
                                                ) : '-'}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ) : (
                                <tr>
                                    <td colSpan={viewMode === 'ward' || viewMode === 'vehicle' ? 3 : 2} className="px-3 py-4 text-right uppercase tracking-wider text-gray-300 border-t border-gray-600">Grand Total</td>
                                    <td className="px-3 py-4 border-t border-gray-600 font-mono text-lg text-center" >
                                        {aggregatedData.reduce((acc: number, curr: any) => acc + (curr.totalRoutes || 0), 0)}
                                    </td>
                                    <td className="px-3 py-4 border-t border-gray-600 font-mono text-lg text-center">
                                        {aggregatedData.reduce((acc: number, curr: any) => acc + curr.totalScheduled, 0)}
                                    </td>
                                    <td className="px-3 py-4 border-t border-gray-600 text-emerald-400 text-center text-lg">{aggregatedData.reduce((acc: number, curr: any) => acc + curr.totalCovered, 0)}</td>
                                    <td className="px-3 py-4 border-t border-gray-600 text-red-400 text-center text-lg">{aggregatedData.reduce((acc: number, curr: any) => acc + curr.totalNotCovered, 0)}</td>
                                    <td className="px-3 py-4 border-t border-gray-600 text-blue-400 text-center text-lg">
                                        {(aggregatedData.length > 0
                                            ? (aggregatedData.reduce((acc: number, curr: any) => acc + curr.totalCovered, 0) / aggregatedData.reduce((acc: number, curr: any) => acc + curr.totalScheduled, 0) * 100)
                                            : 0
                                        ).toFixed(2)}%
                                    </td>
                                </tr>
                            )}
                        </tfoot>
                    </table>
                </div>
            </div>


            {/* Footer */}
            <div className="mb-6 text-center">
                <div className="inline-block bg-white px-8 py-4 rounded-full shadow-sm border border-slate-100">
                    <p className="text-slate-600 font-medium text-sm">
                        Report generated by <span className="font-bold text-indigo-600">Report System</span>
                    </p>
                </div>
            </div>
        </div >
    );
};

export default VarunAdoptedWardsReport;
