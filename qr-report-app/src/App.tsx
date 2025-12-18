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
import { parseFile, processData, type ReportRecord, type SummaryStats } from './utils/dataProcessor';
import { FileDown, Loader2, RefreshCw, Calendar, BarChart3, LayoutDashboard } from 'lucide-react';
import { clsx } from 'clsx';
import masterDataJson from './data/masterData.json';
import supervisorDataJson from './data/supervisorData.json';

function App() {
  const [appSection, setAppSection] = useState<'daily' | 'coverage'>('daily');

  // Daily Report State
  const [scannedFile, setScannedFile] = useState<File | null>(null);
  const [reportData, setReportData] = useState<ReportRecord[]>([]);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'detailed' | 'zonal' | 'beforeAfter' | 'mapping' | 'underground' | 'zonalUnderground'>('detailed');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg">
                <FileDown className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">QR Report Generator</h1>
            </div>

            {/* Main Navigation */}
            <div className="hidden md:flex bg-gray-100 rounded-lg p-1 ml-6">
              <button
                onClick={() => setAppSection('daily')}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  appSection === 'daily'
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <LayoutDashboard className="w-4 h-4" />
                Daily Summary
              </button>
              <button
                onClick={() => setAppSection('coverage')}
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                  appSection === 'coverage'
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <BarChart3 className="w-4 h-4" />
                Coverage Analysis
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {appSection === 'daily' && stats && (
              <>
                <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                  <div className="px-2 text-gray-500">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer py-1 pr-8"
                  >
                    {availableDates.map(date => (
                      <option key={date} value={date}>{date === 'All' ? 'All Dates' : date}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {appSection === 'coverage' ? (
          <CoverageReport />
        ) : (
          /* Daily Report Content */
          !stats ? (
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Data Files</h2>
                <p className="text-gray-500 mb-8">
                  Upload the Scanned Data to generate the report.
                  <br />
                  <span className="text-sm text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded mt-2 inline-block">
                    Note: Master QR List and Supervisor Mapping are pre-loaded.
                  </span>
                </p>

                <div className="space-y-6">
                  <FileUpload
                    label="1. Scanned Data (BulkCollectionScan.csv)"
                    file={scannedFile}
                    onFileSelect={setScannedFile}
                    required
                  />
                </div>

                {error && (
                  <div className="mt-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                    <span className="font-bold">Error:</span> {error}
                  </div>
                )}

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleProcess}
                    disabled={!scannedFile || loading}
                    className={clsx(
                      "flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white transition-all shadow-sm",
                      !scannedFile || loading
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 hover:shadow-md active:transform active:scale-95"
                    )}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        Generate Report
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-fade-in">
              <Dashboard stats={stats} />

              <div className="flex justify-center mb-6">
                <div className="bg-gray-100 p-1 rounded-lg inline-flex flex-wrap justify-center gap-1">
                  <button
                    onClick={() => setViewMode('detailed')}
                    className={clsx(
                      "px-4 py-2 rounded-md text-sm font-medium transition-all",
                      viewMode === 'detailed' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Detailed Report
                  </button>
                  <button
                    onClick={() => setViewMode('zonal')}
                    className={clsx(
                      "px-4 py-2 rounded-md text-sm font-medium transition-all",
                      viewMode === 'zonal' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Zonal Summary
                  </button>
                  <button
                    onClick={() => setViewMode('beforeAfter')}
                    className={clsx(
                      "px-4 py-2 rounded-md text-sm font-medium transition-all",
                      viewMode === 'beforeAfter' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Before/After Report
                  </button>
                  <button
                    onClick={() => setViewMode('mapping')}
                    className={clsx(
                      "px-4 py-2 rounded-md text-sm font-medium transition-all",
                      viewMode === 'mapping' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Mapping
                  </button>
                  <button
                    onClick={() => setViewMode('underground')}
                    className={clsx(
                      "px-4 py-2 rounded-md text-sm font-medium transition-all",
                      viewMode === 'underground' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Underground Dustbin
                  </button>
                  <button
                    onClick={() => setViewMode('zonalUnderground')}
                    className={clsx(
                      "px-4 py-2 rounded-md text-sm font-medium transition-all",
                      viewMode === 'zonalUnderground' ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Zonal Underground
                  </button>
                </div>
              </div>

              {viewMode === 'detailed' ? (
                <ReportTable data={reportData} />
              ) : viewMode === 'zonal' ? (
                <ZonalReport data={reportData} date={selectedDate === 'All' ? 'All Dates' : selectedDate} />
              ) : viewMode === 'beforeAfter' ? (
                <BeforeAfterReport data={reportData} date={selectedDate === 'All' ? 'All Dates' : selectedDate} />
              ) : viewMode === 'mapping' ? (
                <SupervisorZonalMapping />
              ) : viewMode === 'underground' ? (
                <UndergroundReport data={reportData} />
              ) : (
                <ZonalUndergroundReport data={reportData} date={selectedDate === 'All' ? 'All Dates' : selectedDate} />
              )}
            </div>
          )
        )}
      </main>
    </div>
  );
}

export default App;
