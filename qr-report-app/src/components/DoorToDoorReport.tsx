import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  FileText, 
  Download, 
  Upload, 
  Search, 
  Filter, 
  User, 
  Clock, 
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
import * as htmlToImage from 'html-to-image';
import { useRef } from 'react';
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
    const worksheet = XLSX.utils.json_to_sheet(filteredData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Door-to-Door-Report");
    XLSX.writeFile(workbook, `Door-to-Door-Report-${new Date().toLocaleDateString()}.xlsx`);
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setLoading(true);
    try {
      const dataUrl = await htmlToImage.toPng(reportRef.current, {
        backgroundColor: '#f8fafc',
        quality: 1.0,
        pixelRatio: 2
      });

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
          { label: 'Total Points', value: stats.totalTotal.toLocaleString(), icon: Users, color: 'violet' },
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

          {/* Zonal Head Donuts */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-6">
              <img src="/src/assets/nagar-nigam-logo.png" alt="Nagar Nigam Logo" className="h-14 w-auto object-contain" />
              <div className="text-center flex-1 px-4">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Zonal Head Wise Coverage</h3>
                <div className="flex items-center justify-center gap-3 mt-1">
                  <div className="h-[1.5px] w-10 bg-emerald-500" />
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">POI Coverage Breakdown per Zonal Head</p>
                  <div className="h-[1.5px] w-10 bg-emerald-500" />
                </div>
              </div>
              <img src="/src/assets/NatureGreen_Logo.png" alt="Nature Green Logo" className="h-14 w-auto object-contain" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {zonalStats.map((z, idx) => {
                const donutData = [
                  { name: 'Covered',     value: z.covered },
                  { name: 'Not Covered', value: z.notCovered }
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
                        <span className="text-sm font-black text-emerald-600">{z.coverage}%</span>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <div className="text-xs font-black text-slate-700 leading-tight">{z.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{z.covered}/{z.total} POI</div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        Covered
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                        Left
                      </span>
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
                  { name: 'Covered',     value: z.covered },
                  { name: 'Not Covered', value: z.notCovered }
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
                        <span className="text-sm font-black text-emerald-600">{z.coverage}%</span>
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <div className="text-xs font-black text-slate-700 leading-tight line-clamp-2">{z.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{z.covered}/{z.total} POI</div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                        Covered
                      </span>
                      <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                        Left
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
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-2 uppercase">
                  Door to Door Route Wise Performance Report
                </h1>
                <div className="flex items-center justify-center gap-3">
                  <div className="h-[1.5px] w-12 bg-emerald-500" />
                  <p className="text-emerald-600 font-bold tracking-[0.2em] text-xs uppercase">
                    Municipal Corporation Gwalior
                  </p>
                  <div className="h-[1.5px] w-12 bg-emerald-500" />
                </div>
                
                {fileName && (
                  <div className="mt-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 text-[10px] font-bold uppercase tracking-widest shadow-sm">
                    <FileText size={12} className="text-emerald-500" />
                    Source: {fileName}
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 border-b border-slate-50 bg-slate-50/30">
              {viewMode === 'detailed' ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-16 text-center">S.No</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Ward & Route</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Ownership</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Vehicle Details</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">POI</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Coverage</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Timing</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredData.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 text-center text-sm font-bold text-slate-300 group-hover:text-emerald-500 transition-colors">
                          {index + 1}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-800">{row['Ward Name']}</div>
                          <div className="text-xs text-slate-400 font-medium">{row['Route Name']}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                              <User size={14} />
                            </div>
                            <div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">Supervisor:</div>
                              <div className="text-sm font-bold text-slate-700">{row.supervisor}</div>
                              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">Zonal Head:</div>
                              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">{row.zonalHead}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-slate-700">{row['Vehicle Number']}</div>
                          <div className="text-xs text-slate-400">{row['Vehicle Type']}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="text-[9px] text-slate-400 font-bold">TOTAL POI</div>
                              <div className="text-sm font-bold text-slate-700">{row.Total}</div>
                            </div>
                            <div className="w-[1px] h-6 bg-slate-100" />
                            <div>
                              <div className="text-[9px] text-emerald-500 font-bold">DONE POI</div>
                              <div className="text-sm font-bold text-emerald-600">{row.Covered}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ${
                                  parseFloat(row.Coverage) >= 90 ? 'bg-emerald-500' : 
                                  parseFloat(row.Coverage) >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                                style={{ width: `${row.Coverage}%` }}
                              />
                            </div>
                            <span className="text-sm font-bold text-slate-700">{row.Coverage}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-slate-500">
                            <Clock size={14} className="text-slate-400" />
                            <div className="text-xs font-medium">
                              {row['Route In Time']} - {row['Route Out Time']}
                              <div className="text-emerald-500 font-bold mt-0.5">Duration: {row['Route Time']}h</div>
                            </div>
                          </div>
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
                      <div key={sIndex} className="border-2 border-slate-200 rounded-2xl overflow-hidden mb-8 shadow-sm">
                        <div className="bg-emerald-50/50 px-6 py-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 border-b-2 border-slate-200">
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-black text-slate-400 w-6">{sIndex + 1}</span>
                            <div className="h-10 w-10 rounded-full bg-white shadow-sm flex items-center justify-center text-emerald-600 border-2 border-emerald-100">
                              <User size={20} />
                            </div>
                          </div>

                          <div className="text-center min-w-[150px]">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5">Supervisor Name</div>
                            <div className="text-lg font-black text-slate-800 leading-tight">{summary.supervisor}</div>
                          </div>

                          <div className="text-center min-w-[150px]">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5">Zonal Head</div>
                            <div className="text-sm font-bold text-slate-600 uppercase tracking-tighter">{summary.zonalHead}</div>
                          </div>

                          <div className="text-center">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5">Routes</div>
                            <div className="text-lg font-black text-blue-600">{summary.routes}</div>
                          </div>

                          <div className="text-center flex flex-col items-center">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-0.5">Avg Coverage</div>
                            <div className="flex items-center gap-3">
                              <div className="text-lg font-black text-emerald-600">{supervisorCoverage}%</div>
                              <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden shadow-inner">
                                <div 
                                  className={`h-full transition-all duration-1000 ${
                                    parseFloat(supervisorCoverage) >= 90 ? 'bg-emerald-500' : 
                                    parseFloat(supervisorCoverage) >= 70 ? 'bg-amber-500' : 'bg-rose-500'
                                  }`} 
                                  style={{ width: `${supervisorCoverage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse bg-white">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200">
                                <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200 text-center w-16">S.No</th>
                                <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200 w-1/4">Ward & Route</th>
                                <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200 w-1/4">Vehicle Info</th>
                                <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200 w-1/6 text-center">POI Stats</th>
                                <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200 w-1/6 text-center">Coverage %</th>
                                <th className="px-6 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-1/6 text-right">Time Logs</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {supervisorRoutes.map((row, rIndex) => (
                                <tr key={rIndex} className="hover:bg-slate-50/50 transition-colors group">
                                  <td className="px-6 py-4 text-center text-[10px] font-bold text-slate-400 border-r border-slate-200">
                                    {rIndex + 1}
                                  </td>
                                  <td className="px-6 py-4 border-r border-slate-200">
                                    <div className="font-bold text-slate-700">{row['Ward Name']}</div>
                                    <div className="text-[10px] text-slate-400 font-medium">{row['Route Name']}</div>
                                  </td>
                                  <td className="px-6 py-4 border-r border-slate-200">
                                    <div className="text-sm font-bold text-slate-600">{row['Vehicle Number']}</div>
                                    <div className="text-[10px] text-slate-400 font-medium">{row['Vehicle Type']}</div>
                                  </td>
                                  <td className="px-6 py-4 border-r border-slate-200 text-center">
                                    <div className="text-sm font-black text-slate-700">{row.Covered} / {row.Total}</div>
                                  </td>
                                  <td className="px-6 py-4 border-r border-slate-200">
                                    <div className="flex items-center gap-3 justify-center">
                                      <div className="flex-1 h-1.5 min-w-[60px] bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                        <div 
                                          className={`h-full rounded-full ${
                                            parseFloat(row.Coverage) >= 90 ? 'bg-emerald-500' : 'bg-rose-500'
                                          }`}
                                          style={{ width: `${row.Coverage}%` }}
                                        />
                                      </div>
                                      <span className={`text-sm font-black ${
                                        parseFloat(row.Coverage) >= 90 ? 'text-emerald-600' : 'text-rose-600'
                                      }`}>{row.Coverage}%</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="text-xs font-bold text-slate-600">{row['Route In Time']} - {row['Route Out Time']}</div>
                                    <div className="text-[10px] font-black text-emerald-500">{row['Route Time']}h</div>
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
