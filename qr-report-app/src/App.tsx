import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import type { AppSection } from './components/Sidebar';
import NagarNigamLogo from './assets/nagar-nigam-logo.png';
import NatureGreenLogo from './assets/NatureGreen_Logo.png';
import { Dashboard } from './components/Dashboard';
import TripReport from './components/TripReport';
import SecondaryVehicleHistory from './components/SecondaryVehicleHistory';
import CdwasteComplaintReport from './components/CdwasteComplaintReport';
import { CoverageReport } from './components/CoverageReport';
import { KYCSurveyChecker } from './components/KYCSurveyChecker';
import { SupervisorCountReport } from './components/SupervisorCountReport';
import QRStatusReport from './components/QRStatusReport';
import { ZonalReport } from './components/ZonalReport';
import { BeforeAfterReport } from './components/BeforeAfterReport';
import { UndergroundReport } from './components/UndergroundReport';
import { ZonalUndergroundReport } from './components/ZonalUndergroundReport';
import DistanceReport from './components/DistanceReport';
import DateWiseCoverageReport from './components/DateWiseCoverageReport';
import { WardWiseReport } from './components/WardWiseReport';
import WardWiseStatusReport from './components/WardWiseStatusReport';
import { WhatsAppReport } from './components/WhatsAppReport';
import { SupervisorZonalMapping } from './components/SupervisorZonalMapping';
import { KYCCalendarView } from './components/KYCCalendarView';
import { KPIChecker } from './components/KPIChecker';
import type { ReportRecord, SummaryStats } from './utils/dataProcessor';
import './App.css';

const App: React.FC = () => {
  const [currentSection, setCurrentSection] = useState<AppSection>('daily');
  const [currentView, setCurrentView] = useState<'dashboard' | 'detailed' | 'zonal' | 'beforeAfter' | 'mapping' | 'underground' | 'zonalUnderground' | 'distance-report' | 'coverage-dashboard' | 'coverage-supervisor' | 'coverage-ward' | 'coverage-all-wards' | 'coverage-mapping' | 'coverage-date-wise' | 'kyc-survey' | 'kyc-calendar' | 'kyc-whatsapp' | 'ward-household-status' | 'ward-status-new' | 'trip-report' | 'qr-status-view' | 'secondary-trip-view' | 'secondary-vehicle-history' | 'cd-waste-complaint' | 'kpi-checker' | 'supervisor-count-report'>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mock stats for dashboard - in a real app, this would come from a data source
  const mockStats: SummaryStats = {
    total: 1250,
    scanned: 980,
    pending: 270,
    unknown: 0,
    scannedPercentage: 78,
    zoneStats: {},
    zonalHeadStats: {},
    wardStats: []
  };

  const mockReportData: ReportRecord[] = [];
  const mockDate = "";

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard stats={mockStats} />;
      case 'detailed':
        return <CoverageReport />;
      case 'zonal':
        return <ZonalReport data={mockReportData} date={mockDate} />;
      case 'beforeAfter':
        return <BeforeAfterReport data={mockReportData} date={mockDate} />;
      case 'mapping':
        return <SupervisorZonalMapping />;
      case 'underground':
        return <UndergroundReport data={mockReportData} />;
      case 'zonalUnderground':
        return <ZonalUndergroundReport data={mockReportData} date={mockDate} />;
      case 'distance-report':
        return <DistanceReport />;
      case 'trip-report':
        return <TripReport />;
      case 'coverage-dashboard':
        return <CoverageReport />;
      case 'coverage-supervisor':
        return <CoverageReport />;
      case 'coverage-ward':
        return <WardWiseReport />;
      case 'coverage-all-wards':
        return <CoverageReport />;
      case 'coverage-mapping':
        return <SupervisorZonalMapping />;
      case 'coverage-date-wise':
        return <DateWiseCoverageReport />;
      case 'kyc-survey':
        return <KYCSurveyChecker />;
      case 'supervisor-count-report':
        return <SupervisorCountReport />;
      case 'kyc-calendar':
        return <KYCCalendarView />;
      case 'kyc-whatsapp':
        return <WhatsAppReport />;
      case 'ward-household-status':
        return <WardWiseStatusReport />;
      case 'ward-status-new':
        return <WardWiseStatusReport />;
      case 'qr-status-view':
        return <QRStatusReport />;
      case 'secondary-trip-view':
        return <TripReport />;
      case 'secondary-vehicle-history':
        return <SecondaryVehicleHistory />;
      case 'cd-waste-complaint':
        return <CdwasteComplaintReport />;
      case 'kpi-checker':
        return <KPIChecker />;
      default:
        return <Dashboard stats={mockStats} />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <Sidebar
        currentSection={currentSection}
        onSectionChange={setCurrentSection}
        currentView={currentView}
        onViewChange={setCurrentView as any}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with hamburger menu */}
        <header className="bg-white shadow-sm z-10 flex items-center justify-between p-4 border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-md hover:bg-gray-100 transition-colors"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          {/* Header Logos */}
          <div className="flex items-center gap-4 flex-1 justify-center md:justify-start">
            <img src={NagarNigamLogo} alt="NN" className="h-10 w-auto object-contain" />
            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                {currentView.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </h1>
              <span className="text-xs text-gray-500 font-medium">Mathura-Vrindavan Nagar Nigam</span>
            </div>
          </div>

          <div className="w-10">
            <img src={NatureGreenLogo} alt="NG" className="h-10 w-auto object-contain hidden md:block" />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 bg-gray-100">
          {renderCurrentView()}
        </main>
      </div>
    </div >
  );
};

export default App;