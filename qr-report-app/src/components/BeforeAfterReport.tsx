import React, { useMemo } from 'react';
import type { ReportRecord } from '../utils/dataProcessor';
import { Image as ImageIcon } from 'lucide-react';
import { exportToJPEG } from '../utils/exporter';

interface BeforeAfterReportProps {
    data: ReportRecord[];
    date: string;
}

interface SupervisorStats {
    name: string;
    totalQr: number;
    beforeScan: number;
    afterScan: number;
    totalScanned: number;
    pending: number;
    qrs: ReportRecord[];
}

interface ZoneHeadStats {
    name: string;
    supervisors: SupervisorStats[];
    totalQr: number;
    beforeScan: number;
    afterScan: number;
    totalScanned: number;
    pending: number;
}

export const BeforeAfterReport: React.FC<BeforeAfterReportProps> = ({ data, date }) => {
    const [showDetails, setShowDetails] = React.useState(false);
    const [selectedZone, setSelectedZone] = React.useState('All');

    const zonalHeads = useMemo(() => {
        const heads = new Set(data.map(d => d.zonalHead).filter(h => h && h !== 'Unassigned' && h !== 'Unknown'));
        return ['All', ...Array.from(heads).sort()];
    }, [data]);

    const reportData = useMemo(() => {
        const statsByHead: Record<string, ZoneHeadStats> = {};

        const normalize = (s: string) => s ? s.trim() : 'Unknown';

        data.forEach(record => {
            const headName = normalize(record.zonalHead);
            const supervisorName = normalize(record.assignedTo);

            if (!statsByHead[headName]) {
                statsByHead[headName] = {
                    name: headName,
                    supervisors: [],
                    totalQr: 0,
                    beforeScan: 0,
                    afterScan: 0,
                    totalScanned: 0,
                    pending: 0
                };
            }

            const headStats = statsByHead[headName];
            headStats.totalQr++;
            if (record.beforeScanStatus === 'Scanned') headStats.beforeScan++;
            if (record.afterScanStatus === 'Scanned') headStats.afterScan++;
            if (record.status === 'Scanned') headStats.totalScanned++;
            else headStats.pending++;

            let supervisorStats = headStats.supervisors.find(s => s.name === supervisorName);
            if (!supervisorStats) {
                supervisorStats = {
                    name: supervisorName,
                    totalQr: 0,
                    beforeScan: 0,
                    afterScan: 0,
                    totalScanned: 0,
                    pending: 0,
                    qrs: []
                };
                headStats.supervisors.push(supervisorStats);
            }

            supervisorStats.totalQr++;
            if (record.beforeScanStatus === 'Scanned') supervisorStats.beforeScan++;
            if (record.afterScanStatus === 'Scanned') supervisorStats.afterScan++;
            if (record.status === 'Scanned') supervisorStats.totalScanned++;
            else supervisorStats.pending++;

            supervisorStats.qrs.push(record);
        });

        return Object.values(statsByHead)
            .filter(head => selectedZone === 'All' || head.name === selectedZone)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [data, selectedZone]);

    return (
        <div className="space-y-6">
            <div className="flex justify-end gap-2 items-center">
                <select
                    value={selectedZone}
                    onChange={(e) => setSelectedZone(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                    {zonalHeads.map(head => (
                        <option key={head} value={head}>{head === 'All' ? 'All Zonal Heads' : head}</option>
                    ))}
                </select>

                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="px-3 py-2 bg-gray-600 text-white rounded-lg text-sm hover:bg-gray-700 transition-colors"
                >
                    {showDetails ? 'Hide Details' : 'Show Details'}
                </button>
                <button
                    onClick={() => exportToJPEG('before-after-report-container', `Before_After_Report_${date.replace(/\//g, '-')}`)}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                    <ImageIcon className="w-4 h-4" />
                    Export JPEG
                </button>
            </div>

            <div id="before-after-report-container" className="bg-white p-4 min-w-[800px] overflow-x-auto">
                <div className="border-2 border-black">
                    <div className="grid grid-cols-[1fr_2fr] border-b border-black">
                        <div className="bg-[#d9ead3] p-2 font-bold border-r border-black">DATE:-</div>
                        <div className="bg-[#d9ead3] p-2 font-bold text-center">{date}</div>
                    </div>
                    <div className="bg-[#d9ead3] p-2 font-bold text-center border-b border-black text-xl">
                        Before & After Scan Report
                    </div>

                    {reportData.map((zone) => (
                        <div key={zone.name}>
                            <div className="bg-[#ffc000] p-2 font-bold text-center border-b border-black uppercase border-t-2 border-t-black">
                                UNDER ZONAL MR. {zone.name}
                            </div>



                            {zone.supervisors.map((sup, index) => {
                                const pendingBg = sup.pending === 0 ? 'bg-green-400' : 'bg-white';
                                return (
                                    <React.Fragment key={sup.name}>
                                        <div className="grid grid-cols-[0.5fr_2fr_1fr_1fr_1fr_1fr_1fr] bg-[#bdd7ee] text-xs font-bold border-b border-black text-center">
                                            <div className="p-1 border-r border-black">S.NO.</div>
                                            <div className="p-1 border-r border-black">NAME</div>
                                            <div className="p-1 border-r border-black">TOTAL QR</div>
                                            <div className="p-1 border-r border-black">BEFORE SCAN</div>
                                            <div className="p-1 border-r border-black">AFTER SCAN</div>
                                            <div className="p-1 border-r border-black">TOTAL SCANNED</div>
                                            <div className="p-1">PENDING</div>
                                        </div>
                                        <div className="grid grid-cols-[0.5fr_2fr_1fr_1fr_1fr_1fr_1fr] text-xs font-bold border-b border-black text-center items-center">
                                            <div className="p-1 border-r border-black bg-white">{index + 1}</div>
                                            <div className="p-1 border-r border-black bg-white">{sup.name}</div>
                                            <div className="p-1 border-r border-black bg-white">{sup.totalQr}</div>
                                            <div className="p-1 border-r border-black bg-white">{sup.beforeScan}</div>
                                            <div className="p-1 border-r border-black bg-white">{sup.afterScan}</div>
                                            <div className="p-1 border-r border-black bg-white">{sup.totalScanned}</div>
                                            <div className={`p-1 ${pendingBg}`}>{sup.pending}</div>
                                        </div>
                                        {showDetails && (
                                            <div className="col-span-7 border-b border-black bg-gray-50 p-2">
                                                <table className="w-full text-xs text-left">
                                                    <thead>
                                                        <tr className="border-b border-gray-300">
                                                            <th className="p-1">S.No.</th>
                                                            <th className="p-1">QR ID</th>
                                                            <th className="p-1">Ward</th>
                                                            <th className="p-1">Site Name</th>
                                                            <th className="p-1">Building/Street</th>
                                                            <th className="p-1">Type</th>
                                                            <th className="p-1">Before Scan</th>
                                                            <th className="p-1">After Scan</th>
                                                            <th className="p-1">Time Diff</th>
                                                            <th className="p-1">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sup.qrs.map((qr, qrIndex) => (
                                                            <tr key={qr.qrId} className="border-b border-gray-100">
                                                                <td className="p-1">{qrIndex + 1}</td>
                                                                <td className="p-1">{qr.qrId}</td>
                                                                <td className="p-1">{qr.ward.split('-')[0]}</td>
                                                                <td className="p-1 text-xs text-gray-500 truncate max-w-[150px]" title={qr.siteName}>{qr.siteName}</td>
                                                                <td className="p-1 text-xs text-gray-500 truncate max-w-[150px]" title={qr.buildingName}>{qr.buildingName}</td>
                                                                <td className="p-1 text-xs text-gray-500">{qr.type}</td>
                                                                <td className="p-1">
                                                                    <div className={qr.beforeScanStatus === 'Scanned' ? 'text-green-600' : 'text-red-500'}>
                                                                        {qr.beforeScanStatus} <span className="text-gray-400 text-[10px]">{qr.beforeScanTime}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-1">
                                                                    <div className={qr.afterScanStatus === 'Scanned' ? 'text-green-600' : 'text-red-500'}>
                                                                        {qr.afterScanStatus} <span className="text-gray-400 text-[10px]">{qr.afterScanTime}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-1 text-blue-600 font-medium">{qr.timeDifference}</td>
                                                                <td className="p-1">{qr.status}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}

                            <div className="grid grid-cols-[0.5fr_2fr_1fr_1fr_1fr_1fr_1fr] bg-[#00b0f0] text-xs font-bold border-b border-black text-center">
                                <div className="p-1 border-r border-black"></div>
                                <div className="p-1 border-r border-black">TOTAL</div>
                                <div className="p-1 border-r border-black">{zone.totalQr}</div>
                                <div className="p-1 border-r border-black">{zone.beforeScan}</div>
                                <div className="p-1 border-r border-black">{zone.afterScan}</div>
                                <div className="p-1 border-r border-black">{zone.totalScanned}</div>
                                <div className="p-1">{zone.pending}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div >
        </div >
    );
};
