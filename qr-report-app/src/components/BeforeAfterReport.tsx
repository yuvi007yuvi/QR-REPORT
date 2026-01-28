import React, { useMemo } from 'react';
import type { ReportRecord } from '../utils/dataProcessor';
import { Image as ImageIcon } from 'lucide-react';
import { exportToJPEG } from '../utils/exporter';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';
import { Upload } from 'lucide-react';
import { processData, parseFile } from '../utils/dataProcessor';
import masterData from '../data/masterData.json';
import supervisorData from '../data/supervisorData.json';

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
    const [localData, setLocalData] = React.useState<ReportRecord[]>(data);
    const [localDate, setLocalDate] = React.useState<string>(date);
    const [loading, setLoading] = React.useState(false);
    const [showDetails, setShowDetails] = React.useState(false);
    const [selectedZone, setSelectedZone] = React.useState('All');

    React.useEffect(() => {
        setLocalData(data);
        setLocalDate(date);
    }, [data, date]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const jsonData = await parseFile(file);
            const { report, availableDates } = processData(masterData, supervisorData, jsonData);
            setLocalData(report);
            if (availableDates.length > 0) {
                setLocalDate(availableDates[0]);
            }
        } catch (error) {
            console.error("Upload failed", error);
            alert("Failed to process file");
        } finally {
            setLoading(false);
        }
    };

    const zonalHeads = useMemo(() => {
        const heads = new Set(localData.map(d => d.zonalHead).filter(h => h && h !== 'Unassigned' && h !== 'Unknown'));
        return ['All', ...Array.from(heads).sort()];
    }, [localData]);

    const reportData = useMemo(() => {
        const statsByHead: Record<string, ZoneHeadStats> = {};

        const normalize = (s: string) => s ? s.trim() : 'Unknown';

        localData.forEach(record => {
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
    }, [localData, selectedZone]);

    return (
        <div className="space-y-6">
            <div className="flex justify-end gap-2 items-center">
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
                    onClick={() => exportToJPEG('before-after-report-container', `Before_After_Report_${localDate.replace(/\//g, '-')}`)}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                    <ImageIcon className="w-4 h-4" />
                    Export JPEG
                </button>
            </div>

            <div id="before-after-report-container" className="bg-white p-4 min-w-[800px] overflow-x-auto">
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
                                BEFORE & AFTER<br />
                                <span className="text-blue-600">SCAN REPORT</span>
                            </h1>
                            <div className="h-1 w-20 bg-blue-600 rounded-full mb-2"></div>
                            <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-widest">
                                Daily Monitoring Evidence
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

                <div className="border-2 border-black">
                    <div className="grid grid-cols-[1fr_2fr] border-b border-black">
                        <div className="bg-[#d9ead3] p-2 font-bold border-r border-black">DATE:-</div>
                        <div className="bg-[#d9ead3] p-2 font-bold text-center">{localDate}</div>
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
                                                            <th className="p-1">Before Status</th>
                                                            <th className="p-1">Before Time</th>
                                                            <th className="p-1">After Status</th>
                                                            <th className="p-1">After Time</th>
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
                                                                        {qr.beforeScanStatus}
                                                                    </div>
                                                                </td>
                                                                <td className="p-1 text-gray-600 text-xs">
                                                                    {qr.beforeScanTime}
                                                                </td>
                                                                <td className="p-1">
                                                                    <div className={qr.afterScanStatus === 'Scanned' ? 'text-green-600' : 'text-red-500'}>
                                                                        {qr.afterScanStatus}
                                                                    </div>
                                                                </td>
                                                                <td className="p-1 text-gray-600 text-xs">
                                                                    {qr.afterScanTime}
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
            </div >
        </div >
    );
};
