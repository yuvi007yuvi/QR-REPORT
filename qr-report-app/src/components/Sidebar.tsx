import React from 'react';
import {
    LayoutDashboard,
    FileText,
    Map as MapIcon,
    BarChart3,
    Trash2,
    ArrowLeftRight,
    MapPin,
    ChevronRight
} from 'lucide-react';
import { clsx } from 'clsx';

export type AppSection = 'daily' | 'coverage';
export type ViewMode = 'dashboard' | 'detailed' | 'zonal' | 'beforeAfter' | 'mapping' | 'underground' | 'zonalUnderground';

interface SidebarProps {
    currentSection: AppSection;
    currentView: ViewMode;
    onNavigate: (section: AppSection, view: ViewMode) => void;
    statsAvailable: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
    currentSection,
    currentView,
    onNavigate,
    statsAvailable
}) => {

    const navItems = [
        {
            title: 'Daily Reports',
            section: 'daily' as AppSection,
            items: [
                { label: 'Dashboard', view: 'dashboard' as ViewMode, icon: LayoutDashboard },
                { label: 'Detailed Report', view: 'detailed' as ViewMode, icon: FileText },
                { label: 'Zonal Summary', view: 'zonal' as ViewMode, icon: MapIcon },
                { label: 'Before/After', view: 'beforeAfter' as ViewMode, icon: ArrowLeftRight },
                { label: 'Underground Bins', view: 'underground' as ViewMode, icon: Trash2 },
                { label: 'Zonal Underground', view: 'zonalUnderground' as ViewMode, icon: Trash2 },
                { label: 'Mapping', view: 'mapping' as ViewMode, icon: MapPin },
            ]
        },
        {
            title: 'Analysis',
            section: 'coverage' as AppSection,
            items: [
                { label: 'Coverage Analysis', view: '' as any, icon: BarChart3 } // View not relevant for coverage currently
            ]
        }
    ];

    return (
        <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white flex flex-col z-50 transition-all duration-300 shadow-xl">
            {/* Logo Area */}
            <div className="h-16 flex items-center px-6 border-b border-slate-700/50 bg-slate-900">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-1.5 rounded-lg shadow-lg shadow-blue-500/20">
                        <BarChart3 className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-bold tracking-tight text-slate-100">Reports Buddy</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8">
                {navItems.map((group, idx) => (
                    <div key={idx}>
                        <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                            {group.title}
                        </h3>
                        <div className="space-y-1">
                            {group.items.map((item, itemIdx) => {
                                const isActive =
                                    currentSection === group.section &&
                                    (group.section === 'coverage' || currentView === item.view);

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
                                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative",
                                            isActive
                                                ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                                                : isDisabled
                                                    ? "text-slate-600 cursor-not-allowed"
                                                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                        )}
                                    >
                                        <item.icon className={clsx(
                                            "w-5 h-5 transition-colors",
                                            isActive ? "text-white" : "text-slate-400 group-hover:text-white"
                                        )} />
                                        <span className="flex-1 text-left">{item.label}</span>
                                        {isActive && (
                                            <ChevronRight className="w-4 h-4 opacity-75" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* User / Footer Area */}
            <div className="p-4 border-t border-slate-700/50 bg-slate-900">
                <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold">
                        AD
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium truncate text-slate-200">Admin User</p>
                        <p className="text-xs text-slate-400 truncate">admin@portal.com</p>
                    </div>
                </div>
            </div>
        </aside>
    );
};
