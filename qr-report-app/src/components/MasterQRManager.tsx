import React, { useState, useEffect, useMemo } from 'react';
import { 
    Upload, 
    Trash2, 
    CheckCircle2, 
    AlertCircle, 
    Search,
    RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { collection, query, onSnapshot, doc, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface MasterQR {
    id: string;
    qrId: string;
    siteName: string;
    zone: string;
    ward: string;
    type: string;
    address: string;
    area: string;
}

export const MasterQRManager: React.FC = () => {
    const [qrList, setQrList] = useState<MasterQR[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' | null }>({
        message: '',
        type: null
    });

    useEffect(() => {
        const q = query(collection(db, 'qr_master'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as MasterQR));
            setQrList(data);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const filteredList = useMemo(() => {
        return qrList.filter(qr => 
            qr.qrId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            qr.siteName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            qr.ward?.toString().includes(searchTerm) ||
            qr.area?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [qrList, searchTerm]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        setStatus({ message: 'Parsing file...', type: 'info' });

        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                try {
                    const data = evt.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet) as any[];

                    setStatus({ message: `Uploading ${json.length} records...`, type: 'info' });

                    // Batch upload
                    const batchSize = 400;
                    for (let i = 0; i < json.length; i += batchSize) {
                        const batch = writeBatch(db);
                        const chunk = json.slice(i, i + batchSize);
                        
                        chunk.forEach((row) => {
                            const qrId = (row['QR Code ID'] || row['qrId'] || '').toString().trim();
                            if (!qrId) return;

                            const docRef = doc(db, 'qr_master', qrId);
                            batch.set(docRef, {
                                qrId,
                                siteName: row['Site Name'] || row['siteName'] || '',
                                zone: (row['Zone'] || row['zone'] || '').toString(),
                                ward: (row['Ward'] || row['ward'] || '').toString(),
                                type: row['Type'] || row['type'] || '',
                                address: row['Address'] || row['address'] || '',
                                area: row['Area'] || row['area'] || '',
                                lastUpdated: new Date().toISOString()
                            });
                        });
                        
                        await batch.commit();
                        setStatus({ message: `Uploaded ${Math.min(i + batchSize, json.length)} / ${json.length} records...`, type: 'info' });
                    }

                    setStatus({ message: `Successfully synced ${json.length} Master QR records!`, type: 'success' });
                    setUploading(false);
                } catch (err: any) {
                    setStatus({ message: 'Upload failed: ' + err.message, type: 'error' });
                    setUploading(false);
                }
            };
            reader.readAsBinaryString(file);
        } catch (err: any) {
            setStatus({ message: 'File error: ' + err.message, type: 'error' });
            setUploading(false);
        }
    };

    const clearAllData = async () => {
        if (!window.confirm('Are you sure you want to delete ALL master QR records? This cannot be undone.')) return;
        
        setUploading(true);
        setStatus({ message: 'Clearing database...', type: 'info' });
        
        try {
            const querySnapshot = await getDocs(collection(db, 'qr_master'));
            const batchSize = 400;
            const docs = querySnapshot.docs;
            
            for (let i = 0; i < docs.length; i += batchSize) {
                const batch = writeBatch(db);
                const chunk = docs.slice(i, i + batchSize);
                chunk.forEach((d) => batch.delete(d.ref));
                await batch.commit();
            }
            
            setStatus({ message: 'All Master QR records cleared successfully.', type: 'success' });
        } catch (err: any) {
            setStatus({ message: 'Clear failed: ' + err.message, type: 'error' });
        }
        setUploading(false);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <p className="text-slate-500 font-medium">Loading Master QR Database...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Status Alert */}
            {status.type && (
                <div className={`p-4 rounded-xl border flex items-center gap-3 animate-fade-in ${
                    status.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                    status.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                    'bg-blue-50 border-blue-200 text-blue-800'
                }`}>
                    {status.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    <p className="text-sm font-bold">{status.message}</p>
                </div>
            )}

            {/* Actions Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-4">
                    <label className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm cursor-pointer transition-all shadow-lg ${
                        uploading ? 'bg-slate-200 text-slate-400' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-900/20'
                    }`}>
                        <Upload size={18} />
                        {uploading ? 'Processing...' : 'Upload Master Excel'}
                        <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} disabled={uploading} />
                    </label>
                    
                    <button 
                        onClick={clearAllData}
                        disabled={uploading || qrList.length === 0}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                    >
                        <Trash2 size={18} />
                        Clear All
                    </button>
                </div>

                <div className="text-right">
                    <div className="text-2xl font-black text-slate-800 leading-none">{qrList.length}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Records in Cloud</div>
                </div>
            </div>

            {/* Search & List */}
            <div className="space-y-4">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                        type="text"
                        placeholder="Search by QR ID, Site Name, or Area..."
                        className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-medium"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">QR ID</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Site Name</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Ward</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Area</th>
                                    <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredList.slice(0, 50).map((qr) => (
                                    <tr key={qr.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-black border border-blue-100">
                                                {qr.qrId}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-bold text-slate-700">{qr.siteName}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black">
                                                {qr.ward}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-500 font-medium">{qr.area}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 uppercase tracking-tight">
                                                {qr.type}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {filteredList.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                                            No records found. Upload a file to get started.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {filteredList.length > 50 && (
                        <div className="p-4 bg-slate-50 text-center border-t border-slate-200">
                            <p className="text-xs font-bold text-slate-400">Showing first 50 of {filteredList.length} matching records</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
