import React from 'react';
import {
    FileSpreadsheet,
    Map,
    X,
    ClipboardCheck,
    Users,
    LayoutDashboard, // Added
    Image, // Added
    Trash2, // Added
    Route, // Added
    Truck, // Added
    MapPin, // Added
    History, // Added
    BarChart3, // Added
    Calendar, // Added
    Building2, // Added
    FileText, // Added
    Home, // Added
    FileSearch, // Added
    CheckSquare, // Added
    PieChart, // Added
    ArrowRightLeft // Added
} from 'lucide-react';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';

export type AppSection = 'daily' | 'coverage' | 'kyc' | 'qr-status' | 'secondary-trip' | 'complaint' | 'kpi';

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
    | 'coverage-mapping' // Added back
    | 'coverage-date-wise'
    | 'vehicle-change-report' // Added
    | 'poi-ward-monthly' // New Report
    | 'varun-adopted-wards' // Adopted Wards
    | 'kyc-survey'
    | 'kyc-calendar'
    | 'kyc-whatsapp'
    | 'ward-household-status' // Added back
    | 'ward-status-new' // Added new view
    | 'trip-report' // Added trip report
    | 'qr-status-view'
    | 'secondary-trip-view'
    | 'secondary-vehicle-history' // Added
    | 'cd-waste-complaint' // Added for C&D Waste Complaint Report
    | 'kpi-checker' // Added
    | 'supervisor-count-report'; // Added

interface SidebarProps {
    currentSection: AppSection;
    onSectionChange: (section: AppSection) => void;
    currentView: ViewMode;
    onViewChange: (view: ViewMode) => void;
    isOpen: boolean;
    onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
    currentSection,
    onSectionChange,
    currentView,
    onViewChange,
    isOpen,
    onClose
}) => {
    const menuItems = [
        {
            id: 'daily',
            label: 'Daily Reports',
            icon: LayoutDashboard,
            items: [
                { id: 'dashboard', label: 'Summary Dashboard', icon: LayoutDashboard },
                { id: 'detailed', label: 'Detailed View', icon: FileSpreadsheet },
                { id: 'zonal', label: 'Zonal Report', icon: Map },
                { id: 'beforeAfter', label: 'Before/After Report', icon: Image },
                { id: 'mapping', label: 'Supervisor Mapping', icon: Users },
                { id: 'underground', label: 'Underground Bins', icon: Trash2 },
                { id: 'zonalUnderground', label: 'Zonal Underground', icon: Trash2 },
                { id: 'distance-report', label: 'Distance Report', icon: Route },
                { id: 'trip-report', label: 'Trip Report', icon: Route },
            ]
        },
        {
            id: 'kpi',
            label: 'KPI Management',
            icon: ClipboardCheck,
            items: [
                { id: 'kpi-checker', label: 'KPI Compliance', icon: ClipboardCheck },
            ]
        },
        {
            id: 'secondary-trip', // Unified GPS Section
            label: 'GPS Tracking',
            icon: Truck,
            items: [
                { id: 'secondary-trip-view', label: 'Trip Report', icon: MapPin },
                { id: 'secondary-vehicle-history', label: 'Vehicle History', icon: History },
            ]
        },
        {
            id: 'complaint',
            label: 'Complaint Reports',
            icon: FileText,
            items: [
                { id: 'cd-waste-complaint', label: 'C&D Waste Complaint', icon: FileText },
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
                { id: 'varun-adopted-wards', label: 'Adopted Wards (Varun)', icon: Building2 },
                { id: 'coverage-all-wards', label: 'All Wards Summary', icon: FileSpreadsheet },
                { id: 'coverage-mapping', label: 'POI Mapping', icon: Map },
                { id: 'coverage-date-wise', label: 'Date Wise Coverage', icon: Calendar },
                { id: 'vehicle-change-report', label: 'Vehicle Change Report', icon: ArrowRightLeft }, // Added
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
            ]
        },
        {
            id: 'qr-status',
            label: 'QR Status Report',
            icon: CheckSquare,
            items: [
                { id: 'qr-status-view', label: 'Daily QR Status', icon: BarChart3 },
            ]
        }
    ];

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed lg:static inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transition-all duration-300 ease-in-out ${isOpen ? 'w-72 translate-x-0' : 'w-72 -translate-x-full lg:w-72 lg:translate-x-0'}`}>
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <img src={nagarNigamLogo} alt="Logo" className="w-8 h-8 object-contain" />
                            </div>
                            <div>
                                <h1 className="font-bold text-gray-900 leading-none">Nagar Nigam</h1>
                                <span className="text-xs text-blue-600 font-medium">Mathura-Vrindavan</span>
                            </div>
                        </div>
                        <button onClick={onClose} className="lg:hidden p-1 hover:bg-gray-100 rounded-md">
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 overflow-y-auto p-4 space-y-6">
                        {menuItems.map(section => (
                            <div key={section.id}>
                                <div
                                    onClick={() => onSectionChange(section.id as AppSection)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer mb-2 transition-colors ${currentSection === section.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <section.icon className="w-5 h-5" />
                                    <span className="font-semibold">{section.label}</span>
                                </div>

                                {currentSection === section.id && (
                                    <div className="ml-4 space-y-1 border-l-2 border-blue-100 pl-3">
                                        {section.items.map(item => (
                                            <button
                                                key={item.id}
                                                onClick={() => onViewChange(item.id as ViewMode)}
                                                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === item.id ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-gray-500 hover:text-gray-900'}`}
                                            >
                                                {item.icon && <item.icon className="w-4 h-4 inline mr-2 opacity-70" />}
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </nav>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50 text-[10px] text-center text-gray-400">
                        <p>Designed for Nature Green</p>
                        <p className="font-mono mt-1">v2.4.0</p>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
