import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { WARD_MASTER_DATA } from '../data/ward-master';

export interface UCCZoneManager {
    zone: string;
    uccManagerName: string;
    uccManagerPhone: string;
    operationManagerName: string;
    operationManagerPhone: string;
    uccZonalName: string;
    uccZonalPhone: string;
    ctZonalName: string;
    ctZonalPhone: string;
    lastUpdated?: string;
}

export interface UCCWardTarget {
    wardNumber: number;
    targetAmount: number;
    uccSupervisorName?: string;
    lastUpdated?: string;
}

export const UCCMappingManager: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [activeSubTab, setActiveSubTab] = useState<'zone-managers' | 'ward-targets'>('zone-managers');
    const [zoneManagers, setZoneManagers] = useState<Record<string, UCCZoneManager>>({});
    const [wardTargets, setWardTargets] = useState<Record<number, UCCWardTarget>>({});
    const [wardAssignments, setWardAssignments] = useState<Record<string, any>>({});
    const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });

    const zones = useMemo(() => ['Circle 1', 'Circle 2', 'Circle 3', 'Circle 4', 'Circle 5'], []);
    const wards = useMemo(() => [...WARD_MASTER_DATA].sort((a, b) => a.wardNumber - b.wardNumber), []);

    // Load data
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
            setLoading(false);
        });
        unsubs.push(unsubWards);

        const unsubAssignments = onSnapshot(collection(db, 'ward_assignments'), (snapshot) => {
            const data: Record<string, any> = {};
            snapshot.forEach(doc => {
                data[doc.id] = doc.data();
            });
            setWardAssignments(data);
        });
        unsubs.push(unsubAssignments);

        return () => unsubs.forEach(fn => fn());
    }, []);

    const handleSaveZoneManager = async (zone: string, field: keyof UCCZoneManager, value: string) => {
        try {
            const ref = doc(db, 'ucc_zone_managers', zone);
            const currentData = zoneManagers[zone] || {
                zone,
                uccManagerName: '', uccManagerPhone: '',
                operationManagerName: '', operationManagerPhone: '',
                uccZonalName: '', uccZonalPhone: '',
                ctZonalName: '', ctZonalPhone: ''
            };
            await setDoc(ref, {
                ...currentData,
                [field]: value,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            
            setStatus({ message: 'Saved successfully', type: 'success' });
            setTimeout(() => setStatus({ message: '', type: null }), 2000);
        } catch (err: any) {
            setStatus({ message: err.message || 'Failed to save', type: 'error' });
        }
    };

    const handleSaveWardTarget = async (wardNumber: number, field: keyof UCCWardTarget, value: string | number) => {
        try {
            const ref = doc(db, 'ucc_ward_targets', wardNumber.toString());
            const currentData = wardTargets[wardNumber] || { wardNumber, targetAmount: 0 };
            
            await setDoc(ref, {
                ...currentData,
                [field]: value,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
            
            setStatus({ message: 'Saved successfully', type: 'success' });
            setTimeout(() => setStatus({ message: '', type: null }), 2000);
        } catch (err: any) {
            setStatus({ message: err.message || 'Failed to save', type: 'error' });
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-slate-500 text-sm font-medium">Loading Mapping Data...</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-50 p-3 rounded-xl">
                        <ShieldCheck size={24} className="text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">UCC Report Mapping</h2>
                        <p className="text-sm text-slate-500">Configure Circle Managers and Ward Collection Targets for UCC Reports.</p>
                    </div>
                </div>
                
                {status.message && (
                    <div className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                        status.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                        {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                        {status.message}
                    </div>
                )}
            </div>

            {/* Sub Tabs */}
            <div className="flex gap-4 mb-8 border-b border-slate-200">
                <button
                    onClick={() => setActiveSubTab('zone-managers')}
                    className={`pb-4 px-2 text-sm font-bold border-b-2 transition-colors ${
                        activeSubTab === 'zone-managers' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    Circle Managers Configuration
                </button>
                <button
                    onClick={() => setActiveSubTab('ward-targets')}
                    className={`pb-4 px-2 text-sm font-bold border-b-2 transition-colors ${
                        activeSubTab === 'ward-targets' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    Ward Collection Targets
                </button>
            </div>

            {activeSubTab === 'zone-managers' ? (
                <div className="space-y-6">
                    {zones.map(zone => {
                        const data = zoneManagers[zone] || {
                            uccManagerName: '', uccManagerPhone: '',
                            operationManagerName: '', operationManagerPhone: '',
                            uccZonalName: '', uccZonalPhone: '',
                            ctZonalName: '', ctZonalPhone: ''
                        };

                        return (
                            <div key={zone} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="bg-slate-50 px-6 py-3 border-b border-slate-200">
                                    <h3 className="font-black text-lg text-slate-800">{zone}</h3>
                                </div>
                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6 bg-white">
                                    {/* UCC Manager */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">UCC MANAGER</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] text-slate-400 font-semibold mb-1 block">NAME</label>
                                                <input 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded text-sm px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                                                    value={data.uccManagerName || ''}
                                                    onChange={e => handleSaveZoneManager(zone, 'uccManagerName', e.target.value)}
                                                    placeholder="e.g. MRINAL JI"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 font-semibold mb-1 block">PHONE</label>
                                                <input 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded text-sm px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                                                    value={data.uccManagerPhone || ''}
                                                    onChange={e => handleSaveZoneManager(zone, 'uccManagerPhone', e.target.value)}
                                                    placeholder="Phone number"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Operation Manager */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">OPERATION MANAGER</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] text-slate-400 font-semibold mb-1 block">NAME</label>
                                                <input 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded text-sm px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                                                    value={data.operationManagerName || ''}
                                                    onChange={e => handleSaveZoneManager(zone, 'operationManagerName', e.target.value)}
                                                    placeholder="Name"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 font-semibold mb-1 block">PHONE</label>
                                                <input 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded text-sm px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                                                    value={data.operationManagerPhone || ''}
                                                    onChange={e => handleSaveZoneManager(zone, 'operationManagerPhone', e.target.value)}
                                                    placeholder="Phone number"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* UCC Zonal */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">UCC ZONAL</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] text-slate-400 font-semibold mb-1 block">NAME</label>
                                                <input 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded text-sm px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                                                    value={data.uccZonalName || ''}
                                                    onChange={e => handleSaveZoneManager(zone, 'uccZonalName', e.target.value)}
                                                    placeholder="Name"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 font-semibold mb-1 block">PHONE</label>
                                                <input 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded text-sm px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                                                    value={data.uccZonalPhone || ''}
                                                    onChange={e => handleSaveZoneManager(zone, 'uccZonalPhone', e.target.value)}
                                                    placeholder="Phone number"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* C&T Zonal */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2">C&T ZONAL</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] text-slate-400 font-semibold mb-1 block">NAME</label>
                                                <input 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded text-sm px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                                                    value={data.ctZonalName || ''}
                                                    onChange={e => handleSaveZoneManager(zone, 'ctZonalName', e.target.value)}
                                                    placeholder="Name"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-400 font-semibold mb-1 block">PHONE</label>
                                                <input 
                                                    className="w-full bg-slate-50 border border-slate-200 rounded text-sm px-3 py-2 outline-none focus:border-blue-500 transition-colors"
                                                    value={data.ctZonalPhone || ''}
                                                    onChange={e => handleSaveZoneManager(zone, 'ctZonalPhone', e.target.value)}
                                                    placeholder="Phone number"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse bg-white">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Ward No</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Area Name</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Supervisor Name</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">UCC Supervisor</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Zone</th>
                                <th className="px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Target Amount (₹)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {wards.map(w => {
                                const target = wardTargets[w.wardNumber]?.targetAmount || '';
                                return (
                                    <tr key={w.wardNumber} className="hover:bg-slate-50/50">
                                        <td className="px-6 py-3 font-bold text-slate-700">{w.wardNumber}</td>
                                        <td className="px-6 py-3 text-sm text-slate-600">{w.area}</td>
                                        <td className="px-6 py-3 text-sm text-slate-600">{wardAssignments[w.wardNumber.toString()]?.supervisorName || '-'}</td>
                                        <td className="px-6 py-3">
                                            <input 
                                                type="text"
                                                className="w-40 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
                                                value={wardTargets[w.wardNumber]?.uccSupervisorName || ''}
                                                onChange={e => handleSaveWardTarget(w.wardNumber, 'uccSupervisorName', e.target.value)}
                                                placeholder="Name"
                                            />
                                        </td>
                                        <td className="px-6 py-3 text-sm text-slate-500">{w.zone}</td>
                                        <td className="px-6 py-3">
                                            <input 
                                                type="number"
                                                className="w-32 bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
                                                value={target}
                                                onChange={e => handleSaveWardTarget(w.wardNumber, 'targetAmount', parseInt(e.target.value) || 0)}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
