import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  FileText, 
  Download, 
  Upload, 
  Search, 
  Filter, 
  LayoutGrid,
  FileSpreadsheet,
  Users, 
  MapPin, 
  CheckCircle2, 
  ArrowUpRight
} from 'lucide-react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import supervisorDataFallback from '../data/supervisorData.json';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useRef } from 'react';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';
import { 
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

interface RawCSVRow {
  'S.No': string;
  'Zone & Circle': string;
  'Ward Name': string;
  'Vehicle Number': string;
  'Vehicle Type': string;
  'Route Name': string;
  'Total': string;
  'Covered': string;
  'Not Covered': string;
  'Coverage': string;
  'Date': string;
  'Route In Time': string;
  'Route Out Time': string;
  'Route Time': string;
}

interface ProcessedRow extends RawCSVRow {
  supervisor: string;
  zonalHead: string;
}

const DoorToDoorReport: React.FC = () => {
  const [data, setData] = useState<ProcessedRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'detailed' | 'supervisor'>('detailed');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZonal, setSelectedZonal] = useState('All');
  const [selectedSupervisor, setSelectedSupervisor] = useState('All');
  const [selectedWard, setSelectedWard] = useState('All');
  const [rawCsvContent, setRawCsvContent] = useState<string>('');
  const [mappings, setMappings] = useState<any[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  // Sync with Firestore Master Ward Assignments
  useEffect(() => {
    const q = query(collection(db, 'ward_assignments'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMappings(firestoreData);
    });
    return unsubscribe;
  }, []);

  // Re-process data when mappings or CSV content changes
  useEffect(() => {
    if (rawCsvContent && mappings.length > 0) {
      processAndSetData(rawCsvContent, mappings);
    }
  }, [rawCsvContent, mappings]);


  const processAndSetData = (csvContent: string, currentMappings: any[] = []) => {
    setRawCsvContent(csvContent);
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const processed = (results.data as RawCSVRow[]).map(row => {
          // Extract ward number and name (e.g., "01-Birjapur" -> 1 and "Birjapur")
          const wardParts = row['Ward Name']?.split('-');
          const wardNumPrefix = wardParts && wardParts.length > 0 ? parseInt(wardParts[0].trim()) : NaN;
          const cleanWardName = wardParts && wardParts.length > 1 ? wardParts[1].trim().toLowerCase() : row['Ward Name']?.toLowerCase().trim();
          
          // Find mapping from Firestore first
          let mapping = currentMappings.find(m => 
            m.wardNumber === wardNumPrefix ||
            m.area?.toLowerCase().trim() === cleanWardName ||
            (m.area && cleanWardName && (m.area.toLowerCase().includes(cleanWardName) || cleanWardName.includes(m.area.toLowerCase())))
          );

          // If not found in current mappings and no Firestore data yet, check fallback
          if (!mapping && currentMappings.length === 0) {
            mapping = supervisorDataFallback.find(s => 
              s['Ward Name'].toLowerCase() === cleanWardName?.toLowerCase()
            );
          }

          let supervisor = mapping ? (mapping.supervisorName || mapping.Supervisor || 'Unknown') : 'Unknown';
          let zonalHead = mapping ? (mapping.zonalName || mapping['Zonal Head'] || 'Unknown') : 'Unknown';

          // Only keep C&T supervisors if there are multiple
          if (supervisor !== 'Unknown' && supervisor.includes(',')) {
            const parts = supervisor.split(',').map((s: string) => s.trim());
            const ctParts = parts.filter((p: string) => p.toLowerCase().includes('(c&t)'));
            supervisor = ctParts.length > 0 ? ctParts.join(', ') : 'Unknown';
          }

          return {
            ...row,
            supervisor,
            zonalHead
          };
        })
        .filter(row => row.supervisor.toLowerCase().includes('(c&t)'))
        .filter(row => {
          // Exclude specific zonal heads
          const excludedZonals = ['suresh', 'alok', 'pankaj'];
          return !excludedZonals.some(name => row.zonalHead.toLowerCase().includes(name));
        });
        setData(processed);
        setLoading(false);
      },
      error: (error: any) => {
        console.error('Error parsing CSV:', error);
        setLoading(false);
      }
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      processAndSetData(text);
    };
    reader.readAsText(file);
  };

  const zonals = useMemo(() => {
    const unique = new Set(data.map(d => d.zonalHead));
    return ['All', ...Array.from(unique)].filter(z => z !== 'Unknown');
  }, [data]);

  const supervisors = useMemo(() => {
    let filtered = data;
    if (selectedZonal !== 'All') {
      filtered = data.filter(d => d.zonalHead === selectedZonal);
    }
    const unique = new Set(filtered.map(d => d.supervisor));
    return ['All', ...Array.from(unique)].filter(s => s !== 'Unknown');
  }, [data, selectedZonal]);

  const wards = useMemo(() => {
    let filtered = data;
    if (selectedZonal !== 'All') filtered = filtered.filter(d => d.zonalHead === selectedZonal);
    if (selectedSupervisor !== 'All') filtered = filtered.filter(d => d.supervisor === selectedSupervisor);
    const unique = new Set(filtered.map(d => d['Ward Name']));
    return ['All', ...Array.from(unique)].sort();
  }, [data, selectedZonal, selectedSupervisor]);

  const filteredData = useMemo(() => {
    return data.filter(row => {
      const matchesSearch = 
        row['Ward Name']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row['Vehicle Number']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        row['Route Name']?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesZonal = selectedZonal === 'All' || row.zonalHead === selectedZonal;
      const matchesSupervisor = selectedSupervisor === 'All' || row.supervisor === selectedSupervisor;
      const matchesWard = selectedWard === 'All' || row['Ward Name'] === selectedWard;

      return matchesSearch && matchesZonal && matchesSupervisor && matchesWard;
    });
  }, [data, searchTerm, selectedZonal, selectedSupervisor, selectedWard]);

  const stats = useMemo(() => {
    const totalRoutes = filteredData.length;
    const avgCoverage = filteredData.reduce((acc, curr) => acc + (parseFloat(curr.Coverage) || 0), 0) / (totalRoutes || 1);
    const totalTotal = filteredData.reduce((acc, curr) => acc + (parseInt(curr.Total) || 0), 0);
    const totalCovered = filteredData.reduce((acc, curr) => acc + (parseInt(curr.Covered) || 0), 0);
    
    return {
      totalRoutes,
      avgCoverage: avgCoverage.toFixed(1),
      totalTotal,
      totalCovered,
      efficiency: ((totalCovered / (totalTotal || 1)) * 100).toFixed(1)
    };
  }, [filteredData]);

  const supervisorSummary = useMemo(() => {
    const groups: Record<string, {
      supervisor: string;
      zonalHead: string;
      routes: number;
      total: number;
      covered: number;
    }> = {};

    filteredData.forEach(row => {
      const key = row.supervisor;
      if (!groups[key]) {
        groups[key] = {
          supervisor: row.supervisor,
          zonalHead: row.zonalHead,
          routes: 0,
          total: 0,
          covered: 0
        };
      }
      groups[key].routes += 1;
      groups[key].total += parseInt(row.Total) || 0;
      groups[key].covered += parseInt(row.Covered) || 0;
    });

    return Object.values(groups).sort((a, b) => b.covered / (b.total || 1) - a.covered / (a.total || 1));
  }, [filteredData]);

  const zonalStats = useMemo(() => {
    const groups: Record<string, { zonal: string; covered: number; total: number }> = {};
    filteredData.forEach(row => {
      const key = row.zonalHead || 'Unknown';
      if (!groups[key]) groups[key] = { zonal: key, covered: 0, total: 0 };
      groups[key].covered += parseInt(row.Covered) || 0;
      groups[key].total   += parseInt(row.Total)   || 0;
    });
    return Object.values(groups).map(g => ({
      name:     g.zonal,
      covered:  g.covered,
      total:    g.total,
      notCovered: g.total - g.covered,
      coverage: parseFloat(((g.covered / (g.total || 1)) * 100).toFixed(1))
    })).sort((a, b) => b.coverage - a.coverage);
  }, [filteredData]);

  const zoneStats = useMemo(() => {
    const ZONE_DISPLAY_NAMES: Record<string, string> = {
      '4': 'Vrindavan Zone',
      'Zone 4': 'Vrindavan Zone',
      'ZONE 4': 'Vrindavan Zone',
      'zone 4': 'Vrindavan Zone',
    };

    const groups: Record<string, { zone: string; covered: number; total: number }> = {};
    filteredData.forEach(row => {
      const key = row['Zone & Circle'] || 'Unknown';
      if (!groups[key]) groups[key] = { zone: key, covered: 0, total: 0 };
      groups[key].covered += parseInt(row.Covered) || 0;
      groups[key].total   += parseInt(row.Total)   || 0;
    });
    return Object.values(groups).map(g => ({
      name:       ZONE_DISPLAY_NAMES[g.zone.trim()] ?? g.zone,
      covered:    g.covered,
      total:      g.total,
      notCovered: g.total - g.covered,
      coverage:   parseFloat(((g.covered / (g.total || 1)) * 100).toFixed(1))
    })).sort((a, b) => b.coverage - a.coverage);
  }, [filteredData]);

  const handleExportExcel = () => {
    const exportData = filteredData.map((row, index) => ({
      'S.No': index + 1,
      'Ward Name': row['Ward Name'],
      'Route Name': row['Route Name'],
      'Supervisor': row.supervisor,
      'Zonal Head': row.zonalHead,
      'Vehicle Number': row['Vehicle Number'],
      'Vehicle Type': row['Vehicle Type'],
      'Total POI': row.Total,
      'Scanned POI': row.Covered,
      'Coverage %': row.Coverage + '%'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Door-to-Door-Report");
    XLSX.writeFile(workbook, `Door-to-Door-Report-${new Date().toLocaleDateString()}.xlsx`);
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setLoading(true);
    try {
      // Give the UI a moment to settle if any new elements were just rendered
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create canvas from the report element
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: reportRef.current.scrollWidth,
        windowHeight: reportRef.current.scrollHeight
      });

      const dataUrl = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgProps = pdf.getImageProperties(dataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      const pageHeight = pdf.internal.pageSize.getHeight();

      pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Door-to-Door-Report-${new Date().toLocaleDateString()}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="report-container p-6 space-y-6 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <LayoutGrid className="text-emerald-500" />
            Door to Door Coverage Report
          </h2>
          <p className="text-slate-500 text-sm mt-1">Detailed operational analysis by supervisor and zonal heads</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm font-medium text-sm cursor-pointer">
            <Upload size={18} className="text-blue-500" />
            Upload CSV
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm font-medium text-sm"
          >
            <FileSpreadsheet size={18} className="text-emerald-500" />
            Export Excel
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 font-medium text-sm"
          >
            <Download size={18} />
            Download PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Routes', value: stats.totalRoutes, icon: MapPin, color: 'blue' },
          { label: 'Avg Coverage', value: `${stats.avgCoverage}%`, icon: CheckCircle2, color: 'emerald' },
          { label: 'Total POI', value: stats.totalTotal, icon: Users, color: 'slate' },
          { label: 'Scanned POI', value: stats.totalCovered, icon: CheckCircle2, color: 'emerald' },
          { label: 'Efficiency', value: `${stats.efficiency}%`, icon: ArrowUpRight, color: 'orange' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-xl bg-${kpi.color}-50 text-${kpi.color}-500 group-hover:scale-110 transition-transform`}>
                <kpi.icon size={20} />
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Live Analysis</span>
            </div>
            <div className="text-2xl font-bold text-slate-800">{kpi.value}</div>
            <div className="text-sm text-slate-500 mt-1 font-medium">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Filters Section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search ward, vehicle or route..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none"
          />
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <span className="text-sm font-semibold text-slate-600">Filters:</span>
          </div>
          
          <select 
            value={selectedZonal}
            onChange={(e) => {
              setSelectedZonal(e.target.value);
              setSelectedSupervisor('All');
            }}
            className="px-4 py-2 bg-slate-50 border-none rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="All">All Zonals</option>
            {zonals.map(z => <option key={z} value={z}>{z}</option>)}
          </select>

          <select 
            value={selectedSupervisor}
            onChange={(e) => {
              setSelectedSupervisor(e.target.value);
              setSelectedWard('All');
            }}
            className="px-4 py-2 bg-slate-50 border-none rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="All">All Supervisors</option>
            {supervisors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <select 
            value={selectedWard}
            onChange={(e) => setSelectedWard(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-none rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="All">All Wards</option>
            {wards.filter(w => w !== 'All').map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>

        <div className="h-8 w-[1px] bg-slate-100 mx-2 hidden lg:block" />

        <div className="flex bg-slate-50 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('detailed')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              viewMode === 'detailed' 
                ? 'bg-white text-emerald-600 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Route Wise
          </button>
          <button
            onClick={() => setViewMode('supervisor')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
              viewMode === 'supervisor' 
                ? 'bg-white text-emerald-600 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Supervisor Wise
          </button>
        </div>
      </div>

      {/* Analytics Section — Donut Cards */}
      {data.length > 0 && (
        <div className="space-y-8">

          {/* ZONAL HEAD WISE COVERAGE - Premium Implementation */}
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-8 mb-10">
              {/* Header with Title and Lines */}
              <div className="flex items-center justify-between gap-6 mb-12">
                  <div className="flex items-center gap-4">
                      <img src={nagarNigamLogo} alt="Logo" className="h-16 w-auto object-contain" />
                  </div>
                  
                  <div className="flex-1 flex flex-col items-center">
                      <h2 className="text-xl font-extrabold text-[#334155] tracking-tight uppercase text-center">
                          Zonal Head Wise Coverage
                      </h2>
                      <div className="flex items-center gap-4 w-full mt-2">
                          <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-[#10b981] to-[#10b981]"></div>
                          <span className="text-[10px] font-black text-[#10b981] uppercase tracking-[0.2em] whitespace-nowrap">
                              POI Coverage Breakdown Per Zonal Head
                          </span>
                          <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-[#10b981] to-[#10b981]"></div>
                      </div>
                  </div>

                  <div className="flex items-center gap-4">
                      <img src={natureGreenLogo} alt="Logo" className="h-12 w-auto object-contain" />
                  </div>
              </div>

              {/* Grid for Head Cards */}
              <div className="flex flex-wrap justify-center gap-6">
                {zonalStats.map((head) => {
                    const percentage = Math.round((head.covered / head.total) * 1000) / 10;

                    return (
                        <div key={head.name} className="flex-1 min-w-[220px] max-w-[260px] bg-[#f8fafc] rounded-[2rem] p-6 shadow-sm border border-slate-50 flex flex-col items-center transition-transform hover:scale-[1.02]">
                            {/* Donut Chart */}
                            <div className="relative w-36 h-36 mb-6">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Scanned', value: head.covered },
                                                { name: 'Not Scanned', value: Math.max(0, head.total - head.covered) }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={45}
                                            outerRadius={60}
                                            paddingAngle={0}
                                            dataKey="value"
                                            stroke="none"
                                            startAngle={90}
                                            endAngle={450}
                                        >
                                            <Cell fill="#22c55e" /> {/* Covered - Green */}
                                            <Cell fill="#ef4444" /> {/* Left - Red */}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Center Percentage */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xl font-black text-black">
                                        {percentage}%
                                    </span>
                                </div>
                            </div>

                            {/* Head Info */}
                            <h3 className="text-sm font-black text-black uppercase tracking-wider mb-1 text-center">
                                {head.name}
                            </h3>
                            <div className="flex flex-col items-center">
                                <span className="text-xs font-black text-emerald-700">{head.covered}</span>
                                <div className="w-8 h-[1px] bg-slate-200 my-1"></div>
                                <span className="text-xs font-black text-slate-500">{head.total} POI</span>
                            </div>

                            {/* Custom Legend */}
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-[#22c55e]"></div>
                                    <span className="text-[9px] font-bold text-black uppercase">Scanned</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-[#ef4444]"></div>
                                    <span className="text-[9px] font-bold text-black uppercase">Not Scanned</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
              </div>
          </div>

          {/* Zone & Circle Donuts */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-6">
              <img src="/src/assets/nagar-nigam-logo.png" alt="Nagar Nigam Logo" className="h-14 w-auto object-contain" />
              <div className="text-center flex-1 px-4">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Zone &amp; Circle Wise Coverage</h3>
                <div className="flex items-center justify-center gap-3 mt-1">
                  <div className="h-[1.5px] w-10 bg-blue-500" />
                  <p className="text-xs text-blue-600 font-bold uppercase tracking-widest">POI Coverage Breakdown per Zone &amp; Circle</p>
                  <div className="h-[1.5px] w-10 bg-blue-500" />
                </div>
              </div>
              <img src="/src/assets/NatureGreen_Logo.png" alt="Nature Green Logo" className="h-14 w-auto object-contain" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {zoneStats.map((z, idx) => {
                const donutData = [
                  { name: 'Scanned',     value: z.covered },
                  { name: 'Not Scanned', value: z.notCovered }
                ];
                return (
                  <div key={idx} className="flex flex-col items-center p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-md transition-all">
                    <div className="relative w-[110px] h-[110px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={donutData}
                            cx="50%" cy="50%"
                            innerRadius={34} outerRadius={50}
                            startAngle={90} endAngle={-270}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            <Cell fill="#22c55e" />
                            <Cell fill="#ef4444" />
                          </Pie>
                          <Tooltip
                            content={({ active, payload }) =>
                              active && payload?.length ? (
                                <div className="bg-white text-xs font-bold px-2 py-1 rounded-lg shadow-lg border border-slate-100">
                                  {payload[0].name}: {payload[0].value}
                                </div>
                              ) : null
                            }
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-black text-black">{z.coverage}%</span>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <div className="text-xs font-black text-black leading-tight line-clamp-2">{z.name}</div>
                      <div className="text-[10px] text-black mt-0.5 font-bold">{z.covered}/{z.total} POI</div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <span className="flex items-center gap-1 text-[9px] font-bold text-black">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        Scanned
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-bold text-black">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                        Not Scanned
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* Main Report Content */}
      {data.length > 0 ? (
        <div ref={reportRef} className="space-y-8 bg-slate-50/30 p-6 rounded-3xl">
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
            <div className="bg-white px-8 py-12 text-center relative overflow-hidden border-b border-slate-100">
              <div className="absolute top-0 left-0 w-full h-full opacity-40 pointer-events-none">
                <div className="absolute top-[-50%] left-[-10%] w-[40%] h-[200%] bg-emerald-50 rotate-45 blur-3xl" />
                <div className="absolute bottom-[-50%] right-[-10%] w-[40%] h-[200%] bg-blue-50 rotate-45 blur-3xl" />
              </div>
              
              <div className="relative z-10">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-2 uppercase" style={{ color: '#0f172a', fontWeight: 900 }}>
                  Door to Door Route Wise Performance Report
                </h1>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-[1.5px] w-12 bg-emerald-500" />
                  <p className="font-bold tracking-[0.2em] text-xs uppercase" style={{ color: '#059669' }}>
                    NAGAR NIGAM MATHURA-VRINDAVAN
                  </p>
                  <div className="h-[1.5px] w-12 bg-emerald-500" />
                </div>
                
                {fileName && (
                  <div className="mt-6 flex flex-col items-center gap-4">
                    {(selectedZonal !== 'All' || selectedSupervisor !== 'All' || selectedWard !== 'All') && (
                      <div className="flex flex-wrap justify-center gap-3">
                        {selectedZonal !== 'All' && (
                          <div className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[11px] font-black uppercase tracking-wider shadow-lg">
                            Zonal Head: {selectedZonal}
                          </div>
                        )}
                        {selectedSupervisor !== 'All' && (
                          <div className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-[11px] font-black uppercase tracking-wider shadow-lg">
                            Supervisor: {selectedSupervisor}
                          </div>
                        )}
                        {selectedWard !== 'All' && (
                          <div className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-black uppercase tracking-wider shadow-lg">
                            Ward: {selectedWard}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest shadow-sm">
                      <FileText size={12} className="text-emerald-500" />
                      Source: {fileName}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 border-b border-slate-50 bg-slate-50/30">
              {viewMode === 'detailed' ? (
                <table className="w-full border-collapse bg-white" style={{ border: '1px solid black' }}>
                  <thead className="sticky top-0 z-10">
                    <tr style={{ backgroundColor: '#e2e8f0' }}>
                      <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[10px] font-black text-black uppercase text-center w-8">S.No</th>
                      <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[10px] font-black text-black uppercase text-left">Ward Name</th>
                      <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[10px] font-black text-black uppercase text-left">Route Name</th>
                      <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[10px] font-black text-black uppercase text-left">Supervisor / Head</th>
                      <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[10px] font-black text-black uppercase text-left">Vehicle Info</th>
                      <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[10px] font-black text-black uppercase text-center">Total POI</th>
                      <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[10px] font-black text-black uppercase text-center">Scanned POI</th>
                      <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[10px] font-black text-black uppercase text-center">Coverage %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredData.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td style={{ border: '1px solid black' }} className="px-2 py-1 text-center text-[10px] font-bold text-black">{index + 1}</td>
                        <td style={{ border: '1px solid black' }} className="px-2 py-1 text-[10px] font-bold text-black">{row['Ward Name']}</td>
                        <td style={{ border: '1px solid black' }} className="px-2 py-1 text-[10px] font-medium text-black">{row['Route Name']}</td>
                        <td style={{ border: '1px solid black' }} className="px-2 py-1">
                          <div className="text-[10px] font-bold text-black">{row.supervisor}</div>
                          <div className="text-[9px] text-slate-500 font-bold uppercase">{row.zonalHead}</div>
                        </td>
                        <td style={{ border: '1px solid black' }} className="px-2 py-1">
                          <div className="text-[10px] font-bold text-black">{row['Vehicle Number']}</div>
                          <div className="text-[9px] text-slate-500">{row['Vehicle Type']}</div>
                        </td>
                        <td style={{ border: '1px solid black' }} className="px-2 py-1 text-center text-[10px] font-black text-slate-700">
                          {row.Total}
                        </td>
                        <td style={{ border: '1px solid black' }} className="px-2 py-1 text-center text-[10px] font-black text-emerald-700">
                          {row.Covered}
                        </td>
                        <td style={{ border: '1px solid black' }} className="px-2 py-1 text-center">
                          <span className={`text-[10px] font-black ${
                            parseFloat(row.Coverage) >= 90 ? 'text-emerald-700' : 
                            parseFloat(row.Coverage) >= 70 ? 'text-amber-700' : 'text-rose-700'
                          }`}>{row.Coverage}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="space-y-4">
                  {supervisorSummary.map((summary, sIndex) => {
                    const supervisorRoutes = filteredData.filter(d => d.supervisor === summary.supervisor);
                    const supervisorCoverage = ((summary.covered / (summary.total || 1)) * 100).toFixed(1);
                    
                    return (
                      <div key={sIndex} className="border border-black mb-6">
                        <div className="bg-slate-100 px-4 py-1.5 flex items-center justify-between border-b border-black">
                          <div className="flex items-center gap-6">
                            <span className="text-[10px] font-black text-black w-4">{sIndex + 1}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-black uppercase">Supervisor:</span>
                              <span className="text-xs font-black text-black">{summary.supervisor}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-600 uppercase">Zonal Head:</span>
                              <span className="text-[10px] font-bold text-black">{summary.zonalHead}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-8">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-black uppercase">Routes:</span>
                              <span className="text-xs font-black text-blue-700">{summary.routes}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-black uppercase">Avg Coverage:</span>
                              <span className="text-xs font-black text-emerald-700">{supervisorCoverage}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse bg-white" style={{ border: '1px solid black' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#f1f5f9' }}>
                                <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[9px] font-black text-black uppercase text-center w-8">S.No</th>
                                <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[9px] font-black text-black uppercase text-left">Ward Name</th>
                                <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[9px] font-black text-black uppercase text-left">Route Name</th>
                                <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[9px] font-black text-black uppercase text-left">Vehicle Info</th>
                                <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[9px] font-black text-black uppercase text-center">Total POI</th>
                                <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[9px] font-black text-black uppercase text-center">Scanned POI</th>
                                <th style={{ border: '1px solid black' }} className="px-2 py-1 text-[9px] font-black text-black uppercase text-center">Coverage %</th>
                              </tr>
                            </thead>
                            <tbody>
                              {supervisorRoutes.map((row, rIndex) => (
                                <tr key={rIndex} className="hover:bg-slate-50">
                                  <td style={{ border: '1px solid black' }} className="border border-black px-2 py-0.5 text-center text-[9px] font-bold text-black">
                                    {rIndex + 1}
                                  </td>
                                  <td style={{ border: '1px solid black' }} className="border border-black px-2 py-0.5 text-[10px] font-bold text-black">
                                    {row['Ward Name']}
                                  </td>
                                  <td style={{ border: '1px solid black' }} className="border border-black px-2 py-0.5 text-[9px] text-black">
                                    {row['Route Name']}
                                  </td>
                                  <td style={{ border: '1px solid black' }} className="border border-black px-2 py-0.5">
                                    <div className="text-[9px] font-bold text-black">{row['Vehicle Number']}</div>
                                    <div className="text-[8px] text-slate-500 uppercase">{row['Vehicle Type']}</div>
                                  </td>
                                  <td style={{ border: '1px solid black' }} className="border border-black px-2 py-0.5 text-center text-[10px] font-black text-slate-700">
                                    {row.Total}
                                  </td>
                                  <td style={{ border: '1px solid black' }} className="border border-black px-2 py-0.5 text-center text-[10px] font-black text-emerald-700">
                                    {row.Covered}
                                  </td>
                                  <td style={{ border: '1px solid black' }} className="border border-black px-2 py-0.5 text-center">
                                    <span className={`text-[10px] font-black ${
                                      parseFloat(row.Coverage) >= 90 ? 'text-emerald-700' : 'text-rose-700'
                                    }`}>{row.Coverage}%</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {filteredData.length === 0 && (
                <div className="py-20 text-center">
                  <div className="inline-flex p-4 rounded-full bg-slate-50 text-slate-300 mb-4">
                    <Search size={32} />
                  </div>
                  <p className="text-slate-500 font-medium">No records found matching your filters</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200 shadow-sm animate-in fade-in zoom-in duration-500">
          <div className="p-6 bg-blue-50 rounded-full text-blue-500 mb-6 group-hover:scale-110 transition-transform">
            <Upload size={48} />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">No Report Data Loaded</h3>
          <p className="text-slate-500 text-center max-w-md mb-8 px-6">
            Please upload a Door to Door POI report CSV file to begin your operational analysis. 
            The system will automatically map supervisors and zonal heads.
          </p>
          <label className="flex items-center gap-3 px-8 py-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 font-bold cursor-pointer hover:-translate-y-1">
            <Upload size={20} />
            Choose CSV File
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>
        </div>
      )}
    </div>
  );
};

export default DoorToDoorReport;
