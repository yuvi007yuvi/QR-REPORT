import React, { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  Download, 
  Upload, 
  Search, 
  Filter, 
  LayoutGrid,
  FileSpreadsheet,
  Users, 
  MapPin, 
  CheckCircle2, 
  ArrowUpRight,
  Table
} from 'lucide-react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import supervisorDataFallback from '../data/supervisorData.json';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
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
  const [pdfExporting, setPdfExporting] = useState(false);
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
    if (rawCsvContent) {
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
            String(m.wardNumber) === String(wardNumPrefix) ||
            String(m.wardNo) === String(wardNumPrefix) ||
            m.area?.toLowerCase().trim() === cleanWardName ||
            (m.area && cleanWardName && (m.area.toLowerCase().includes(cleanWardName) || cleanWardName.includes(m.area.toLowerCase())))
          );

          // Fallback to static JSON if not found in Firestore
          if (!mapping) {
            mapping = supervisorDataFallback.find(s => 
              String(s['Ward No']) === String(wardNumPrefix) ||
              s['Ward Name'].toLowerCase() === cleanWardName?.toLowerCase()
            );
          }

          let supervisor = mapping ? (mapping.supervisorName || mapping.Supervisor || 'Unknown') : 'Unknown';
          let zonalHead = mapping ? (mapping.zonalName || mapping['Zonal Head'] || 'Unknown') : 'Unknown';

          // Handle multiple supervisors if present (comma separated)
          if (supervisor !== 'Unknown' && supervisor.includes(',')) {
            const parts = supervisor.split(',').map((s: string) => s.trim());
            // Prioritize C&T if multiple exist, else take the first one
            const ctParts = parts.filter((p: string) => p.toLowerCase().includes('(c&t)'));
            supervisor = ctParts.length > 0 ? ctParts.join(', ') : parts[0];
          }

          return {
            ...row,
            supervisor,
            zonalHead
          };
        })
        // Removed strict (c&t) filter to allow custom mapped supervisors to show up
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
    setPdfExporting(true);
    try {
      // Give the UI a moment to settle
      await new Promise(resolve => setTimeout(resolve, 500));

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      let currentY = margin;

      // 1. Capture Header/Letterhead
      const headerEl = reportRef.current.querySelector('.relative.overflow-hidden.rounded-\\[2\\.5rem\\]') as HTMLElement;
      if (headerEl) {
        const dataUrl = await toPng(headerEl, { pixelRatio: 2, backgroundColor: '#ffffff' });
        const imgProps = pdf.getImageProperties(dataUrl);
        const imgWidth = pdfWidth - (margin * 2);
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        
        pdf.addImage(dataUrl, 'PNG', margin, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 10;
      }

      // 2. Capture Content based on viewMode
      if (viewMode === 'supervisor') {
        const blocks = Array.from(reportRef.current.querySelectorAll('.border.border-black.rounded-xl')) as HTMLElement[];
        
        for (const block of blocks) {
          const blockHeader = block.querySelector('.bg-slate-900') as HTMLElement;
          const table = block.querySelector('table') as HTMLElement;

          if (blockHeader && table) {
            // Capture Header first
            const headerUrl = await toPng(blockHeader, { pixelRatio: 2, backgroundColor: '#0f172a' });
            const hProps = pdf.getImageProperties(headerUrl);
            const hWidth = pdfWidth - (margin * 2);
            const hHeight = (hProps.height * hWidth) / hProps.width;

            if (currentY + hHeight > pdfHeight - margin) {
              pdf.addPage();
              currentY = margin;
            }
            pdf.addImage(headerUrl, 'PNG', margin, currentY, hWidth, hHeight);
            currentY += hHeight;

            // Now Chunk the Table
            const rows = Array.from(table.querySelectorAll('tbody tr')) as HTMLElement[];
            const tableHeader = table.querySelector('thead') as HTMLElement;
            const chunkSize = 15;

            for (let i = 0; i < rows.length; i += chunkSize) {
              const tempContainer = document.createElement('div');
              tempContainer.style.position = 'absolute';
              tempContainer.style.left = '-9999px';
              tempContainer.style.width = table.offsetWidth + 'px';
              tempContainer.style.backgroundColor = '#ffffff';
              document.body.appendChild(tempContainer);

              const tempTable = document.createElement('table');
              tempTable.className = table.className;
              tempTable.style.width = '100%';
              tempTable.style.borderCollapse = 'collapse';
              tempTable.style.border = '1px solid black';
              
              const tempHeader = tableHeader.cloneNode(true) as HTMLElement;
              tempTable.appendChild(tempHeader);

              const tempBody = document.createElement('tbody');
              rows.slice(i, i + chunkSize).forEach(row => {
                const clonedRow = row.cloneNode(true) as HTMLElement;
                // Ensure styles are preserved for the clone
                tempBody.appendChild(clonedRow);
              });
              tempTable.appendChild(tempBody);
              tempContainer.appendChild(tempTable);

              const dataUrl = await toPng(tempContainer, { pixelRatio: 2, backgroundColor: '#ffffff' });
              const imgProps = pdf.getImageProperties(dataUrl);
              const imgWidth = pdfWidth - (margin * 2);
              const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

              if (currentY + imgHeight > pdfHeight - margin) {
                pdf.addPage();
                currentY = margin;
                // If we started a new page, maybe repeat the supervisor header? 
                // For now just continue to keep it simple and clean
              }

              pdf.addImage(dataUrl, 'PNG', margin, currentY, imgWidth, imgHeight);
              currentY += imgHeight;

              document.body.removeChild(tempContainer);
            }
            currentY += 5; // Gap between blocks
          } else {
            // Fallback for simple blocks
            const dataUrl = await toPng(block, { pixelRatio: 2, backgroundColor: '#ffffff' });
            const imgProps = pdf.getImageProperties(dataUrl);
            const imgWidth = pdfWidth - (margin * 2);
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

            if (currentY + imgHeight > pdfHeight - margin) {
              pdf.addPage();
              currentY = margin;
            }

            pdf.addImage(dataUrl, 'PNG', margin, currentY, imgWidth, imgHeight);
            currentY += imgHeight + 5;
          }
        }
      } else {
        // Detailed mode - One big table.
        const table = reportRef.current.querySelector('table') as HTMLElement;
        if (table) {
          const rows = Array.from(table.querySelectorAll('tbody tr')) as HTMLElement[];
          const header = table.querySelector('thead') as HTMLElement;
          const chunkSize = 20;

          for (let i = 0; i < rows.length; i += chunkSize) {
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-9999px';
            tempContainer.style.width = table.offsetWidth + 'px';
            tempContainer.style.backgroundColor = '#ffffff';
            document.body.appendChild(tempContainer);

            const tempTable = document.createElement('table');
            tempTable.className = table.className;
            tempTable.style.width = '100%';
            tempTable.style.borderCollapse = 'collapse';
            tempTable.style.border = '1px solid black';
            
            const tempHeader = header.cloneNode(true) as HTMLElement;
            tempTable.appendChild(tempHeader);

            const tempBody = document.createElement('tbody');
            rows.slice(i, i + chunkSize).forEach(row => {
              tempBody.appendChild(row.cloneNode(true));
            });
            tempTable.appendChild(tempBody);
            tempContainer.appendChild(tempTable);

            const dataUrl = await toPng(tempContainer, { pixelRatio: 2, backgroundColor: '#ffffff' });
            const imgProps = pdf.getImageProperties(dataUrl);
            const imgWidth = pdfWidth - (margin * 2);
            const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

            if (currentY + imgHeight > pdfHeight - margin) {
              pdf.addPage();
              currentY = margin;
            }

            pdf.addImage(dataUrl, 'PNG', margin, currentY, imgWidth, imgHeight);
            currentY += imgHeight;

            document.body.removeChild(tempContainer);
          }
        }
      }

      // Add branding footer to the last page if there's room, or new page
      const footerEl = reportRef.current.querySelector('.mt-12.mb-6.text-center') as HTMLElement;
      if (footerEl) {
        const dataUrl = await toPng(footerEl, { pixelRatio: 2, backgroundColor: '#ffffff' });
        const imgProps = pdf.getImageProperties(dataUrl);
        const imgWidth = pdfWidth - (margin * 2);
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

        if (currentY + imgHeight > pdfHeight - margin) {
          pdf.addPage();
          currentY = margin;
        }
        pdf.addImage(dataUrl, 'PNG', margin, currentY, imgWidth, imgHeight);
      }

      pdf.save(`Door-to-Door-Report-${new Date().toLocaleDateString()}.pdf`);
    } catch (error) {
      console.error('PDF generation failed:', error);
    } finally {
      setPdfExporting(false);
    }
  };

  const [tableOnlyExporting, setTableOnlyExporting] = useState(false);

  const handleExportTableOnly = async () => {
    if (!reportRef.current) return;
    setTableOnlyExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      let currentY = margin;

      // Capture Header (Logos + Basic Title)
      const headerSection = reportRef.current.querySelector('.relative.z-10') as HTMLElement;
      if (headerSection) {
        const dataUrl = await toPng(headerSection, { pixelRatio: 2, backgroundColor: '#ffffff' });
        const imgProps = pdf.getImageProperties(dataUrl);
        const imgWidth = pdfWidth - (margin * 2);
        const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
        pdf.addImage(dataUrl, 'PNG', margin, currentY, imgWidth, imgHeight);
        currentY += imgHeight + 10;
      }

      // Add a simple subtitle
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Detailed Coverage Table Only', margin, currentY);
      currentY += 8;

      // Find all tables (either main detailed or supervisor blocks)
      const tables = Array.from(reportRef.current.querySelectorAll('table')) as HTMLElement[];
      
      for (const table of tables) {
        // If it's supervisor view, try to capture the supervisor name header
        const blockHeader = table.closest('.border.border-black.rounded-xl')?.querySelector('.bg-slate-900') as HTMLElement;
        if (blockHeader) {
          const headerUrl = await toPng(blockHeader, { pixelRatio: 2, backgroundColor: '#0f172a' });
          const hProps = pdf.getImageProperties(headerUrl);
          const hWidth = pdfWidth - (margin * 2);
          const hHeight = (hProps.height * hWidth) / hProps.width;

          if (currentY + hHeight > pdfHeight - margin) {
            pdf.addPage();
            currentY = margin;
          }
          pdf.addImage(headerUrl, 'PNG', margin, currentY, hWidth, hHeight);
          currentY += hHeight;
        }

        // Chunk rendering for the table
        const rows = Array.from(table.querySelectorAll('tbody tr')) as HTMLElement[];
        const tableHeader = table.querySelector('thead') as HTMLElement;
        const chunkSize = 20;

        for (let i = 0; i < rows.length; i += chunkSize) {
          const tempContainer = document.createElement('div');
          tempContainer.style.position = 'absolute';
          tempContainer.style.left = '-9999px';
          tempContainer.style.width = table.offsetWidth + 'px';
          tempContainer.style.backgroundColor = '#ffffff';
          document.body.appendChild(tempContainer);

          const tempTable = document.createElement('table');
          tempTable.className = table.className;
          tempTable.style.width = '100%';
          tempTable.style.borderCollapse = 'collapse';
          tempTable.style.border = '1px solid black';
          
          const tempHeader = tableHeader.cloneNode(true) as HTMLElement;
          tempTable.appendChild(tempHeader);

          const tempBody = document.createElement('tbody');
          rows.slice(i, i + chunkSize).forEach(row => {
            tempBody.appendChild(row.cloneNode(true));
          });
          tempTable.appendChild(tempBody);
          tempContainer.appendChild(tempTable);

          const dataUrl = await toPng(tempTable, { pixelRatio: 2, backgroundColor: '#ffffff' });
          const imgProps = pdf.getImageProperties(dataUrl);
          const imgWidth = pdfWidth - (margin * 2);
          const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

          if (currentY + imgHeight > pdfHeight - margin) {
            pdf.addPage();
            currentY = margin;
          }
          pdf.addImage(dataUrl, 'PNG', margin, currentY, imgWidth, imgHeight);
          currentY += imgHeight;

          document.body.removeChild(tempContainer);
        }
        currentY += 10;
      }

      pdf.save(`Coverage_Table_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
    } catch (err) {
      console.error('Table export failed:', err);
    } finally {
      setTableOnlyExporting(false);
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
      {/* Top Header Section - Premium Dashboard Style */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              System Live
            </div>
            <span className="text-slate-300 text-xs font-bold">|</span>
            <span className="text-slate-400 text-xs font-bold">
              {data.length > 0 && data[0].Date ? 
                (() => {
                  const d = data[0].Date;
                  const dateObj = new Date(d);
                  if (!isNaN(dateObj.getTime())) {
                    const day = dateObj.getDate().toString().padStart(2, '0');
                    const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                    const year = dateObj.getFullYear();
                    return `${day} / ${month} / ${year}`;
                  }
                  return d;
                })() : 
                (() => {
                  const now = new Date();
                  const day = now.getDate().toString().padStart(2, '0');
                  const month = (now.getMonth() + 1).toString().padStart(2, '0');
                  const year = now.getFullYear();
                  return `${day} / ${month} / ${year}`;
                })()
              }
            </span>
          </div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <div className="p-2 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-200">
              <LayoutGrid size={28} />
            </div>
            Door to Door Coverage
          </h2>
          <p className="text-slate-500 text-sm mt-3 font-medium max-w-md leading-relaxed">
            Comprehensive real-time analysis of waste collection efficiency across all zones and wards of Mathura-Vrindavan.
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-[2rem] border border-slate-100 shadow-inner">
          <label className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-[1.5rem] text-slate-700 hover:bg-slate-50 transition-all shadow-sm font-black text-xs cursor-pointer uppercase tracking-wider group">
            <Upload size={16} className="text-blue-500 group-hover:scale-110 transition-transform" />
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
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-[1.5rem] text-slate-700 hover:bg-slate-50 transition-all shadow-sm font-black text-xs uppercase tracking-wider group"
          >
            <FileSpreadsheet size={16} className="text-emerald-500 group-hover:scale-110 transition-transform" />
            Export Excel
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-[1.5rem] hover:bg-black transition-all shadow-xl shadow-slate-200 font-black text-xs uppercase tracking-widest group"
            disabled={pdfExporting}
          >
            {pdfExporting ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />
            )}
            {pdfExporting ? 'Generating...' : 'Full Report'}
          </button>

          <button 
            onClick={handleExportTableOnly}
            className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-[1.5rem] hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 font-black text-xs uppercase tracking-widest group"
            disabled={tableOnlyExporting}
          >
            {tableOnlyExporting ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Table size={16} className="group-hover:scale-110 transition-transform" />
            )}
            {tableOnlyExporting ? 'Processing...' : 'Table Only'}
          </button>
        </div>
      </div>

      {/* KPI Cards - Premium Dashboard Style */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Routes', value: stats.totalRoutes, icon: MapPin, color: 'blue', bg: 'bg-blue-50', text: 'text-blue-600' },
          { label: 'Avg Coverage', value: `${stats.avgCoverage}%`, icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600' },
          { label: 'Total POI', value: stats.totalTotal, icon: Users, color: 'indigo', bg: 'bg-indigo-50', text: 'text-indigo-600' },
          { label: 'Scanned POI', value: stats.totalCovered, icon: CheckCircle2, color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-600' },
          { label: 'Efficiency', value: `${stats.efficiency}%`, icon: ArrowUpRight, color: 'orange', bg: 'bg-orange-50', text: 'text-orange-600' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2.5 rounded-2xl ${kpi.bg} ${kpi.text} group-hover:scale-110 transition-transform`}>
                <kpi.icon size={22} />
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.15em]">Live</span>
                <div className={`w-1.5 h-1.5 rounded-full ${kpi.color === 'emerald' ? 'bg-emerald-500' : 'bg-blue-500'} animate-pulse`} />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-800 tracking-tight">{kpi.value}</div>
            <div className="text-[11px] text-slate-500 mt-1 font-bold uppercase tracking-wide">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Filters Section - Premium Segmented Controls */}
      <div className="bg-white p-3 rounded-[1.5rem] border border-slate-100 shadow-sm flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[280px] group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search ward, vehicle or route..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50/50 border border-transparent rounded-2xl text-sm focus:bg-white focus:border-emerald-100 focus:ring-4 focus:ring-emerald-500/5 transition-all outline-none font-medium placeholder:text-slate-400"
          />
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-2">
            <Filter size={14} className="text-slate-400" />
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Filters</span>
          </div>
          
          <div className="flex items-center gap-2">
            <select 
              value={selectedZonal}
              onChange={(e) => {
                setSelectedZonal(e.target.value);
                setSelectedSupervisor('All');
              }}
              className="pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-600 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20fill%3D%27none%27%20viewBox%3D%270%200%2020%2020%27%3E%3Cpath%20stroke%3D%27%2364748b%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%20stroke-width%3D%271.5%27%20d%3D%27m6%208%204%204%204-4%27%2F%3E%3C%2Fsvg%3E')] bg-[length:20px_20px] bg-[right_8px_center] bg-no-repeat"
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
              className="pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-600 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20fill%3D%27none%27%20viewBox%3D%270%200%2020%2020%27%3E%3Cpath%20stroke%3D%27%2364748b%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%20stroke-width%3D%271.5%27%20d%3D%27m6%208%204%204%204-4%27%2F%3E%3C%2Fsvg%3E')] bg-[length:20px_20px] bg-[right_8px_center] bg-no-repeat"
            >
              <option value="All">All Supervisors</option>
              {supervisors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            <select 
              value={selectedWard}
              onChange={(e) => setSelectedWard(e.target.value)}
              className="pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-black text-slate-600 outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20fill%3D%27none%27%20viewBox%3D%270%200%2020%2020%27%3E%3Cpath%20stroke%3D%27%2364748b%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%20stroke-width%3D%271.5%27%20d%3D%27m6%208%204%204%204-4%27%2F%3E%3C%2Fsvg%3E')] bg-[length:20px_20px] bg-[right_8px_center] bg-no-repeat"
            >
              <option value="All">All Wards</option>
              {wards.filter(w => w !== 'All').map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
        </div>

        <div className="h-8 w-[1px] bg-slate-100 mx-2 hidden xl:block" />

        <div className="flex bg-slate-100/80 p-1 rounded-2xl">
          <button
            onClick={() => setViewMode('detailed')}
            className={`px-6 py-2 rounded-[0.9rem] text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
              viewMode === 'detailed' 
                ? 'bg-white text-emerald-600 shadow-md scale-[1.02]' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Route Wise
          </button>
          <button
            onClick={() => setViewMode('supervisor')}
            className={`px-6 py-2 rounded-[0.9rem] text-[11px] font-black uppercase tracking-wider transition-all duration-300 ${
              viewMode === 'supervisor' 
                ? 'bg-white text-emerald-600 shadow-md scale-[1.02]' 
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

              {/* Structured Grid for Head Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {zonalStats.map((head) => {
                    const percentage = Math.round((head.covered / head.total) * 1000) / 10;

                    return (
                        <div key={head.name} className="bg-[#f8fafc] rounded-[2.5rem] p-6 shadow-sm border border-slate-100 flex flex-col items-center transition-all hover:shadow-xl hover:bg-white group">
                            {/* Donut Chart with Progress Shadow */}
                            <div className="relative w-32 h-32 mb-6">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Scanned', value: head.covered },
                                                { name: 'Not Scanned', value: Math.max(0, head.total - head.covered) }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={42}
                                            outerRadius={56}
                                            paddingAngle={0}
                                            dataKey="value"
                                            stroke="none"
                                            startAngle={90}
                                            endAngle={450}
                                        >
                                            <Cell fill="#10b981" /> {/* Covered - Emerald */}
                                            <Cell fill="#f43f5e" /> {/* Left - Rose */}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Center Percentage Overlay */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-lg font-black text-slate-800 leading-none">
                                        {percentage}%
                                    </span>
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Coverage</span>
                                </div>
                            </div>

                            {/* Head Info with High Contrast */}
                            <div className="w-full text-center">
                                <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-widest mb-3 line-clamp-1">
                                    {head.name}
                                </h3>
                                
                                <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-sm flex justify-between items-center mb-4">
                                    <div className="flex flex-col items-start">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Covered</span>
                                        <span className="text-sm font-black text-emerald-600 leading-none">{head.covered}</span>
                                    </div>
                                    <div className="w-[1px] h-6 bg-slate-100"></div>
                                    <div className="flex flex-col items-end">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Total POI</span>
                                        <span className="text-sm font-black text-slate-700 leading-none">{head.total}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Refined Legend */}
                            <div className="flex items-center gap-4 mt-auto">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-sm shadow-emerald-200"></div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Done</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-[#f43f5e] shadow-sm shadow-rose-200"></div>
                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">Pending</span>
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
        <div ref={reportRef} className="space-y-8 bg-white p-12 rounded-[3rem] shadow-2xl">
          {/* Professional Municipal Letterhead */}
          <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-100 bg-slate-50/50 p-12 mb-10">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-emerald-100/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-12 border-b border-slate-200 pb-10">
                <img src={nagarNigamLogo} alt="Logo" className="h-24 w-auto object-contain" />
                <div className="text-right">
                  <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-2">
                    Operational Performance
                  </h1>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs font-black text-emerald-600 uppercase tracking-[0.3em]">
                      Nagar Nigam Mathura-Vrindavan
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Report Generated: {new Date().toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center text-center max-w-3xl mx-auto">
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight mb-8 px-8 py-3 bg-white shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-100">
                  Door to Door Route Wise Coverage Report
                </h2>
                
                {fileName && (
                  <div className="flex flex-wrap justify-center gap-4 w-full">
                    {selectedZonal !== 'All' && (
                      <div className="px-6 py-2.5 bg-slate-900 rounded-2xl shadow-lg shadow-slate-200">
                        <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Zonal Head</span>
                        <span className="text-xs font-black text-white uppercase">{selectedZonal}</span>
                      </div>
                    )}
                    {selectedSupervisor !== 'All' && (
                      <div className="px-6 py-2.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-100">
                        <span className="block text-[8px] font-black text-blue-200 uppercase tracking-widest mb-0.5">Supervisor</span>
                        <span className="text-xs font-black text-white uppercase">{selectedSupervisor}</span>
                      </div>
                    )}
                    {selectedWard !== 'All' && (
                      <div className="px-6 py-2.5 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-100">
                        <span className="block text-[8px] font-black text-emerald-200 uppercase tracking-widest mb-0.5">Ward No.</span>
                        <span className="text-xs font-black text-white uppercase">{selectedWard}</span>
                      </div>
                    )}
                    <div className="px-6 py-2.5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                      <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Data Source</span>
                      <span className="text-xs font-black text-slate-600 truncate max-w-[150px]">{fileName}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

            <div className="p-8 border-b border-slate-50 bg-slate-50/10">
              {viewMode === 'detailed' ? (
                <div className="overflow-x-auto rounded-xl border border-black">
                  <table className="w-full border-collapse bg-white">
                    <thead>
                      <tr className="bg-slate-900">
                        <th style={{ border: '1px solid black' }} className="px-3 py-3 text-[11px] font-black text-white uppercase tracking-wider text-center w-12">S.No</th>
                        <th style={{ border: '1px solid black' }} className="px-4 py-3 text-[11px] font-black text-white uppercase tracking-wider text-left">Ward Name</th>
                        <th style={{ border: '1px solid black' }} className="px-4 py-3 text-[11px] font-black text-white uppercase tracking-wider text-left">Route Name</th>
                        <th style={{ border: '1px solid black' }} className="px-4 py-3 text-[11px] font-black text-white uppercase tracking-wider text-left">Supervisor / Head</th>
                        <th style={{ border: '1px solid black' }} className="px-4 py-3 text-[11px] font-black text-white uppercase tracking-wider text-left">Vehicle Info</th>
                        <th style={{ border: '1px solid black' }} className="px-4 py-3 text-[11px] font-black text-white uppercase tracking-wider text-center">Total POI</th>
                        <th style={{ border: '1px solid black' }} className="px-4 py-3 text-[11px] font-black text-white uppercase tracking-wider text-center">Scanned</th>
                        <th style={{ border: '1px solid black' }} className="px-4 py-3 text-[11px] font-black text-white uppercase tracking-wider text-center">Coverage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((row, index) => (
                        <tr key={index} className="hover:bg-slate-50 transition-colors group">
                          <td style={{ border: '1px solid black' }} className="px-3 py-2 text-center text-[11px] font-bold text-slate-900 group-hover:bg-slate-100/50">{index + 1}</td>
                          <td style={{ border: '1px solid black' }} className="px-4 py-2 text-[11px] font-black text-slate-900">{row['Ward Name']}</td>
                          <td style={{ border: '1px solid black' }} className="px-4 py-2 text-[11px] font-bold text-slate-700">{row['Route Name']}</td>
                          <td style={{ border: '1px solid black' }} className="px-4 py-2">
                            <div className="text-[11px] font-black text-blue-700">{row.supervisor}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase">{row.zonalHead}</div>
                          </td>
                          <td style={{ border: '1px solid black' }} className="px-4 py-2">
                            <div className="text-[11px] font-black text-slate-700">{row['Vehicle Number']}</div>
                            <div className="text-[9px] text-slate-400 font-bold">{row['Vehicle Type']}</div>
                          </td>
                          <td style={{ border: '1px solid black' }} className="px-4 py-2 text-center text-[12px] font-black text-slate-900 bg-slate-50/30">
                            {row.Total}
                          </td>
                          <td style={{ border: '1px solid black' }} className="px-4 py-2 text-center text-[12px] font-black text-emerald-600 bg-emerald-50/10">
                            {row.Covered}
                          </td>
                          <td style={{ border: '1px solid black' }} className="px-4 py-2 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-[12px] font-black ${
                                parseFloat(row.Coverage) >= 90 ? 'text-emerald-600' : 
                                parseFloat(row.Coverage) >= 70 ? 'text-orange-600' : 'text-rose-600'
                              }`}>{row.Coverage}%</span>
                              <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${
                                    parseFloat(row.Coverage) >= 90 ? 'bg-emerald-500' : 
                                    parseFloat(row.Coverage) >= 70 ? 'bg-orange-500' : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${row.Coverage}%` }}
                                />
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-6">
                  {supervisorSummary.map((summary, sIndex) => {
                    const supervisorRoutes = filteredData.filter(d => d.supervisor === summary.supervisor);
                    const supervisorCoverage = ((summary.covered / (summary.total || 1)) * 100).toFixed(1);
                    
                    return (
                      <div key={sIndex} className="border border-black rounded-xl overflow-hidden shadow-sm">
                        <div className="bg-slate-900 px-6 py-3 flex items-center justify-between border-b border-black">
                          <div className="flex items-center gap-8">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Supervisor</span>
                              <span className="text-sm font-black text-white">{summary.supervisor}</span>
                            </div>
                            <div className="w-[1px] h-8 bg-slate-700"></div>
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Zonal Head</span>
                              <span className="text-[11px] font-bold text-emerald-400 uppercase">{summary.zonalHead}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-10">
                            <div className="text-right">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total Routes</span>
                              <span className="text-sm font-black text-white">{summary.routes}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Overall Coverage</span>
                              <span className="text-lg font-black text-emerald-400">{supervisorCoverage}%</span>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse bg-white">
                            <thead>
                              <tr className="bg-slate-50 border-b border-black">
                                <th style={{ borderRight: '1px solid black' }} className="px-3 py-2 text-[10px] font-black text-slate-900 uppercase tracking-wider text-center w-12">S.No</th>
                                <th style={{ borderRight: '1px solid black' }} className="px-4 py-2 text-[10px] font-black text-slate-900 uppercase tracking-wider text-left">Ward Name</th>
                                <th style={{ borderRight: '1px solid black' }} className="px-4 py-2 text-[10px] font-black text-slate-900 uppercase tracking-wider text-left">Route Name</th>
                                <th style={{ borderRight: '1px solid black' }} className="px-4 py-2 text-[10px] font-black text-slate-900 uppercase tracking-wider text-left">Vehicle Info</th>
                                <th style={{ borderRight: '1px solid black' }} className="px-4 py-2 text-[10px] font-black text-slate-900 uppercase tracking-wider text-center">Total POI</th>
                                <th style={{ borderRight: '1px solid black' }} className="px-4 py-2 text-[10px] font-black text-slate-900 uppercase tracking-wider text-center">Scanned</th>
                                <th className="px-4 py-2 text-[10px] font-black text-slate-900 uppercase tracking-wider text-center">Coverage</th>
                              </tr>
                            </thead>
                            <tbody>
                              {supervisorRoutes.map((row, rIndex) => (
                                <tr key={rIndex} className="hover:bg-slate-50 border-b border-slate-200 last:border-b-0 group">
                                  <td style={{ borderRight: '1px solid black' }} className="px-3 py-1.5 text-center text-[10px] font-bold text-slate-900 group-hover:bg-slate-100/50">
                                    {rIndex + 1}
                                  </td>
                                  <td style={{ borderRight: '1px solid black' }} className="px-4 py-1.5 text-[11px] font-black text-slate-900">
                                    {row['Ward Name']}
                                  </td>
                                  <td style={{ borderRight: '1px solid black' }} className="px-4 py-1.5 text-[10px] font-bold text-slate-700">
                                    {row['Route Name']}
                                  </td>
                                  <td style={{ borderRight: '1px solid black' }} className="px-4 py-1.5">
                                    <div className="text-[10px] font-black text-slate-800">{row['Vehicle Number']}</div>
                                    <div className="text-[8px] text-slate-400 font-bold uppercase">{row['Vehicle Type']}</div>
                                  </td>
                                  <td style={{ borderRight: '1px solid black' }} className="px-4 py-1.5 text-center text-[11px] font-black text-slate-900 bg-slate-50/30">
                                    {row.Total}
                                  </td>
                                  <td style={{ borderRight: '1px solid black' }} className="px-4 py-1.5 text-center text-[11px] font-black text-emerald-600 bg-emerald-50/10">
                                    {row.Covered}
                                  </td>
                                  <td className="px-4 py-1.5 text-center">
                                    <span className={`text-[11px] font-black ${
                                      parseFloat(row.Coverage) >= 90 ? 'text-emerald-600' : 'text-rose-600'
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
