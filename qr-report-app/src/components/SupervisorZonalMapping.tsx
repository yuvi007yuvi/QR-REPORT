import React, { useState, useEffect, useMemo } from 'react';
import { 
    Image as ImageIcon, 
    RefreshCw, 
    Edit3, 
    Save, 
    Trash2, 
    Search,
    ShieldCheck
} from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { seedSupervisorsToFirestore } from '../utils/firebaseMigration';
import { exportToJPEG } from '../utils/exporter';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';

interface Supervisor {
    id: string; // Firestore doc ID
    empId: string;
    name: string;
    mobile: string;
    ward: string;
    zonal: string;
    department: string;
}

export const SupervisorZonalMapping: React.FC = () => {
    const { isAdmin } = useAuth();
    const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<Supervisor>>({});

    // Fetch data from Firestore
    useEffect(() => {
        const q = query(collection(db, 'supervisors'), orderBy('name', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Supervisor));
            setSupervisors(data);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // Filter and group data
    const groupedData = useMemo(() => {
        const filtered = supervisors.filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.ward.toString().includes(searchTerm) ||
            s.zonal.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.empId.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const groups: Record<string, Supervisor[]> = {};
        filtered.forEach(s => {
            const zone = s.zonal || 'Unassigned';
            if (!groups[zone]) groups[zone] = [];
            groups[zone].push(s);
        });
        return groups;
    }, [supervisors, searchTerm]);

    const handleSync = async () => {
        if (!window.confirm('This will seed the database with static master data. Continue?')) return;
        setIsMigrating(true);
        const result = await seedSupervisorsToFirestore();
        alert(result.message);
        setIsMigrating(false);
    };

    const handleEdit = (s: Supervisor) => {
        setEditingId(s.id);
        setEditData(s);
    };

    const handleSave = async (id: string) => {
        try {
            const docRef = doc(db, 'supervisors', id);
            await updateDoc(docRef, {
                ...editData,
                lastUpdated: new Date().toISOString()
            });
            setEditingId(null);
        } catch (err) {
            console.error('Save failed:', err);
            alert('Failed to save changes.');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this supervisor?')) return;
        try {
            await deleteDoc(doc(db, 'supervisors', id));
        } catch (err) {
            console.error('Delete failed:', err);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <div className="w-10 h-10 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-slate-400 text-sm font-medium">Synchronizing Mapping Data...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Control Bar */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/50 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                    <input
                        type="text"
                        placeholder="Search supervisor, ward or zone..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border-white/10 rounded-xl text-white text-sm focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    {isAdmin && supervisors.length === 0 && (
                        <button
                            onClick={handleSync}
                            disabled={isMigrating}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl text-sm font-semibold hover:bg-amber-500 hover:text-white transition-all disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={isMigrating ? 'animate-spin' : ''} />
                            Sync from Master
                        </button>
                    )}
                    
                    <button
                        onClick={() => exportToJPEG('mapping-report-container', 'Supervisor_Mapping_Report')}
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 shadow-lg shadow-emerald-900/20 transition-all"
                    >
                        <ImageIcon size={16} />
                        Export JPEG
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div id="mapping-report-container" className="bg-[#020617] p-8 rounded-3xl border border-white/5 shadow-2xl">
                {/* Visual Header (Branded) */}
                <div className="grid grid-cols-3 items-center mb-10 pb-10 border-b border-white/5">
                    <div className="flex flex-col items-start gap-3">
                        <img src={nagarNigamLogo} alt="Nagar Nigam" className="h-16 w-auto object-contain brightness-0 invert opacity-80" />
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] leading-tight">
                            Mathura-Vrindavan<br />Nagar Nigam
                        </div>
                    </div>

                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-widest">
                            <ShieldCheck size={12} /> Official Assignment Register
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tighter">SUPERVISOR <span className="text-emerald-500">MAPPING</span></h1>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-[0.3em]">Master Database v3.0</p>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <img src={natureGreenLogo} alt="Nature Green" className="h-16 w-auto object-contain" />
                        <div className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-[0.2em] text-right leading-tight">
                            Nature Green<br />Waste Management
                        </div>
                    </div>
                </div>

                {/* Data Tables */}
                <div className="space-y-12">
                    {Object.entries(groupedData).sort().map(([zone, sups]) => (
                        <div key={zone} className="group">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-px flex-1 bg-white/5" />
                                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    Zone: <span className="text-white">{zone}</span>
                                    <span className="text-[10px] bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full lowercase">
                                        {sups.length} units
                                    </span>
                                </h2>
                                <div className="h-px flex-1 bg-white/5" />
                            </div>

                            <div className="bg-slate-900/30 rounded-2xl border border-white/5 overflow-hidden">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-800/50">
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Emp ID</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Supervisor</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Ward(s)</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5">Contact</th>
                                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 text-right">Dept</th>
                                            {isAdmin && <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 text-right w-24">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.03]">
                                        {sups.map(s => (
                                            <tr key={s.id} className="hover:bg-white/[0.02] transition-colors group/row">
                                                <td className="px-6 py-4 text-xs font-mono text-slate-500">{s.empId}</td>
                                                <td className="px-6 py-4 text-sm font-bold text-slate-200">
                                                    {editingId === s.id ? (
                                                        <input 
                                                            className="bg-slate-800 border-emerald-500/50 text-white rounded px-2 py-1 w-full"
                                                            value={editData.name}
                                                            onChange={e => setEditData({...editData, name: e.target.value})}
                                                        />
                                                    ) : s.name}
                                                </td>
                                                <td className="px-6 py-4 text-xs font-medium text-slate-400">
                                                    {editingId === s.id ? (
                                                        <input 
                                                            className="bg-slate-800 border-emerald-500/50 text-white rounded px-2 py-1 w-full"
                                                            value={editData.ward}
                                                            onChange={e => setEditData({...editData, ward: e.target.value})}
                                                        />
                                                    ) : s.ward}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-slate-500">
                                                    {editingId === s.id ? (
                                                        <input 
                                                            className="bg-slate-800 border-emerald-500/50 text-white rounded px-2 py-1 w-full"
                                                            value={editData.mobile}
                                                            onChange={e => setEditData({...editData, mobile: e.target.value})}
                                                        />
                                                    ) : s.mobile}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded ${s.department === 'UCC' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                        {s.department}
                                                    </span>
                                                </td>
                                                {isAdmin && (
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                                            {editingId === s.id ? (
                                                                <button onClick={() => handleSave(s.id)} className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"><Save size={14} /></button>
                                                            ) : (
                                                                <button onClick={() => handleEdit(s)} className="p-1.5 text-slate-400 hover:bg-white/5 rounded-lg"><Edit3 size={14} /></button>
                                                            )}
                                                            <button onClick={() => handleDelete(s.id)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 size={14} /></button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Detailed Footer */}
                <div className="mt-16 pt-8 border-t border-white/5 text-center">
                    <p className="text-slate-600 text-[11px] font-medium tracking-widest uppercase mb-4">
                        System Signature: 0x798YST-PORTAL-BUDDY-SECURE
                    </p>
                    <div className="inline-flex items-center gap-6 px-8 py-3 rounded-2xl bg-white/[0.02] border border-white/5">
                        <div className="text-left border-r border-white/10 pr-6">
                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Generated by</div>
                            <div className="text-xs font-black text-white">Reports Buddy Pro</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Authority</div>
                            <div className="text-xs font-black text-slate-300">Yuvraj Singh Tomar</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
