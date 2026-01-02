import { useState, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { ReportTable } from './components/ReportTable';
import { ZonalReport } from './components/ZonalReport';
import { BeforeAfterReport } from './components/BeforeAfterReport';
import { SupervisorZonalMapping } from './components/SupervisorZonalMapping';
import { UndergroundReport } from './components/UndergroundReport';
import { ZonalUndergroundReport } from './components/ZonalUndergroundReport';
import { CoverageReport } from './components/CoverageReport';
import { KYCSurveyChecker } from './components/KYCSurveyChecker';
import { KYCCalendarView } from './components/KYCCalendarView';
import { WhatsAppReport } from './components/WhatsAppReport';
import { WardWiseReport } from './components/WardWiseReport';
import { Sidebar, type AppSection, type ViewMode } from './components/Sidebar';
import { parseFile, processData, type ReportRecord, type SummaryStats } from './utils/dataProcessor';
import { Loader2, RefreshCw, Calendar, Menu } from 'lucide-react';
import { clsx } from 'clsx';
import masterDataJson from './data/masterData.json';
import supervisorDataJson from './data/supervisorData.json';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'admin' || passwordInput === 'ng123' || passwordInput === '1234') {
      setIsAuthenticated(true);
      setLoginError('');
    } else {
      setLoginError('Incorrect password');
    }
  };

  const [appSection, setAppSection] = useState<AppSection>('daily');

  // Daily Report State
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const [reportData, setReportData] = useState<ReportRecord[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('All');
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Keep track of raw scanned data to re-filter without re-parsing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rawScannedData, setRawScannedData] = useState<any[] | null>(null);

  const handleProcess = async () => {
    if (!scannedFile) return;

    setLoading(true);
    setError(null);

    try {
      const [scannedData] = await Promise.all([
        parseFile(scannedFile),
      ]);

      setRawScannedData(scannedData);

      // Use embedded data
      const masterData = masterDataJson;
      const supervisorData = supervisorDataJson;

      // Initial process to get dates and default report (All dates)
      const { report, stats, availableDates } = processData(masterData, supervisorData, scannedData, 'All');

      setAvailableDates(['All', ...availableDates]);

      // Default to Today's date if available
      const today = new Date();
      const day = String(today.getDate()).padStart(2, '0');
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const year = today.getFullYear();
      const todayStr = `${day}/${month}/${year}`;

      if (availableDates.includes(todayStr)) {
        setSelectedDate(todayStr);
      } else {
        setSelectedDate('All');
      }

      setReportData(report);
      setStats(stats);
      setViewMode('dashboard');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error(err);
      setError('Error processing files. Please check the file formats.');
    } finally {
      setLoading(false);
    }
  };

  // Re-process when date changes
  useEffect(() => {
    if (rawScannedData && stats) { // Only if we have data processed at least once
      const masterData = masterDataJson;
      const supervisorData = supervisorDataJson;
      const { report, stats: newStats } = processData(masterData, supervisorData, rawScannedData, selectedDate);
      setReportData(report);
      setStats(newStats);
    }
  }, [selectedDate, rawScannedData]);

  const handleReset = () => {
    setScannedFile(null);
    setReportData([]);
    setStats(null);
    setRawScannedData(null);
    setAvailableDates([]);
    setSelectedDate('All');
    setError(null);
    setViewMode('dashboard');
  };

  const currentTitle =
    viewMode === 'dashboard' ? 'Quick Dashboard' :
      viewMode === 'detailed' ? 'Detailed Daily Report' :
        viewMode === 'zonal' ? 'Zonal Daily Summary' :
          viewMode === 'beforeAfter' ? 'Photo Evidence Report' :
            viewMode === 'mapping' ? 'Daily Supervisor Mapping' :
              viewMode === 'underground' ? 'Underground Dustbin Status' :
                viewMode === 'zonalUnderground' ? 'Zonal Dustbin Summary' :
                  viewMode === 'coverage-dashboard' ? 'POI Coverage Dashboard' :
                    viewMode === 'coverage-supervisor' ? 'Supervisor POI Analysis' :
                      viewMode === 'coverage-ward' ? 'Ward POI Analysis' :
                        viewMode === 'coverage-all-wards' ? 'All Wards POI Summary' :
                          viewMode === 'coverage-mapping' ? 'POI Mapping' :
                            viewMode === 'kyc-calendar' ? 'Daily KYC Calendar' :
                              viewMode === 'ward-household-status' ? 'Ward Household Status' : 'Reports Buddy';

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Menu className="w-8 h-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h2>
          <p className="text-gray-500 mb-8">Please enter the password to access the reports.</p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                placeholder="Enter password..."
                autoFocus
              />
            </div>

            {loginError && (
              <p className="text-sm text-red-600 font-medium bg-red-50 p-2 rounded">{loginError}</p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-md active:scale-95"
            >
              Access Dashboard
            </button>
          </form>
          <p className="mt-6 text-xs text-gray-400">
            Protected System • Nature Green
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900 overflow-hidden">

      <Sidebar
        currentSection={appSection}
        currentView={viewMode}
        onNavigate={(sec, view) => {
          setAppSection(sec);
          if (view) setViewMode(view);
        }}
        statsAvailable={!!stats}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className={clsx(
        "flex-1 flex flex-col h-screen relative transition-all duration-300",
        sidebarOpen ? "lg:ml-64" : "ml-0"
      )}>
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-xl font-bold text-gray-800 tracking-tight">
              {currentTitle}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {appSection === 'daily' && stats && (
              <>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1.5 border border-gray-200">
                  <div className="px-2 text-gray-500">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer py-0.5 pr-8 outline-none"
                  >
                    {availableDates.map(date => (
                      <option key={date} value={date}>{date === 'All' ? 'All Dates' : date}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </button>
              </>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto animate-in fade-in duration-500">

            {appSection === 'coverage' ? (
              <CoverageReport initialMode={
                viewMode === 'coverage-supervisor' ? 'supervisor' :
                  viewMode === 'coverage-ward' ? 'ward' :
                    viewMode === 'coverage-all-wards' ? 'all-wards' :
                      viewMode === 'coverage-mapping' ? 'mapping' : 'dashboard'
              } />
            ) : appSection === 'kyc' ? (
              viewMode === 'kyc-calendar' ? <KYCCalendarView /> :
                viewMode === 'whatsapp-report' ? <WhatsAppReport /> :
                  viewMode === 'ward-household-status' ? <WardWiseReport /> : <KYCSurveyChecker />
            ) : (
              <>
                {/* Daily Report Logic */}
                {!stats && viewMode !== 'mapping' ? (
                  /* Upload Screen */
                  <div className="max-w-2xl mx-auto mt-10">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
                      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Menu className="w-8 h-8 text-blue-600" />
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900 mb-2">Initialize Daily Report</h2>
                      <p className="text-gray-500 mb-8 max-w-md mx-auto">
                        Upload the Bulk Collection Scan CSV file to generate the interactive dashboard and detailed reports.
                      </p>

                      <div className="space-y-6 text-left">
                        <FileUpload
                          label="Scanned Data (BulkCollectionScan.csv)"
                          file={scannedFile}
                          onFileSelect={setScannedFile}
                          required
                        />
                      </div>

                      {error && (
                        <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2 text-left">
                          <span className="font-bold">Error:</span> {error}
                        </div>
                      )}

                      <div className="mt-8">
                        <button
                          onClick={handleProcess}
                          disabled={!scannedFile || loading}
                          className={clsx(
                            "w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium text-white transition-all shadow-sm",
                            !scannedFile || loading
                              ? "bg-gray-300 cursor-not-allowed"
                              : "bg-blue-600 hover:bg-blue-700 hover:shadow-md active:transform active:scale-95"
                          )}
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Processing Data...
                            </>
                          ) : (
                            <>
                              Generate Dashboard
                            </>
                          )}
                        </button>
                      </div>
                      <p className="mt-4 text-xs text-gray-400">
                        Checking Master Data & Supervisor Mapping automatically.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Views */
                  <>
                    {viewMode === 'dashboard' && stats && <Dashboard stats={stats} />}

                    {viewMode === 'detailed' && <ReportTable data={reportData} />}

                    {viewMode === 'zonal' && <ZonalReport data={reportData} date={selectedDate === 'All' ? 'All Dates' : selectedDate} />}

                    {viewMode === 'beforeAfter' && <BeforeAfterReport data={reportData} date={selectedDate === 'All' ? 'All Dates' : selectedDate} />}

                    {viewMode === 'mapping' && <SupervisorZonalMapping />}

                    {viewMode === 'underground' && <UndergroundReport data={reportData} />}

                    {viewMode === 'zonalUnderground' && <ZonalUndergroundReport data={reportData} date={selectedDate === 'All' ? 'All Dates' : selectedDate} />}
                  </>
                )}
              </>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
