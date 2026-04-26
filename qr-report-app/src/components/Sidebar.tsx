import React from 'react';
import {
    FileSpreadsheet,
    Map,
    X,
    ClipboardCheck,
    Users,
    LayoutDashboard,
    Image,
    Trash2,
    Route,
    MapPin,
    BarChart3,
    Calendar,
    Building2,
    FileText,
    Home,
    FileSearch,
    CheckSquare,
    PieChart,
    ArrowRightLeft,
    Banknote,
    ChevronRight
} from 'lucide-react';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';

export type AppSection = 'daily' | 'coverage' | 'kyc' | 'qr-status' | 'complaint' | 'kpi' | 'collection' | 'msw';

export type ViewMode =
    | 'dashboard'
    | 'detailed'
    | 'zonal'
    | 'beforeAfter'
    | 'mapping'
    | 'underground'
    | 'zonalUnderground'
    | 'distance-report'
    | 'coverage-dashboard'
    | 'coverage-supervisor'
    | 'coverage-ward'
    | 'coverage-all-wards'
    | 'coverage-mapping'
    | 'coverage-date-wise'
    | 'coverage-supervisor-wards'
    | 'vehicle-change-report'
    | 'poi-ward-monthly'
    | 'varun-adopted-wards'
    | 'kyc-survey'
    | 'kyc-calendar'
    | 'kyc-whatsapp'
    | 'ward-household-status'
    | 'ward-status-new'
    | 'trip-report'
    | 'qr-status-view'
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
    | 'msw-date-wise';

interface SidebarProps {
    currentSection: AppSection;
    onSectionChange: (section: AppSection) => void;
    currentView: ViewMode;
    onViewChange: (view: ViewMode) => void;
    isOpen: boolean;
    onClose: () => void;
}

const menuItems = [
    {
        id: 'daily',
        label: 'Daily Reports',
        icon: LayoutDashboard,
        items: [
            { id: 'dashboard', label: 'Summary Dashboard', icon: LayoutDashboard },
            { id: 'detailed', label: 'Detailed View', icon: FileSpreadsheet },
            { id: 'zonal', label: 'Zonal Report', icon: Map },
            { id: 'beforeAfter', label: 'Before / After Report', icon: Image },
            { id: 'mapping', label: 'Supervisor Mapping', icon: Users },
            { id: 'underground', label: 'Underground Bins', icon: Trash2 },
            { id: 'zonalUnderground', label: 'Zonal Underground', icon: Trash2 },
            { id: 'distance-report', label: 'Distance Report', icon: Route },
            { id: 'trip-report', label: 'Trip Report', icon: Route },
            { id: 'supervisor-daily-report', label: 'Supervisor Daily Analysis', icon: BarChart3 },
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
        label: 'Collection Reports',
        icon: Banknote,
        items: [
            { id: 'ucc-report', label: 'UCC Collection Analysis', icon: BarChart3 },
        ]
    },
    {
        id: 'coverage',
        label: 'POI Coverage',
        icon: MapPin,
        items: [
            { id: 'coverage-dashboard', label: 'Coverage Dashboard', icon: BarChart3 },
            { id: 'coverage-supervisor', label: 'Supervisor Report', icon: Users },
            { id: 'coverage-ward', label: 'Ward Wise Report (KYC)', icon: Building2 },
            { id: 'poi-ward-monthly', label: 'Ward POI Monthly', icon: FileSpreadsheet },
            { id: 'coverage-supervisor-wards', label: 'Supervisor Wards Coverage', icon: Users },
            { id: 'varun-adopted-wards', label: 'Adopted Wards (Varun)', icon: Building2 },
            { id: 'coverage-all-wards', label: 'All Wards Summary', icon: FileSpreadsheet },
            { id: 'coverage-mapping', label: 'POI Mapping', icon: Map },
            { id: 'coverage-date-wise', label: 'Date Wise Coverage', icon: Calendar },
            { id: 'vehicle-change-report', label: 'Vehicle Change Report', icon: ArrowRightLeft },
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
        id: 'qr-status',
        label: 'QR Status Report',
        icon: CheckSquare,
        items: [
            { id: 'qr-status-view', label: 'Daily QR Status', icon: BarChart3 },
        ]
    },
    {
        id: 'msw',
        label: 'MSW Management',
        icon: Trash2,
        items: [
            { id: 'msw-date-wise', label: 'Date Wise MSW', icon: Calendar },
        ]
    }
];

const Sidebar: React.FC<SidebarProps> = ({
    currentSection,
    onSectionChange,
    currentView,
    onViewChange,
    isOpen,
    onClose
}) => {
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
                        {menuItems.map(section => {
                            const isActive = currentSection === section.id;
                            const SectionIcon = section.icon;
                            return (
                                <div key={section.id} className="sidebar-section">
                                    <button
                                        className={`sidebar-section-header ${isActive ? 'active' : ''}`}
                                        onClick={() => onSectionChange(section.id as AppSection)}
                                    >
                                        <SectionIcon className="sidebar-section-icon" />
                                        <span style={{ flex: 1 }}>{section.label}</span>
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
                                            {section.items.map(item => {
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
