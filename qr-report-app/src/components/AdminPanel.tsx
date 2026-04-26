import React, { useState } from 'react';
import { 
    Settings, 
    Database, 
    ShieldCheck, 
    RefreshCw, 
    Users, 
    AlertTriangle,
    CheckCircle2,
    ArrowRight,
    MapPin,
    ArrowLeft
} from 'lucide-react';
import { seedSupervisorsToFirestore } from '../utils/firebaseMigration';
import { WardZonalMapping } from './WardZonalMapping';

export const AdminPanel: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'overview' | 'ward-mapping'>('overview');
    const [status, setStatus] = useState<{ loading: boolean; message: string; type: 'success' | 'error' | 'info' | null }>({
        loading: false,
        message: '',
        type: null
    });

    const handleSeedData = async () => {
        if (!window.confirm('Are you sure you want to seed supervisor data? This will overwrite or skip based on existing data.')) return;
        
        setStatus({ loading: true, message: 'Running migration...', type: 'info' });
        try {
            const result = await seedSupervisorsToFirestore();
            if (result.success) {
                setStatus({ loading: false, message: result.message, type: 'success' });
            } else {
                setStatus({ loading: false, message: result.message, type: 'error' });
            }
        } catch (err: any) {
            setStatus({ loading: false, message: err.message || 'Migration failed', type: 'error' });
        }
    };

    if (activeTab === 'ward-mapping') {
        return (
            <div className="admin-panel-container" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
                <button 
                    onClick={() => setActiveTab('overview')}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-semibold text-sm mb-6 transition-colors"
                >
                    <ArrowLeft size={16} /> Back to Administration
                </button>
                <WardZonalMapping />
            </div>
        );
    }

    return (
        <div className="admin-panel-container" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ShieldCheck size={28} className="text-emerald-500" />
                    System Administration
                </h2>
                <p style={{ color: '#64748b', fontSize: '14px', marginTop: '4px' }}>
                    Manage system-level configurations and data migrations.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {/* Ward Mapping Card */}
                <div style={{ 
                    background: '#ffffff', 
                    borderRadius: '16px', 
                    border: '1.5px solid #e2e8f0', 
                    padding: '24px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    cursor: 'pointer'
                }} onClick={() => setActiveTab('ward-mapping')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '10px', background: '#fff7ed', borderRadius: '12px', color: '#f97316' }}>
                            <MapPin size={20} />
                        </div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Ward Mapping</h3>
                    </div>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: 1.5 }}>
                        Manage 70 municipal wards, zonal associations, and supervisor assignments.
                    </p>
                    <button 
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: '#f8fafc',
                            color: '#1e293b',
                            border: '1.5px solid #e2e8f0',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        Configure Wards <ArrowRight size={16} />
                    </button>
                </div>

                {/* Data Management Card */}
                <div style={{ 
                    background: '#ffffff', 
                    borderRadius: '16px', 
                    border: '1.5px solid #e2e8f0', 
                    padding: '24px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '10px', background: '#ecfdf5', borderRadius: '12px', color: '#10b981' }}>
                            <Database size={20} />
                        </div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>Data Seeding</h3>
                    </div>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: 1.5 }}>
                        Initialize the Firestore 'supervisors' collection with master data. Overwrites or skips existing records.
                    </p>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleSeedData(); }}
                        disabled={status.loading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: status.loading ? '#f1f5f9' : '#10b981',
                            color: status.loading ? '#94a3b8' : '#ffffff',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: status.loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            transition: 'all 0.2s'
                        }}
                    >
                        {status.loading ? <RefreshCw size={16} className="animate-spin" /> : <Database size={16} />}
                        Sync Supervisors
                    </button>
                </div>

                {/* User Access Card */}
                <div style={{ 
                    background: '#ffffff', 
                    borderRadius: '16px', 
                    border: '1.5px solid #e2e8f0', 
                    padding: '24px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <div style={{ padding: '10px', background: '#eff6ff', borderRadius: '12px', color: '#3b82f6' }}>
                            <Users size={20} />
                        </div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b' }}>User Permissions</h3>
                    </div>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px', lineHeight: 1.5 }}>
                        System roles and custom claims management. Verify your administrative status here.
                    </p>
                    <div style={{ 
                        padding: '12px', 
                        background: '#f8fafc', 
                        borderRadius: '10px', 
                        border: '1px dashed #cbd5e1',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        <span style={{ fontSize: '12px', color: '#475569', fontWeight: 500 }}>Admin privileges active</span>
                    </div>
                </div>
            </div>

            {/* Status Message */}
            {status.message && (
                <div style={{ 
                    marginTop: '24px', 
                    padding: '16px', 
                    borderRadius: '12px', 
                    background: status.type === 'success' ? '#f0fdf4' : status.type === 'error' ? '#fef2f2' : '#f8fafc',
                    border: `1.5px solid ${status.type === 'success' ? '#bbf7d0' : status.type === 'error' ? '#fecaca' : '#e2e8f0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                }}>
                    {status.type === 'success' ? <CheckCircle2 size={18} className="text-emerald-500" /> : <AlertTriangle size={18} className="text-rose-500" />}
                    <span style={{ fontSize: '14px', color: status.type === 'success' ? '#166534' : status.type === 'error' ? '#991b1b' : '#475569', fontWeight: 500 }}>
                        {status.message}
                    </span>
                </div>
            )}
        </div>
    );
};
