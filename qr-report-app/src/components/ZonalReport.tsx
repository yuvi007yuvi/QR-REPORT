import React, { useMemo } from 'react';
import type { ReportRecord } from '../utils/dataProcessor';
import { Image as ImageIcon, Upload } from 'lucide-react';
import { exportToJPEG } from '../utils/exporter';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';
import { parseFile } from '../utils/dataProcessor';

interface ZonalReportProps {
    data: ReportRecord[];
    date: string;
    onUpload: (data: any[], date: string) => void;
}

interface SupervisorStats {
    name: string;
    wards: Set<string>;
    wardNames: Set<string>;
    totalQr: number;
    scanned: number;
    pending: number;
    scanTiming: string;
}

interface ZoneHeadStats {
    name: string;
    supervisors: SupervisorStats[];
    totalQr: number;
    scanned: number;
    pending: number;
}

export const ZonalReport: React.FC<ZonalReportProps> = ({ data, date, onUpload }) => {
    const [localData, setLocalData] = React.useState<ReportRecord[]>(data);
    const [localDate, setLocalDate] = React.useState<string>(date);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (data) {
            setLocalData(data);
            setLocalDate(date);
        }
    }, [data, date]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const jsonData = await parseFile(file);
            // Identify first date in file for the header
            const dateKeys = ['Date Of Scan', 'Date', 'Scan Date', 'Timestamp'];
            let fileDate = '';
            if (jsonData.length > 0) {
                const firstRow = jsonData[0];
                for (const key of dateKeys) {
                    if (firstRow[key]) {
                        fileDate = firstRow[key];
                        break;
                    }
                }
            }
            onUpload(jsonData, fileDate);
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to process file");
        } finally {
            setLoading(false);
        }
    };

    const reportData = useMemo(() => {
        const zones: Record<string, Record<string, ZoneHeadStats>> = {
            'MATHURA': {},
            'VRINDAVAN': {}
        };

        const normalize = (s: string) => s ? s.trim() : 'Unknown';

        localData.forEach(record => {
            const headName = normalize(record.zonalHead);
            const supervisorName = normalize(record.assignedTo);
            
            // Map zone name to MATHURA or VRINDAVAN
            // Heuristic: Zone 4 is Vrindavan, others are Mathura
            const isVrindavan = record.zone.includes('4') || record.zone.toUpperCase().includes('VRINDAVAN');
            const zoneKey = isVrindavan ? 'VRINDAVAN' : 'MATHURA';

            if (!zones[zoneKey][headName]) {
                zones[zoneKey][headName] = {
                    name: headName,
                    supervisors: [],
                    totalQr: 0,
                    scanned: 0,
                    pending: 0
                };
            }

            const headStats = zones[zoneKey][headName];
            headStats.totalQr++;
            if (record.status === 'Scanned') headStats.scanned++;
            else headStats.pending++;

            let supervisorStats = headStats.supervisors.find(s => s.name === supervisorName);
            if (!supervisorStats) {
                supervisorStats = {
                    name: supervisorName,
                    wards: new Set<string>(),
                    wardNames: new Set<string>(),
                    totalQr: 0,
                    scanned: 0,
                    pending: 0,
                    scanTiming: 'DAY'
                };
                headStats.supervisors.push(supervisorStats);
            }

            // Extract ward number and name for display
            // Format is "60-Jagannath Puri"
            const wardMatch = record.ward.match(/^(\d+)-(.*)/);
            if (wardMatch) {
                supervisorStats.wards.add(wardMatch[1]);
                supervisorStats.wardNames.add(wardMatch[2].trim());
            } else {
                // Fallback if no dash
                const numMatch = record.ward.match(/^(\d+)/);
                if (numMatch) supervisorStats.wards.add(numMatch[1]);
                supervisorStats.wardNames.add(record.ward);
            }

            supervisorStats.totalQr++;
            if (record.status === 'Scanned') supervisorStats.scanned++;
            else supervisorStats.pending++;
        });

        return zones;
    }, [localData]);

    // Calculate Grand Totals for Header
    const grandTotals = useMemo(() => {
        let mathuraTotal = 0;
        let mathuraScanned = 0;
        let vrindavanTotal = 0;
        let vrindavanScanned = 0;

        // Naive logic to separate Mathura/Vrindavan based on Zonal Head or Zone if available
        // Since we don't have explicit city mapping in Zonal Head, we'll try to infer or just sum all for now.
        // Looking at the user image, it seems they separate by city. 
        // Let's check the data. Zone 4 is Vrindavan.

        localData.forEach(r => {
            const zoneStr = (r.zone || '').toLowerCase();
            const headStr = (r.zonalHead || '').toLowerCase();
            const isVrindavan = zoneStr.includes('vrindavan') || headStr.includes('vrindavan');
            if (isVrindavan) {
                vrindavanTotal++;
                if (r.status === 'Scanned') vrindavanScanned++;
            } else {
                mathuraTotal++;
                if (r.status === 'Scanned') mathuraScanned++;
            }
        });

        return { mathuraTotal, mathuraScanned, vrindavanTotal, vrindavanScanned };
    }, [localData]);

    return (
        <div className="space-y-6">
            <div className="flex justify-end gap-2">
                <label className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors cursor-pointer shadow-sm">
                    <Upload className="w-4 h-4" />
                    <span>{loading ? 'Processing...' : 'Upload Data'}</span>
                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={loading}
                    />
                </label>
                <button
                    onClick={() => exportToJPEG('zonal-report-container', `Zonal_Report_${localDate.replace(/\//g, '-')}`)}
                    className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
                >
                    <ImageIcon className="w-4 h-4" />
                    Export JPEG
                </button>
            </div>

            <div id="zonal-report-container" className="bg-white p-4 min-w-[800px] overflow-x-auto">
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
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">
                                ZONAL DAILY<br />
                                <span className="text-blue-600">REPORT</span>
                            </h1>
                            <div className="h-1 w-20 bg-blue-600 rounded-full mb-2"></div>
                            <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-widest">
                                Secondary Points Status
                            </p>
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

                {/* Header Section */}
                <div className="border-2 border-black">
                    <div className="grid grid-cols-[1fr_2fr] border-b border-black">
                        <div className="bg-[#d9ead3] p-2 font-bold border-r border-black">DATE:-</div>
                        <div className="bg-[#d9ead3] p-2 font-bold text-center">{localDate}</div>
                    </div>
                    <div className="bg-[#d9ead3] p-2 font-bold text-center border-b border-black text-xl">
                        Secondary Points Mathura - Vrindavan
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-black text-sm font-bold bg-[#ffe699]">
                        <div className="p-1 border-r border-black">MATHURA:-</div>
                        <div className="p-1 border-r border-black text-center">{grandTotals.mathuraScanned}</div>
                        <div className="p-1 border-r border-black text-center">Out of</div>
                        <div className="p-1 text-center">{grandTotals.mathuraTotal}</div>
                    </div>
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-black text-sm font-bold bg-[#ffe699]">
                        <div className="p-1 border-r border-black">VRINDAVAN :-</div>
                        <div className="p-1 border-r border-black text-center">{grandTotals.vrindavanScanned}</div>
                        <div className="p-1 border-r border-black text-center">Out of</div>
                        <div className="p-1 text-center">{grandTotals.vrindavanTotal}</div>
                    </div>
                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] border-b border-black text-sm font-bold bg-[#ffe699]">
                        <div className="p-1 border-r border-black">TOTAL QR SCAN</div>
                        <div className="p-1 border-r border-black text-center">{grandTotals.mathuraScanned + grandTotals.vrindavanScanned}</div>
                        <div className="p-1 border-r border-black text-center"></div>
                        <div className="p-1 text-center">{grandTotals.mathuraTotal + grandTotals.vrindavanTotal}</div>
                    </div>

                    {/* Zonal Sections Grouped by Zone */}
                    {Object.entries(reportData).map(([zoneName, heads]) => {
                        const headList = Object.values(heads).sort((a, b) => a.name.localeCompare(b.name));
                        if (headList.length === 0) return null;

                        return (
                            <div key={zoneName} className="border-t-4 border-black">
                                {/* Zone Header Label */}
                                <div className="bg-[#4472c4] text-white p-2 font-bold text-center uppercase tracking-widest text-lg">
                                    {zoneName} ZONE
                                </div>

                                {headList.map((zone) => {
                                    // Sort supervisors by ward number
                                    const sortedSupervisors = [...zone.supervisors].sort((a, b) => {
                                        const wardA = parseInt(Array.from(a.wards)[0] || '999');
                                        const wardB = parseInt(Array.from(b.wards)[0] || '999');
                                        return wardA - wardB;
                                    });

                                    return (
                                        <div key={zone.name}>
                                            {/* Zonal Head Header */}
                                            <div className="bg-[#ffc000] p-2 font-bold text-center border-b border-black uppercase border-t border-t-black">
                                                UNDER ZONAL MR. {zone.name}
                                            </div>

                                            {/* Table Header */}
                                            <div className="grid grid-cols-[2fr_1.5fr_1fr_2fr_1fr_1fr] bg-[#bdd7ee] text-xs font-bold border-b border-black text-center">
                                                <div className="p-1 border-r border-black">WARD (NO-NAME)</div>
                                                <div className="p-1 border-r border-black">SUPERVISOR</div>
                                                <div className="p-1 border-r border-black">TOTAL QR</div>
                                                <div className="p-1 border-r border-black">SCAN TIMING</div>
                                                <div className="p-1 border-r border-black">SCANNED</div>
                                                <div className="p-1">PENDING QR</div>
                                            </div>

                                            {/* Supervisors */}
                                            {sortedSupervisors.map((sup) => {
                                                const isZeroScanned = sup.scanned === 0;
                                                const scannedBg = isZeroScanned
                                                    ? 'bg-gradient-to-r from-red-500 via-orange-500 to-red-500 text-white'
                                                    : 'bg-white text-black';

                                                const pendingBg = sup.pending === 0 ? 'bg-green-400' : 'bg-white';
                                                
                                                // Format Ward display: "60-Jagannath Puri"
                                                const wardNums = Array.from(sup.wards).sort((a, b) => parseInt(a) - parseInt(b));
                                                const wardNames = Array.from(sup.wardNames);
                                                const wardDisplay = wardNums.map((n, i) => `${n}-${wardNames[i] || ''}`).join(', ');

                                                return (
                                                    <div key={sup.name} className="grid grid-cols-[2fr_1.5fr_1fr_2fr_1fr_1fr] text-xs font-bold border-b border-black text-center items-center">
                                                        <div className="p-1 border-r border-black bg-white text-left pl-1">
                                                            {wardDisplay}
                                                        </div>
                                                        <div className="p-1 border-r border-black bg-white">{sup.name}</div>
                                                        <div className="p-1 border-r border-black bg-white">{sup.totalQr}</div>
                                                        <div className="p-1 border-r border-black bg-white">{sup.scanTiming}</div>
                                                        <div className={`p-1 border-r border-black ${scannedBg}`}>{sup.scanned}</div>
                                                        <div className={`p-1 ${pendingBg}`}>{sup.pending}</div>
                                                    </div>
                                                );
                                            })}

                                            {/* Zonal Total */}
                                            <div className="grid grid-cols-[2fr_1.5fr_1fr_2fr_1fr_1fr] bg-[#00b0f0] text-xs font-bold border-b border-black text-center">
                                                <div className="p-1 border-r border-black"></div>
                                                <div className="p-1 border-r border-black">TOTAL</div>
                                                <div className="p-1 border-r border-black">{zone.totalQr}</div>
                                                <div className="p-1 border-r border-black"></div>
                                                <div className="p-1 border-r border-black">{zone.scanned}</div>
                                                <div className="p-1">{zone.pending}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {/* Detailed Site List */}
                    <div className="mt-8 border-t-4 border-black">
                        <div className="bg-[#4472c4] text-white p-2 font-bold text-center uppercase tracking-widest text-sm">
                            Detailed Site-wise Performance Status
                        </div>
                        <div className="grid grid-cols-[0.5fr_1.5fr_2fr_2fr_1fr_1fr] bg-[#bdd7ee] text-[10px] font-bold border-b border-black text-center uppercase">
                            <div className="p-1 border-r border-black">S.No</div>
                            <div className="p-1 border-r border-black">Ward</div>
                            <div className="p-1 border-r border-black">Site Name</div>
                            <div className="p-1 border-r border-black">Location/Address</div>
                            <div className="p-1 border-r border-black">Status</div>
                            <div className="p-1">Time</div>
                        </div>
                        {localData.sort((a, b) => {
                            const zoneA = (a.zone.includes('4') || a.zone.toUpperCase().includes('VRINDAVAN')) ? 'VRINDAVAN' : 'MATHURA';
                            const zoneB = (b.zone.includes('4') || b.zone.toUpperCase().includes('VRINDAVAN')) ? 'VRINDAVAN' : 'MATHURA';
                            if (zoneA !== zoneB) return zoneA.localeCompare(zoneB);
                            
                            const getNum = (w: string) => parseInt(w.match(/^(\d+)/)?.[1] || '0');
                            return getNum(a.ward) - getNum(b.ward);
                        }).map((record, idx) => (
                            <div key={record.qrId} className="grid grid-cols-[0.5fr_1.5fr_2fr_2fr_1fr_1fr] text-[9px] border-b border-black text-center items-center font-medium">
                                <div className="p-1 border-r border-black">{idx + 1}</div>
                                <div className="p-1 border-r border-black text-left pl-1">{record.ward}</div>
                                <div className="p-1 border-r border-black text-left pl-1">{record.siteName}</div>
                                <div className="p-1 border-r border-black text-left pl-1">{record.buildingName}</div>
                                <div className={`p-1 border-r border-black font-bold ${record.status === 'Scanned' ? 'text-green-600' : 'text-red-500'}`}>
                                    {record.status}
                                </div>
                                <div className="p-1">{record.scanTime || '-'}</div>
                            </div>
                        ))}
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
        </div>
    );
};
