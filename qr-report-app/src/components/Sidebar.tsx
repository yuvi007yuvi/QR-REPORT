import React from 'react';
import {
    LayoutDashboard,
    FileSpreadsheet,
    Map,
    MessageCircle,
    Image as ImageIcon,
    Calendar,
    X,
    ClipboardCheck,
    Trash2,
    Users,
    MapPin
} from 'lucide-react';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';

export type AppSection = 'daily' | 'coverage' | 'kyc';

export type ViewMode =
    | 'dashboard'
    | 'detailed'
    | 'zonal'
    | 'beforeAfter'
    | 'mapping'
    | 'underground'
    | 'zonalUnderground'
    | 'coverage-dashboard'
    | 'coverage-supervisor'
    | 'coverage-ward'
    | 'coverage-all-wards'
    | 'coverage-mapping'
    | 'kyc-calendar'
    | 'whatsapp-report'
    | 'ward-household-status'
    | 'kyc-checker'; // Added for KYCSurveyChecker fallback

interface SidebarProps {
    currentSection: AppSection;
    currentView: ViewMode;
    onNavigate: (section: AppSection, view?: ViewMode) => void;
    statsAvailable: boolean;
    isOpen: boolean;
    onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    currentSection,
    currentView,
    onNavigate,
    statsAvailable,
    isOpen,
    onClose
}) => {

    // Helper to check if an item is active
    const isActive = (section: AppSection, view?: ViewMode) => {
        if (section !== currentSection) return false;
        if (!view) return true; // Section match is enough if no view specified? 
        return view === currentView;
    };

    const renderMenuItem = (
        label: string,
        icon: React.ElementType,
        section: AppSection,
        view?: ViewMode,
        disabled: boolean = false
    ) => (
        <button
            onClick={() => {
                if (!disabled) {
                    onNavigate(section, view);
                    if (window.innerWidth < 1024) onClose();
                }
            }}
            disabled={disabled}
            className={`
                w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive(section, view)
                    ? 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-100'
                    : disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
            `}
        >
            {React.createElement(icon, { size: 18, className: isActive(section, view) ? 'text-blue-600' : 'text-gray-400' })}
            <span className="whitespace-nowrap">{label}</span>
            {isActive(section, view) && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-600" />
            )}
        </button>
    );

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Container */}
            <div className={`
                fixed lg:static inset-y-0 left-0 z-30
                w-72 bg-white border-r border-gray-200 flex flex-col font-sans transition-transform duration-300 ease-in-out shadow-xl lg:shadow-none
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:hidden'}
            `}>
                {/* Header */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100 shrink-0">
                    <div className="flex items-center gap-3">
                        <img
                            src={nagarNigamLogo}
                            alt="Logo"
                            className="w-8 h-8 object-contain"
                        />
                        <div>
                            <h1 className="font-bold text-gray-800 text-sm leading-tight uppercase tracking-tight">
                                Reports Admin
                            </h1>
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Panel</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">

                    {/* Section: Daily Reports */}
                    <div className="space-y-2">
                        <div className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Calendar size={12} />
                            Daily Operations
                        </div>
                        {renderMenuItem('Dashboard', LayoutDashboard, 'daily', 'dashboard', !statsAvailable)}
                        {renderMenuItem('Detailed Report', FileSpreadsheet, 'daily', 'detailed', !statsAvailable)}
                        {renderMenuItem('Zonal Summary', Map, 'daily', 'zonal', !statsAvailable)}
                        {renderMenuItem('Photo Evidence (Before/After)', ImageIcon, 'daily', 'beforeAfter', !statsAvailable)}
                        {renderMenuItem('Supervisor Mapping', Users, 'daily', 'mapping')}
                        {renderMenuItem('Underground Dustbins', Trash2, 'daily', 'underground', !statsAvailable)}
                        {renderMenuItem('Zonal Dustbins', Trash2, 'daily', 'zonalUnderground', !statsAvailable)}
                    </div>

                    {/* Section: Coverage Analysis */}
                    <div className="space-y-2">
                        <div className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <MapPin size={12} />
                            POI Coverage Analysis
                        </div>
                        {renderMenuItem('Coverage Dashboard', LayoutDashboard, 'coverage', 'coverage-dashboard')}
                        {renderMenuItem('Supervisor Analysis', Users, 'coverage', 'coverage-supervisor')}
                        {renderMenuItem('Ward Analysis', Map, 'coverage', 'coverage-ward')}
                        {renderMenuItem('All Wards Summary', FileSpreadsheet, 'coverage', 'coverage-all-wards')}
                        {renderMenuItem('POI Mapping', MapPin, 'coverage', 'coverage-mapping')}
                    </div>

                    {/* Section: KYC & Other */}
                    <div className="space-y-2">
                        <div className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <ClipboardCheck size={12} />
                            KYC & Dept. Reports
                        </div>
                        {renderMenuItem('KYC Calendar', Calendar, 'kyc', 'kyc-calendar')}
                        {renderMenuItem('KYC Checker', ClipboardCheck, 'kyc', 'kyc-checker')}
                        {renderMenuItem('Ward Household Status', Users, 'kyc', 'ward-household-status')}
                        {renderMenuItem('WhatsApp Reports', MessageCircle, 'kyc', 'whatsapp-report')}
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 text-[10px] text-center text-gray-400">
                    <p>Designed for Nature Green</p>
                    <p className="font-mono mt-1">v2.4.0</p>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
