import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import type { AppSection, ViewMode } from './components/Sidebar';
import NagarNigamLogo from './assets/nagar-nigam-logo.png';
import NatureGreenLogo from './assets/NatureGreen_Logo.png';
import { Dashboard } from './components/Dashboard';
import CdwasteComplaintReport from './components/CdwasteComplaintReport';
import { KYCSurveyChecker } from './components/KYCSurveyChecker';
import { SupervisorCountReport } from './components/SupervisorCountReport';
import { ZonalReport } from './components/ZonalReport';
import { DetailedZonalQRReport } from './components/DetailedZonalQRReport';
import { ZonalTabularReport } from './components/ZonalTabularReport';
import { DetailedQRTable } from './components/DetailedQRTable';
import WardWiseStatusReport from './components/WardWiseStatusReport';
import { WhatsAppReport } from './components/WhatsAppReport';
import { KYCCalendarView } from './components/KYCCalendarView';
import { KPIChecker } from './components/KPIChecker';
import { UCCReport } from './components/UCCReport';
import './App.css';
import { LoadingScreen } from './components/LoadingScreen';
import { DailyKycStatusReport } from './components/DailyKycStatusReport';
import { WardKYCCrossCheck } from './components/WardKYCCrossCheck';
import NewKycTeamReport from './components/NewKycTeamReport';
import ComplaintRegisterReport from './components/ComplaintRegisterReport';
import MSWDateWiseReport from './components/MSWDateWiseReport';
import MonthWiseKPICalendar from './components/MonthWiseKPICalendar';
import DoorToDoorReport from './components/DoorToDoorReport';
import { AdminPanel } from './components/AdminPanel';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import { LogOut, ShieldCheck } from 'lucide-react';
import { processData } from './utils/dataProcessor';
import masterData from './data/masterData.json';
import supervisorData from './data/supervisorData.json';
import { db } from './firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import type { WardAssignment, SummaryStats, ReportRecord } from './utils/dataProcessor';
import { formatDisplayDate } from './utils/dataProcessor';

const App: React.FC = () => {
  const { currentUser, isLoading: authLoading, logout, isAdmin } = useAuth();
  
  const [currentSection, setCurrentSection] = useState<AppSection>(() => {
    return (localStorage.getItem('currentSection') as AppSection) || 'daily';
  });
  const [currentView, setCurrentView] = useState<ViewMode>(() => {
    return (localStorage.getItem('currentView') as ViewMode) || 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingView, setPendingView] = useState<string | null>(null);

  const [reportData, setReportData] = useState<ReportRecord[]>(() => {
    const { report } = processData(masterData, supervisorData, [], 'All', {});
    return report;
  });
  const [reportStats, setReportStats] = useState<SummaryStats>(() => {
    const { stats } = processData(masterData, supervisorData, [], 'All', {});
    return stats;
  });
  const [reportDate, setReportDate] = useState<string>(formatDisplayDate(new Date()));
  const [wardAssignments, setWardAssignments] = useState<Record<string, WardAssignment>>({});
  const [masterQRPoints, setMasterQRPoints] = useState<any[]>([]);
  const [scannedData, setScannedData] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('All');

  // Persist routing state across refreshes
  React.useEffect(() => {
    localStorage.setItem('currentSection', currentSection);
  }, [currentSection]);

  React.useEffect(() => {
    localStorage.setItem('currentView', currentView);
  }, [currentView]);

  // Fetch Ward Assignments from Firestore
  React.useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(collection(db, 'ward_assignments'), (snapshot) => {
      const mapping: Record<string, WardAssignment> = {};
      snapshot.forEach((doc) => {
        mapping[doc.id] = doc.data() as WardAssignment;
      });
      setWardAssignments(mapping);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Fetch Master QR Points from Firestore
  React.useEffect(() => {
    if (!currentUser) return;
    const unsubscribe = onSnapshot(collection(db, 'qr_master'), (snapshot) => {
      const points = snapshot.docs.map(doc => doc.data());
      setMasterQRPoints(points);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Update report when master data, scan data, or ward assignments change
  React.useEffect(() => {
    // If we have Firestore master points, use them. Otherwise fallback to JSON.
    const masterSource = masterQRPoints.length > 0 ? masterQRPoints : masterData;
    const { report, stats } = processData(masterSource, supervisorData, scannedData, selectedZone, wardAssignments);
    setReportData(report);
    setReportStats(stats);
  }, [masterQRPoints, scannedData, wardAssignments, selectedZone]);

  // Enforce RBAC constraints on currentView
  React.useEffect(() => {
    if (!currentUser || isAdmin) return;
    
    const allowed = currentUser.allowedViews;
    
    // Legacy fallback: if allowedViews is undefined, allow all
    if (!allowed) return;
    
    if (allowed.length === 0) {
       // If no views allowed, maybe we should set to a special no-access view, but for now we let it render nothing or a restricted dashboard.
       if (currentView !== 'no-access') {
           setCurrentView('no-access');
       }
       return;
    }
    
    // If current view is not allowed, redirect to the first allowed view
    if (currentView !== 'no-access' && !allowed.includes(currentView)) {
        setCurrentView(allowed[0] as ViewMode);
    }
  }, [currentUser, currentView, isAdmin]);

  // Auth guard MUST be after state definitions to prevent flashes or errors
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#ffffff',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', margin: '0 auto 20px',
            border: '3px solid rgba(0,0,0,0.06)', borderTopColor: '#10b981',
            animation: 'spin 1s cubic-bezier(0.5, 0.1, 0.4, 0.9) infinite'
          }} />
          <p style={{ color: '#475569', fontSize: '13px', fontWeight: 600, margin: 0, letterSpacing: '0.05em' }}>VERIFYING SYSTEM ACCESS...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  if (currentUser.status === 'disabled') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
          <ShieldCheck size={64} className="text-rose-400 mb-4" />
          <h2 className="text-2xl font-bold text-slate-800">Account Disabled</h2>
          <p className="text-slate-500 mt-2">Your access to the portal has been suspended.</p>
          <button 
              onClick={() => logout()}
              className="mt-6 px-6 py-2.5 bg-white border-2 border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-colors"
          >
              Sign Out
          </button>
      </div>
    );
  }

  console.log('App: Current User:', currentUser?.email, 'isAdmin:', isAdmin);




  const handleGlobalUpload = (newData: any[], date: string) => {
    setScannedData(newData);
    if (date) setReportDate(formatDisplayDate(date));
  };

  const handleViewChange = (newView: any) => {
    setPendingView(newView);
    setIsLoading(true);
    setTimeout(() => {
      setCurrentView(newView);
      setPendingView(null);
      setIsLoading(false);
    }, 1500);
  };

  const renderCurrentView = () => {
    if (currentView === 'no-access') {
      return (
          <div className="flex flex-col items-center justify-center h-[70vh]">
              <ShieldCheck size={64} className="text-slate-300 mb-4" />
              <h2 className="text-2xl font-bold text-slate-700">Access Restricted</h2>
              <p className="text-slate-500 mt-2">You don't have permission to view any modules. Please contact an administrator.</p>
          </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <Dashboard stats={reportStats} onUpload={handleGlobalUpload} />;
      case 'zonal':
        return <ZonalReport data={reportData} date={reportDate} onUpload={handleGlobalUpload} wardAssignments={wardAssignments} />;
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
      case 'cd-waste-complaint':
        return <CdwasteComplaintReport />;
      case 'kpi-checker':
        return <KPIChecker />;
      case 'kpi-monthly-calendar':
        return <MonthWiseKPICalendar />;
      case 'ucc-report':
        return <UCCReport />;
      case 'daily-kyc-status':
        return <DailyKycStatusReport />;
      case 'ward-kyc-cross-check':
        return <WardKYCCrossCheck />;
      case 'new-kyc-team-report':
        return <NewKycTeamReport />;
      case 'complaint-register':
        return <ComplaintRegisterReport />;
      case 'msw-date-wise':
        return <MSWDateWiseReport />;
      case 'door-to-door-report':
        return <DoorToDoorReport />;
      case 'detailed-zonal-qr':
        return <DetailedZonalQRReport data={reportData} date={reportDate} onUpload={handleGlobalUpload} wardAssignments={wardAssignments} />;
      case 'zonal-tabular-report':
        return <ZonalTabularReport data={reportData} date={reportDate} onUpload={handleGlobalUpload} wardAssignments={wardAssignments} />;
      case 'detailed-qr-list':
        return <DetailedQRTable data={reportData} date={reportDate} wardAssignments={wardAssignments} />;
      case 'admin-panel':
      case 'admin-ward-mapping':
      case 'admin-qr-master':
      case 'admin-ucc-mapping':
      case 'admin-user-management':
      case 'admin-data-seeding':
        return <AdminPanel initialTab={currentView} />;
      default:
        return <Dashboard stats={reportStats} onUpload={handleGlobalUpload} />;
    }
  };

  const sectionLabel = (() => {
    const allItems = [
      { id: 'dashboard', label: 'Summary Dashboard' },
      { id: 'zonal', label: 'Zonal QR Report' },
      { id: 'detailed-zonal-qr', label: 'Detailed Zonal Analytics' },
      { id: 'zonal-tabular-report', label: 'Zonal Tabular Analysis' },
      { id: 'detailed-qr-list', label: 'Detailed QR Audit' },
      { id: 'mapping', label: 'Supervisor Mapping' },
      { id: 'trip-report', label: 'Trip Report' },
      { id: 'supervisor-daily-report', label: 'Supervisor Daily Analysis' },
      { id: 'kpi-checker', label: 'KPI Compliance' },
      { id: 'kpi-monthly-calendar', label: 'Monthly KPI Calendar' },
      { id: 'msw-date-wise', label: 'Date Wise MSW Data' },
      { id: 'admin-panel', label: 'Admin Panel' },
    ];

    return allItems.find(i => i.id === currentView)?.label
      ?? currentView.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  })();

  return (
    <div className="portal-root">
      {isLoading && (
        <LoadingScreen
          title={(pendingView || currentView).split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
        />
      )}

      <Sidebar
        currentSection={currentSection}
        onSectionChange={setCurrentSection}
        currentView={currentView}
        onViewChange={handleViewChange}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAdmin={isAdmin}
      />


      <div className="portal-main">
        {/* Floating Glassmorphic Header */}
        <header className="portal-header">
          <div className="header-left">
            <button
              className="header-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>
            <div className="header-divider" />
            <div className="header-branding">
              <img src={NagarNigamLogo} alt="Nagar Nigam" className="header-logo" />
              <div className="header-title-block">
                <h1 className="header-title">{sectionLabel}</h1>
                <span className="header-subtitle">Mathura-Vrindavan Nagar Nigam</span>
              </div>
            </div>
          </div>

          <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Global Zone Filter */}
            <div className="flex bg-slate-100/80 backdrop-blur-md p-1 rounded-xl border border-slate-200">
              {(['All', 'Mathura', 'Vrindavan'] as const).map(z => (
                <button
                  key={z}
                  onClick={() => setSelectedZone(z)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                    selectedZone === z 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {z}
                </button>
              ))}
            </div>
            {/* User info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 800, color: '#ffffff', flexShrink: 0,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
              }}>
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden md:block">


                <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                  {currentUser.name}
                </div>
                <div style={{ fontSize: '10px', color: isAdmin ? '#10b981' : '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '1px' }}>
                  {isAdmin ? '◆ Admin' : 'Viewer'}
                </div>
              </div>
            </div>

            <div style={{ width: '1px', height: '24px', background: 'rgba(0,0,0,0.08)' }} />

            <img src={NatureGreenLogo} alt="Nature Green" className="header-right-logo" />

            {/* Logout */}
            <button
              onClick={logout}
              title="Sign out"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 12px', borderRadius: '9px', border: '1.5px solid #e2e8f0',
                background: 'transparent', color: '#64748b', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'Inter, sans-serif'
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.background = '#fef2f2';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#fca5a5';
                (e.currentTarget as HTMLButtonElement).style.color = '#dc2626';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                (e.currentTarget as HTMLButtonElement).style.borderColor = '#e2e8f0';
                (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
              }}
            >
              <LogOut size={14} />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="portal-content">
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
};

export default App;