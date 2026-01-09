import React from 'react';
import {
    FileSpreadsheet,
    Map,
    X,
    ClipboardCheck,
    Users
} from 'lucide-react';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';

export type AppSection = 'daily' | 'coverage' | 'kyc' | 'qr-status';

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
    | 'coverage-mapping' // Added back
    | 'coverage-date-wise'
    | 'kyc-survey'
    | 'kyc-calendar'
    | 'kyc-whatsapp'
    | 'ward-household-status' // Added back
    | 'ward-status-new' // Added new view
    | 'qr-status-view';

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
            <div className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:transform-none ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
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
                        {/* Daily Reports Section */}
                        <div>
                            <div
                                onClick={() => onSectionChange('daily')}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer mb-2 transition-colors ${currentSection === 'daily' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <FileSpreadsheet className="w-5 h-5" />
                                <span className="font-semibold">Daily Reports</span>
                            </div>

                            {currentSection === 'daily' && (
                                <div className="ml-4 space-y-1 border-l-2 border-blue-100 pl-3">
                                    <button
                                        onClick={() => onViewChange('dashboard')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'dashboard' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Summary Dashboard
                                    </button>
                                    <button
                                        onClick={() => onViewChange('detailed')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'detailed' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Detailed View
                                    </button>
                                    <button
                                        onClick={() => onViewChange('zonal')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'zonal' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Zonal Report
                                    </button>
                                    <button
                                        onClick={() => onViewChange('beforeAfter')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'beforeAfter' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Before/After Report
                                    </button>
                                    <button
                                        onClick={() => onViewChange('mapping')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'mapping' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Supervisor Mapping
                                    </button>
                                    <button
                                        onClick={() => onViewChange('underground')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'underground' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Underground Bins
                                    </button>
                                    <button
                                        onClick={() => onViewChange('zonalUnderground')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'zonalUnderground' ? 'bg-white text-blue-600 shadow-sm border border-blue-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Zonal Underground
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* POI Coverage Section */}
                        <div>
                            <div
                                onClick={() => onSectionChange('coverage')}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer mb-2 transition-colors ${currentSection === 'coverage' ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <Map className="w-5 h-5" />
                                <span className="font-semibold">POI Coverage</span>
                            </div>

                            {currentSection === 'coverage' && (
                                <div className="ml-4 space-y-1 border-l-2 border-purple-100 pl-3">
                                    <button
                                        onClick={() => onViewChange('coverage-dashboard')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'coverage-dashboard' ? 'bg-white text-purple-600 shadow-sm border border-purple-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Coverage Dashboard
                                    </button>
                                    <button
                                        onClick={() => onViewChange('coverage-supervisor')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'coverage-supervisor' ? 'bg-white text-purple-600 shadow-sm border border-purple-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Supervisor Report
                                    </button>
                                    <button
                                        onClick={() => onViewChange('coverage-ward')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'coverage-ward' ? 'bg-white text-purple-600 shadow-sm border border-purple-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Ward Wise Report
                                    </button>
                                    <button
                                        onClick={() => onViewChange('coverage-date-wise')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'coverage-date-wise' ? 'bg-white text-purple-600 shadow-sm border border-purple-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Date Wise Coverage
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* QR Status Report Section */}
                        <div>
                            <div
                                onClick={() => {
                                    onSectionChange('qr-status');
                                    onViewChange('qr-status-view');
                                }}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer mb-2 transition-colors ${currentSection === 'qr-status' ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <ClipboardCheck className="w-5 h-5" />
                                <span className="font-semibold">QR Status Report</span>
                            </div>
                        </div>

                        {/* KYC Section */}
                        <div>
                            <div
                                onClick={() => onSectionChange('kyc')}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer mb-2 transition-colors ${currentSection === 'kyc' ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <Users className="w-5 h-5" />
                                <span className="font-semibold">KYC Reports</span>
                            </div>
                            {currentSection === 'kyc' && (
                                <div className="ml-4 space-y-1 border-l-2 border-orange-100 pl-3">
                                    <button
                                        onClick={() => onViewChange('kyc-survey')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'kyc-survey' ? 'bg-white text-orange-600 shadow-sm border border-orange-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        KYC Survey
                                    </button>
                                    <button
                                        onClick={() => onViewChange('kyc-calendar')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'kyc-calendar' ? 'bg-white text-orange-600 shadow-sm border border-orange-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        KYC Calendar
                                    </button>
                                    <button
                                        onClick={() => onViewChange('ward-status-new')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'ward-status-new' ? 'bg-white text-orange-600 shadow-sm border border-orange-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        Ward Wise Status (New)
                                    </button>
                                    <button
                                        onClick={() => onViewChange('kyc-whatsapp')}
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${currentView === 'kyc-whatsapp' ? 'bg-white text-orange-600 shadow-sm border border-orange-100' : 'text-gray-500 hover:text-gray-900'}`}
                                    >
                                        WhatsApp Reports
                                    </button>
                                </div>
                            )}
                        </div>
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
