import React, { useMemo, useState } from 'react';
import { 
    Search, 
    Download,
    PieChart as PieIcon,
    MapPin,
    Table as TableIcon
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { exportToJPEG } from '../utils/exporter';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';
import { type ReportRecord, type WardAssignment, formatDisplayDate } from '../utils/dataProcessor';
import supervisorData from '../data/supervisorData.json';
import masterData from '../data/masterData.json';

interface DetailedZonalQRReportProps {
    data: ReportRecord[];
    date: string;
    onUpload: (data: any[], date: string) => void;
    wardAssignments?: Record<string, WardAssignment>;
}

interface WardStats {
    ward: string;
    wardName: string;
    supervisor: string;
    totalQr: number;
    scanned: number;
    pending: number;
    percentage: number;
}

interface ZoneHeadStats {
    name: string;
    zone: string;
    wards: WardStats[];
    totalQr: number;
    scanned: number;
    pending: number;
    percentage: number;
}

export const DetailedZonalQRReport: React.FC<DetailedZonalQRReportProps> = ({ data, date, wardAssignments }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedZone, setSelectedZone] = useState<'ALL' | 'MATHURA' | 'VRINDAVAN'>('ALL');

    const displayDate = useMemo(() => formatDisplayDate(date), [date]);

    const processedData = useMemo(() => {
        const heads: Record<string, ZoneHeadStats> = {};
        const normalize = (s: string) => s ? s.trim().toUpperCase() : 'UNASSIGNED';

        const sData = Array.isArray(supervisorData) ? supervisorData : (supervisorData as any).default || [];
        const mData = Array.isArray(masterData) ? masterData : (masterData as any).default || [];

        const wardCounts: Record<string, number> = {};
        mData.forEach((m: any) => {
            const mWardRaw = String(m['Ward'] || m['WARD'] || '').trim();
            const wardMatch = mWardRaw.match(/(\d+)/);
            const mWardNo = wardMatch ? wardMatch[1].replace(/^0+/, '') : '';
            if (mWardNo) {
                wardCounts[mWardNo] = (wardCounts[mWardNo] || 0) + 1;
            }
        });

        (sData as any[]).forEach((mapping: any) => {
            const rawWardNo = String(mapping['Ward No'] || mapping['WARD NO.'] || '').trim();
            const wardMatch = rawWardNo.match(/(\d+)/);
            const wardNo = wardMatch ? wardMatch[1].replace(/^0+/, '') : '';
            const wName = mapping['Ward Name'] || mapping['WARD NAME'] || `Ward ${wardNo}`;
            const masterTotal = wardCounts[wardNo] || 0;
            
            if (masterTotal === 0 && !data.some(r => {
                const rWardRaw = String(r.ward || '').trim();
                const rWardMatch = rWardRaw.match(/(\d+)/);
                return rWardMatch && rWardMatch[1].replace(/^0+/, '') === wardNo;
            })) return;

            const override = wardAssignments?.[wardNo];
            const supervisorName = (override?.supervisor && override.supervisor !== 'Unassigned') 
                ? override.supervisor 
                : (mapping['Supervisor'] || 'Unassigned');

            const headName = normalize(override?.zonalHead && override.zonalHead !== 'Unassigned' 
                ? override.zonalHead 
                : (mapping['Zonal Head'] || 'Unassigned'));

            if (!heads[headName]) {
                const isVrindavan = headName.includes('VRINDAVAN') || 
                                   String(mapping['Zone'] || '').includes('4') ||
                                   String(mapping['Zone & Circle'] || '').includes('4');
                heads[headName] = {
                    name: headName,
                    zone: isVrindavan ? 'VRINDAVAN' : 'MATHURA',
                    wards: [],
                    totalQr: 0,
                    scanned: 0,
                    pending: 0,
                    percentage: 0
                };
            }

            const head = heads[headName];
            if (!head.wards.find(w => w.ward === wardNo)) {
                head.wards.push({
                    ward: wardNo,
                    wardName: wName,
                    supervisor: supervisorName,
                    totalQr: masterTotal,
                    scanned: 0,
                    pending: masterTotal,
                    percentage: 0
                });
                head.totalQr += masterTotal;
                head.pending += masterTotal;
            }
        });

        data.forEach(record => {
            const wardRaw = String(record.ward || '').trim();
            const wardMatch = wardRaw.match(/(\d+)/);
            const wardNo = wardMatch ? wardMatch[1].replace(/^0+/, '') : '';
            
            const override = wardAssignments?.[wardNo];
            const headName = normalize(record.zonalHead && record.zonalHead !== 'Unassigned' ? record.zonalHead : (override?.zonalHead || 'Unassigned'));
            
            if (heads[headName]) {
                const head = heads[headName];
                const ward = head.wards.find(w => w.ward === wardNo);
                if (ward && record.status === 'Scanned') {
                    ward.scanned++;
                    ward.pending = Math.max(0, ward.totalQr - ward.scanned);
                    ward.percentage = Math.round((ward.scanned / (ward.totalQr || 1)) * 100);
                    head.scanned++;
                    head.pending = Math.max(0, head.totalQr - head.scanned);
                    head.percentage = Math.round((head.scanned / (head.totalQr || 1)) * 100);
                }
            }
        });

        return heads;
    }, [data, wardAssignments]);

    const filteredHeads = useMemo(() => {
        let heads = Object.values(processedData);
        if (selectedZone !== 'ALL') {
            heads = heads.filter(h => h.zone === selectedZone);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            heads = heads.filter(h => 
                h.name.toLowerCase().includes(q) || 
                h.wards.some(w => w.ward.includes(q) || w.wardName.toLowerCase().includes(q))
            );
        }
        return heads.sort((a, b) => b.percentage - a.percentage);
    }, [processedData, selectedZone, searchQuery]);

    const [pdfExporting, setPdfExporting] = useState(false);

    const handleExportPDF = async () => {
        const element = document.getElementById('detailed-zonal-content');
        if (!element) return;
        setPdfExporting(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 10;
            let currentY = margin;

            // 1. Header
            const headerSection = element.querySelector('.bg-white.rounded-\\[2\\.5rem\\]') as HTMLElement;
            if (headerSection) {
                const dataUrl = await toPng(headerSection, { pixelRatio: 2, backgroundColor: '#ffffff' });
                const imgProps = pdf.getImageProperties(dataUrl);
                const imgWidth = pdfWidth - (margin * 2);
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                pdf.addImage(dataUrl, 'PNG', margin, currentY, imgWidth, imgHeight);
                currentY += imgHeight + 10;
            }

            // 2. Supervisor Blocks
            const blocks = Array.from(element.querySelectorAll('.bg-white.rounded-\\[3rem\\]')) as HTMLElement[];
            for (const block of blocks) {
                const dataUrl = await toPng(block, { pixelRatio: 2, backgroundColor: '#ffffff' });
                const imgProps = pdf.getImageProperties(dataUrl);
                const imgWidth = pdfWidth - (margin * 2);
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

                if (currentY + imgHeight > pdfHeight - margin) {
                    pdf.addPage();
                    currentY = margin;
                }
                pdf.addImage(dataUrl, 'PNG', margin, currentY, imgWidth, imgHeight);
                currentY += imgHeight + 5;
            }

            // 3. Branding Footer
            const footer = element.querySelector('.bg-white.rounded-\\[2rem\\].border-2.border-slate-900') as HTMLElement;
            if (footer) {
                const dataUrl = await toPng(footer, { pixelRatio: 2, backgroundColor: '#ffffff' });
                const imgProps = pdf.getImageProperties(dataUrl);
                const imgWidth = pdfWidth - (margin * 2);
                const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

                if (currentY + imgHeight > pdfHeight - margin) {
                    pdf.addPage();
                    currentY = margin;
                }
                pdf.addImage(dataUrl, 'PNG', margin, currentY, imgWidth, imgHeight);
            }

            pdf.save(`Detailed-Zonal-Report-${date || new Date().toLocaleDateString()}.pdf`);
        } catch (err) {
            console.error('PDF export failed:', err);
        } finally {
            setPdfExporting(false);
        }
    };

    const handleExport = () => {
        exportToJPEG('detailed-zonal-content', `Detailed_Zonal_Report_${date}.jpg`);
    };

    return (
        <div className="min-h-screen bg-slate-50 p-4 lg:p-8">
            <div id="detailed-zonal-content" className="max-w-[1600px] mx-auto space-y-8">
                
                {/* Header Section */}
                <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-50 blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-50 rounded-full -ml-32 -mb-32 opacity-50 blur-3xl" />
                    
                    <div className="flex items-center gap-6 relative">
                        <div className="p-4 bg-slate-900 rounded-3xl shadow-xl shadow-slate-900/20 rotate-3">
                            <PieIcon className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Detailed Zonal Analytics</h1>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-full">Hierarchy Audit</span>
                                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                <span className="text-slate-500 font-bold text-sm">{displayDate !== 'N/A' ? displayDate : 'Select Date'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 relative">
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                            {(['ALL', 'MATHURA', 'VRINDAVAN'] as const).map(z => (
                                <button
                                    key={z}
                                    onClick={() => setSelectedZone(z)}
                                    className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${
                                        selectedZone === z 
                                        ? 'bg-white text-slate-900 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {z}
                                </button>
                            ))}
                        </div>

                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
                            <input 
                                type="text"
                                placeholder="Search Head/Ward..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-11 pr-6 py-3 bg-slate-100 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-slate-900/10 w-64 transition-all outline-none"
                            />
                        </div>

                        <button 
                            onClick={handleExportPDF}
                            disabled={pdfExporting}
                            className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl transition-all active:scale-95 disabled:opacity-50"
                        >
                            {pdfExporting ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            EXPORT PDF
                        </button>

                        <button 
                            onClick={handleExport}
                            className="flex items-center gap-3 bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl transition-all active:scale-95"
                        >
                            <TableIcon className="w-4 h-4" />
                            EXPORT JPEG
                        </button>
                    </div>
                </div>

                {/* Performance Feed */}
                <div className="space-y-10">
                    {filteredHeads.map((head) => (
                        <div key={head.name} className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                            {/* Head Header */}
                            <div className="p-8 lg:p-10 bg-slate-50 border-b border-slate-100 flex flex-col lg:flex-row items-center gap-8">
                                <div className="w-24 h-24">
                                    <ResponsiveContainer width="100%" height="100%" minHeight={96}>
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Done', value: head.scanned },
                                                    { name: 'Pending', value: head.totalQr - head.scanned }
                                                ]}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={30}
                                                outerRadius={40}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                <Cell fill="#0f172a" />
                                                <Cell fill="#e2e8f0" />
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{head.name}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                head.percentage >= 90 ? 'bg-emerald-100 text-emerald-700' : 
                                                head.percentage >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                                            }`}>
                                                {head.percentage}% Coverage
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-1 bg-white p-4 rounded-2xl border border-slate-100">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total QR</p>
                                            <p className="text-lg font-black text-slate-900">{head.totalQr}</p>
                                        </div>
                                        <div className="flex-1 bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                                            <p className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest mb-1">Scanned</p>
                                            <p className="text-lg font-black text-emerald-700">{head.scanned}</p>
                                        </div>
                                        <div className="flex-1 bg-rose-50 p-4 rounded-2xl border border-rose-100">
                                            <p className="text-[10px] font-black text-rose-600/70 uppercase tracking-widest mb-1">Pending</p>
                                            <p className="text-lg font-black text-rose-700">{head.totalQr - head.scanned}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Wards Matrix Grid */}
                            <div className="p-8 lg:p-10">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                                    {head.wards.sort((a,b) => parseInt(a.ward) - parseInt(b.ward)).map((ward) => (
                                        <div key={ward.ward} className="group relative bg-white border border-slate-100 rounded-3xl p-5 hover:shadow-xl hover:border-blue-200 transition-all duration-300">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-slate-900 rounded-xl">
                                                        <MapPin className="w-4 h-4 text-white" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ward</p>
                                                        <p className="text-lg font-black text-slate-900 leading-none">{ward.ward}</p>
                                                    </div>
                                                </div>
                                                <div className={`text-sm font-black ${ward.percentage >= 90 ? 'text-emerald-600' : ward.percentage >= 50 ? 'text-blue-600' : 'text-rose-600'}`}>
                                                    {ward.percentage}%
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex justify-between items-end">
                                                    <div>
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${ward.percentage === 100 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                            <span className="text-xs font-black text-slate-700 uppercase">
                                                                {ward.percentage === 100 ? 'Completed' : 'In Progress'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pending</p>
                                                        <p className="text-xs font-black text-slate-900">{ward.pending} QRs</p>
                                                    </div>
                                                </div>
                                                
                                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 ${
                                                            ward.percentage >= 90 ? 'bg-emerald-500' : ward.percentage >= 50 ? 'bg-blue-500' : 'bg-rose-500'
                                                        }`}
                                                        style={{ width: `${ward.percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Report Branding Footer */}
                <div className="bg-white rounded-[2rem] border-2 border-slate-900 p-10 flex flex-col lg:flex-row items-center justify-between gap-10">
                    <div className="flex items-center gap-8">
                        <img src={nagarNigamLogo} alt="NNMV" className="h-16 w-auto" />
                        <div className="h-12 w-px bg-slate-200" />
                        <div>
                            <h3 className="text-xl font-black text-slate-900 uppercase">Nagar Nigam Mathura-Vrindavan</h3>
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Administrative Hierarchical Audit</p>
                        </div>
                    </div>
                    
                    <div className="text-center lg:text-right">
                        <p className="text-slate-400 font-black uppercase text-[10px] tracking-[0.3em] mb-2">Systems Engineered By</p>
                        <div className="flex items-center justify-center lg:justify-end gap-3">
                            <span className="text-lg font-black text-slate-900">Nature Green</span>
                            <img src={natureGreenLogo} alt="Nature Green" className="h-8 w-auto" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
