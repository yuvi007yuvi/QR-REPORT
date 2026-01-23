import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, Search, Download, Image as ImageIcon, Trash2, ClipboardCheck, MapPin } from 'lucide-react';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toJpeg } from 'html-to-image';
import { MASTER_SUPERVISORS } from '../data/master-supervisors';

interface KPIRecord {
    'S.No': string;
    'Supervisor Name': string;
    'Supervisor Number': string;
    'Supervisor Id': string;
    'Zone-Circle': string;
    'Ward': string;
    'Date': string;
    'Time': string;
    'Remark': string;
}

interface SupervisorStat {
    name: string;
    id: string;
    mobile: string;
    zone: string;
    zonalName: string;
    ward: string;
    uniformCount: number;
    segregationCount: number;
    uniformLastTime: string;
    segregationLastTime: string;
}

export const KPIChecker: React.FC = () => {
    const [data, setData] = useState<SupervisorStat[]>([]);
    const [uniformFileName, setUniformFileName] = useState<string | null>(null);
    const [segregationFileName, setSegregationFileName] = useState<string | null>(null);
    const [rawUniformRecords, setRawUniformRecords] = useState<KPIRecord[]>([]);
    const [rawSegregationRecords, setRawSegregationRecords] = useState<KPIRecord[]>([]);

    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedZone, setSelectedZone] = useState<string>('All');
    const [selectedZonal, setSelectedZonal] = useState<string>('All');

    const uniformInputRef = useRef<HTMLInputElement>(null);
    const segregationInputRef = useRef<HTMLInputElement>(null);
    const reportRef = useRef<HTMLDivElement>(null);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'uniform' | 'segregation') => {
        const file = event.target.files?.[0];
        if (file) {
            if (type === 'uniform') setUniformFileName(file.name);
            else setSegregationFileName(file.name);

            setLoading(true);
            Papa.parse<KPIRecord>(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    processData(results.data, type);
                    setLoading(false);
                },
                error: (error) => {
                    console.error('Error parsing CSV:', error);
                    setLoading(false);
                }
            });
        }
    };

    // We need to keep track of the *other* dataset when processing one
    // So distinct process function isn't enough, we need to rebuild the map from both current raw sets
    // But since `handleFileUpload` is async and updates state, we might not have the *other* state updated yet if we rely on `rawUniformRecords` in the closure.
    // Better approach: Update the specific raw record state, then trigger a "recalc" effect? 
    // OR: Just pass the new records to a merger function along with the *existing* other records.

    const processData = (newRecords: KPIRecord[], type: 'uniform' | 'segregation') => {
        let currentUniform = type === 'uniform' ? newRecords : rawUniformRecords;
        let currentSegregation = type === 'segregation' ? newRecords : rawSegregationRecords;

        if (type === 'uniform') setRawUniformRecords(newRecords);
        else setRawSegregationRecords(newRecords);

        recalculateStats(currentUniform, currentSegregation);
    };

    const recalculateStats = (uniformRecs: KPIRecord[], segregationRecs: KPIRecord[]) => {
        const supervisorMap = new Map<string, SupervisorStat>();

        // 1. Initialize with Master Data
        MASTER_SUPERVISORS.forEach(sup => {
            if (sup.department === 'UCC') return;
            const id = sup.empId.trim().toUpperCase();
            supervisorMap.set(id, {
                name: sup.name,
                id: sup.empId,
                mobile: sup.mobile,
                zone: 'N/A',
                zonalName: sup.zonal,
                ward: sup.ward,
                uniformCount: 0,
                segregationCount: 0,
                uniformLastTime: '-',
                segregationLastTime: '-'
            });
        });

        const processRecordSet = (records: KPIRecord[], type: 'uniform' | 'segregation') => {
            records.forEach(record => {
                const name = record['Supervisor Name']?.trim();
                if (!name) return;
                const rawId = record['Supervisor Id'] || '';
                const id = rawId.trim().toUpperCase() || name.toUpperCase();
                const wardStr = record['Ward'] || 'N/A';
                const zoneNum = record['Zone-Circle'] || 'N/A';

                if (supervisorMap.has(id)) {
                    const existing = supervisorMap.get(id)!;
                    if (type === 'uniform') {
                        existing.uniformCount += 1;
                        existing.uniformLastTime = record['Time'];
                    } else {
                        existing.segregationCount += 1;
                        existing.segregationLastTime = record['Time'];
                    }

                    // Update dynamic fields (prefer newer info?)
                    // Just take valid data if missing
                    if (existing.zone === 'N/A' && zoneNum !== 'N/A') existing.zone = zoneNum;
                    if (existing.ward === 'N/A' && wardStr !== 'N/A') existing.ward = wardStr;
                } else {
                    // New entry not in master
                    supervisorMap.set(id, {
                        name: name,
                        id: rawId || 'N/A',
                        mobile: record['Supervisor Number'] || 'N/A',
                        zone: zoneNum,
                        zonalName: 'IEC TEAM (Sujeet Singh)',
                        ward: wardStr,
                        uniformCount: type === 'uniform' ? 1 : 0,
                        segregationCount: type === 'segregation' ? 1 : 0,
                        uniformLastTime: type === 'uniform' ? record['Time'] : '-',
                        segregationLastTime: type === 'segregation' ? record['Time'] : '-'
                    });
                }
            });
        };

        processRecordSet(uniformRecs, 'uniform');
        processRecordSet(segregationRecs, 'segregation');

        const statsArray = Array.from(supervisorMap.values()).sort((a, b) => {
            const totalA = a.uniformCount + a.segregationCount;
            const totalB = b.uniformCount + b.segregationCount;
            return totalB - totalA;
        });

        setData(statsArray);
    };

    const uniqueZones = Array.from(new Set(data.map(item => item.zone))).sort();
    const uniqueZonals = Array.from(new Set(data.map(item => item.zonalName))).sort();

    const filteredData = data.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.ward.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesZone = selectedZone === 'All' || item.zone === selectedZone;
        const matchesZonal = selectedZonal === 'All' || item.zonalName === selectedZonal;
        return matchesSearch && matchesZone && matchesZonal;
    });

    const totalSupervisors = data.length;
    // const totalUploads = rawRecords.length; // Now we have two counts

    // Mathura/Vrindavan Counts for Uniform
    // Calculate Supervisor Counts by Zone (Work Done)
    const getSupervisorCountByZone = (type: 'uniform' | 'segregation', targetZones: string[]) => {
        return data.filter(item => {
            const matchesZone = targetZones.some(z => item.zone.includes(z));
            const hasWork = type === 'uniform' ? item.uniformCount > 0 : item.segregationCount > 0;
            return matchesZone && hasWork;
        }).length;
    };

    const mathuraUniform = getSupervisorCountByZone('uniform', ['1', '2', '3']);
    const vrindavanUniform = getSupervisorCountByZone('uniform', ['4']);

    const mathuraSegregation = getSupervisorCountByZone('segregation', ['1', '2', '3']);
    const vrindavanSegregation = getSupervisorCountByZone('segregation', ['4']);

    const exportPDF = () => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.text('KPI Compliance Report', 14, 22);

        doc.setFontSize(11);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
        const filesStr = [uniformFileName, segregationFileName].filter(Boolean).join(', ') || 'N/A';
        doc.text(`Source Files: ${filesStr}`, 14, 36);

        // Summary
        doc.setDrawColor(200, 200, 200);
        doc.rect(14, 42, 180, 25);
        doc.setFontSize(10);
        doc.text(`Total Supervisors: ${totalSupervisors}`, 20, 52);
        doc.text(`Uniform Uploads: ${rawUniformRecords.length}`, 80, 52);
        doc.text(`Segregation Uploads: ${rawSegregationRecords.length}`, 140, 52);

        const tableData = filteredData.map(item => [
            item.name,
            item.zone,
            item.zonalName,
            item.ward,
            item.uniformCount > 0 ? `DONE (${item.uniformCount})` : "PENDING",
            item.segregationCount > 0 ? `DONE (${item.segregationCount})` : "PENDING"
        ]);

        autoTable(doc, {
            startY: 75,
            head: [['Supervisor Name', 'Zone', 'Zonal', 'Ward', 'Uniform', 'Segregation']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185], textColor: 255 },
            styles: { fontSize: 9 },
        });

        doc.save('KPI_Compliance_Report.pdf');
    };

    const exportJPEG = async () => {
        if (!reportRef.current) return;

        try {
            const dataUrl = await toJpeg(reportRef.current, { quality: 0.95, backgroundColor: '#ffffff' });
            const link = document.createElement('a');
            link.download = 'KPI_Compliance_Report.jpeg';
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Error generating JPEG:', error);
            alert('Failed to generate JPEG export.');
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header with Logos */}
            <div className="w-full bg-white border border-gray-200 rounded-xl px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                <img src={NagarNigamLogo} alt="NN" className="h-16 object-contain" />
                <div className="text-center">
                    <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Mathura Vrindavan Nagar Nigam</h1>
                    <div className="inline-block border-b-4 border-blue-500 pb-1 mt-1">
                        <h2 className="text-xl font-bold text-blue-700 uppercase tracking-wide">KPI Compliance Checker</h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 font-medium">Upload Uniform Compliance CSV to analyze supervisor performance</p>
                </div>
                <img src={NatureGreenLogo} alt="NG" className="h-16 object-contain" />
            </div>

            {/* Controls Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex gap-3">
                    <input
                        type="file"
                        ref={uniformInputRef}
                        onChange={(e) => handleFileUpload(e, 'uniform')}
                        accept=".csv"
                        className="hidden"
                    />
                    <input
                        type="file"
                        ref={segregationInputRef}
                        onChange={(e) => handleFileUpload(e, 'segregation')}
                        accept=".csv"
                        className="hidden"
                    />

                    {!uniformFileName && (
                        <button
                            onClick={() => uniformInputRef.current?.click()}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                        >
                            <Upload className="w-4 h-4" />
                            Upload Uniform
                        </button>
                    )}

                    {!segregationFileName && (
                        <button
                            onClick={() => segregationInputRef.current?.click()}
                            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                            <Upload className="w-4 h-4" />
                            Upload Segregation
                        </button>
                    )}


                    {data.length > 0 && (
                        <>
                            <button
                                onClick={exportPDF}
                                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                Export PDF
                            </button>
                            <button
                                onClick={exportJPEG}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                <ImageIcon className="w-4 h-4" />
                                Export JPEG
                            </button>
                        </>
                    )}
                </div>
            </div>

            {loading && (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
            )}

            {!loading && data.length > 0 && (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">


                        {/* Mathura Stats */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 relative overflow-hidden hover:shadow-md transition-shadow">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
                            <div className="flex items-center gap-2 mb-4">
                                <MapPin className="w-5 h-5 text-amber-500" />
                                <h3 className="font-bold text-gray-800 text-lg">Mathura <span className="text-xs text-gray-400 font-normal ml-1">(Zone 1-3)</span></h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-2 bg-amber-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <ClipboardCheck className="w-4 h-4 text-amber-600" />
                                        <span className="text-sm font-medium text-amber-800">Uniform</span>
                                    </div>
                                    <span className="font-bold text-gray-900">{mathuraUniform}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Trash2 className="w-4 h-4 text-orange-600" />
                                        <span className="text-sm font-medium text-orange-800">Waste Seg.</span>
                                    </div>
                                    <span className="font-bold text-gray-900">{mathuraSegregation}</span>
                                </div>
                            </div>
                        </div>

                        {/* Vrindavan Stats */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 relative overflow-hidden hover:shadow-md transition-shadow">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 to-fuchsia-600"></div>
                            <div className="flex items-center gap-2 mb-4">
                                <MapPin className="w-5 h-5 text-purple-500" />
                                <h3 className="font-bold text-gray-800 text-lg">Vrindavan <span className="text-xs text-gray-400 font-normal ml-1">(Zone 4)</span></h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between p-2 bg-purple-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <ClipboardCheck className="w-4 h-4 text-purple-600" />
                                        <span className="text-sm font-medium text-purple-900">Uniform</span>
                                    </div>
                                    <span className="font-bold text-gray-900">{vrindavanUniform}</span>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-fuchsia-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <Trash2 className="w-4 h-4 text-fuchsia-600" />
                                        <span className="text-sm font-medium text-fuchsia-900">Waste Seg.</span>
                                    </div>
                                    <span className="font-bold text-gray-900">{vrindavanSegregation}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Data Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <h3 className="font-semibold text-gray-800">Supervisor Performance List</h3>

                            <div className="flex flex-col sm:flex-row gap-3">
                                {/* Zone Filter */}
                                <select
                                    value={selectedZone}
                                    onChange={(e) => setSelectedZone(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                    <option value="All">All Zones</option>
                                    {uniqueZones.map(z => <option key={z} value={z}>Zone {z}</option>)}
                                </select>

                                {/* Zonal Filter */}
                                <select
                                    value={selectedZonal}
                                    onChange={(e) => setSelectedZonal(e.target.value)}
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                >
                                    <option value="All">All Zonals</option>
                                    {uniqueZonals.map(z => <option key={z} value={z}>{z}</option>)}
                                </select>

                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="Search..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-48"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto p-4" ref={reportRef}>
                            {/* In-Table Header for Export/View */}
                            <div className="bg-white border-b-2 border-gray-100 p-4 mb-4 flex flex-col md:flex-row items-center justify-between gap-4">
                                <img src={NagarNigamLogo} alt="NN" className="h-12 object-contain" />
                                <div className="text-center">
                                    <h2 className="text-lg font-bold text-gray-900 uppercase">Mathura Vrindavan Nagar Nigam</h2>
                                    <h3 className="text-md font-bold text-blue-700 uppercase mt-1">KPI Compliance Report</h3>
                                    <p className="text-xs text-gray-500 mt-1">Generated on: {new Date().toLocaleString()}</p>
                                    {(selectedZone !== 'All' || selectedZonal !== 'All') && (
                                        <div className="flex gap-2 justify-center mt-1 text-xs font-semibold text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-100 inline-block">
                                            {selectedZone !== 'All' && <span>Zone: {selectedZone}</span>}
                                            {selectedZone !== 'All' && selectedZonal !== 'All' && <span>|</span>}
                                            {selectedZonal !== 'All' && <span>Zonal: {selectedZonal}</span>}
                                        </div>
                                    )}
                                </div>
                                <img src={NatureGreenLogo} alt="NG" className="h-12 object-contain" />
                            </div>

                            <table className="w-full text-sm border-collapse border border-black">
                                <thead className="bg-gray-100 text-gray-900 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="px-4 py-3 border border-black text-center bg-gray-200" rowSpan={2}>S.No</th>
                                        <th className="px-4 py-3 border border-black text-left bg-gray-200" rowSpan={2}>Supervisor Name</th>
                                        <th className="px-4 py-3 border border-black text-center bg-gray-200" rowSpan={2}>ID</th>
                                        <th className="px-4 py-3 border border-black text-center bg-gray-200" rowSpan={2}>Mobile</th>
                                        <th className="px-4 py-3 border border-black text-center bg-gray-200" rowSpan={2}>Zone</th>
                                        <th className="px-4 py-3 border border-black text-center bg-gray-200" rowSpan={2}>Zonal</th>
                                        <th className="px-4 py-3 border border-black text-center bg-gray-200" rowSpan={2}>Ward</th>
                                        <th className="px-4 py-3 border border-black text-center bg-blue-600 text-white tracking-wider" colSpan={2}>Uniform Compliance</th>
                                        <th className="px-4 py-3 border border-black text-center bg-emerald-600 text-white tracking-wider" colSpan={2}>Segregation Compliance</th>
                                    </tr>
                                    <tr>
                                        <th className="px-4 py-2 border border-black text-center bg-blue-100 text-blue-900 text-xs">Status</th>
                                        <th className="px-4 py-2 border border-black text-center bg-blue-100 text-blue-900 text-xs">Time</th>
                                        <th className="px-4 py-2 border border-black text-center bg-emerald-100 text-emerald-900 text-xs">Status</th>
                                        <th className="px-4 py-2 border border-black text-center bg-emerald-100 text-emerald-900 text-xs">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredData.map((supervisor, index) => (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-4 py-2 border border-black text-center text-gray-700">{index + 1}</td>
                                            <td className="px-4 py-2 border border-black text-center font-bold text-gray-800">{supervisor.name}</td>
                                            <td className="px-4 py-2 border border-black text-center text-gray-600 font-mono text-xs">{supervisor.id}</td>
                                            <td className="px-4 py-2 border border-black text-center text-gray-600">{supervisor.mobile}</td>
                                            <td className="px-4 py-2 border border-black text-center text-gray-700">{supervisor.zone !== 'N/A' ? supervisor.zone : '-'}</td>
                                            <td className="px-4 py-2 border border-black text-center text-purple-700 font-medium">{supervisor.zonalName}</td>
                                            <td className="px-4 py-2 border border-black text-center text-gray-700 text-xs truncate max-w-[150px]" title={supervisor.ward}>{supervisor.ward}</td>
                                            <td className="px-4 py-2 border border-black text-center">
                                                <span className={`inline-block px-2 py-1 rounded font-bold text-xs ${supervisor.uniformCount > 0 ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}`}>
                                                    {supervisor.uniformCount > 0 ? `DONE (${supervisor.uniformCount})` : 'PENDING'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 border border-black text-center text-gray-500 text-xs font-mono">{supervisor.uniformLastTime || '-'}</td>

                                            <td className="px-4 py-2 border border-black text-center">
                                                <span className={`inline-block px-2 py-1 rounded font-bold text-xs ${supervisor.segregationCount > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                                    {supervisor.segregationCount > 0 ? `DONE (${supervisor.segregationCount})` : 'PENDING'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2 border border-black text-center text-gray-500 text-xs font-mono">{supervisor.segregationLastTime || '-'}</td>
                                        </tr>
                                    ))}

                                    {filteredData.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="px-6 py-8 text-center text-gray-500 border border-black">
                                                No supervisors found matching filters
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-6 border-t border-gray-100 text-center">
                            <div className="inline-block bg-gray-50 px-6 py-3 rounded-lg border border-gray-100 mb-3">
                                <p className="text-gray-500 font-medium text-sm">
                                    Generated by <span className="font-bold text-blue-600">Reports Buddy Pro</span>
                                    <span className="mx-2 text-gray-300">|</span>
                                    Created by <span className="font-bold text-gray-800 border-b-2 border-blue-200">Yuvraj Singh Tomar</span>
                                </p>
                            </div>
                            <p className="text-xs text-gray-400">
                                Showing {filteredData.length} of {data.length} supervisors
                            </p>
                        </div>
                    </div>
                </>
            )}

            {!loading && data.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-12 text-center">
                    <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Upload className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Data Uploaded</h3>
                    <p className="text-gray-500 mb-6 max-w-md mx-auto">
                        Please upload 'Uniform Compliance.csv' or 'Waste Segregation.csv' to analyze performance.
                    </p>
                    <div className="flex gap-4 justify-center">
                        <button
                            onClick={() => uniformInputRef.current?.click()}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md font-medium"
                        >
                            Upload Uniform
                        </button>
                        <button
                            onClick={() => segregationInputRef.current?.click()}
                            className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors shadow-md font-medium"
                        >
                            Upload Segregation
                        </button>
                    </div>
                </div>
            )}


        </div>
    );
};
