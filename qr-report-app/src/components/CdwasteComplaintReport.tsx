import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Download, FileDown, Eye, Users, Image as ImageIcon } from 'lucide-react';
import type { ComplaintRecord } from '../utils/csvParser';
import {
  parseCSV,
  filterCDWasteComplaints,
  getUniqueValues,
} from '../utils/csvParser';

import { MASTER_SUPERVISORS } from '../data/master-supervisors';

// Import logos
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';

// For Excel export
import * as XLSX from 'xlsx';

// For PDF export
import jsPDF from 'jspdf';
import { toPng, toJpeg } from 'html-to-image';

const CDWasteComplaintReport: React.FC = () => {
  const [complaintData, setComplaintData] = useState<ComplaintRecord[]>([]);
  const [filteredData, setFilteredData] = useState<ComplaintRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showDetails, setShowDetails] = useState<{ supervisor: string, complaints: ComplaintRecord[] } | null>(null);

  // Refs for export
  const reportRef = useRef<HTMLDivElement>(null);

  // Filters
  const [selectedZone, setSelectedZone] = useState<string>('All');
  const [selectedWard, setSelectedWard] = useState<string>('All');
  const [selectedSupervisor, setSelectedSupervisor] = useState<string>('All');
  const [selectedZonalHead, setSelectedZonalHead] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // 1. Create a specialized Map for C&T: Ward Number -> Supervisor Info
  const wardToSupervisorMap = useMemo(() => {
    const map = new Map<string, typeof MASTER_SUPERVISORS[0]>();

    MASTER_SUPERVISORS.filter(s => s.department === 'C&T').forEach(sup => {
      // Handle comma separated wards "15,11,1"
      const wards = sup.ward.split(',').map(w => w.trim());
      wards.forEach(wardNum => {
        // Map "15" -> Supervisor Object
        map.set(wardNum, sup);
        // Also map just incase there's leading zeros in data or mismatch "01" vs "1"
        // But for now assume data matches or we sanitize later
      });
    });
    return map;
  }, []);



  // Apply filters
  useEffect(() => {
    let filtered = [...complaintData];

    if (selectedZone !== 'All') {
      filtered = filtered.filter(record => record.zone === selectedZone);
    }

    if (selectedWard !== 'All') {
      filtered = filtered.filter(record => record.ward === selectedWard);
    }

    if (selectedSupervisor !== 'All') {
      filtered = filtered.filter(record => record.assignee.includes(selectedSupervisor));
    }

    if (selectedZonalHead !== 'All') {
      // Filter by Zonal Head using our Map
      filtered = filtered.filter(record => {
        const wardNumberMatch = record.ward.match(/(\d+)/);
        if (wardNumberMatch) {
          const wardNum = wardNumberMatch[0];
          const supervisor = wardToSupervisorMap.get(wardNum);
          return supervisor && supervisor.zonal === selectedZonalHead;
        }
        return false;
      });
    }

    if (dateFrom) {
      filtered = filtered.filter(record => {
        // Convert date formats for comparison
        const recordDate = new Date(record.complaintRegisteredDate.replace(/;/g, '/'));
        return recordDate >= new Date(dateFrom);
      });
    }

    if (dateTo) {
      filtered = filtered.filter(record => {
        // Convert date formats for comparison
        const recordDate = new Date(record.complaintRegisteredDate.replace(/;/g, '/'));
        return recordDate <= new Date(dateTo);
      });
    }

    // Only show open complaints
    filtered = filtered.filter(record => record.status.toLowerCase() === 'open');

    setFilteredData(filtered);
  }, [complaintData, selectedZone, selectedWard, selectedSupervisor, selectedZonalHead, dateFrom, dateTo, wardToSupervisorMap]);

  // Extract unique values for filters
  const zones = useMemo(() => {
    return getUniqueValues(complaintData, 'zone');
  }, [complaintData]);

  const wards = useMemo(() => {
    return getUniqueValues(complaintData, 'ward');
  }, [complaintData]);

  const supervisors = useMemo(() => {
    // Return supervisors from Master Data C&T
    return Array.from(new Set(
      MASTER_SUPERVISORS
        .filter(s => s.department === 'C&T')
        .map(s => s.name)
    )).sort();
  }, []);

  const zonalHeads = useMemo(() => {
    // Return Unique Zonal Heads from Master Data C&T
    return Array.from(new Set(
      MASTER_SUPERVISORS
        .filter(s => s.department === 'C&T')
        .map(s => s.zonal)
    )).sort();
  }, []);

  // Group complaints by zonal head
  const groupedByZonalHead = useMemo(() => {
    const grouped: { [key: string]: { [key: string]: { complaints: ComplaintRecord[], wardCounts: { [key: string]: number } } } } = {};

    // Helper to get matching C&T supervisor for a complaint
    const getCTSupervisor = (wardName: string) => {
      const match = wardName.match(/(\d+)/);
      if (!match) return null;
      // Try strict match first, then maybe fallback (e.g. "01" vs "1")
      // Our map keys are trimmed strings from Master Data.
      // Assuming Master Data has "1" and complaint has "Ward 1" -> match[0] is "1".
      return wardToSupervisorMap.get(match[0]) || wardToSupervisorMap.get(parseInt(match[0]).toString());
    };

    filteredData.forEach(record => {
      const matchedSupervisor = getCTSupervisor(record.ward);

      if (matchedSupervisor) {
        const zonalHead = matchedSupervisor.zonal;
        const supervisorName = matchedSupervisor.name;

        if (!grouped[zonalHead]) {
          grouped[zonalHead] = {};
        }

        if (!grouped[zonalHead][supervisorName]) {
          grouped[zonalHead][supervisorName] = {
            complaints: [],
            wardCounts: {}
          };
        }

        grouped[zonalHead][supervisorName].complaints.push(record);

        // Count complaints per ward
        if (!grouped[zonalHead][supervisorName].wardCounts[record.ward]) {
          grouped[zonalHead][supervisorName].wardCounts[record.ward] = 0;
        }
        grouped[zonalHead][supervisorName].wardCounts[record.ward]++;
      } else {
        // Optional: handle unmapped complaints?
        // For now, they are just excluded from the grouped view or put in "Unassigned"
        const unassignedKey = "Unassigned";
        if (!grouped[unassignedKey]) grouped[unassignedKey] = {};
        if (!grouped[unassignedKey]["Unknown"]) grouped[unassignedKey]["Unknown"] = { complaints: [], wardCounts: {} };

        grouped[unassignedKey]["Unknown"].complaints.push(record);
        if (!grouped[unassignedKey]["Unknown"].wardCounts[record.ward]) grouped[unassignedKey]["Unknown"].wardCounts[record.ward] = 0;
        grouped[unassignedKey]["Unknown"].wardCounts[record.ward]++;
      }
    });

    // Cleanup empty unassigned if we want
    if (grouped["Unassigned"] && Object.keys(grouped["Unassigned"]).length === 0) {
      delete grouped["Unassigned"];
    }

    return grouped;
  }, [filteredData, wardToSupervisorMap]);



  // Export to Excel function
  const handleExportExcel = () => {
    // Create worksheet with zonal data
    const wsData = [
      ['Zonal Head', 'Supervisor', 'Wards', 'Ward Count', 'Total Open'],
      ...Object.entries(groupedByZonalHead).flatMap(([zonalHead, supervisors]) =>
        Object.entries(supervisors).map(([supervisor, supervisorData]) => [
          zonalHead,
          supervisor,
          Object.keys(supervisorData.wardCounts).join(', '),
          Object.keys(supervisorData.wardCounts).length,
          supervisorData.complaints.length
        ])
      )
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'C&D Waste Report');

    // Generate file name with timestamp
    const fileName = `C_D_Waste_Complaint_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Export to PDF function
  const handleExportPDF = async () => {
    try {
      const element = reportRef.current;
      if (!element) {
        alert('Report content not found for export');
        return;
      }

      const imgData = await toPng(element, {
        cacheBust: true,
        backgroundColor: '#ffffff'
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`C_D_Waste_Complaint_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    }
  };

  // Export to JPEG function
  const handleExportJPEG = async () => {
    try {
      const element = reportRef.current;
      if (!element) {
        alert('Report content not found for export');
        return;
      }

      const imgData = await toJpeg(element, {
        quality: 0.95,
        cacheBust: true,
        backgroundColor: '#ffffff'
      });

      // Create temporary link to download image
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `C_D_Waste_Complaint_Report_${new Date().toISOString().slice(0, 10)}.jpeg`;
      link.click();
    } catch (error) {
      console.error('Error generating JPEG:', error);
      alert('Error generating JPEG. Please try again.');
    }
  };

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const allRecords = parseCSV(text);
        const cdWasteRecords = filterCDWasteComplaints(allRecords);
        setComplaintData(cdWasteRecords);
        // Reset filters when new data is loaded
        setFilteredData(cdWasteRecords);
        alert(`Successfully loaded ${cdWasteRecords.length} records from ${file.name}`);
      } catch (err) {
        console.error('Error parsing CSV:', err);
        alert('Error parsing CSV file. Please ensure it is a valid format.');
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Loading C&D Waste Complaint Data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        Error: {error}
      </div>
    );
  }

  if (showDetails) {
    return (
      <div ref={reportRef} className="flex flex-col h-full bg-gray-50 items-center">
        <div className="bg-white border-b border-gray-200 p-4 w-full max-w-6xl">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-black">Open Complaint Details for {showDetails.supervisor}</h1>
            <button
              onClick={() => setShowDetails(null)}
              className="px-3 py-2 bg-gray-500 text-white text-sm font-medium rounded shadow-sm hover:bg-gray-600"
            >
              Back
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 w-full max-w-6xl">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-blue-100">
                <tr>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider">S.No</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider">Complaint ID</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider">Supervisor Name</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider">Zone</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider">Ward</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider">Assigned / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {showDetails.complaints.map((record, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center">{index + 1}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center">{record.compId}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center">{showDetails.supervisor}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center">{record.zone}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center">{record.ward}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center">{record.complaintRegisteredDate}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center">{record.status}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center">{record.assignee}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-blue-700 text-white">
                <tr>
                  <td colSpan={8} className="px-4 py-2 text-sm font-semibold text-center text-black">
                    Total: {showDetails.complaints.length} Open Complaints
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 items-center overflow-auto">
      {/* Header - Aligned with WardWiseStatusReport style */}
      <div className="w-full max-w-6xl bg-white border-b border-gray-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-6 shrink-0">
        <img src={NagarNigamLogo} alt="NN" className="h-20 object-contain" />
        <div className="text-center">
          <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Mathura Vrindavan Nagar Nigam</h1>
          <div className="inline-block border-b-4 border-emerald-500 pb-1 mt-1">
            <h2 className="text-xl font-bold text-emerald-700 uppercase tracking-wide">C&D Waste Complaint Report</h2>
          </div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-2">SUVIDHA APP COMPLAINTS</h3>
          {dateFrom && dateTo && (
            <div className="mt-2 text-sm font-semibold text-gray-600 bg-gray-100 px-3 py-0.5 rounded-full inline-block">
              {dateFrom} to {dateTo}
            </div>
          )}
        </div>
        <img src={NatureGreenLogo} alt="NG" className="h-20 object-contain" />
      </div>

      <div className="w-full max-w-6xl p-4 space-y-4 flex-1">
        {/* Controls Section (No Print) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 no-print">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-4">
            {/* Upload & Summary Stats */}
            <div className="flex items-center gap-4">
              {complaintData.length === 0 && (
                <div className="relative">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 cursor-pointer flex items-center gap-2 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                    <span>Upload CSV</span>
                  </label>
                </div>
              )}


            </div>

            {/* Export Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleExportExcel}
                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm"
                title="Export Excel"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                onClick={handleExportPDF}
                className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm"
                title="Export PDF"
              >
                <FileDown className="w-5 h-5" />
              </button>
              <button
                onClick={handleExportJPEG}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm"
                title="Export JPEG"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <select value={selectedZone} onChange={e => setSelectedZone(e.target.value)} className="p-2 text-sm border rounded hover:border-blue-400 text-black">
              <option value="All">All Zones</option>
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
            <select value={selectedWard} onChange={e => setSelectedWard(e.target.value)} className="p-2 text-sm border rounded hover:border-blue-400 text-black">
              <option value="All">All Wards</option>
              {wards.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <select value={selectedSupervisor} onChange={e => setSelectedSupervisor(e.target.value)} className="p-2 text-sm border rounded hover:border-blue-400 text-black">
              <option value="All">All Supervisors</option>
              {supervisors.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={selectedZonalHead} onChange={e => setSelectedZonalHead(e.target.value)} className="p-2 text-sm border rounded hover:border-blue-400 text-black">
              <option value="All">All Zonal Heads</option>
              {zonalHeads.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="p-2 text-sm border rounded hover:border-blue-400 text-black" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="p-2 text-sm border rounded hover:border-blue-400 text-black" />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="space-y-6 pb-8" ref={reportRef}>
          {/* Internal Header for Export */}
          <div className="bg-white border-b-2 border-gray-100 p-4 mb-4 flex flex-col md:flex-row items-center justify-between gap-4 rounded-xl shadow-sm border border-gray-200">
            <img src={NagarNigamLogo} alt="NN" className="h-16 object-contain" />
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-900 uppercase">Mathura Vrindavan Nagar Nigam</h2>
              <h3 className="text-lg font-bold text-emerald-700 uppercase mt-1">C&D Waste Complaint Report</h3>
              <h4 className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">SUVIDHA APP COMPLAINTS</h4>
              <p className="text-xs text-gray-500 mt-1">Generated on: {new Date().toLocaleString()}</p>
              {dateFrom && dateTo && (
                <div className="mt-1 text-xs font-semibold text-gray-600">
                  Period: {dateFrom} to {dateTo}
                </div>
              )}
              {(selectedZone !== 'All' || selectedZonalHead !== 'All' || selectedWard !== 'All' || selectedSupervisor !== 'All') && (
                <div className="flex flex-wrap gap-2 justify-center mt-2 max-w-2xl">
                  {selectedZone !== 'All' && <span className="text-xs font-semibold bg-gray-50 border border-gray-200 px-2 py-1 rounded text-gray-700">Zone: {selectedZone}</span>}
                  {selectedZonalHead !== 'All' && <span className="text-xs font-semibold bg-gray-50 border border-gray-200 px-2 py-1 rounded text-gray-700">Zonal: {selectedZonalHead}</span>}
                  {selectedWard !== 'All' && <span className="text-xs font-semibold bg-gray-50 border border-gray-200 px-2 py-1 rounded text-gray-700">Ward: {selectedWard}</span>}
                  {selectedSupervisor !== 'All' && <span className="text-xs font-semibold bg-gray-50 border border-gray-200 px-2 py-1 rounded text-gray-700">Sup: {selectedSupervisor}</span>}
                </div>
              )}
            </div>
            <img src={NatureGreenLogo} alt="NG" className="h-16 object-contain" />
          </div>

          {Object.keys(groupedByZonalHead).length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
              No complaints found for the selected filters.
            </div>
          ) : (
            Object.entries(groupedByZonalHead).map(([zonalHead, supervisors]) => {
              if (Object.keys(supervisors).length === 0) return null;

              const zonalTotal = Object.values(supervisors).reduce(
                (total, supData) => total + supData.complaints.length, 0
              );

              return (
                <div key={zonalHead} className="bg-white rounded-lg shadow-sm border border-black overflow-hidden break-inside-avoid">
                  {/* Zonal Header */}
                  <div className="bg-emerald-600 text-white px-4 py-2 flex items-center justify-between border-b border-black print-bg-emerald">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      <h3 className="text-lg font-bold uppercase">Zonal Head: {zonalHead}</h3>
                    </div>
                    <span className="font-bold bg-white text-emerald-700 px-3 py-0.5 rounded-full text-sm">
                      Total: {zonalTotal}
                    </span>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-100 text-gray-900 border-b border-black font-bold uppercase text-xs">
                        <tr>
                          <th className="px-4 py-3 text-center border-r border-black w-16">S.No.</th>
                          <th className="px-4 py-3 text-left border-r border-black w-1/4">Supervisor Name</th>
                          <th className="px-4 py-3 text-left border-r border-black w-1/2">Ward Details (Ward: Count)</th>
                          <th className="px-4 py-3 text-center border-r border-black w-1/8">Open</th>
                          <th className="px-4 py-3 text-center w-1/8 no-print">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {Object.entries(supervisors).map(([supervisor, supData], idx) => (
                          <tr key={supervisor} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-2 text-center text-gray-600 border-r border-gray-300">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-2 font-bold text-gray-800 border-r border-gray-300">
                              {supervisor}
                            </td>
                            <td className="px-4 py-2 border-r border-gray-300">
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(supData.wardCounts).map(([ward, count]) => (
                                  <span key={ward} className="inline-flex items-center px-2 py-1 rounded bg-gray-100 border border-gray-200 text-xs">
                                    <span className="font-semibold text-gray-700 mr-1">{ward}:</span>
                                    <span className="font-bold text-red-600">{count}</span>
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-2 text-center font-bold text-red-600 text-base border-r border-gray-300">
                              {supData.complaints.length}
                            </td>
                            <td className="px-4 py-2 text-center no-print">
                              <button
                                className="text-blue-600 hover:text-blue-800 font-medium hover:underline text-xs flex items-center justify-center gap-1 mx-auto"
                                onClick={() => setShowDetails({ supervisor, complaints: supData.complaints })}
                              >
                                <Eye className="w-3 h-3" /> View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t border-black font-bold">
                        <tr>
                          <td colSpan={2} className="px-4 py-2 text-right uppercase text-xs text-gray-500 border-r border-gray-300">Zonal Total</td>
                          <td className="border-r border-gray-300"></td>
                          <td className="px-4 py-2 text-center text-emerald-700">{zonalTotal}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })
          )}

          {/* Footer - Moved inside report container */}
          <div className="mt-8 mb-6 text-center">
            <div className="inline-block bg-white px-8 py-4 rounded-2xl shadow-sm border border-slate-100">
              <p className="text-slate-600 font-medium text-lg tracking-wide">
                Generated by <span className="font-extrabold text-indigo-600 mx-1">Reports Buddy Pro</span>
                <span className="text-slate-300 mx-3">|</span>
                Created by <span className="font-extrabold text-slate-800 mx-1 border-b-2 border-indigo-200">Yuvraj Singh Tomar</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CDWasteComplaintReport;