import React from 'react';
import {
    FileSpreadsheet,
    Map,
    X,
    ClipboardCheck,
    LayoutDashboard,
    Trash2,
    BarChart3,
    Calendar,
    FileText,
    Home,
    FileSearch,
    PieChart,
    Banknote,
    ChevronRight,
    ShieldCheck,
    Settings
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

import nagarNigamLogo from '../assets/nagar-nigam-logo.png';

export type AppSection = 'daily' | 'kyc' | 'complaint' | 'kpi' | 'collection' | 'msw';

export type ViewMode =
    | 'dashboard'
    | 'zonal'
    | 'mapping'
    | 'kyc-survey'
    | 'kyc-calendar'
    | 'kyc-whatsapp'
    | 'ward-household-status'
    | 'ward-status-new'
    | 'trip-report'
    | 'cd-waste-complaint'
    | 'kpi-checker'
    | 'kpi-monthly-calendar'
    | 'supervisor-count-report'
    | 'ucc-report'
    | 'supervisor-daily-report'
    | 'daily-kyc-status'
    | 'ward-kyc-cross-check'
    | 'new-kyc-team-report'
    | 'complaint-register'
    | 'msw-date-wise'
    | 'door-to-door-report'
    | 'detailed-zonal-qr'
    | 'zonal-tabular-report'
    | 'detailed-qr-list'
    | 'admin-panel'
    | 'admin-ward-mapping'
    | 'admin-qr-master'
    | 'admin-ucc-mapping'
    | 'admin-user-management'
    | 'admin-data-seeding'
    | 'ucc-summary'
    | 'no-access';

interface SidebarProps {
    currentSection: AppSection;
    onSectionChange: (section: AppSection) => void;
    currentView: ViewMode;
    onViewChange: (view: ViewMode) => void;
    isOpen: boolean;
    onClose: () => void;
    isAdmin: boolean;
}


export const menuItems = [
    {
        id: 'daily',
        label: 'Daily Reports',
        icon: LayoutDashboard,
        items: [
            { id: 'dashboard', label: 'Summary Dashboard', icon: LayoutDashboard },
            { id: 'zonal', label: 'Zonal QR Report', icon: Map },
            { id: 'detailed-zonal-qr', label: 'Detailed Zonal Analytics', icon: BarChart3 },
            { id: 'zonal-tabular-report', label: 'Zonal Tabular Analysis', icon: FileText },
            { id: 'detailed-qr-list', label: 'Detailed QR Audit', icon: FileSearch },
            { id: 'door-to-door-report', label: 'Door to Door Report', icon: FileSpreadsheet },
        ]
    },
    {
        id: 'kpi',
        label: 'KPI Management',
        icon: ClipboardCheck,
        items: [
            { id: 'kpi-checker', label: 'KPI Compliance', icon: ClipboardCheck },
            { id: 'kpi-monthly-calendar', label: 'Monthly KPI Calendar', icon: Calendar },
        ]
    },
    {
        id: 'complaint',
        label: 'Complaint Reports',
        icon: FileText,
        items: [
            { id: 'cd-waste-complaint', label: 'C&D Waste Complaint', icon: FileText },
            { id: 'complaint-register', label: 'Resolution Analysis', icon: BarChart3 },
        ]
    },
    {
        id: 'collection',
        label: 'UCC Analysis',
        icon: Banknote,
        items: [
            { id: 'ucc-report', label: 'UCC Collection Analysis', icon: BarChart3 },
            { id: 'ucc-summary', label: 'UCC Summary', icon: LayoutDashboard },
        ]
    },
    {
        id: 'kyc',
        label: 'KYC Reports',
        icon: ClipboardCheck,
        items: [
            { id: 'kyc-survey', label: 'KYC Survey', icon: FileSearch },
            { id: 'supervisor-count-report', label: 'Supervisor Count Report', icon: PieChart },
            { id: 'kyc-calendar', label: 'KYC Calendar', icon: Calendar },
            { id: 'kyc-whatsapp', label: 'WhatsApp Reports', icon: FileText },
            { id: 'ward-household-status', label: 'Ward Household Status', icon: Home },
            { id: 'ward-status-new', label: 'Ward Wise Status (New)', icon: BarChart3 },
            { id: 'daily-kyc-status', label: 'Daily KYC Status', icon: FileText },
            { id: 'ward-kyc-cross-check', label: 'Ward KYC Cross-Check', icon: BarChart3 },
            { id: 'new-kyc-team-report', label: 'New KYC Team Report', icon: FileSpreadsheet },
        ]
    },
    {
        id: 'msw',
        label: 'MSW Management',
        icon: Trash2,
        items: [
            { id: 'msw-date-wise', label: 'Date Wise MSW', icon: Calendar },
        ]
    },
    {
        id: 'admin',
        label: 'Administration',
        icon: ShieldCheck,
        items: [
            { id: 'admin-panel', label: 'Admin Overview', icon: Settings },
            { id: 'admin-ward-mapping', label: 'Ward Mapping', icon: Map },
            { id: 'admin-qr-master', label: 'Master QR List', icon: FileSpreadsheet },
            { id: 'admin-ucc-mapping', label: 'UCC Mapping', icon: Map },
            { id: 'admin-user-management', label: 'User Management', icon: Settings },
            { id: 'admin-data-seeding', label: 'Data Seeding', icon: Settings },
        ]
    }
];

const Sidebar: React.FC<SidebarProps> = ({
    currentSection,
    onSectionChange,
    currentView,
    onViewChange,
    isOpen,
    onClose,
    isAdmin
}) => {
    const { currentUser } = useAuth();

    // Filter items based on RBAC
    let accessibleMenuItems = menuItems.map(section => {
        // Admins see everything
        if (isAdmin) return section;

        // If no allowedViews configured yet (legacy users), show everything except admin
        if (!currentUser?.allowedViews || currentUser.allowedViews.length === 0) {
            if (section.id === 'admin') return { ...section, items: [] };
            return section;
        }
        
        // Filter items in the section based on allowedViews
        const filteredItems = section.items.filter(item => currentUser.allowedViews?.includes(item.id));
        return {
            ...section,
            items: filteredItems
        };
    }).filter(section => section.items.length > 0); // Remove empty sections


    return (

        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="sidebar-overlay lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div className={`portal-sidebar ${isOpen ? 'translate-x-0' : 'sidebar-closed'}`}>
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

                    {/* Header */}
                    <div className="sidebar-header">
                        <div className="sidebar-logo-wrapper">
                            <div className="sidebar-logo-ring animate-pulse-glow">
                                <img src={nagarNigamLogo} alt="Logo" style={{ width: 26, height: 26, objectFit: 'contain' }} />
                            </div>
                            <div>
                                <div className="sidebar-title">Nagar Nigam</div>
                                <div className="sidebar-subtitle">Mathura-Vrindavan</div>
                            </div>
                        </div>
                        <button className="sidebar-close-btn" onClick={onClose} aria-label="Close sidebar">
                            <X size={16} />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="sidebar-nav">
                        {accessibleMenuItems.map((section) => {

                            const isActive = currentSection === section.id;
                            const SectionIcon = section.icon;
                            return (
                                <div key={section.id} className="sidebar-section">
                                    <button
                                        className={`sidebar-section-header ${isActive ? 'active' : ''}`}
                                        onClick={() => onSectionChange(isActive ? '' as any : section.id as AppSection)}
                                    >
                                        <div className="flex items-center gap-2" style={{ flex: 1 }}>
                                            <SectionIcon className="sidebar-section-icon" />
                                            <span>{section.label}</span>
                                        </div>
                                        <ChevronRight
                                            size={13}
                                            style={{
                                                opacity: 0.5,
                                                transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
                                                transition: 'transform 0.2s ease'
                                            }}
                                        />
                                    </button>

                                    {isActive && (
                                        <div className="sidebar-items">
                                            {section.items.map((item) => {
                                                const ItemIcon = item.icon;
                                                const itemActive = currentView === item.id;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        className={`sidebar-nav-item ${itemActive ? 'active' : ''}`}
                                                        onClick={() => onViewChange(item.id as ViewMode)}
                                                    >
                                                        <ItemIcon className="sidebar-nav-item-icon" />
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {item.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </nav>

                    {/* Footer */}
                    <div className="sidebar-footer">
                        <p>Designed for Nature Green</p>
                        <span className="version-badge">v2.4.0</span>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
