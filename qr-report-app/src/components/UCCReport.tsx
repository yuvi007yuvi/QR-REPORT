import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { UCCZoneManager, UCCWardTarget } from './UCCMappingManager';
import { MASTER_SUPERVISORS } from '../data/master-supervisors';
import { LoadingScreen } from './LoadingScreen';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { Download, Table as TableIcon, ChartBar, FileSpreadsheet, Upload, IndianRupee, Hash } from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportToPDFImage } from '../utils/exporter';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';
// Define the interface for the CSV data based on the file content
interface UCCRecord {
    "S.No.": string;
    "Transaction ID": string;
    "Date": string;
    "Time": string;
    "Customer Name": string;
    "Customer Number": string;
    "Customer ID": string;
    "Property Name": string;
    "Property Description": string;
    "Party Name": string;
    "Property Number": string;
    "Property Type Name": string;
    "Property Sub-Type Name": string;
    "Area": string;
    "Locality": string;
    "Ward Name": string;
    "Zone Name": string;
    "Supervisor Name": string;
    "Supervisor ID": string;
    "Gazette Monthly Rate": string;
    "Revised Monthly Rate": string;
    "Amount Collected": string;
    "Pending Dues": string;
    "Payment Mode": string;
    "Remark": string;
}

interface MonthlyStats {
    month: string;
    totalAmount: number;
    count: number;
    [key: string]: number | string; // For dynamic property type keys
}

interface PropertyStats {
    propertyType: string;
    totalAmount: number;
    count: number;
    [key: string]: number | string; // Index signature for Recharts
}

interface WardStats {
    wardName: string;
    wardNo: number;
    zone: string;
    totalAmount: number;
    count: number;
    [key: string]: number | string; // Index signature for Recharts
}

// Just combined data structure as we are no longer splitting strictly
interface ProcessedData {
    amount: {
        monthly: MonthlyStats[];
        property: PropertyStats[];
        ward: WardStats[];
    };
    count: {
        monthly: MonthlyStats[];
        property: PropertyStats[];
        ward: WardStats[];
    };
    combinedPivot: any[]; // Property Pivot
    wardPivot: any[];     // Ward Pivot
    months: string[]; // List of month keys (YYYY-MM)
    nested: Record<string, Record<string, Record<string, { amount: number, count: number }>>>;
    uniqueDaysPerMonth: Record<string, number>; // Month -> count of unique days
    totalUniqueDays: number; // Total unique days across all months
    circlePivot: any[]; // Zone/Circle Pivot
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57'];

export const UCCReport: React.FC = () => {
    const [data, setData] = useState<UCCRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');
    const [metricMode, setMetricMode] = useState<'amount' | 'count'>('amount');
    const [reportType, setReportType] = useState<'ward' | 'circle'>('ward');

    const [filterCircle, setFilterCircle] = useState<string>('All');
    const [filterSupervisor, setFilterSupervisor] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [zoneManagers, setZoneManagers] = useState<Record<string, UCCZoneManager>>({});
    const [wardTargets, setWardTargets] = useState<Record<number, UCCWardTarget>>({});

    useEffect(() => {
        const unsubs: (() => void)[] = [];

        const unsubZones = onSnapshot(collection(db, 'ucc_zone_managers'), (snapshot) => {
            const data: Record<string, UCCZoneManager> = {};
            snapshot.forEach(doc => {
                data[doc.id] = doc.data() as UCCZoneManager;
            });
            setZoneManagers(data);
        });
        unsubs.push(unsubZones);

        const unsubWards = onSnapshot(collection(db, 'ucc_ward_targets'), (snapshot) => {
            const data: Record<number, UCCWardTarget> = {};
            snapshot.forEach(doc => {
                data[parseInt(doc.id)] = doc.data() as UCCWardTarget;
            });
            setWardTargets(data);
        });
        unsubs.push(unsubWards);

        return () => unsubs.forEach(fn => fn());
    }, []);

    // Store processed data for both metrics
    const [processedData, setProcessedData] = useState<ProcessedData | null>(null);

    // Track loading start time for minimum display duration
    const [loadingStartTime, setLoadingStartTime] = useState<number>(0);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setLoadingStartTime(Date.now()); // Track when loading started
        setError(null);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const parsedData = results.data as UCCRecord[];
                // Validate some basic fields to ensure it's the right CSV
                if (parsedData.length > 0 && 'Amount Collected' in parsedData[0] && 'Property Type Name' in parsedData[0]) {
                    setData(parsedData);
                    processData(parsedData);

                    // Ensure loading screen shows for at least 6 seconds
                    const elapsedTime = Date.now() - loadingStartTime;
                    const remainingTime = Math.max(0, 6000 - elapsedTime);

                    setTimeout(() => {
                        setLoading(false);
                    }, remainingTime);
                } else {
                    setError("Invalid CSV format. Please upload the correct UCC Report file.");
                    setLoading(false);
                }
            },
            error: (err: Error) => {
                setError(err.message);
                setLoading(false);
            }
        });
    };

    const processData = (records: UCCRecord[]) => {
        // C&T Supervisor Lookup
        const ctSupervisorLookup = new Map<string, string>();
        MASTER_SUPERVISORS.forEach(sup => {
            if (sup.department === 'C&T' && sup.ward) {
                const wards = sup.ward.split(',').map(w => w.trim());
                wards.forEach(w => {
                    ctSupervisorLookup.set(w, sup.name);
                });
            }
        });

        // Ward Lookup Map (Dynamic from CSV)
        const wardLookup = new Map<string, { name: string, no: number, zone: string }>();

        // New Nested Structure: Ward -> Property -> Month -> {amount, count}
        const nestedData: Record<string, Record<string, Record<string, { amount: number, count: number }>>> = {};

        // Helper to parse amount
        const parseAmount = (amt: string) => {
            if (!amt) return 0;
            return parseFloat(amt.replace(/,/g, '')) || 0;
        };

        // Helper to get Year-Month key/label
        const getMonthKey = (dateStr: string) => {
            // Date format is DD/MM/YYYY
            if (!dateStr) return 'Unknown';
            const parts = dateStr.split('/');
            if (parts.length !== 3) return 'Unknown';
            // Returns YYYY-MM for sorting
            return `${parts[2]}-${parts[1]}`;
        };

        const getMonthLabel = (yearMonth: string) => {
            if (yearMonth === 'Unknown') return 'Unknown';
            const [year, month] = yearMonth.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, 1);
            return date.toLocaleString('default', { month: 'short', year: 'numeric' });
        };

        // Data structures for both metrics
        // Structure: monthKey -> PropertyType -> {amount, count}
        const monthlyGroups: Record<string, Record<string, { amount: number, count: number }>> = {};
        const propertyGroups: Record<string, { amount: number, count: number }> = {};

        // Ward Aggregation: WardName -> Month -> {amount, count}
        const wardGroups: Record<string, Record<string, { amount: number, count: number }>> = {};
        const wardTotals: Record<string, { amount: number, count: number }> = {}; // Overall per ward

        // Track unique dates per month for collection days count
        const uniqueDatesPerMonth: Record<string, Set<string>> = {};
        const allUniqueDates = new Set<string>(); // Track ALL unique dates across all months

        const monthsSet = new Set<string>();
        const propertyTypesSet = new Set<string>();
        const wardsSet = new Set<string>();

        records.forEach(record => {
            const amount = parseAmount(record["Amount Collected"]);
            const monthKey = getMonthKey(record.Date);
            const propertyType = record["Property Type Name"] || 'Unspecified';
            const dateStr = record.Date; // Full date DD/MM/YYYY

            // Track unique dates per month
            if (!uniqueDatesPerMonth[monthKey]) {
                uniqueDatesPerMonth[monthKey] = new Set<string>();
            }
            uniqueDatesPerMonth[monthKey].add(dateStr);

            // Track all unique dates globally
            allUniqueDates.add(dateStr);

            // Extract Ward Info from CSV Columns
            const rawWardNo = record["Ward Name"]; // "31"
            const rawZone = record["Zone Name"];   // "2"
            const rawArea = record["Area"];        // "31-Navneet Nagar"

            let wardName = rawWardNo || 'Unknown';
            let wardNo = parseInt(rawWardNo) || 0;

            if (rawArea && rawArea.includes('-')) {
                const parts = rawArea.split('-');
                if (parts.length >= 2) {
                    const extractedNo = parseInt(parts[0]);
                    if (!isNaN(extractedNo)) wardNo = extractedNo;
                    wardName = parts.slice(1).join('-').trim();
                }
            }

            // Update Lookup with dynamic data
            if (!wardLookup.has(wardName)) {
                wardLookup.set(wardName, { name: wardName, no: wardNo, zone: rawZone || 'Unknown' });
            }

            monthsSet.add(monthKey);
            propertyTypesSet.add(propertyType);
            wardsSet.add(wardName);

            // --- Property & Monthly Grouping ---
            if (!monthlyGroups[monthKey]) {
                monthlyGroups[monthKey] = { total: { amount: 0, count: 0 } };
            }
            if (!monthlyGroups[monthKey][propertyType]) {
                monthlyGroups[monthKey][propertyType] = { amount: 0, count: 0 };
            }

            monthlyGroups[monthKey][propertyType].amount += amount;
            monthlyGroups[monthKey][propertyType].count += 1;

            monthlyGroups[monthKey].total.amount += amount;
            monthlyGroups[monthKey].total.count += 1;

            if (!propertyGroups[propertyType]) {
                propertyGroups[propertyType] = { amount: 0, count: 0 };
            }
            propertyGroups[propertyType].amount += amount;
            propertyGroups[propertyType].count += 1;


            // --- Ward Grouping ---
            if (!wardGroups[wardName]) {
                wardGroups[wardName] = {};
            }
            if (!wardGroups[wardName][monthKey]) {
                wardGroups[wardName][monthKey] = { amount: 0, count: 0 };
            }
            wardGroups[wardName][monthKey].amount += amount;
            wardGroups[wardName][monthKey].count += 1;

            if (!wardTotals[wardName]) {
                wardTotals[wardName] = { amount: 0, count: 0 };
            }
            wardTotals[wardName].amount += amount;
            wardTotals[wardName].count += 1;

            // --- Nested Grouping (Ward -> Property -> Month) ---
            if (!nestedData[wardName]) nestedData[wardName] = {};
            if (!nestedData[wardName][propertyType]) nestedData[wardName][propertyType] = {};

            if (!nestedData[wardName][propertyType][monthKey]) {
                nestedData[wardName][propertyType][monthKey] = { amount: 0, count: 0 };
            }
            const leaf = nestedData[wardName][propertyType][monthKey];
            leaf.amount += amount;
            leaf.count += 1;
        });

        const sortedMonths = Array.from(monthsSet).sort();
        const uniqueProps = Array.from(propertyTypesSet).sort();

        // Sort Wards by Number if available, else Name
        const uniqueWards = Array.from(wardsSet).sort((a, b) => {
            const aInfo = wardLookup.get(a);
            const bInfo = wardLookup.get(b);
            if (aInfo && bInfo) return aInfo.no - bInfo.no;
            return a.localeCompare(b);
        });

        // --- Generate Combined Pivot Data (Property) ---
        const combinedPivot = uniqueProps.map(propType => {
            const row: any = { propertyType: propType };
            let grandTotalAmount = 0;
            let grandTotalCount = 0;
            sortedMonths.forEach(month => {
                const stats = monthlyGroups[month][propType] || { amount: 0, count: 0 };
                row[month] = stats; // Store object {amount, count}
                grandTotalAmount += stats.amount;
                grandTotalCount += stats.count;
            });
            row.total = { amount: grandTotalAmount, count: grandTotalCount };
            return row;
        });

        // Total Row
        const totalRow: any = { propertyType: 'Total', isTotal: true };
        let globalTotalAmount = 0;
        let globalTotalCount = 0;
        sortedMonths.forEach(month => {
            const stats = monthlyGroups[month].total || { amount: 0, count: 0 };
            totalRow[month] = stats;
            globalTotalAmount += stats.amount;
            globalTotalCount += stats.count;
        });
        totalRow.total = { amount: globalTotalAmount, count: globalTotalCount };
        combinedPivot.push(totalRow);


        // --- Generate Ward Pivot Data ---
        const wardPivot = uniqueWards.map(wardName => {
            const info = wardLookup.get(wardName);
            const row: any = {
                wardName: wardName,
                wardNo: info ? info.no : 'N/A',
                zone: info ? info.zone : 'Unknown'
            };

            let grandTotalAmount = 0;
            let grandTotalCount = 0;

            sortedMonths.forEach(month => {
                const stats = wardGroups[wardName]?.[month] || { amount: 0, count: 0 };
                row[month] = stats;
                grandTotalAmount += stats.amount;
                grandTotalCount += stats.count;
            });

            row.total = { amount: grandTotalAmount, count: grandTotalCount };
            return row;
        });

        // Add Ward Total Row (Should match global total)
        const wardTotalRow: any = { wardName: 'Total', wardNo: '', zone: '', isTotal: true };
        sortedMonths.forEach(month => {
            const stats = monthlyGroups[month].total || { amount: 0, count: 0 }; // Reusing monthly totals as they are same
            wardTotalRow[month] = stats;
        });
        wardTotalRow.total = { amount: globalTotalAmount, count: globalTotalCount };
        wardPivot.push(wardTotalRow);


        // --- Monthly Data for Charts ---
        const createMonthlyChartData = (metric: 'amount' | 'count') => {
            return sortedMonths.map(month => {
                const label = getMonthLabel(month);
                const dataObj: any = {
                    month: label,
                    totalAmount: monthlyGroups[month].total[metric],
                    count: 0
                };
                uniqueProps.forEach(prop => {
                    dataObj[prop] = monthlyGroups[month][prop]?.[metric] || 0;
                });
                return dataObj;
            });
        };

        const monthlyDataAmount = createMonthlyChartData('amount');
        const monthlyDataCount = createMonthlyChartData('count');

        // --- Property Data for Charts ---
        const createPropertyChartData = (metric: 'amount' | 'count') => {
            return Object.entries(propertyGroups).map(([type, stats]) => ({
                propertyType: type,
                totalAmount: stats[metric],
                count: stats.count
            })).sort((a, b) => b.totalAmount - a.totalAmount);
        };

        const propertyDataAmount = createPropertyChartData('amount');
        const propertyDataCount = createPropertyChartData('count');

        // --- Ward Data for Charts ---
        const createWardChartData = (metric: 'amount' | 'count') => {
            return uniqueWards.map(ward => {
                const stats = wardTotals[ward];
                const info = wardLookup.get(ward);
                return {
                    wardName: ward,
                    wardNo: info ? info.no : 0,
                    zone: info ? info.zone : 'Unknown',
                    totalAmount: stats[metric],
                    count: stats.count
                };
            }).sort((a, b) => b.totalAmount - a.totalAmount); // Sort by highest metric
        };

        const wardDataAmount = createWardChartData('amount');
        const wardDataCount = createWardChartData('count');


        // Convert uniqueDatesPerMonth Sets to counts
        const uniqueDaysCounts: Record<string, number> = {};
        Object.keys(uniqueDatesPerMonth).forEach(monthKey => {
            uniqueDaysCounts[monthKey] = uniqueDatesPerMonth[monthKey].size;
        });

        // --- Generate Circle Pivot Data ---
        const circleGroups: Record<string, Record<string, Record<string, any>>> = {};
        records.forEach(record => {
            const amount = parseAmount(record["Amount Collected"]);
            const monthKey = getMonthKey(record.Date);
            const rawWardNo = record["Ward Name"];
            const wardNoForCircle = parseInt(rawWardNo) || 0;
            let rawZone = record["Zone Name"] || 'Unknown';
            
            if ([1, 3, 11, 15, 16, 20, 30, 31, 33, 37, 44, 47, 48, 54, 59, 68].includes(wardNoForCircle)) rawZone = 'Z1-C1';
            else if ([6, 10, 23, 27, 28, 29, 32, 38, 41, 52, 57, 63].includes(wardNoForCircle)) rawZone = 'Z1-C2';
            else if ([2, 4, 5, 7, 14, 18, 19, 26, 35, 49, 53, 61, 64, 65].includes(wardNoForCircle)) rawZone = 'Z1-C3';
            else if ([12, 17, 22, 24, 36, 39, 40, 42, 43, 45, 46, 55, 56, 58, 60].includes(wardNoForCircle)) rawZone = 'Z1-C4';
            else if ([8, 9, 13, 21, 25, 34, 50, 51, 62, 66, 67, 69, 70].includes(wardNoForCircle)) rawZone = 'Z1-C5';
            
            const supervisorName = record["Supervisor Name"] || 'Unknown';
            const rawArea = record["Area"];
            
            let wardName = rawWardNo || 'Unknown';
            if (rawArea && rawArea.includes('-')) {
                const parts = rawArea.split('-');
                if (parts.length >= 2) {
                    wardName = parts.slice(1).join('-').trim();
                }
            }

            if (!circleGroups[rawZone]) circleGroups[rawZone] = {};
            if (!circleGroups[rawZone][supervisorName]) circleGroups[rawZone][supervisorName] = {};
            if (!circleGroups[rawZone][supervisorName][wardName]) circleGroups[rawZone][supervisorName][wardName] = {};

            if (!circleGroups[rawZone][supervisorName][wardName][monthKey]) {
                circleGroups[rawZone][supervisorName][wardName][monthKey] = { amount: 0, count: 0 };
            }

            circleGroups[rawZone][supervisorName][wardName][monthKey].amount += amount;
            circleGroups[rawZone][supervisorName][wardName][monthKey].count += 1;
        });

        const circlePivot = Object.keys(circleGroups).map(zone => {
            const supervisors = Object.keys(circleGroups[zone]).map(supervisor => {
                const wards = Object.keys(circleGroups[zone][supervisor]).map(ward => {
                    const info = wardLookup.get(ward);
                    const ctSup = ctSupervisorLookup.get(info ? String(info.no) : '') || 'N/A';
                    const row: any = { 
                        wardName: ward, 
                        wardNo: info ? info.no : 0,
                        supervisorName: supervisor,
                        supervisorRowSpan: 0,
                        wardRowSpan: 0,
                        ctSupervisor: ctSup,
                        total: { amount: 0, count: 0 }
                    };
                    let grandTotalAmount = 0;
                    let grandTotalCount = 0;
                    
                    sortedMonths.forEach(month => {
                        const stats = circleGroups[zone][supervisor][ward][month] || { amount: 0, count: 0 };
                        row[month] = stats;
                        grandTotalAmount += stats.amount;
                        grandTotalCount += stats.count;
                    });
                    
                    row.total = { amount: grandTotalAmount, count: grandTotalCount };
                    return row;
                }).sort((a, b) => a.wardNo - b.wardNo);
                
                if (wards.length > 0) {
                    wards[0].supervisorRowSpan = wards.length;
                }
                
                return wards;
            }).flat().sort((a: any, b: any) => {
                if (a.wardNo && b.wardNo) return a.wardNo - b.wardNo;
                return String(a.wardName).localeCompare(String(b.wardName));
            });
            
            // Calculate wardRowSpan for adjacent identical wards
            let currentWardName: string | null = null;
            let currentWardRowIndex = -1;
            supervisors.forEach((row: any, idx: number) => {
                if (row.wardName !== currentWardName) {
                    row.wardRowSpan = 1;
                    currentWardName = row.wardName;
                    currentWardRowIndex = idx;
                } else {
                    row.wardRowSpan = 0;
                    supervisors[currentWardRowIndex].wardRowSpan += 1;
                }
            });
            
            // Calculate Grand Total for the circle
            let circleTotalAmount = 0;
            let circleTotalCount = 0;
            const circleMonthlyTotals: Record<string, {amount: number, count: number}> = {};
            sortedMonths.forEach(month => circleMonthlyTotals[month] = {amount: 0, count: 0});

            supervisors.forEach((row: any) => {
                sortedMonths.forEach(month => {
                    circleMonthlyTotals[month].amount += row[month].amount;
                    circleMonthlyTotals[month].count += row[month].count;
                });
                circleTotalAmount += row.total.amount;
                circleTotalCount += row.total.count;
            });

            return { 
                zone, 
                rows: supervisors, 
                grandTotal: { amount: circleTotalAmount, count: circleTotalCount },
                monthlyTotals: circleMonthlyTotals
            };
        });

        setProcessedData({
            amount: { monthly: monthlyDataAmount, property: propertyDataAmount, ward: wardDataAmount },
            count: { monthly: monthlyDataCount, property: propertyDataCount, ward: wardDataCount },
            combinedPivot: combinedPivot,
            wardPivot: wardPivot,
            circlePivot: circlePivot,
            months: sortedMonths,
            nested: nestedData,
            uniqueDaysPerMonth: uniqueDaysCounts,
            totalUniqueDays: allUniqueDates.size
        });
    };

    const getMonthLabel = (yearMonth: string) => {
        if (yearMonth === 'Unknown') return 'Unknown';
        const [year, month] = yearMonth.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleString('default', { month: 'short', year: 'numeric' });
    };

    const exportToExcel = () => {
        if (!processedData) return;
        const { wardPivot, months, nested } = processedData;

        const wb = XLSX.utils.book_new();

        // 1. Raw Data
        const wsData = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, wsData, "Raw Data");

        // 2. Merged Analysis
        const mergedRows: any[] = [];
        const monthKeys = months;

        wardPivot.forEach(wardRow => {
            // Skip Grand Total row if simpler
            const isTotal = wardRow.isTotal;
            if (isTotal) {
                const flatRow: any = {
                    "Ward No": "GRAND TOTAL",
                    "Ward Name": "",
                    "Zone": "",
                    "Property Type": "",
                };
                monthKeys.forEach(m => {
                    const label = getMonthLabel(m);
                    const stats = wardRow[m] || { amount: 0, count: 0 };
                    flatRow[`${label} - Amount`] = stats.amount;
                    flatRow[`${label} - Slips`] = stats.count;
                });
                flatRow["Total Amount"] = wardRow.total.amount;
                flatRow["Total Slips"] = wardRow.total.count;
                mergedRows.push(flatRow);
                return;
            }

            // Ward Header Row
            const wardHeaderRow: any = {
                "Ward No": wardRow.wardNo,
                "Ward Name": wardRow.wardName,
                "Zone": wardRow.zone,
                "Property Type": "TOTAL",
            };

            monthKeys.forEach(m => {
                const label = getMonthLabel(m);
                const stats = wardRow[m] || { amount: 0, count: 0 };
                wardHeaderRow[`${label} - Amount`] = stats.amount;
                wardHeaderRow[`${label} - Slips`] = stats.count;
            });
            wardHeaderRow["Total Amount"] = wardRow.total.amount;
            wardHeaderRow["Total Slips"] = wardRow.total.count;

            mergedRows.push(wardHeaderRow);

            // Property Rows
            const props = nested[wardRow.wardName] || {};
            Object.keys(props).sort().forEach(propType => {
                const propRowData: any = {
                    "Ward No": "",
                    "Ward Name": "",
                    "Zone": "",
                    "Property Type": propType
                };
                monthKeys.forEach(m => {
                    const label = getMonthLabel(m);
                    const stats = props[propType][m] || { amount: 0, count: 0 };
                    propRowData[`${label} - Amount`] = stats.amount;
                    propRowData[`${label} - Slips`] = stats.count;
                });
                // Calculate property total
                let propTotAmount = 0;
                let propTotCount = 0;
                monthKeys.forEach(m => {
                    const stats = props[propType][m] || { amount: 0, count: 0 };
                    propTotAmount += stats.amount;
                    propTotCount += stats.count;
                });

                propRowData["Total Amount"] = propTotAmount;
                propRowData["Total Slips"] = propTotCount;
                mergedRows.push(propRowData);
            });
        });

        const wsMerged = XLSX.utils.json_to_sheet(mergedRows);
        XLSX.utils.book_append_sheet(wb, wsMerged, "Merged Analysis");

        XLSX.writeFile(wb, "UCC_Report_Merged_Analysis.xlsx");
    };

    const exportToPDF = async () => {
        if (!processedData) return;

        const tableId = reportType === 'circle' ? 'ucc-circle-report' : 'ucc-report-table';
        const tableElement = document.getElementById(tableId);
        if (!tableElement) {
            alert('Table not found for export');
            return;
        }

        try {
            // Show loading indicator
            const originalCursor = document.body.style.cursor;
            document.body.style.cursor = 'wait';

            await exportToPDFImage(tableId, 'UCC_Collection_Report');

            document.body.style.cursor = originalCursor;
        } catch (error) {
            console.error('Error generating PDF:', error);
            document.body.style.cursor = 'default';
            alert('Failed to generate PDF. Please try again.');
        }
    };

    const formatAmount = (val: number) => val.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
    const formatCount = (val: number) => val.toLocaleString('en-IN');


    if (loading) {
        return (
            <LoadingScreen
                title="User Charge Collection Report"
                subtitle="Mathura Vrindavan Nagar Nigam"
            />
        );
    }

    if (!processedData) {
        return (
            <div className="p-6 h-full flex flex-col">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">UCC Collection Analysis</h2>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                        <p className="font-medium">Error processing file:</p>
                        <p>{error}</p>
                    </div>
                )}

                <div className="flex-1 flex items-center justify-center">
                    <label className="flex flex-col items-center justify-center w-full max-w-2xl h-64 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <div className="p-4 bg-blue-50 rounded-full mb-4">
                                <Upload className="w-8 h-8 text-blue-500" />
                            </div>
                            <p className="mb-2 text-lg font-medium text-gray-700">Upload UCC Report CSV</p>
                            <p className="text-sm text-gray-500">Click to select or drag and drop your file here</p>
                        </div>
                        <input
                            type="file"
                            className="hidden"
                            accept=".csv"
                            onChange={handleFileUpload}
                        />
                    </label>
                </div>
            </div>
        );
    }

    // Helper to simulate loading for distinct UI changes
    const withLoading = (action: () => void, delay: number = 2000) => {
        setLoading(true);
        setTimeout(() => {
            action();
            setLoading(false);
        }, delay);
    };

    const handleMetricChange = (mode: 'amount' | 'count') => {
        if (metricMode === mode) return;
        withLoading(() => setMetricMode(mode), 1500);
    };

    const handleViewChange = (mode: 'table' | 'chart') => {
        if (viewMode === mode) return;
        withLoading(() => setViewMode(mode), 1500);
    };

    const handleExcelExport = () => {
        withLoading(() => exportToExcel(), 2000);
    };

    const handlePDFExport = async () => {
        // PDF export handles its own cursor wait state
        // We cannot use setLoading(true) because it unmounts the table component,
        // causing document.getElementById(tableId) to fail.
        await exportToPDF();
    };

    const { combinedPivot, wardPivot, months } = processedData;
    const currentMetricData = processedData[metricMode];
    const { monthly: monthlyData, ward: wardData } = currentMetricData; // wardData is sorted list of WardStats
    const totalStats = combinedPivot.find(r => r.isTotal)?.total || { amount: 0, count: 0 };


    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-lg shadow-sm gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">UCC Collection Analysis</h2>
                    <p className="text-sm text-gray-500">Comprehensive Analysis Report</p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Report Type Toggle */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                        <span className="text-xs font-semibold text-gray-500 px-2 uppercase">Type:</span>
                        <button
                            onClick={() => setReportType('ward')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${reportType === 'ward' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Ward Report
                        </button>
                        <button
                            onClick={() => setReportType('circle')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${reportType === 'circle' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Circle Report
                        </button>
                    </div>                    {/* Metric Toggle */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-1 border border-gray-200">
                        <span className="text-xs font-semibold text-gray-500 px-2 uppercase">Metric:</span>
                        <button
                            onClick={() => handleMetricChange('amount')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${metricMode === 'amount' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <IndianRupee className="w-4 h-4" /> Amount
                        </button>
                        <button
                            onClick={() => handleMetricChange('count')}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${metricMode === 'count' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <Hash className="w-4 h-4" /> Slips
                        </button>
                    </div>
                </div>

                <div className="flex gap-2">
                    <label className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 text-sm cursor-pointer border border-blue-200">
                        <Upload className="w-4 h-4" /> Upload New
                        <input type="file" className="hidden" accept=".csv" onChange={handleFileUpload} />
                    </label>
                    <div className="h-6 w-px bg-gray-300 mx-2"></div>
                    <button
                        onClick={() => handleViewChange('table')}
                        className={`p-2 rounded-md ${viewMode === 'table' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                        title="Table View"
                    >
                        <TableIcon className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => handleViewChange('chart')}
                        className={`p-2 rounded-md ${viewMode === 'chart' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                        title="Chart View"
                    >
                        <ChartBar className="w-5 h-5" />
                    </button>
                    <div className="h-6 w-px bg-gray-300 mx-2"></div>
                    <button onClick={handleExcelExport} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
                        <FileSpreadsheet className="w-4 h-4" /> Excel
                    </button>
                    <button onClick={handlePDFExport} className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm">
                        <Download className="w-4 h-4" /> PDF
                    </button>
                </div>
            </div>

            {/* Circle Report Filters */}
            {reportType === 'circle' && processedData && (
                <div className="flex flex-wrap gap-4 bg-white p-4 rounded-lg shadow-sm">
                    <div className="flex flex-col">
                        <label className="text-xs font-semibold text-gray-500 uppercase mb-1">Select Circle</label>
                        <select 
                            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                            value={filterCircle}
                            onChange={(e) => setFilterCircle(e.target.value)}
                        >
                            <option value="All">All Circles</option>
                            {processedData.circlePivot.map(c => (
                                <option key={c.zone} value={c.zone}>{c.zone.replace('Z1-', '')}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs font-semibold text-gray-500 uppercase mb-1">Supervisor</label>
                        <select 
                            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                            value={filterSupervisor}
                            onChange={(e) => setFilterSupervisor(e.target.value)}
                        >
                            <option value="All">All Supervisors</option>
                            {Array.from(new Set(
                                processedData.circlePivot
                                    .filter(c => filterCircle === 'All' || c.zone === filterCircle)
                                    .flatMap(c => c.rows.map((r: any) => r.supervisorName))
                            )).sort().map(sup => (
                                <option key={sup as string} value={sup as string}>{sup as string}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex flex-col flex-1 min-w-[200px]">
                        <label className="text-xs font-semibold text-gray-500 uppercase mb-1">Search</label>
                        <input 
                            type="text" 
                            placeholder="Search ward, supervisor..."
                            className="border border-gray-300 rounded px-3 py-1.5 text-sm w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
                    <h3 className="text-gray-500 text-sm font-medium">Total Collection</h3>
                    <p className="text-2xl font-bold text-gray-900">
                        {formatAmount(totalStats.amount)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                        {formatCount(totalStats.count)} Slips
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-green-500">
                    <h3 className="text-gray-500 text-sm font-medium">Total Transactions</h3>
                    <p className="text-2xl font-bold text-gray-900">{data.length.toLocaleString()}</p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-purple-500">
                    <h3 className="text-gray-500 text-sm font-medium">Top Ward</h3>
                    <p className="text-xl font-bold text-gray-900 truncate">
                        {wardData[0]?.wardName}
                    </p>
                    <p className="text-xs text-gray-500">
                        {metricMode === 'amount' ? formatAmount(wardData[0]?.totalAmount) : formatCount(wardData[0]?.totalAmount)}
                    </p>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm border-l-4 border-orange-500">
                    <h3 className="text-gray-500 text-sm font-medium">Highest Month</h3>
                    {(() => {
                        const maxMonth = monthlyData.reduce((prev, current) => (prev.totalAmount > current.totalAmount) ? prev : current, { month: '', totalAmount: 0 });
                        return (
                            <>
                                <p className="text-xl font-bold text-gray-900">{maxMonth.month}</p>
                                <p className="text-xs text-gray-500">
                                    {metricMode === 'amount' ? formatAmount(maxMonth.totalAmount) : formatCount(maxMonth.totalAmount)}
                                </p>
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Progress & Improvement Section */}
            {monthlyData.length >= 2 && (() => {
                const sortedMonthlyData = [...monthlyData].sort((a, b) => {
                    // Sort by month chronologically
                    const aDate = new Date(a.month);
                    const bDate = new Date(b.month);
                    return aDate.getTime() - bDate.getTime();
                });

                const lastMonth = sortedMonthlyData[sortedMonthlyData.length - 1];
                const previousMonth = sortedMonthlyData[sortedMonthlyData.length - 2];

                const lastMonthValue = metricMode === 'amount' ? lastMonth.totalAmount : lastMonth.count;
                const previousMonthValue = metricMode === 'amount' ? previousMonth.totalAmount : previousMonth.count;

                const change = lastMonthValue - previousMonthValue;
                const percentChange = previousMonthValue !== 0 ? ((change / previousMonthValue) * 100) : 0;
                const isPositive = change >= 0;

                return (
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6 border border-blue-200">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Month-over-Month Progress</h3>
                                <p className="text-sm text-gray-600">
                                    Comparing <span className="font-medium">{lastMonth.month}</span> vs <span className="font-medium">{previousMonth.month}</span>
                                </p>
                            </div>
                            <div className={`flex items - center gap - 2 px - 4 py - 2 rounded - lg ${isPositive ? 'bg-green-100' : 'bg-red-100'} `}>
                                <span className={`text - 2xl ${isPositive ? 'text-green-600' : 'text-red-600'} `}>
                                    {isPositive ? '↑' : '↓'}
                                </span>
                                <div>
                                    <p className={`text - 2xl font - bold ${isPositive ? 'text-green-700' : 'text-red-700'} `}>
                                        {isPositive ? '+' : ''}{percentChange.toFixed(1)}%
                                    </p>
                                    <p className="text-xs text-gray-600">
                                        {isPositive ? 'Growth' : 'Decline'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <div className="bg-white p-3 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500 mb-1">Previous Month</p>
                                <p className="text-lg font-bold text-gray-700">
                                    {metricMode === 'amount' ? formatAmount(previousMonthValue) : formatCount(previousMonthValue)}
                                </p>
                                <p className="text-xs text-gray-500">{previousMonth.month}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500 mb-1">Current Month</p>
                                <p className="text-lg font-bold text-blue-700">
                                    {metricMode === 'amount' ? formatAmount(lastMonthValue) : formatCount(lastMonthValue)}
                                </p>
                                <p className="text-xs text-gray-500">{lastMonth.month}</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-gray-200">
                                <p className="text-xs text-gray-500 mb-1">Absolute Change</p>
                                <p className={`text - lg font - bold ${isPositive ? 'text-green-700' : 'text-red-700'} `}>
                                    {isPositive ? '+' : ''}{metricMode === 'amount' ? formatAmount(Math.abs(change)) : formatCount(Math.abs(change))}
                                </p>
                                <p className="text-xs text-gray-500">{isPositive ? 'Increase' : 'Decrease'}</p>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Main Content */}
            <div className="bg-white rounded-lg shadow-sm p-4 min-h-[400px]">
                {viewMode === 'table' ? (
                    reportType === 'ward' ? (
                        <div id="ucc-report-table" className="overflow-x-auto border-2 border-blue-400 rounded-lg shadow-lg">
                        <table className="min-w-full border-collapse">
                            <thead>
                                {/* Header with Logos and Title */}
                                <tr className="bg-white border-b border-blue-400">
                                    <th colSpan={3 + months.length + 1} className="py-2 px-3">
                                        <div className="flex items-center justify-between">
                                            {/* Left Logo */}
                                            <div className="flex-shrink-0">
                                                <img
                                                    src="/src/assets/nagar-nigam-logo.png"
                                                    alt="Nagar Nigam Logo"
                                                    className="h-20 w-auto object-contain"
                                                />
                                            </div>

                                            {/* Center Title */}
                                            <div className="flex-grow text-center px-2">
                                                <h1 className="text-lg font-bold text-gray-800">
                                                    Mathura Vrindavan Nagar Nigam
                                                </h1>
                                                <h2 className="text-sm font-semibold text-blue-700">
                                                    User Charge Collection Report
                                                </h2>
                                                <p className="text-xs text-gray-600">
                                                    Monthly Collection Analysis
                                                </p>
                                            </div>

                                            {/* Right Logo */}
                                            <div className="flex-shrink-0">
                                                <img
                                                    src="/src/assets/NatureGreen_Logo.png"
                                                    alt="NatureGreen Logo"
                                                    className="h-12 w-auto object-contain"
                                                />
                                            </div>
                                        </div>
                                    </th>
                                </tr>

                                {/* Column Headers */}
                                <tr className="bg-gradient-to-r from-blue-600 to-blue-700">
                                    <th className="px-2 py-1.5 text-center text-[10px] font-bold text-white uppercase border-r-2 border-blue-500 bg-blue-600">Ward</th>
                                    <th className="px-2 py-1.5 text-center text-[10px] font-bold text-white uppercase border-r-2 border-blue-500 bg-blue-600">Zone</th>
                                    <th className="px-2 py-1.5 text-center text-[10px] font-bold text-white uppercase border-r-2 border-blue-500 bg-blue-600">Property Type</th>
                                    {months.map((m, mIdx) => (
                                        <th key={m} className="px-2 py-1.5 text-center text-[10px] font-bold text-white uppercase border-r border-blue-500 bg-gradient-to-r from-indigo-600 to-indigo-700 whitespace-nowrap">
                                            <div className="flex flex-col items-center">
                                                <span>{getMonthLabel(m)}</span>
                                                {mIdx > 0 && (
                                                    <span className="text-[10px] font-normal text-blue-200 mt-0.5">vs prev</span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                    <th className="px-2 py-1.5 text-center text-[10px] font-bold text-white uppercase border-l-2 border-purple-400 bg-gradient-to-r from-purple-600 to-purple-700 whitespace-nowrap">
                                        Total
                                    </th>
                                </tr>
                                {/* Collection Days Summary Row */}
                                <tr className="bg-gradient-to-r from-green-100 to-teal-100 border-b border-green-300">
                                    <td className="px-2 py-1 text-[10px] font-semibold text-green-800 border-r-2 border-green-200 bg-gradient-to-r from-green-100 to-teal-100 text-center" colSpan={3}>
                                        📅 Collection Days
                                    </td>
                                    {months.map(monthKey => {
                                        const uniqueDays = processedData.uniqueDaysPerMonth[monthKey] || 0;
                                        return (
                                            <td key={monthKey} className="px-2 py-1 text-center text-[10px] font-bold text-green-700 border-r border-green-200 bg-green-50 whitespace-nowrap">
                                                {uniqueDays} {uniqueDays === 1 ? 'day' : 'days'}
                                            </td>
                                        );
                                    })}
                                    <td className="px-2 py-1 text-center text-[10px] font-bold text-green-700 border-l-2 border-green-300 bg-green-100 whitespace-nowrap">
                                        {processedData.totalUniqueDays} days
                                    </td>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {wardPivot.map((wardRow, idx) => {
                                    if (wardRow.isTotal) {
                                        // Grand Total Row
                                        return (
                                            <tr key="grand-total" className="bg-gradient-to-r from-yellow-100 to-orange-100 font-bold border-t-2 border-orange-400">
                                                <td className="px-2 py-1.5 text-[11px] text-center text-gray-900 border-r-2 border-orange-300 bg-gradient-to-r from-yellow-100 to-orange-100 whitespace-nowrap" colSpan={2}>
                                                    <span className="text-orange-700 font-extrabold text-xs">📊 GRAND TOTAL</span>
                                                </td>
                                                <td className="px-2 py-1.5 text-[11px] text-center text-gray-900 border-r-2 border-orange-300 bg-gradient-to-r from-yellow-100 to-orange-100 whitespace-nowrap">
                                                </td>
                                                {months.map((monthKey, mIdx) => {
                                                    const stats = wardRow[monthKey] || { amount: 0, count: 0 };
                                                    const currentValue = metricMode === 'amount' ? stats.amount : stats.count;

                                                    let prevValue = 0;
                                                    let percentChange = 0;
                                                    if (mIdx > 0) {
                                                        const prevMonth = months[mIdx - 1];
                                                        const prevStats = wardRow[prevMonth] || { amount: 0, count: 0 };
                                                        prevValue = metricMode === 'amount' ? prevStats.amount : prevStats.count;
                                                        if (prevValue !== 0) {
                                                            percentChange = ((currentValue - prevValue) / prevValue) * 100;
                                                        }
                                                    }

                                                    return (
                                                        <td key={monthKey} className="px-3 py-3 text-center text-sm border-r border-gray-200 bg-yellow-50 whitespace-nowrap">
                                                            <div className="flex flex-col">
                                                                <span>{formatAmount(stats.amount)}</span>
                                                                <span className="text-xs text-gray-600">({stats.count} slips)</span>
                                                                {mIdx > 0 && prevValue !== 0 && (
                                                                    <span className={`text - [10px] font - semibold mt - 0.5 ${percentChange >= 0 ? 'text-green-600' : 'text-red-600'} `}>
                                                                        {percentChange >= 0 ? '↑' : '↓'} {Math.abs(percentChange).toFixed(1)}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-3 py-3 text-center text-sm border-l-2 border-orange-300 bg-orange-50 font-bold whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span>{formatAmount(wardRow.total.amount)}</span>
                                                        <span className="text-xs text-gray-600">({wardRow.total.count} slips)</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }

                                    // 1. Ward Header Row
                                    const wardHeader = (
                                        <tr key={`ward - ${idx} `} className="bg-gradient-to-r from-blue-50 to-indigo-50 font-bold border-t-2 border-blue-300 hover:from-blue-100 hover:to-indigo-100 transition-colors">
                                            <td className="px-3 py-2 text-sm text-center text-blue-900 border-r-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 whitespace-nowrap">
                                                <span className="font-bold">{wardRow.wardNo} - {wardRow.wardName}</span>
                                            </td>
                                            <td className="px-3 py-2 text-sm text-center text-blue-900 border-r-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 whitespace-nowrap">
                                                <span className="font-semibold">{wardRow.zone}</span>
                                            </td>
                                            <td className="px-3 py-2 text-sm text-center text-indigo-600 italic border-r-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 whitespace-nowrap">
                                                <span className="font-bold">TOTAL</span>
                                            </td>
                                            {months.map((monthKey, mIdx) => {
                                                const stats = wardRow[monthKey] || { amount: 0, count: 0 };
                                                const currentValue = metricMode === 'amount' ? stats.amount : stats.count;

                                                let prevValue = 0;
                                                let percentChange = 0;
                                                if (mIdx > 0) {
                                                    const prevMonth = months[mIdx - 1];
                                                    const prevStats = wardRow[prevMonth] || { amount: 0, count: 0 };
                                                    prevValue = metricMode === 'amount' ? prevStats.amount : prevStats.count;
                                                    if (prevValue !== 0) {
                                                        percentChange = ((currentValue - prevValue) / prevValue) * 100;
                                                    }
                                                }

                                                return (
                                                    <td key={monthKey} className="px-3 py-2 text-center text-sm border-r border-blue-100 bg-blue-50 whitespace-nowrap">
                                                        <div className="flex flex-col">
                                                            <span>{formatAmount(stats.amount)}</span>
                                                            <span className="text-xs text-gray-500">({stats.count} slips)</span>
                                                            {mIdx > 0 && prevValue !== 0 && (
                                                                <span className={`text - [10px] font - semibold mt - 0.5 ${percentChange >= 0 ? 'text-green-600' : 'text-red-600'} `}>
                                                                    {percentChange >= 0 ? '↑' : '↓'} {Math.abs(percentChange).toFixed(1)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="px-3 py-2 text-center text-sm border-l-2 border-indigo-300 bg-indigo-100 font-bold whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span>{formatAmount(wardRow.total.amount)}</span>
                                                    <span className="text-xs text-gray-500">({wardRow.total.count} slips)</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );

                                    // 2. Property Sub-rows
                                    const props = processedData.nested[wardRow.wardName] || {};
                                    const propKeys = Object.keys(props).sort();

                                    const propRows = propKeys.map((prop, pIdx) => {
                                        let rowTotalAmount = 0;
                                        let rowTotalCount = 0;

                                        const rowBgColor = pIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50';
                                        return (
                                            <tr key={`ward - ${idx} -prop - ${pIdx} `} className={`${rowBgColor} hover: bg - purple - 50 transition - colors border - b border - gray - 100`}>
                                                <td className={`px - 3 py - 1 border - r border - gray - 200 ${rowBgColor} `}></td>
                                                <td className={`px - 3 py - 1 border - r border - gray - 200 ${rowBgColor} `}></td>
                                                <td className={`px - 3 py - 1 text - sm text - center text - purple - 700 border - r - 2 border - gray - 200 ${rowBgColor} pl - 6 whitespace - nowrap`}>
                                                    <span className="font-medium">▸ {prop}</span>
                                                </td>
                                                {months.map((monthKey, mIdx) => {
                                                    const stats = props[prop][monthKey] || { amount: 0, count: 0 };
                                                    rowTotalAmount += stats.amount;
                                                    rowTotalCount += stats.count;

                                                    const currentValue = metricMode === 'amount' ? stats.amount : stats.count;
                                                    let prevValue = 0;
                                                    let percentChange = 0;
                                                    if (mIdx > 0) {
                                                        const prevMonth = months[mIdx - 1];
                                                        const prevStats = props[prop][prevMonth] || { amount: 0, count: 0 };
                                                        prevValue = metricMode === 'amount' ? prevStats.amount : prevStats.count;
                                                        if (prevValue !== 0) {
                                                            percentChange = ((currentValue - prevValue) / prevValue) * 100;
                                                        }
                                                    }

                                                    return (
                                                        <td key={monthKey} className="px-3 py-1 text-center text-sm border-r border-gray-200 text-gray-600 whitespace-nowrap">
                                                            {stats.amount > 0 ? (
                                                                <div className="flex flex-col text-xs">
                                                                    <span>{formatAmount(stats.amount)}</span>
                                                                    <span className="text-gray-400">({stats.count} slips)</span>
                                                                    {mIdx > 0 && prevValue !== 0 && currentValue > 0 && (
                                                                        <span className={`text - [9px] font - semibold mt - 0.5 ${percentChange >= 0 ? 'text-green-600' : 'text-red-600'} `}>
                                                                            {percentChange >= 0 ? '↑' : '↓'} {Math.abs(percentChange).toFixed(1)}%
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            ) : '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className="px-3 py-1 text-center text-sm border-l-2 border-purple-200 bg-purple-50 font-semibold text-purple-800 whitespace-nowrap">
                                                    <div className="flex flex-col text-xs">
                                                        <span>{formatAmount(rowTotalAmount)}</span>
                                                        <span className="text-gray-400">({rowTotalCount} slips)</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    });

                                    return (
                                        <React.Fragment key={idx}>
                                            {wardHeader}
                                            {propRows}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    ) : (
                        <div id="ucc-circle-report" className="flex flex-col gap-8">
                            {processedData.circlePivot
                                .filter(circle => filterCircle === 'All' || circle.zone === filterCircle)
                                .map((circle) => {
                                    const searchStr = searchQuery.toLowerCase();
                                    const filteredRows = circle.rows.filter((row: any) => {
                                        const matchSup = filterSupervisor === 'All' || row.supervisorName === filterSupervisor;
                                        const matchSearch = searchQuery === '' || 
                                            row.supervisorName.toLowerCase().includes(searchStr) || 
                                            row.wardName.toLowerCase().includes(searchStr) ||
                                            String(row.wardNo).includes(searchStr) ||
                                            (row.ctSupervisor && row.ctSupervisor.toLowerCase().includes(searchStr));
                                        return matchSup && matchSearch;
                                    });

                                    if (filteredRows.length === 0) return null;

                                    // Recalculate rowspans for rendering
                                    let currentSupName: string | null = null;
                                    let currentSupRowIndex = -1;
                                    let currentWardName: string | null = null;
                                    let currentWardRowIndex = -1;

                                    filteredRows.forEach((row: any, idx: number) => {
                                        if (row.supervisorName !== currentSupName) {
                                            row.renderSupRowSpan = 1;
                                            currentSupName = row.supervisorName;
                                            currentSupRowIndex = idx;
                                        } else {
                                            row.renderSupRowSpan = 0;
                                            filteredRows[currentSupRowIndex].renderSupRowSpan += 1;
                                        }

                                        if (row.wardName !== currentWardName) {
                                            row.renderWardRowSpan = 1;
                                            currentWardName = row.wardName;
                                            currentWardRowIndex = idx;
                                        } else {
                                            row.renderWardRowSpan = 0;
                                            filteredRows[currentWardRowIndex].renderWardRowSpan += 1;
                                        }
                                    });

                                    // Recalculate Totals based on filtered rows
                                    const filteredGrandTotal = { amount: 0, count: 0 };
                                    const filteredMonthlyTotals: Record<string, {amount: number, count: number}> = {};
                                    months.forEach(m => filteredMonthlyTotals[m] = {amount: 0, count: 0});
                                    let filteredTargetTotal = 0;
                                    
                                    filteredRows.forEach((r: any) => {
                                        filteredGrandTotal.amount += r.total.amount;
                                        filteredGrandTotal.count += r.total.count;
                                        filteredTargetTotal += wardTargets[r.wardNo]?.targetAmount || 0;
                                        months.forEach(m => {
                                            filteredMonthlyTotals[m].amount += r[m].amount || 0;
                                            filteredMonthlyTotals[m].count += r[m].count || 0;
                                        });
                                    });

                                return (
                                <div key={circle.zone} className="overflow-x-auto bg-white mb-8">
                                    <table className="excel-table text-sm text-slate-700 w-full">
                                        <thead>
                                            {/* Header Title */}
                                            <tr>
                                                <th colSpan={4 + months.length + 2} className="bg-peach">
                                                    <div className="flex items-center justify-between px-8 py-3">
                                                        <img src={nagarNigamLogo} alt="Nagar Nigam" className="h-20 w-auto mix-blend-multiply" />
                                                        <span className="text-[36px] text-black font-extrabold uppercase tracking-wide">
                                                            {circle.zone.replace('Z1-', '')} CIRCLE REPORT
                                                        </span>
                                                        <img src={natureGreenLogo} alt="Nature Green" className="h-16 w-auto mix-blend-multiply" />
                                                    </div>
                                                </th>
                                            </tr>
                                            {/* Manager Rows */}
                                            {(() => {
                                                const zoneKeyMap: Record<string, string> = {
                                                    'Z1-C1': 'Circle 1',
                                                    'Z1-C2': 'Circle 2',
                                                    'Z1-C3': 'Circle 3',
                                                    'Z1-C4': 'Circle 4',
                                                    'Z1-C5': 'Circle 5'
                                                };
                                                const mappedZoneKey = zoneKeyMap[circle.zone] || circle.zone;
                                                const zm = zoneManagers[mappedZoneKey] || {} as Partial<UCCZoneManager>;
                                                return (
                                                    <>
                                                        <tr>
                                                            <th colSpan={2} className="py-1 text-center font-bold text-sm bg-blue">UCC MANAGER</th>
                                                            <th colSpan={4 + months.length} className="py-1 text-center font-bold text-sm bg-blue">OPERATION MANAGER</th>
                                                        </tr>
                                                        <tr>
                                                            <th className="py-1 text-center font-bold text-sm w-24 bg-light-gray">NAME</th>
                                                            <th className="py-1 text-center font-bold bg-light-yellow">{zm.uccManagerName || ''}</th>
                                                            <th className="py-1 text-center font-bold text-sm w-24 bg-light-gray">NAME</th>
                                                            <th colSpan={3 + months.length} className="py-1 text-center font-bold bg-light-yellow">{zm.operationManagerName || ''}</th>
                                                        </tr>
                                                        <tr>
                                                            <th className="py-1 text-center font-bold text-sm bg-light-gray">PH NO.</th>
                                                            <th className="py-1 text-center font-bold bg-white">{zm.uccManagerPhone || ''}</th>
                                                            <th className="py-1 text-center font-bold text-sm bg-light-gray">PH NO.</th>
                                                            <th colSpan={3 + months.length} className="py-1 text-center font-bold bg-white">{zm.operationManagerPhone || ''}</th>
                                                        </tr>
                                                        <tr>
                                                            <th colSpan={2} className="py-1 text-center font-bold text-sm bg-green">UCC ZONAL</th>
                                                            <th colSpan={4 + months.length} className="py-1 text-center font-bold text-sm bg-green">C&T ZONAL</th>
                                                        </tr>
                                                        <tr>
                                                            <th className="py-1 text-center font-bold text-sm w-24 bg-light-gray">NAME</th>
                                                            <th className="py-1 text-center font-bold bg-white">{zm.uccZonalName || ''}</th>
                                                            <th className="py-1 text-center font-bold text-sm w-24 bg-light-gray">NAME</th>
                                                            <th colSpan={3 + months.length} className="py-1 text-center font-bold bg-white">{zm.ctZonalName || ''}</th>
                                                        </tr>
                                                        <tr>
                                                            <th className="py-1 text-center font-bold text-sm bg-light-gray">PH NO.</th>
                                                            <th className="py-1 text-center font-bold bg-light-yellow">{zm.uccZonalPhone || ''}</th>
                                                            <th className="py-1 text-center font-bold text-sm bg-light-gray">PH NO.</th>
                                                            <th colSpan={3 + months.length} className="py-1 text-center font-bold bg-light-yellow">{zm.ctZonalPhone || ''}</th>
                                                        </tr>
                                                    </>
                                                );
                                            })()}
                                            
                                            {/* Data Columns */}
                                            <tr>
                                                <th className="px-2 py-2 text-center font-bold text-sm uppercase bg-yellow">S NO.</th>
                                                <th className="px-2 py-2 text-center font-bold text-sm uppercase bg-yellow">UCC SUPERVISOR</th>
                                                <th className="px-2 py-2 text-center font-bold text-sm uppercase bg-yellow">WARD</th>
                                                <th className="px-2 py-2 text-center font-bold text-sm uppercase bg-yellow">C&T SUPERVISOR</th>
                                                {months.map(m => (
                                                    <th key={m} className="px-2 py-2 text-center font-bold text-sm uppercase bg-yellow">
                                                        {getMonthLabel(m)} Collection
                                                    </th>
                                                ))}
                                                <th className="px-2 py-2 text-center font-bold text-sm uppercase bg-yellow">JULY TARGET</th>
                                                <th className="px-2 py-2 text-center font-bold text-sm uppercase bg-yellow">TOTAL</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredRows.map((row: any, rIdx: number) => (
                                                <tr key={rIdx}>
                                                    <td className="px-2 py-1 text-center">{rIdx + 1}</td>
                                                    <td className="px-2 py-1 text-left align-top">
                                                        {row.supervisorName}
                                                    </td>
                                                    {row.renderWardRowSpan > 0 ? (
                                                        <td 
                                                            rowSpan={row.renderWardRowSpan}
                                                            className="px-2 py-1 text-center align-top"
                                                        >
                                                            {row.wardNo || row.wardName}
                                                        </td>
                                                    ) : null}
                                                    {row.renderWardRowSpan > 0 ? (
                                                        <td 
                                                            rowSpan={row.renderWardRowSpan}
                                                            className="px-2 py-1 text-center align-top text-xs text-gray-600 font-semibold"
                                                        >
                                                            {row.ctSupervisor}
                                                        </td>
                                                    ) : null}
                                                    {months.map(m => (
                                                        <td key={m} className="px-2 py-2 text-center border-l border-r border-gray-200 bg-yellow-50 whitespace-nowrap">
                                                            <div className="flex flex-col text-sm">
                                                                <span>{formatAmount(row[m].amount || 0)}</span>
                                                                <span className="text-xs text-gray-600">({formatCount(row[m].count || 0)} slips)</span>
                                                            </div>
                                                        </td>
                                                    ))}
                                                    <td className="px-2 py-2 text-center font-semibold">
                                                        {formatAmount(wardTargets[row.wardNo]?.targetAmount || 0)}
                                                    </td>
                                                    <td className="px-2 py-2 text-center font-bold border-l-2 border-orange-300 bg-orange-50 whitespace-nowrap">
                                                        <div className="flex flex-col text-sm">
                                                            <span>{formatAmount(row.total.amount || 0)}</span>
                                                            <span className="text-xs text-gray-600">({formatCount(row.total.count || 0)} slips)</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                            {/* Circle Grand Total */}
                                            <tr className="bg-gradient-to-r from-yellow-100 to-orange-100 font-bold border-t-2 border-orange-400">
                                                <th colSpan={4} className="px-2 py-3 text-center font-extrabold text-xs text-orange-700">📊 GRAND TOTAL</th>
                                                {months.map(m => (
                                                    <th key={m} className="px-2 py-3 text-center border-l border-r border-gray-300 whitespace-nowrap">
                                                        <div className="flex flex-col text-sm">
                                                            <span>{formatAmount(filteredMonthlyTotals[m].amount)}</span>
                                                            <span className="text-xs text-orange-700 font-semibold">({formatCount(filteredMonthlyTotals[m].count)} slips)</span>
                                                        </div>
                                                    </th>
                                                ))}
                                                <th className="px-2 py-3 text-center font-bold text-sm">
                                                    {formatAmount(filteredTargetTotal)}
                                                </th>
                                                <th className="px-2 py-3 text-center font-extrabold border-l-2 border-orange-400 bg-orange-100 whitespace-nowrap">
                                                    <div className="flex flex-col text-sm text-orange-900">
                                                        <span>{formatAmount(filteredGrandTotal.amount)}</span>
                                                        <span className="text-xs">({formatCount(filteredGrandTotal.count)} slips)</span>
                                                    </div>
                                                </th>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                );
                            })}
                        </div>
                    )
                ) : (
                    <div className="space-y-8">
                        <div className="h-[400px]">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-gray-700">Monthly Trend</h3>
                                <span className="text-sm px-2 py-1 bg-gray-100 rounded text-gray-600">
                                    Displaying: {metricMode === 'amount' ? 'Amount' : 'Slip Counts'}
                                </span>
                            </div>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="month" />
                                    <YAxis tickFormatter={(val) => metricMode === 'amount' ? `₹${val / 1000} k` : val.toString()} />
                                    <Tooltip formatter={(value: number | undefined) => metricMode === 'amount' ? formatAmount(value || 0) : formatCount(value || 0)} />
                                    <Legend />
                                    <Bar dataKey="totalAmount" name={metricMode === 'amount' ? "Total Collection" : "Total Slips"} fill="#8884d8" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[700px]">
                            <div className="h-full">
                                <h3 className="text-lg font-medium text-gray-700 mb-4">By Ward</h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={wardData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                                            outerRadius={120}
                                            fill="#8884d8"
                                            dataKey="totalAmount"
                                            nameKey="wardName"
                                        >
                                            {wardData.map((_, index) => (
                                                <Cell key={`cell - ${index} `} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number | undefined) => metricMode === 'amount' ? formatAmount(value || 0) : formatCount(value || 0)} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="h-full">
                                <h3 className="text-lg font-medium text-gray-700 mb-4">Ward Breakdown</h3>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={wardData.slice(0, 15)} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" tickFormatter={(val) => metricMode === 'amount' ? `₹${val / 1000} k` : val.toString()} />
                                        <YAxis dataKey="wardName" type="category" width={150} tick={{ fontSize: 10 }} />
                                        <Tooltip formatter={(value: number | undefined) => metricMode === 'amount' ? formatAmount(value || 0) : formatCount(value || 0)} />
                                        <Bar dataKey="totalAmount" fill="#82ca9d" name={metricMode === 'amount' ? "Collection" : "Slips"} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
