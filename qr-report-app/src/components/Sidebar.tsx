import React, { useState } from 'react';
import {
    LayoutDashboard,
    FileText,
    Map as MapIcon,
    BarChart3,
    Trash2,
    ArrowLeftRight,
    MapPin,
    ChevronDown,
    ChevronUp,
    X
} from 'lucide-react';
import { clsx } from 'clsx';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';


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
    | 'kyc-survey'
    | 'kyc-calendar'
    | 'kyc-calendar'
    | 'whatsapp-report'
    | 'ward-household-status';

interface SidebarProps {
    currentSection: AppSection;
    currentView: ViewMode;
    onNavigate: (section: AppSection, view: ViewMode) => void;
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
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        daily: true,
        coverage: true,
        kyc: true
    });

    // Automatically expand the section that contains the current view
    if (!expandedSections[currentSection]) {
        setExpandedSections(prev => ({
            ...prev,
            [currentSection]: true
        }));
    }


    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const navItems = [
        {
            title: 'Daily Performance',
            section: 'daily' as AppSection,
            items: [
                { label: 'Quick Dashboard', view: 'dashboard' as ViewMode, icon: LayoutDashboard },
                { label: 'Detailed Table', view: 'detailed' as ViewMode, icon: FileText },
                { label: 'Zonal Summary', view: 'zonal' as ViewMode, icon: MapIcon },
                { label: 'Photo Evidence', view: 'beforeAfter' as ViewMode, icon: ArrowLeftRight },
                { label: 'Underground Bins', view: 'underground' as ViewMode, icon: Trash2 },
                { label: 'Zonal Dustbins', view: 'zonalUnderground' as ViewMode, icon: BarChart3 },
                { label: 'Daily Mapping', view: 'mapping' as ViewMode, icon: MapPin },
            ]
        },
        {
            title: 'Coverage Analysis (POI)',
            section: 'coverage' as AppSection,
            items: [
                { label: 'Coverage Dashboard', view: 'coverage-dashboard' as ViewMode, icon: LayoutDashboard },
                { label: 'Supervisor Coverage', view: 'coverage-supervisor' as ViewMode, icon: FileText },
                { label: 'Ward Detail Coverage', view: 'coverage-ward' as ViewMode, icon: MapIcon },
                { label: 'All Wards Coverage', view: 'coverage-all-wards' as ViewMode, icon: BarChart3 },
                { label: 'Coverage Mapping', view: 'coverage-mapping' as ViewMode, icon: MapPin },
            ]
        },
        {
            title: 'KYC Survey Management',
            section: 'kyc' as AppSection,
            items: [
                { label: 'KYC Survey Checker', view: 'kyc-survey' as ViewMode, icon: LayoutDashboard },
                { label: 'KYC Daily Calendar', view: 'kyc-calendar' as ViewMode, icon: BarChart3 },
                { label: 'Daily Target Report', view: 'whatsapp-report' as ViewMode, icon: FileText },
                { label: 'Ward Household Status', view: 'ward-household-status' as ViewMode, icon: MapIcon },
            ]
        }
    ];

    return (
        <>
            {/* Overlay for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                />
            )}

            <aside className={clsx(
                "fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 text-gray-900 flex flex-col z-50 transition-transform duration-300 shadow-lg",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>

                {/* Logo Area */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-gray-100 bg-gray-50/50 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                            <img src={nagarNigamLogo} alt="Logo" className="w-8 h-8 object-contain" />
                        </div>

                        <div className="flex flex-col">
                            <span className="text-sm font-extrabold tracking-tight text-gray-900 leading-none">REPORTS</span>
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">BUDDY PRO</span>
                        </div>
                    </div>

                    {/* Close button for mobile */}
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        aria-label="Close sidebar"
                    >
                        <X className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-4 scrollbar-hide">
                    {navItems.map((group, idx) => {
                        const isExpanded = expandedSections[group.section];
                        return (
                            <div key={idx} className="space-y-1">
                                <button
                                    onClick={() => toggleSection(group.section)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider hover:text-gray-700 transition-colors"
                                >
                                    <span>{group.title}</span>
                                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>

                                {isExpanded && (
                                    <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                                        {group.items.map((item, itemIdx) => {
                                            const isActive =
                                                currentSection === group.section &&
                                                (group.section === 'daily' ? currentView === item.view : currentView === item.view);

                                            const isDisabled = group.section === 'daily' && !statsAvailable && item.view !== 'dashboard' && item.view !== 'mapping';

                                            return (
                                                <button
                                                    key={itemIdx}
                                                    onClick={() => {
                                                        if (!isDisabled) {
                                                            onNavigate(group.section, item.view);
                                                        }
                                                    }}
                                                    disabled={isDisabled}
                                                    className={clsx(
                                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 group relative",
                                                        isActive
                                                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40 translate-x-1"
                                                            : isDisabled
                                                                ? "text-gray-300 cursor-not-allowed opacity-50"
                                                                : "text-gray-600 hover:bg-gray-50 hover:text-blue-600"
                                                    )}
                                                >
                                                    <div className={clsx(
                                                        "p-1.5 rounded-lg transition-colors",
                                                        isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600"
                                                    )}>
                                                        <item.icon className="w-4 h-4" />
                                                    </div>
                                                    <span className="flex-1 text-left tracking-tight">{item.label}</span>
                                                    {isActive && (
                                                        <div className="w-1 h-4 bg-white rounded-full shadow-sm" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>

                {/* Branding Logos Footer Area */}
                <div className="p-4 space-y-4 bg-gray-50/80 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-white p-2 rounded-xl border border-gray-200 flex items-center justify-center shadow-sm">
                            <img src={nagarNigamLogo} alt="Nagar Nigam" className="h-10 w-auto object-contain drop-shadow-sm" />
                        </div>
                        <div className="bg-white p-2 rounded-xl border border-gray-200 flex items-center justify-center shadow-sm">
                            <img src={natureGreenLogo} alt="Nature Green" className="h-10 w-auto object-contain drop-shadow-sm" />
                        </div>
                    </div>


                    <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white border border-gray-200 shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-sm font-black text-white shadow-md shadow-blue-500/20">
                            AD
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-xs font-black truncate text-gray-900 uppercase tracking-wider">Admin Portal</p>
                            <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <p className="text-[10px] text-gray-500 font-bold truncate">System Active</p>
                            </div>
                        </div>
                    </div>

                    <p className="text-[8px] text-center text-gray-400 font-bold uppercase tracking-[0.2em] mt-2">
                        Official Analytics System
                    </p>
                </div>
            </aside>
        </>
    );
};

