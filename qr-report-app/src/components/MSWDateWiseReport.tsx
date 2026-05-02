import React, { useState, useMemo, useRef } from 'react';
import { 
  Download, 
  FileDown, 
  Search,
  Filter,
  BarChart3,
  Calendar,
  TrendingUp,
  Upload,
  CalendarDays,
  Truck,
  Weight,
  RotateCcw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';

// Import logos
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';

interface MSWTransaction {
  "S.No.": string;
  "Zone Name": string;
  "Ward Name": string;
  "Vehicle Number": string;
  "Gross Weight (Kg)": number;
  "Tare Weight (Kg)": number;
  "Net Weight (Kg)": number;
  "Content Type": string;
  "Date Of Weighment": string;
  "Receipt Number": string;
  "Vehicle Type": string;
  "Weighbridge Party Name": string;
  "Date of Entry": string;
  "Time of Entry": string;
  "Driver Name": string;
  "Driver Mobile Number": string;
  "Supervisor Name": string;
  "Supervisor Display ID": string;
  "Supervisor Contact Number": string;
  "Zone In-Charge Name": string;
  "In Date": string;
  "In Time": string;
  "Out Date": string;
  "Out Time": string;
}

interface DateSummary {
  date: string;
  totalTrips: number;
  totalNetWeight: number;
  totalGrossWeight: number;
  totalTareWeight: number;
}

const MSWDateWiseReport: React.FC = () => {
  const [data, setData] = useState<MSWTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('All');
  const [wasteTypeFilter, setWasteTypeFilter] = useState('All');
  
  const reportRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const bstr = e.target?.result;
      const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      const parsedData = processExcelData(rawData);
      setData(parsedData);
      setLoading(false);
      alert(`Successfully loaded ${parsedData.length} records from ${file.name}`);
    };
    reader.onerror = () => {
      setLoading(false);
      alert("Error reading file");
    };
    reader.readAsBinaryString(file);
  };

  const processExcelData = (rows: any[][]): MSWTransaction[] => {
    // We need to find the header row. In the provided sample, it's after the title.
    // Searching for "S.NO." or similar across rows
    let headerIndex = -1;
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        if (rows[i].includes("S.NO.") || rows[i].includes("S.No.")) {
            headerIndex = i;
            break;
        }
    }

    if (headerIndex === -1) {
        // Fallback for empty/wrong format
        return [];
    }

    const headers = rows[headerIndex];
    const dataRows = rows.slice(headerIndex + 1);

    const mapped = dataRows.filter(row => row.length > 0 && row[0] !== undefined).map((row) => {
        const getVal = (headerName: string) => {
            const idx = headers.indexOf(headerName);
            return idx !== -1 ? row[idx] : "";
        };

        // Helper: return "NA" for empty/undefined/falsy values
        const na = (val: any): string => {
            if (val === null || val === undefined || val === "") return "NA";
            const s = String(val).trim();
            return s === "" || s === "undefined" ? "NA" : s;
        };

        // Vehicle Type mapping: raw code → Primary/Secondary label
        const mapVehicleType = (code: string): string => {
            const key = String(code || "").trim().toUpperCase();
            const map: Record<string, string> = {
                "RC": "Secondary - Refuse Compactor (RC)",
                "TRACTOR": "Secondary - Tractor Trolley",
                "HOOK LODAR": "Secondary - Hook Loader",
                "HYVA": "Secondary - HYVA",
                "DUMPER": "Secondary - Dumper",
                "D2D": "Primary - Auto Tipper",
                "AUTO TIPPER 3 WHEELER": "Primary - AUTO TIPPER 3 WHEELER",
                "AUTO TIPPER EV": "Primary - AUTO TIPPER EV",
                "MANUAL RICKSHAW": "Primary - Manual Rickshaw",
                "WHEEL BARROW": "Primary - Wheel Barrow",
                "JCB 2DX": "Secondary - JCB 2DX",
                "JCB 3DX": "Secondary - JCB 3DX",
                "BOLERO": "Secondary - Bolero",
                "DUSTBIN PLACER VEHICLE": "Secondary - Dustbin Placer Vehicle",
                "TRACTOR LOADER": "Secondary - Tractor Loader"
            };
            return map[key] || (key ? "Others" : "NA");
        };

        const dateTimeStr = (val: any) => {
            if (!val) return ["", ""];
            if (val instanceof Date) {
               const day = val.getDate().toString().padStart(2, '0');
               const month = (val.getMonth() + 1).toString().padStart(2, '0');
               const year = val.getFullYear();
               return [`${day} / ${month} / ${year}`, val.toLocaleTimeString('en-GB')];
            }
            const parts = String(val).split(' ');
            return [parts[0] || "", parts[1] || ""];
        };

        const [grossDate, grossTime] = dateTimeStr(getVal("GROSS DATE TIME"));
        const [netDate, netTime] = dateTimeStr(getVal("NET DATE TIME"));
        const [tareDate, tareTime] = dateTimeStr(getVal("TARE DATE TIME"));

        const grossWeight = parseFloat(getVal("GROSS WEIGHT")) || 0;
        const tareWeight = parseFloat(getVal("TARE WEIGHT")) || 0;
        const netWeight = parseFloat(getVal("NET WEIGHT")) || 0;
        const vehicle = String(getVal("VEHICLE") || "").trim();
        const receiptNo = String(getVal("RECEIPT NO.") || "").trim();
        const dateVal = getVal("DATE");

        return {
            "S.No.": "",  // Will be re-numbered after filtering
            "Zone Name": na(""),
            "Ward Name": na(getVal("LOCATION")),
            "Vehicle Number": na(vehicle),
            "Gross Weight (Kg)": grossWeight,
            "Tare Weight (Kg)": tareWeight,
            "Net Weight (Kg)": netWeight,
            "Content Type": na(getVal("WASTE TYPE")),
            "Date Of Weighment": na(dateVal instanceof Date ? (() => {
                const day = dateVal.getDate().toString().padStart(2, '0');
                const month = (dateVal.getMonth() + 1).toString().padStart(2, '0');
                const year = dateVal.getFullYear();
                return `${day} / ${month} / ${year}`;
            })() : String(dateVal || "")),
            "Receipt Number": na(receiptNo),
            "Vehicle Type": mapVehicleType(getVal("VEHICLE TYPE")),
            "Weighbridge Party Name": na(getVal("PARTY NAME")),
            "Date of Entry": na(grossDate),
            "Time of Entry": na(grossTime),
            "Driver Name": na(getVal("DRIVER NAME")),
            "Driver Mobile Number": na(getVal("DRIVER MOBILE")),
            "Supervisor Name": na(getVal("SUPERVISOR")),
            "Supervisor Display ID": na(getVal("SUPERVISOR ID")),
            "Supervisor Contact Number": na(getVal("SUPERVISOR CONTACT")),
            "Zone In-Charge Name": na(getVal("ZONE INCHARGE")),
            "In Date": na(grossDate),
            "In Time": na(grossTime),
            "Out Date": na(netDate || tareDate),
            "Out Time": na(netTime || tareTime)
        };
    });

    // Filter out junk/blank rows: all weights 0, or no vehicle/receipt/date
    return mapped
      .filter(item => {
        const hasWeight = item["Gross Weight (Kg)"] > 0 || item["Tare Weight (Kg)"] > 0 || item["Net Weight (Kg)"] > 0;
        const hasVehicle = item["Vehicle Number"] !== "NA" && item["Vehicle Number"] !== "undefined";
        const hasReceipt = item["Receipt Number"] !== "NA" && item["Receipt Number"] !== "undefined";
        return hasWeight && (hasVehicle || hasReceipt);
      })
      .map((item, index) => ({
        ...item,
        "S.No.": String(index + 1)  // Re-number after filtering
      }));
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const vNum = String(item["Vehicle Number"] || "");
      const rNum = String(item["Receipt Number"] || "");
      const matchesSearch = 
        vNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rNum.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDate = !dateFilter || (() => {
        const d = new Date(dateFilter);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return item["Date Of Weighment"] === `${day} / ${month} / ${year}`;
      })();
      const matchesVehicle = vehicleFilter === 'All' || item["Vehicle Number"] === vehicleFilter;
      const matchesWaste = wasteTypeFilter === 'All' || item["Content Type"] === wasteTypeFilter;

      return matchesSearch && matchesDate && matchesVehicle && matchesWaste;
    });
  }, [data, searchTerm, dateFilter, vehicleFilter, wasteTypeFilter]);

  const dateWiseSummary = useMemo(() => {
    const summary: { [key: string]: DateSummary } = {};
    data.forEach(item => {
        const date = item["Date Of Weighment"];
        if (!summary[date]) {
            summary[date] = {
                date,
                totalTrips: 0,
                totalNetWeight: 0,
                totalGrossWeight: 0,
                totalTareWeight: 0
            };
        }
        summary[date].totalTrips += 1;
        summary[date].totalNetWeight += item["Net Weight (Kg)"];
        summary[date].totalGrossWeight += item["Gross Weight (Kg)"];
        summary[date].totalTareWeight += item["Tare Weight (Kg)"];
    });

    return Object.values(summary).sort((a,b) => {
        const dateA = a.date.split('/').reverse().join('-');
        const dateB = b.date.split('/').reverse().join('-');
        return dateB.localeCompare(dateA);
    });
  }, [data]);

  const stats = useMemo(() => {
    const totalNetWeight = data.reduce((acc, curr) => acc + curr["Net Weight (Kg)"], 0);
    const totalTransactions = data.length;
    const uniqueVehicles = new Set(data.map(d => d["Vehicle Number"])).size;
    const avgWeightPerTrip = totalTransactions > 0 ? totalNetWeight / totalTransactions : 0;

    return {
      totalNetWeight: (totalNetWeight / 1000).toFixed(2), // In Tons
      totalTransactions,
      uniqueVehicles,
      avgWeightPerTrip: avgWeightPerTrip.toFixed(2)
    };
  }, [data]);

  const chartData = useMemo(() => {
    return dateWiseSummary.slice(0, 7).reverse().map(s => ({
        date: s.date,
        weight: parseFloat((s.totalNetWeight / 1000).toFixed(2))
    }));
  }, [dateWiseSummary]);

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      "S.No.": item["S.No."],
      "Zone Name": item["Zone Name"],
      "Ward Name": item["Ward Name"],
      "Vehicle Number": item["Vehicle Number"],
      "Gross Weight (Kg)": item["Gross Weight (Kg)"],
      "Tare Weight (Kg)": item["Tare Weight (Kg)"],
      "Net Weight (Kg)": item["Net Weight (Kg)"],
      "Content Type": item["Content Type"],
      "Date Of Weighment": item["Date Of Weighment"],
      "Receipt Number": item["Receipt Number"],
      "Vehicle Type": item["Vehicle Type"],
      "Weighbridge Party Name": item["Weighbridge Party Name"],
      "Date of Entry": item["Date of Entry"],
      "Time of Entry": item["Time of Entry"],
      "Driver Name": item["Driver Name"],
      "Driver Mobile Number": item["Driver Mobile Number"],
      "Supervisor Name": item["Supervisor Name"],
      "Supervisor Display ID": item["Supervisor Display ID"],
      "Supervisor Contact Number": item["Supervisor Contact Number"],
      "Zone In-Charge Name": item["Zone In-Charge Name"],
      "In Date": item["In Date"],
      "In Time": item["In Time"],
      "Out Date": item["Out Date"],
      "Out Time": item["Out Time"]
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MSW Transactions");

    // Build filename from actual weighment dates
    const weighmentDates = [...new Set(filteredData.map(d => d["Date Of Weighment"]).filter(d => d && d !== "NA"))];
    let dateStr = "";
    if (weighmentDates.length === 1) {
      dateStr = weighmentDates[0].replace(/\//g, "-");
    } else if (weighmentDates.length > 1) {
      dateStr = `${weighmentDates[0].replace(/\//g, "-")}_to_${weighmentDates[weighmentDates.length - 1].replace(/\//g, "-")}`;
    } else {
      dateStr = new Date().toISOString().split('T')[0];
    }
    XLSX.writeFile(wb, `MSW_Report_${dateStr}.xlsx`);
  };

  const handleReset = () => {
    setData([]);
    setSearchTerm('');
    setDateFilter('');
    setVehicleFilter('All');
    setWasteTypeFilter('All');
    // Reset the file input so the same file can be re-uploaded
    const fileInput = document.getElementById('msw-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    try {
      const imgData = await toPng(reportRef.current, { backgroundColor: '#f9fafb' });
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape for weighment report
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      const weighmentDates = [...new Set(filteredData.map(d => d["Date Of Weighment"]).filter(d => d && d !== "NA"))];
      let pdfDateStr = "";
      if (weighmentDates.length === 1) {
        pdfDateStr = weighmentDates[0].replace(/\//g, "-");
      } else if (weighmentDates.length > 1) {
        pdfDateStr = `${weighmentDates[0].replace(/\//g, "-")}_to_${weighmentDates[weighmentDates.length - 1].replace(/\//g, "-")}`;
      } else {
        pdfDateStr = new Date().toISOString().split('T')[0];
      }
      pdf.save(`MSW_Analysis_${pdfDateStr}.pdf`);
    } catch (error) {
      console.error("PDF export failed", error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xl font-bold text-gray-700 animate-pulse">Processing Weight scaling data...</p>
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
              <Weight className="text-blue-600 w-8 h-8" />
              MSW DATE WISE TONNAGE ANALYSIS
            </h1>
            <p className="text-sm font-semibold text-gray-500 tracking-wider uppercase">Mathura-Vrindavan Nagar Nigam</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <img src={NatureGreenLogo} alt="NG" className="h-16 w-auto drop-shadow-sm transition-transform hover:scale-105" />
        </div>
      </div>

      <div className="container mx-auto px-4 mt-8 max-w-[1600px]">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-gray-100 shadow-sm">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <Upload className="text-blue-600 w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2 uppercase">MSW Data Processor</h2>
            <p className="text-slate-500 font-bold mb-10 max-w-md text-center px-4 uppercase tracking-widest text-[10px] leading-relaxed">
              Upload the <span className="text-blue-600">Weight Scaling Software</span> Excel file to generate <br/> 
              Date-wise tonnage, vehicle-wise stats, and consolidated MSW reports.
            </p>
            
            <div className="relative">
              <input
                type="file"
                accept=".xlsx, .xls"
                id="msw-upload"
                className="hidden"
                onChange={handleFileUpload}
              />
              <label 
                htmlFor="msw-upload"
                className="flex items-center gap-3 px-12 py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-3xl shadow-2xl shadow-blue-200 transition-all active:scale-95 cursor-pointer text-lg tracking-[0.2em] uppercase"
              >
                <Upload className="w-6 h-6" /> UPLOAD TRANSACTION
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
                  <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                    <Weight className="text-blue-600 w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Net Weight</p>
                  <h3 className="text-3xl font-black text-gray-900 mt-1">{stats.totalNetWeight} <span className="text-sm font-bold text-blue-600">TONS</span></h3>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                    <Truck className="text-emerald-600 w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total Trips</p>
                  <h3 className="text-3xl font-black text-emerald-600 mt-1">{stats.totalTransactions}</h3>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
                    <BarChart3 className="text-amber-600 w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Avg Trip weight</p>
                  <h3 className="text-3xl font-black text-amber-600 mt-1">{stats.avgWeightPerTrip} <span className="text-sm">KG</span></h3>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-all group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4">
                    <TrendingUp className="text-indigo-600 w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Active Vehicles</p>
                  <h3 className="text-3xl font-black text-indigo-600 mt-1">{stats.uniqueVehicles}</h3>
                </div>
              </div>
            </div>

            {/* Date Wise Table Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
              <div className="lg:col-span-1 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col">
                <h4 className="text-lg font-black text-gray-900 flex items-center gap-2 mb-6">
                    <CalendarDays className="text-blue-500 w-5 h-5" />
                    DATE WISE SUMMARY
                </h4>
                <div className="flex-1 overflow-y-auto max-h-[400px]">
                    <table className="w-full text-sm text-left">
                        <thead className="sticky top-0 bg-white shadow-sm">
                            <tr className="border-b border-gray-100">
                                <th className="py-3 px-2 font-black text-gray-400 uppercase text-[10px]">Date</th>
                                <th className="py-3 px-2 font-black text-gray-400 uppercase text-[10px] text-center">Trips</th>
                                <th className="py-3 px-2 font-black text-gray-400 uppercase text-[10px] text-right">Net Wt (Ton)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {dateWiseSummary.map((s, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-3 px-2 font-bold text-gray-900">{s.date}</td>
                                    <td className="py-3 px-2 font-black text-blue-600 text-center">{s.totalTrips}</td>
                                    <td className="py-3 px-2 font-black text-gray-900 text-right">{(s.totalNetWeight / 1000).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              </div>

              <div className="lg:col-span-2 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
                <h4 className="text-lg font-black text-gray-900 flex items-center gap-2 mb-6">
                    <TrendingUp className="text-blue-500 w-5 h-5" />
                    TONNAGE TREND (LAST 7 DAYS)
                </h4>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 800}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 800}} />
                      <Tooltip 
                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                        cursor={{fill: '#f8fafc'}}
                      />
                      <Bar dataKey="weight" radius={[8, 8, 0, 0]} barSize={40}>
                         {chartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#60a5fa'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Detailed Transaction Log */}
            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden" ref={reportRef}>
              <div className="p-8 border-b border-gray-100 bg-white">
                <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                  <div>
                    <h4 className="text-2xl font-black text-gray-900 tracking-tight">DETAILED WEIGHMENT LOG</h4>
                    <p className="text-slate-500 font-semibold text-sm mt-1 uppercase tracking-widest text-[10px]">
                        As per format: {filteredData.length} entries processed
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button 
                      onClick={handleExportExcel}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95"
                    >
                      <Download className="w-4 h-4" /> EXCEL
                    </button>
                    <button 
                      onClick={handleExportPDF}
                      className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95"
                    >
                      <FileDown className="w-4 h-4" /> PDF
                    </button>
                    <button 
                      onClick={handleReset}
                      className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-lg transition-all active:scale-95"
                    >
                      <RotateCcw className="w-4 h-4" /> RESET
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <div className="relative lg:col-span-2">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="Search Vehicle or Receipt..." 
                      className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="date" 
                      className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 text-sm"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select 
                      className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 appearance-none text-sm"
                      value={wasteTypeFilter}
                      onChange={(e) => setWasteTypeFilter(e.target.value)}
                    >
                      <option value="All">All Waste Types</option>
                      {Array.from(new Set(data.map(d => d["Content Type"]))).filter(Boolean).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                   <div className="relative">
                    <Truck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <select 
                      className="w-full pl-11 pr-4 py-3 bg-white rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 appearance-none text-sm"
                      value={vehicleFilter}
                      onChange={(e) => setVehicleFilter(e.target.value)}
                    >
                      <option value="All">All Vehicles</option>
                      {Array.from(new Set(data.map(d => d["Vehicle Number"]))).filter(Boolean).map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <button 
                    onClick={() => {setSearchTerm(''); setDateFilter(''); setVehicleFilter('All'); setWasteTypeFilter('All');}}
                    className="py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-black rounded-2xl transition-all active:scale-95 text-xs uppercase tracking-widest"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[2200px]">
                  <thead>
                    <tr className="bg-[#0f172a] text-white">
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">S.No.</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Zone Name</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Ward Name</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Vehicle Number</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap bg-emerald-900">Gross Weight (Kg)</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap bg-amber-900">Tare Weight (Kg)</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap bg-blue-900">Net Weight (Kg)</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Content Type</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Date Of Weighment</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Receipt Number</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Vehicle Type</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Weighbridge Party</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Date of Entry</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Time of Entry</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Driver Name</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Driver Mobile</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Supervisor Name</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Supervisor ID</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Supervisor Contact</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Zone In-Charge</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">In Date</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">In Time</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center border-r border-slate-700 whitespace-nowrap">Out Date</th>
                      <th className="px-3 py-4 text-[10px] font-black uppercase text-center whitespace-nowrap">Out Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.map((item, idx) => (
                      <tr key={idx} className={`hover:bg-blue-50/50 transition-colors group ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}>
                        <td className="px-3 py-3 text-[11px] font-bold text-center border-r border-slate-100">{item["S.No."]}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-center border-r border-slate-100 text-slate-700">{item["Zone Name"]}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-center border-r border-slate-100 text-slate-700">{item["Ward Name"]}</td>
                        <td className="px-3 py-3 text-[11px] font-black text-center border-r border-slate-100 text-slate-900">{item["Vehicle Number"]}</td>
                        <td className="px-3 py-3 text-[11px] font-bold text-center border-r border-slate-100 text-emerald-700 bg-emerald-50/30">{item["Gross Weight (Kg)"]}</td>
                        <td className="px-3 py-3 text-[11px] font-bold text-center border-r border-slate-100 text-amber-700 bg-amber-50/30">{item["Tare Weight (Kg)"]}</td>
                        <td className="px-3 py-3 text-[12px] font-black text-center border-r border-slate-100 text-blue-800 bg-blue-50/30">{item["Net Weight (Kg)"]}</td>
                        <td className="px-3 py-3 text-[11px] text-center border-r border-slate-100">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-black text-[9px] uppercase border border-indigo-100">
                            {item["Content Type"]}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[11px] font-bold text-center border-r border-slate-100 text-slate-800">{item["Date Of Weighment"]}</td>
                        <td className="px-3 py-3 text-[11px] font-black text-center border-r border-slate-100 text-blue-900">{item["Receipt Number"]}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-center border-r border-slate-100 text-slate-600">{item["Vehicle Type"]}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-center border-r border-slate-100 text-slate-600">{item["Weighbridge Party Name"]}</td>
                        <td className="px-3 py-3 text-[11px] font-bold text-center border-r border-slate-100 text-slate-700">{item["Date of Entry"]}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-center border-r border-slate-100 text-slate-500">{item["Time of Entry"]}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-center border-r border-slate-100 text-slate-700">{item["Driver Name"]}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-center border-r border-slate-100 text-slate-500">{item["Driver Mobile Number"]}</td>
                        <td className="px-3 py-3 text-[11px] font-black text-center border-r border-slate-100 text-slate-900">{item["Supervisor Name"]}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-center border-r border-slate-100 text-slate-500">{item["Supervisor Display ID"]}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-center border-r border-slate-100 text-slate-500">{item["Supervisor Contact Number"]}</td>
                        <td className="px-3 py-3 text-[11px] font-bold text-center border-r border-slate-100 text-slate-800">{item["Zone In-Charge Name"]}</td>
                        <td className="px-3 py-3 text-[11px] font-bold text-center border-r border-slate-100 text-slate-700">{item["In Date"]}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-center border-r border-slate-100 text-slate-500">{item["In Time"]}</td>
                        <td className="px-3 py-3 text-[11px] font-bold text-center border-r border-slate-100 text-slate-700">{item["Out Date"]}</td>
                        <td className="px-3 py-3 text-[11px] font-semibold text-center text-slate-500">{item["Out Time"]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredData.length > 100 && (
                    <div className="p-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50">
                        Top 100 records shown. Use filters or export for full data.
                    </div>
                )}
              </div>
            </div>

            {/* Branding Footer */}
            <div className="mt-12 text-center pb-8 border-t border-gray-200 pt-8">
                <div className="inline-flex items-center gap-6 opacity-40">
                  <img src={NagarNigamLogo} alt="Logo" className="h-10 grayscale" />
                  <div className="h-6 w-px bg-gray-300"></div>
                  <div className="text-left">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Mathura Vrindavan</p>
                    <p className="text-sm font-black text-gray-600 tracking-tighter">MSW Reporting Gateway</p>
                  </div>
                </div>
                <p className="mt-8 text-[9px] font-black text-gray-300 uppercase tracking-[0.5em]">Powered by Nature Green v2.0</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MSWDateWiseReport;
