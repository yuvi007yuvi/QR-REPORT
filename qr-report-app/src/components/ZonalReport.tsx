import React, { useMemo } from 'react';
import type { ReportRecord } from '../utils/dataProcessor';
import { Image as ImageIcon } from 'lucide-react';
import { exportToJPEG } from '../utils/exporter';

interface ZonalReportProps {
    data: ReportRecord[];
    date: string;
}

interface SupervisorStats {
    name: string;
    totalQr: number;
    scanned: number;
    pending: number;
    scanTiming: string; // Defaulting to 'DAY' as per plan
}

interface ZoneHeadStats {
    name: string;
    supervisors: SupervisorStats[];
    totalQr: number;
    scanned: number;
    pending: number;
}

export const ZonalReport: React.FC<ZonalReportProps> = ({ data, date }) => {
    const reportData = useMemo(() => {
        const statsByHead: Record<string, ZoneHeadStats> = {};

        // Helper to normalize names for grouping
        const normalize = (s: string) => s ? s.trim() : 'Unknown';

        data.forEach(record => {
            const headName = normalize(record.zonalHead);
            const supervisorName = normalize(record.assignedTo);

            if (!statsByHead[headName]) {
                statsByHead[headName] = {
                    name: headName,
                    supervisors: [],
                    totalQr: 0,
                    scanned: 0,
                    pending: 0
                };
            }

            const headStats = statsByHead[headName];
            headStats.totalQr++;
            if (record.status === 'Scanned') headStats.scanned++;
            else headStats.pending++;

            let supervisorStats = headStats.supervisors.find(s => s.name === supervisorName);
            if (!supervisorStats) {
                supervisorStats = {
                    name: supervisorName,
                    totalQr: 0,
                    scanned: 0,
                    pending: 0,
                    scanTiming: 'DAY' // Default
                };
                headStats.supervisors.push(supervisorStats);
            }

            supervisorStats.totalQr++;
            if (record.status === 'Scanned') supervisorStats.scanned++;
            else supervisorStats.pending++;
        });

        // Convert to array and sort if needed
        return Object.values(statsByHead).sort((a, b) => a.name.localeCompare(b.name));
    }, [data]);

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

        data.forEach(r => {
            const isVrindavan = r.zone.toLowerCase().includes('vrindavan') || r.zonalHead.toLowerCase().includes('abhinav'); // Abhinav is Vrindavan in sample
            if (isVrindavan) {
                vrindavanTotal++;
                if (r.status === 'Scanned') vrindavanScanned++;
            } else {
                mathuraTotal++;
                if (r.status === 'Scanned') mathuraScanned++;
            }
        });

        return { mathuraTotal, mathuraScanned, vrindavanTotal, vrindavanScanned };
    }, [data]);

    return (
        <div className="space-y-6">
            <div className="flex justify-end gap-2">
                <button
                    onClick={() => exportToJPEG('zonal-report-container', `Zonal_Report_${date.replace(/\//g, '-')}`)}
                    className="flex items-center gap-1 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
                >
                    <ImageIcon className="w-4 h-4" />
                    Export JPEG
                </button>
            </div>

            <div id="zonal-report-container" className="bg-white p-4 min-w-[800px] overflow-x-auto">
                {/* Header Section */}
                <div className="border-2 border-black">
                    <div className="grid grid-cols-[1fr_2fr] border-b border-black">
                        <div className="bg-[#d9ead3] p-2 font-bold border-r border-black">DATE:-</div>
                        <div className="bg-[#d9ead3] p-2 font-bold text-center">{date}</div>
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

                    {/* Zonal Sections */}
                    {reportData.map((zone) => (
                        <div key={zone.name}>
                            {/* Zone Header */}
                            <div className="bg-[#ffc000] p-2 font-bold text-center border-b border-black uppercase border-t-2 border-t-black">
                                UNDER ZONAL MR. {zone.name}
                            </div>

                            {/* Table Header */}
                            <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr] bg-[#bdd7ee] text-xs font-bold border-b border-black text-center">
                                <div className="p-1 border-r border-black">NAME</div>
                                <div className="p-1 border-r border-black">TOTAL QR</div>
                                <div className="p-1 border-r border-black">SCAN TIMING</div>
                                <div className="p-1 border-r border-black">SCANNED</div>
                                <div className="p-1">PANDING QR</div>
                            </div>

                            {/* Supervisors */}
                            {zone.supervisors.map((sup) => {
                                // Determine row background based on scanned count (mimicking the image logic roughly)
                                // Image shows red/orange gradient for 0 scanned.
                                const isZeroScanned = sup.scanned === 0;
                                const scannedBg = isZeroScanned
                                    ? 'bg-gradient-to-r from-red-500 via-orange-500 to-red-500 text-white'
                                    : 'bg-white text-black';

                                const pendingBg = sup.pending === 0 ? 'bg-green-400' : 'bg-white';

                                return (
                                    <div key={sup.name} className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr] text-xs font-bold border-b border-black text-center items-center">
                                        <div className="p-1 border-r border-black bg-white">{sup.name}</div>
                                        <div className="p-1 border-r border-black bg-white">{sup.totalQr}</div>
                                        <div className="p-1 border-r border-black bg-white">{sup.scanTiming}</div>
                                        <div className={`p-1 border-r border-black ${scannedBg}`}>{sup.scanned}</div>
                                        <div className={`p-1 ${pendingBg}`}>{sup.pending}</div>
                                    </div>
                                );
                            })}

                            {/* Zone Total */}
                            <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr] bg-[#00b0f0] text-xs font-bold border-b border-black text-center">
                                <div className="p-1 border-r border-black">TOTAL</div>
                                <div className="p-1 border-r border-black">{zone.totalQr}</div>
                                <div className="p-1 border-r border-black"></div>
                                <div className="p-1 border-r border-black">{zone.scanned}</div>
                                <div className="p-1">{zone.pending}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
