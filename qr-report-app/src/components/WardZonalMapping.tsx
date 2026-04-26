import React, { useState, useMemo, useEffect } from 'react';
import { 
    Search, 
    Filter, 
    MapPin, 
    Users,
    ArrowUpDown,
    Download,
    CircleDot,
    Edit3,
    Save,
    X,
    ShieldCheck,
    RefreshCw
} from 'lucide-react';
import { collection, query, onSnapshot, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { WARD_MASTER_DATA, type WardMapping } from '../data/ward-master';
import { MASTER_SUPERVISORS } from '../data/master-supervisors';

interface WardAssignment extends WardMapping {
    id: string;
    supervisorName: string;
    zonalName: string;
    lastUpdated?: string;
}

export const WardZonalMapping: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedZone, setSelectedZone] = useState<string>('All');
    const [assignments, setAssignments] = useState<WardAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<WardAssignment>>({});
    const [sortConfig, setSortConfig] = useState<{ key: keyof WardAssignment; direction: 'asc' | 'desc' } | null>(null);

    // Sync static data with Firestore
    useEffect(() => {
        const q = query(collection(db, 'ward_assignments'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                setAssignments(WARD_MASTER_DATA.map(w => ({
                    ...w,
                    id: w.wardNumber.toString(),
                    supervisorName: '',
                    zonalName: ''
                })));
                setLoading(false);
                return;
            }

            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as WardAssignment));

            // Merge with master data to ensure all 70 wards exist
            const merged = WARD_MASTER_DATA.map(master => {
                const existing = data.find(d => d.wardNumber === master.wardNumber);
                return existing || {
                    ...master,
                    id: master.wardNumber.toString(),
                    supervisorName: '',
                    zonalName: ''
                };
            });

            setAssignments(merged);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const zones = useMemo(() => {
        const z = new Set(WARD_MASTER_DATA.map(w => w.zone));
        return ['All', ...Array.from(z).sort()];
    }, []);

    const filteredWards = useMemo(() => {
        let data = assignments.filter(w => {
            const matchesSearch = w.area.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                w.wardNumber.toString().includes(searchTerm) ||
                                w.supervisorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                w.zonalName.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesZone = selectedZone === 'All' || w.zone === selectedZone;
            return matchesSearch && matchesZone;
        });

        if (sortConfig) {
            data.sort((a, b) => {
                const aVal = a[sortConfig.key] ?? '';
                const bVal = b[sortConfig.key] ?? '';
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return data;
    }, [assignments, searchTerm, selectedZone, sortConfig]);

    const handleSort = (key: keyof WardAssignment) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const handleEdit = (ward: WardAssignment) => {
        setEditingId(ward.id);
        setEditData(ward);
    };

    const handleSave = async (id: string) => {
        try {
            const docRef = doc(db, 'ward_assignments', id);
            await setDoc(docRef, {
                ...editData,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            setEditingId(null);
        } catch (err) {
            console.error('Save failed:', err);
            alert('Failed to update assignment.');
        }
    };

    const handleSeedAssignments = async () => {
        if (!window.confirm('Initialize all 70 wards using Master Supervisors list?')) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);
            
            WARD_MASTER_DATA.forEach(w => {
                const wardNumStr = w.wardNumber.toString();
                
                // Find all supervisors assigned to this ward
                const assignedSupervisors = MASTER_SUPERVISORS.filter(s => {
                    const wardList = s.ward.split(',').map(part => part.trim());
                    return wardList.includes(wardNumStr);
                });

                const supervisorNames = assignedSupervisors
                    .map(s => `${s.name}${s.department ? ` (${s.department})` : ''}`)
                    .join(', ');

                const zonalNames = Array.from(new Set(assignedSupervisors.map(s => s.zonal)))
                    .filter(z => z && z !== 'N/A' && z !== 'NA')
                    .join(' / ');

                const ref = doc(db, 'ward_assignments', wardNumStr);
                batch.set(ref, {
                    ...w,
                    supervisorName: supervisorNames || '',
                    zonalName: zonalNames || '',
                    lastUpdated: new Date().toISOString()
                }, { merge: true });
            });

            await batch.commit();
            alert('Wards initialized with Master Supervisor data successfully!');
        } catch (err) {
            console.error('Seed failed:', err);
            alert('Failed to seed data: ' + (err as Error).message);
        }
        setLoading(false);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                <p className="text-slate-500 text-sm font-medium tracking-wide">Syncing Global Ward Mapping...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <ShieldCheck className="text-emerald-500" size={20} />
                        <h2 className="text-xl font-bold text-slate-800">Master Ward Assignments</h2>
                    </div>
                    <p className="text-sm text-slate-500">Configure Supervisor and Zonal Head names for all 70 wards.</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={handleSeedAssignments}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-semibold hover:bg-slate-200 transition-all"
                    >
                        <RefreshCw size={16} /> Reset/Seed Master
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 shadow-lg shadow-emerald-900/10 transition-all">
                        <Download size={16} /> Export Mapping
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text"
                        placeholder="Search area, ward, supervisor..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Filter className="text-slate-400" size={18} />
                    <select 
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        value={selectedZone}
                        onChange={e => setSelectedZone(e.target.value)}
                    >
                        {zones.map(z => <option key={z} value={z}>{z === 'All' ? 'All Zones' : `Zone: ${z}`}</option>)}
                    </select>
                </div>

                <div className="flex items-center justify-end px-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                        {filteredWards.length} / 70 Wards Configured
                    </span>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th onClick={() => handleSort('wardNumber')} className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-emerald-600 transition-colors">
                                    <div className="flex items-center gap-2">Ward <ArrowUpDown size={12} /></div>
                                </th>
                                <th onClick={() => handleSort('area')} className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-emerald-600 transition-colors">
                                    <div className="flex items-center gap-2">Area / Location <ArrowUpDown size={12} /></div>
                                </th>
                                <th onClick={() => handleSort('zone')} className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer hover:text-emerald-600 transition-colors">
                                    <div className="flex items-center gap-2">Zone <ArrowUpDown size={12} /></div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-emerald-50/30">
                                    <div className="flex items-center gap-2"><Users size={14} className="text-emerald-600" /> Assigned Supervisor</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-indigo-50/30">
                                    <div className="flex items-center gap-2"><MapPin size={14} className="text-indigo-600" /> Zonal Head</div>
                                </th>
                                <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredWards.map(ward => {
                                const isEditing = editingId === ward.id;
                                return (
                                    <tr key={ward.id} className={`hover:bg-slate-50/80 transition-colors group ${isEditing ? 'bg-emerald-50/20' : ''}`}>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-900 text-white text-[11px] font-black shadow-lg">
                                                {ward.wardNumber}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700">{ward.area}</span>
                                                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{ward.city}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase">
                                                {ward.zone}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 bg-emerald-50/10">
                                            {isEditing ? (
                                                <input 
                                                    className="w-full bg-white border-2 border-emerald-500/20 rounded-lg px-3 py-1.5 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                                                    value={editData.supervisorName}
                                                    placeholder="Type name..."
                                                    onChange={e => setEditData({...editData, supervisorName: e.target.value})}
                                                    autoFocus
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    {ward.supervisorName ? (
                                                        <span className="text-sm font-bold text-slate-700">{ward.supervisorName}</span>
                                                    ) : (
                                                        <span className="text-xs text-slate-300 italic flex items-center gap-1.5">
                                                            <CircleDot size={12} /> Not Assigned
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 bg-indigo-50/10">
                                            {isEditing ? (
                                                <input 
                                                    className="w-full bg-white border-2 border-indigo-500/20 rounded-lg px-3 py-1.5 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                                    value={editData.zonalName}
                                                    placeholder="Type name..."
                                                    onChange={e => setEditData({...editData, zonalName: e.target.value})}
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    {ward.zonalName ? (
                                                        <span className="text-sm font-bold text-indigo-700">{ward.zonalName}</span>
                                                    ) : (
                                                        <span className="text-xs text-slate-300 italic flex items-center gap-1.5">
                                                            <CircleDot size={12} /> Not Assigned
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {isEditing ? (
                                                <div className="flex justify-end gap-2">
                                                    <button 
                                                        onClick={() => handleSave(ward.id)}
                                                        className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all"
                                                    >
                                                        <Save size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingId(null)}
                                                        className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all"
                                                    >
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => handleEdit(ward)}
                                                    className="p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    <Edit3 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Info Footer */}
            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
                <CircleDot className="text-amber-500 shrink-0 mt-0.5" size={18} />
                <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Note:</strong> Changes made here will reflect globally across all reports that use the Ward-to-Supervisor mapping logic. 
                    This acts as the primary source of truth for administrative assignments in the Mathura-Vrindavan project.
                </p>
            </div>
        </div>
    );
};
