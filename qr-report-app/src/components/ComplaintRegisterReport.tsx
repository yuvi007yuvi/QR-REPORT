import React, { useState, useMemo, useRef } from 'react';
import { 
  Download, 
  FileDown, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Search,
  Filter,
  BarChart3,
  Calendar,
  TrendingUp,
  MapPin,
  Clock3,
  Upload
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

// Import logos (assuming they exist based on other components)
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';

interface ComplaintData {
  "S.No.": string;
  "Customer ID": string;
  "Customer Name": string;
  "Customer Number": string;
  "Complaint Date": string;
  "Complaint Time": string;
  "Status": string;
  "Ward": string;
  "Zone & Circle": string;
  "Complaint Type": string;
  "Complaint Sub-Type": string;
  "Complaint ID": string;
  "Resolved Date": string;
  "Resolved Time": string;
  "Feedback": string;
  "Progress": string;
  "Address": string;
  "Complaint Description": string;
  "Remark": string;
  "Complaint OTP": string;
  // Computed fields
  durationMs?: number;
  durationText?: string;
  isResolved: boolean;
}

const ComplaintRegisterReport: React.FC = () => {
  const [data, setData] = useState<ComplaintData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [zoneFilter, setZoneFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const reportRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = processCSVData(results.data);
        setData(parsedData);
        setLoading(false);
        alert(`Successfully loaded ${parsedData.length} records from ${file.name}`);
      },
      error: (error) => {
        console.error("Error parsing CSV:", error);
        setLoading(false);
        alert("Error parsing CSV file.");
      }
    });
  };

  const processCSVData = (rawData: any[]) => {
    return rawData.map((row: any) => {
      const isResolved = row["Status"] === 'RESOLVED';
      let durationMs = 0;
      let durationText = 'N/A';

      if (isResolved && row["Resolved Date"] && row["Resolved Time"] && row["Resolved Time"] !== '00:00:00') {
        const start = parseDateTime(row["Complaint Date"], row["Complaint Time"]);
        const end = parseDateTime(row["Resolved Date"], row["Resolved Time"]);
        
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          durationMs = end.getTime() - start.getTime();
          if (durationMs >= 0) {
            const hours = Math.floor(durationMs / (1000 * 60 * 60));
            const mins = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
            durationText = `${hours}h ${mins}m`;
          }
        }
      }

      return {
        ...row,
        isResolved,
        durationMs,
        durationText
      } as ComplaintData;
    });
  };

  const parseDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return new Date(NaN);
    const [day, month, year] = dateStr.split('/').map(Number);
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, seconds);
  };

  const formatTo12Hr = (timeStr: string) => {
    if (!timeStr || timeStr === '00:00:00' || timeStr === '---' || timeStr === '0') return '---';
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) return timeStr;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      const mStr = minutes.toString().padStart(2, '0');
      return `${h12}:${mStr} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = 
        item["Customer Name"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item["Complaint ID"]?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item["Ward"]?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'All' || item["Status"] === statusFilter;
      const matchesZone = zoneFilter === 'All' || item["Zone & Circle"] === zoneFilter;
      const matchesType = typeFilter === 'All' || item["Complaint Type"] === typeFilter;
      
      let matchesDate = true;
      if (startDate || endDate) {
        const itemDate = parseDateTime(item["Complaint Date"], "00:00:00");
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0,0,0,0);
          if (itemDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23,59,59,999);
          if (itemDate > end) matchesDate = false;
        }
      }

      return matchesSearch && matchesStatus && matchesZone && matchesType && matchesDate;
    });
  }, [data, searchTerm, statusFilter, zoneFilter, typeFilter, startDate, endDate]);

  const stats = useMemo(() => {
    const total = data.length;
    const resolved = data.filter(d => d.Status === 'RESOLVED').length;
    const open = data.filter(d => d.Status === 'OPEN').length;
    const other = total - resolved - open;
    
    const resolvedWithDuration = data.filter(d => d.isResolved && d.durationMs && d.durationMs > 0);
    const avgDurationMs = resolvedWithDuration.length > 0
      ? resolvedWithDuration.reduce((acc, curr) => acc + (curr.durationMs || 0), 0) / resolvedWithDuration.length
      : 0;
      
    const avgHours = Math.floor(avgDurationMs / (1000 * 60 * 60));
    const avgMins = Math.floor((avgDurationMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      total,
      resolved,
      open,
      other,
      avgDuration: `${avgHours}h ${avgMins}m`,
      resolutionRate: total > 0 ? ((resolved / total) * 100).toFixed(1) : '0'
    };
  }, [data]);

  const zoneChartData = useMemo(() => {
    const zones: {[key: string]: number} = {};
    data.forEach(item => {
      const z = item["Zone & Circle"] || 'Unknown';
      zones[z] = (zones[z] || 0) + 1;
    });
    return Object.entries(zones).map(([name, count]) => ({ name, count }));
  }, [data]);

  const statusChartData = [
    { name: 'Resolved', value: stats.resolved, color: '#10b981' },
    { name: 'Open', value: stats.open, color: '#f59e0b' },
    { name: 'Other', value: stats.other, color: '#6366f1' },
  ];

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      "Complaint ID": item["Complaint ID"],
      "Customer": item["Customer Name"],
      "Phone": item["Customer Number"],
      "Ward": item["Ward"],
      "Zone": item["Zone & Circle"],
      "Type": item["Complaint Type"],
      "Register Date": item["Complaint Date"],
      "Register Time": item["Complaint Time"],
      "Resolved Date": item["Resolved Date"],
      "Resolved Time": item["Resolved Time"],
      "Solve Duration": item.durationText,
      "Status": item["Status"]
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Complaints");
    XLSX.writeFile(wb, `Complaint_Resolution_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    try {
      const imgData = await toPng(reportRef.current, { backgroundColor: '#f9fafb' });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Complaint_Analysis_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("PDF export failed", error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xl font-bold text-gray-700 animate-pulse">Analyzing Complaint Data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12 overflow-x-hidden" style={{ fontFamily: "'Calibri', 'Segoe UI', sans-serif" }}>
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <img src={NagarNigamLogo} alt="NN" className="h-16 w-auto drop-shadow-sm" />
          <div className="h-12 w-px bg-gray-200 hidden md:block"></div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Clock3 className="text-blue-600 w-8 h-8" />
              COMPLAINT RESOLUTION ANALYSIS
            </h1>
            <p className="text-sm font-semibold text-gray-500 tracking-wider uppercase">Mathura-Vrindavan Nagar Nigam</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <img src={NatureGreenLogo} alt="NG" className="h-16 w-auto drop-shadow-sm hover:scale-105 transition-transform cursor-pointer" />
        </div>
      </div>

      <div className="container mx-auto px-4 mt-8 max-w-7xl">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 shadow-sm shadow-slate-100">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <Upload className="text-blue-600 w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2 uppercase">Analysis Engine Ready</h2>
            <p className="text-slate-500 font-bold mb-10 max-w-md text-center px-4 uppercase tracking-widest text-[10px] leading-relaxed">
              Please upload the <span className="text-blue-600">Complaints.csv</span> file to generate <br/> 
              Real-time KPIs, zone-wise analytics, and resolution timelines.
            </p>
            
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                id="csv-empty-upload"
                className="hidden"
                onChange={handleFileUpload}
              />
              <label 
                htmlFor="csv-empty-upload"
                className="flex items-center gap-3 px-12 py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-3xl shadow-2xl shadow-blue-200 transition-all active:scale-95 cursor-pointer text-lg tracking-[0.2em] uppercase"
              >
                <Upload className="w-6 h-6" /> START UPLOAD
              </label>
            </div>
          </div>
        ) : (
          <>
            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-4 group-hover:rotate-6 transition-transform">
                    <AlertCircle className="text-blue-600 w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Registered</p>
                  <h3 className="text-3xl font-black text-gray-900 mt-1">{stats.total}</h3>
                  <div className="mt-2 flex items-center gap-1 text-xs font-bold text-blue-600 italic">
                    <TrendingUp className="w-3 h-3" />
                    Live Data
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4 group-hover:rotate-6 transition-transform">
                    <CheckCircle2 className="text-emerald-600 w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Resolved</p>
                  <h3 className="text-3xl font-black text-emerald-600 mt-1">{stats.resolved}</h3>
                  <div className="mt-2 text-xs font-bold text-slate-500">
                    Resolution Rate: <span className="text-emerald-600">{stats.resolutionRate}%</span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mb-4 group-hover:rotate-6 transition-transform">
                    <Clock className="text-amber-600 w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Average Solve Time</p>
                  <h3 className="text-3xl font-black text-amber-600 mt-1">{stats.avgDuration}</h3>
                  <div className="mt-2 text-xs font-bold text-slate-500 italic">
                    From registration to closure
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4 group-hover:rotate-6 transition-transform">
                    <BarChart3 className="text-indigo-600 w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Open Complaints</p>
                  <h3 className="text-3xl font-black text-indigo-600 mt-1">{stats.open}</h3>
                  <div className="mt-2 text-xs font-bold text-red-500 animate-pulse">
                    Action Required
                  </div>
                </div>
              </div>
            </div>

            {/* Analytics Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <MapPin className="text-blue-500 w-5 h-5" />
                    ZONE-WISE DISTRIBUTION
                  </h4>
                </div>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={zoneChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 600}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 600}} />
                      <Tooltip 
                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        cursor={{fill: '#f8fafc'}}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={32}>
                        {zoneChartData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899'][index % 5]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-lg font-black text-gray-900 flex items-center gap-2">
                    <CheckCircle2 className="text-emerald-500 w-5 h-5" />
                    STATUS OVERVIEW
                  </h4>
                </div>
                <div className="h-[220px] flex items-center justify-center">
                  <div className="w-1/2 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none'}} />
                        <Pie
                          data={statusChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={75}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {statusChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-1/2 flex flex-col justify-center gap-3 pr-4">
                    {statusChartData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between group">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: item.color}}></div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter group-hover:text-gray-600 transition-colors">{item.name}</p>
                        </div>
                        <p className="text-sm font-black text-gray-800">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Data Table Section */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-100 border border-gray-100 overflow-hidden" ref={reportRef}>
              <div className="p-8 border-b border-gray-100">
                <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                  <div>
                    <h4 className="text-2xl font-black text-gray-900 tracking-tight">DETAILED COMPLAINT LOG</h4>
                    <p className="text-slate-500 font-semibold text-sm mt-1">Found {filteredData.length} records matching your filters</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <div className="relative">
                      <input
                        type="file"
                        accept=".csv"
                        id="csv-manual-upload"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <label 
                        htmlFor="csv-manual-upload"
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-100 transition-all active:scale-95 cursor-pointer"
                      >
                        <Upload className="w-4 h-4" /> UPLOAD CSV
                      </label>
                    </div>
                    <button 
                      onClick={handleExportExcel}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg shadow-emerald-100 transition-all active:scale-95"
                    >
                      <Download className="w-4 h-4" /> EXCEL
                    </button>
                    <button 
                      onClick={handleExportPDF}
                      className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-lg shadow-rose-100 transition-all active:scale-95"
                    >
                      <FileDown className="w-4 h-4" /> PDF
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="Search..." 
                      className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 font-semibold text-slate-700 text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="date" 
                      className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 text-sm"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="date" 
                      className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 text-sm"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select 
                      className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 appearance-none text-sm"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="All">All Status</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="OPEN">Open</option>
                    </select>
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select 
                      className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 appearance-none text-sm"
                      value={zoneFilter}
                      onChange={(e) => setZoneFilter(e.target.value)}
                    >
                      <option value="All">All Zones</option>
                      {Array.from(new Set(data.map(d => d["Zone & Circle"]))).filter(Boolean).map(z => (
                        <option key={z} value={z}>Zone {z}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    onClick={() => {setSearchTerm(''); setStatusFilter('All'); setZoneFilter('All'); setTypeFilter('All'); setStartDate(''); setEndDate('');}}
                    className="py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-black rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                  >
                    Reset
                  </button>
                </div>
              </div>

                <div className="overflow-hidden border border-slate-200 rounded-3xl shadow-xl bg-white">
                  <div className="overflow-x-auto max-h-[600px]">
                    <table className="w-full border-collapse border-spacing-0">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-[#1e293b] text-white">
                          <th className="px-10 py-6 text-center text-[14px] font-black uppercase tracking-widest border-r border-slate-700/50 w-24">Sr. No</th>
                          <th className="px-10 py-6 text-center text-[16px] font-black uppercase tracking-widest border-r border-slate-700/50 min-w-[300px]">Complaint ID & Customer</th>
                          <th className="px-10 py-6 text-center text-[14px] font-black uppercase tracking-widest border-r border-slate-700/50 w-28">Ward No.</th>
                          <th className="px-10 py-6 text-center text-[16px] font-black uppercase tracking-widest border-r border-slate-700/50 min-w-[450px]">Complaint Description Details</th>
                          <th className="px-10 py-6 text-center text-[16px] font-black uppercase tracking-widest border-r border-slate-700/50 min-w-[450px]">Supervisor Final Remarks</th>
                          <th className="px-10 py-6 text-center text-[16px] font-black uppercase tracking-widest border-r border-slate-700/50 min-w-[200px]">Registration Info</th>
                          <th className="px-10 py-6 text-center text-[16px] font-black uppercase tracking-widest border-r border-slate-700/50 min-w-[200px]">Resolution Info</th>
                          <th className="px-10 py-6 text-center text-[16px] font-black uppercase tracking-widest min-w-[150px]">Final Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {filteredData.slice(0, 100).map((item, idx) => (
                          <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                            <td className="px-10 py-7 text-[16px] font-bold text-slate-500 border-r border-slate-200 text-center">{idx + 1}</td>
                            <td className="px-10 py-7 border-r border-slate-200 text-center text-slate-900">
                              <div className="text-[18px] font-mono font-black text-blue-900 leading-none mb-2">{item["Complaint ID"]}</div>
                              <div className="text-[16px] font-bold uppercase tracking-tight">{item["Customer Name"]}</div>
                            </td>
                            <td className="px-10 py-7 text-[18px] font-black text-slate-700 border-r border-slate-200 text-center bg-slate-50/40">{item["Ward"]}</td>
                            <td className="px-10 py-7 border-r border-slate-200 text-center">
                              <div className="inline-block px-4 py-1.5 bg-indigo-100 text-indigo-900 rounded-xl text-[12px] font-black uppercase border border-indigo-200 mb-3">
                                {item["Complaint Type"]}
                              </div>
                              <p className="text-[15px] font-bold text-slate-700 leading-relaxed italic block break-words" title={item["Complaint Description"]}>
                                "{item["Complaint Description"]}"
                              </p>
                            </td>
                            <td className={`px-10 py-7 border-r border-slate-200 text-center ${item["Remark"] ? 'bg-amber-50/60' : ''}`}>
                              <p className="text-[16px] font-black text-slate-950 leading-normal block break-words" title={item["Remark"]}>
                                {item["Remark"] || <span className="text-slate-400 italic font-medium tracking-wide">-- No Remarks Recorded --</span>}
                              </p>
                            </td>
                            <td className="px-10 py-7 text-center border-r border-slate-200 bg-slate-50/50">
                              <div className="text-[16px] font-black text-slate-900 mb-1">{item["Complaint Date"]}</div>
                              <div className="text-[14px] font-black text-slate-400 uppercase tracking-widest">{formatTo12Hr(item["Complaint Time"])}</div>
                            </td>
                            <td className="px-10 py-7 text-center border-r border-slate-200 bg-emerald-50/30">
                              <div className="text-[16px] font-black text-emerald-900 mb-1">{item["Resolved Date"] || '---'}</div>
                              <div className="text-[14px] font-black text-emerald-600/50 uppercase tracking-widest">{formatTo12Hr(item["Resolved Time"])}</div>
                            </td>
                            <td className="px-10 py-7 text-center">
                              <span className={`inline-flex items-center px-6 py-2.5 rounded-2xl text-[12px] font-black uppercase tracking-[0.3em] border-2 shadow-sm ${
                                item["Status"] === 'RESOLVED' 
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-400' 
                                  : 'bg-amber-100 text-amber-900 border-amber-400'
                              }`}>
                                {item["Status"]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Brand Footer */}
          <div className="mt-12 text-center pb-8 border-t border-gray-200 pt-8">
            <div className="inline-flex items-center gap-6 opacity-40 hover:opacity-100 transition-opacity">
              <img src={NagarNigamLogo} alt="Logo" className="h-10 grayscale" />
              <div className="h-6 w-px bg-gray-300"></div>
              <div className="text-left">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Built for Excellence</p>
                <p className="text-sm font-black text-gray-600 tracking-tighter">Nagar Nigam Mathura-Vrindavan</p>
              </div>
            </div>
            <p className="mt-8 text-xs font-black text-gray-300 uppercase tracking-[0.5em]">2026 Admin Portal v4.0.0</p>
          </div>
        </div>
      </div>
    );
};

export default ComplaintRegisterReport;
