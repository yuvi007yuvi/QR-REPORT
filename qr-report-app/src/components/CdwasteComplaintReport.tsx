import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Download, FileDown, Eye, Users, Image as ImageIcon } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { ComplaintRecord } from '../utils/csvParser';
import {
  parseCSV,
  filterCDWasteComplaints,
  getUniqueValues,
} from '../utils/csvParser';

import { MASTER_SUPERVISORS } from '../data/master-supervisors';
import { WARD_MASTER_DATA } from '../data/ward-master';

// Import logos
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';

// For Excel export
import * as XLSX from 'xlsx';

// For PDF export
import jsPDF from 'jspdf';
import { toPng, toJpeg } from 'html-to-image';

const calculateDuration = (dateStr: string) => {
  if (!dateStr) return 0;
  try {
    // Standardize separators - Replace semicolon with comma for native JS date support
    // This handles the format like "May 1; 2026 9:04 AM"
    const cleaned = dateStr.replace(/;/g, ',').trim();

    let regDate = new Date(cleaned);

    // Fallback for DD-MM-YYYY or DD/MM/YYYY numeric formats if native parsing fails
    if (isNaN(regDate.getTime())) {
      const datePart = cleaned.split(' ')[0];
      const parts = datePart.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          regDate = new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
        } else {
          // DD-MM-YYYY -> MM-DD-YYYY for JS Date
          regDate = new Date(`${parts[1]}-${parts[0]}-${parts[2]}`);
        }
      }
    }

    if (isNaN(regDate.getTime())) return 0;

    const now = new Date();
    // Calculate difference in days by setting both to start of day
    const d1 = new Date(regDate.getFullYear(), regDate.getMonth(), regDate.getDate());
    const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = d2.getTime() - d1.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  } catch (e) {
    return 0;
  }
};


const CDWasteComplaintReport: React.FC = () => {
  const [complaintData, setComplaintData] = useState<ComplaintRecord[]>([]);
  const [filteredData, setFilteredData] = useState<ComplaintRecord[]>([]);
  const [loading, setLoading] = useState(false);


  const [showDetails, setShowDetails] = useState<{ supervisor: string, complaints: ComplaintRecord[] } | null>(null);
  const [wardAssignments, setWardAssignments] = useState<Record<string, any>>({});

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'ward_assignments'), (snapshot) => {
      const mapping: Record<string, any> = {};
      snapshot.forEach(doc => {
        mapping[doc.id] = doc.data();
      });
      setWardAssignments(mapping);
    });
    return () => unsubscribe();
  }, []);

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



  // Build reverse map from wardAssignments + MASTER_SUPERVISORS
  const supervisorToWards = useMemo(() => {
    const map = new Map<string, Set<string>>();

    MASTER_SUPERVISORS.filter(s => s.department === 'C&T').forEach(sup => {
      if (!map.has(sup.name)) map.set(sup.name, new Set());
      sup.ward.split(',').forEach(w => {
        const trimmed = w.trim();
        if (trimmed && trimmed !== 'N/A' && trimmed !== 'NA') {
          map.get(sup.name)!.add(parseInt(trimmed).toString());
        }
      });
    });

    Object.entries(wardAssignments).forEach(([wardNumStr, data]) => {
      if (data && data.supervisorName) {
        const supName = data.supervisorName;
        if (!map.has(supName)) map.set(supName, new Set());

        for (const [otherSup, wards] of map.entries()) {
          if (otherSup !== supName && wards.has(wardNumStr)) {
            wards.delete(wardNumStr);
          }
        }

        map.get(supName)!.add(wardNumStr);
      }
    });

    return map;
  }, [wardAssignments]);

  // Helper to get matching C&T supervisor for a complaint
  const getCTSupervisor = useMemo(() => (wardName: string) => {
    const match = wardName.match(/(\d+)/);
    if (!match) return null;
    const wardNumStr = parseInt(match[0]).toString();

    const assignment = wardAssignments[wardNumStr];
    if (assignment && assignment.supervisorName) {

      let fallbackZonal = 'Unknown';
      const masterSup = MASTER_SUPERVISORS.find(s =>
        s.department === 'C&T' &&
        (s.name === assignment.supervisorName || assignment.supervisorName.includes(s.name) || assignment.supervisorName.replace(/\s*\(C&T\)\s*/i, '') === s.name)
      );
      if (masterSup) {
        fallbackZonal = masterSup.zonal;
      }

      return {
        name: assignment.supervisorName,
        zonal: assignment.zonalName || assignment.zonalHead || fallbackZonal,
        wardList: Array.from(supervisorToWards.get(assignment.supervisorName) || [])
      };
    }

    const master = wardToSupervisorMap.get(match[0]) || wardToSupervisorMap.get(wardNumStr);
    if (master) {
      return {
        name: master.name,
        zonal: master.zonal,
        wardList: Array.from(supervisorToWards.get(master.name) || [])
      };
    }
    return null;
  }, [wardAssignments, supervisorToWards, wardToSupervisorMap]);

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
      filtered = filtered.filter(record => {
        const supervisor = getCTSupervisor(record.ward);
        return supervisor && supervisor.name === selectedSupervisor;
      });
    }

    if (selectedZonalHead !== 'All') {
      filtered = filtered.filter(record => {
        const supervisor = getCTSupervisor(record.ward);
        return supervisor && supervisor.zonal === selectedZonalHead;
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

  // Extract unique filter options incorporating dynamic Firebase data
  const zonalHeads = useMemo(() => {
    const heads = new Set(
      MASTER_SUPERVISORS.filter(s => s.department === 'C&T').map(s => s.zonal)
    );
    Object.values(wardAssignments).forEach(assignment => {
      const zonal = assignment?.zonalName || assignment?.zonalHead;
      if (zonal) {
        heads.add(zonal);
      }
    });
    return Array.from(heads).sort();
  }, [wardAssignments]);

  const supervisors = useMemo(() => {
    const sups = new Set(
      MASTER_SUPERVISORS.filter(s => s.department === 'C&T').map(s => s.name)
    );
    Object.values(wardAssignments).forEach(assignment => {
      if (assignment?.supervisorName) {
        sups.add(assignment.supervisorName);
      }
    });

    // Convert to array
    const allSups = Array.from(sups).sort();

    // If a specific zonal head is selected, we ideally want to filter,
    // but mapping is complex. For safety, if they select a Zonal Head,
    // we can filter based on getCTSupervisor results in the data, 
    // or just return allSups if we want to be safe.
    if (selectedZonalHead === 'All') {
      return allSups;
    }

    // Filter supervisors to only those associated with the selected Zonal Head
    const filteredSups = new Set<string>();
    MASTER_SUPERVISORS.filter(s => s.department === 'C&T' && s.zonal === selectedZonalHead).forEach(s => filteredSups.add(s.name));
    Object.values(wardAssignments).forEach(assignment => {
      if (assignment?.zonalHead === selectedZonalHead && assignment?.supervisorName) {
        filteredSups.add(assignment.supervisorName);
      }
    });

    return Array.from(filteredSups).sort();
  }, [selectedZonalHead, wardAssignments]);

  // Group complaints by zonal head
  const groupedByZonalHead = useMemo(() => {
    const grouped: { [key: string]: { [key: string]: { complaints: ComplaintRecord[], wardCounts: { [key: string]: number }, typeCounts?: { [key: string]: number } } } } = {};

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
            wardCounts: {},
            typeCounts: {}
          };

          // Pre-populate with all wards for this supervisor
          const assignedWards = matchedSupervisor.wardList || [];
          assignedWards.forEach(w => {
            if (w && w !== 'N/A' && w !== 'NA') {
              const wardNum = parseInt(w);
              const wardObj = WARD_MASTER_DATA.find(wd => wd.wardNumber === wardNum);
              const fullWardName = wardObj ? wardObj.area : w;
              grouped[zonalHead][supervisorName].wardCounts[fullWardName] = 0;
            }
          });
        }

        grouped[zonalHead][supervisorName].complaints.push(record);

        // Count complaints per ward, normalizing ward name to match pre-populated keys
        let wardKey = record.ward;
        const match = record.ward.match(/(\d+)/);
        if (match) {
          const wardNum = parseInt(match[0]);
          const wardObj = WARD_MASTER_DATA.find(wd => wd.wardNumber === wardNum);
          if (wardObj) {
            wardKey = wardObj.area;
          }
        }

        if (grouped[zonalHead][supervisorName].wardCounts[wardKey] === undefined) {
          grouped[zonalHead][supervisorName].wardCounts[wardKey] = 0;
        }
        grouped[zonalHead][supervisorName].wardCounts[wardKey]++;

        // Count complaint types
        let compType = record.complaintType || 'Other';
        if (record.complaintType && record.complaintSubtype) {
          compType = `${record.complaintType} - ${record.complaintSubtype}`;
        }
        if (!grouped[zonalHead][supervisorName].typeCounts) {
          grouped[zonalHead][supervisorName].typeCounts = {};
        }
        grouped[zonalHead][supervisorName].typeCounts[compType] = (grouped[zonalHead][supervisorName].typeCounts[compType] || 0) + 1;
      } else {
        // Optional: handle unmapped complaints?
        // For now, they are just excluded from the grouped view or put in "Unassigned"
        const unassignedKey = "Unassigned";
        if (!grouped[unassignedKey]) grouped[unassignedKey] = {};
        if (!grouped[unassignedKey]["Unknown"]) grouped[unassignedKey]["Unknown"] = { complaints: [], wardCounts: {}, typeCounts: {} };

        grouped[unassignedKey]["Unknown"].complaints.push(record);
        if (!grouped[unassignedKey]["Unknown"].wardCounts[record.ward]) grouped[unassignedKey]["Unknown"].wardCounts[record.ward] = 0;
        grouped[unassignedKey]["Unknown"].wardCounts[record.ward]++;

        let compType = record.complaintType || 'Other';
        if (record.complaintType && record.complaintSubtype) {
          compType = `${record.complaintType} - ${record.complaintSubtype}`;
        }
        if (!grouped[unassignedKey]["Unknown"].typeCounts) grouped[unassignedKey]["Unknown"].typeCounts = {};
        grouped[unassignedKey]["Unknown"].typeCounts[compType] = (grouped[unassignedKey]["Unknown"].typeCounts[compType] || 0) + 1;
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
      ['Zonal Head', 'Supervisor', 'Wards', 'Ward Count', 'Total Open', 'Max Duration (Days)'],
      ...Object.entries(groupedByZonalHead).flatMap(([zonalHead, supervisors]) =>
        Object.entries(supervisors).map(([supervisor, supervisorData]) => {
          const maxDuration = Math.max(...supervisorData.complaints.map(c => calculateDuration(c.complaintRegisteredDate)), 0);
          return [
            zonalHead,
            supervisor,
            Object.keys(supervisorData.wardCounts).join(', '),
            Object.keys(supervisorData.wardCounts).length,
            supervisorData.complaints.length,
            maxDuration
          ];
        })
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

      // Hide scrollbars before capture
      element.classList.add('hide-scrollbars-for-export');

      const imgData = await toPng(element, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#ffffff'
      });

      // Restore scrollbars
      element.classList.remove('hide-scrollbars-for-export');

      // Create PDF with custom dimensions matching the exact image size
      // This ensures the entire report is on a single, continuous page without cuts
      const tempPdf = new jsPDF({ unit: 'px' });
      const imgProps = tempPdf.getImageProperties(imgData);
      
      const pdf = new jsPDF({
        orientation: imgProps.width > imgProps.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [imgProps.width, imgProps.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, imgProps.width, imgProps.height);
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

      // Hide scrollbars before capture
      element.classList.add('hide-scrollbars-for-export');

      const imgData = await toJpeg(element, {
        quality: 1.0,
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#ffffff'
      });

      // Restore scrollbars
      element.classList.remove('hide-scrollbars-for-export');

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

    setLoading(true);
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
      } finally {
        setLoading(false);
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
          <div className="bg-white rounded-lg shadow-sm border-2 border-black overflow-x-auto">
            <table className="min-w-full divide-y divide-black">
              <thead className="bg-blue-100 border-b-2 border-black">
                <tr>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider border border-black">S.No</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider border border-black">Complaint ID</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider border border-black">Supervisor Name</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider border border-black">Zone</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider border border-black">Ward</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider border border-black">Date</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider border border-black">Duration</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider border border-black">Complaint Type</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider border border-black">Status</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-black uppercase tracking-wider border border-black">Assigned / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black">
                {showDetails.complaints.map((record, index) => {
                  const duration = calculateDuration(record.complaintRegisteredDate);
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center border border-black">{index + 1}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center border border-black">{record.compId}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center border border-black">{showDetails.supervisor}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center border border-black">{record.zone}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center border border-black">{record.ward}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center border border-black">{record.complaintRegisteredDate}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-center border border-black">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${duration > 7 ? 'bg-red-100 text-red-700' :
                            duration > 3 ? 'bg-orange-100 text-orange-700' :
                              'bg-green-100 text-green-700'
                          }`}>
                          {duration} Days
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-black text-center max-w-[200px] truncate border border-black" title={`${record.complaintType} - ${record.complaintSubtype}`}>
                        <div className="font-semibold text-xs">{record.complaintType}</div>
                        <div className="text-[10px] text-gray-500">{record.complaintSubtype}</div>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center border border-black">{record.status}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm text-black text-center border border-black">{record.assignee}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-blue-700 text-white border-t-2 border-black">
                <tr>
                  <td colSpan={10} className="px-4 py-2 text-sm font-semibold text-center text-white border border-black">
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
                      <h3 className="text-lg font-bold uppercase !text-white">Zonal Head: {zonalHead}</h3>
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
                          <th className="px-4 py-3 text-center border border-black w-16">S.No.</th>
                          <th className="px-4 py-3 text-left border border-black w-1/4">Supervisor Name</th>
                          <th className="px-4 py-3 text-left border border-black w-1/3">Ward Details (Ward: Count)</th>
                          <th className="px-4 py-3 text-left border border-black w-1/4">Complaint Types</th>
                          <th className="px-4 py-3 text-center border border-black w-24">Max Duration</th>
                          <th className="px-4 py-3 text-center border border-black w-20">Open</th>
                          <th className="px-4 py-3 text-center border border-black w-24 no-print">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black">
                        {Object.entries(supervisors).map(([supervisor, supData], idx) => {
                          const maxDuration = Math.max(...supData.complaints.map(c => calculateDuration(c.complaintRegisteredDate)), 0);
                          return (
                            <tr key={supervisor} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-4 py-2 text-center text-gray-600 border border-black">
                                {idx + 1}
                              </td>
                              <td className="px-4 py-2 font-bold text-gray-800 border border-black">
                                {supervisor}
                              </td>
                              <td className="px-4 py-2 border border-black">
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(supData.wardCounts).map(([ward, count]) => (
                                    <span key={ward} className="inline-flex items-center px-2 py-1 rounded bg-gray-100 border border-black text-xs">
                                      <span className="font-semibold text-gray-700 mr-1">{ward}:</span>
                                      <span className="font-bold text-red-600">{count}</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-2 border border-black">
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(supData.typeCounts || {}).map(([cType, count]) => (
                                    <span key={cType} className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 border border-black text-[11px]">
                                      <span className="font-semibold text-blue-800 mr-1">{cType}:</span>
                                      <span className="font-bold text-blue-600">{count}</span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="px-4 py-2 text-center border border-black">
                                <span className={`font-bold ${maxDuration > 7 ? 'text-red-600' : maxDuration > 3 ? 'text-orange-600' : 'text-gray-700'}`}>
                                  {maxDuration} Days
                                </span>
                              </td>
                              <td className="px-4 py-2 text-center font-bold text-red-600 text-base border border-black">
                                {supData.complaints.length}
                              </td>
                              <td className="px-4 py-2 text-center no-print border border-black">
                                <button
                                  className="text-blue-600 hover:text-blue-800 font-medium hover:underline text-xs flex items-center justify-center gap-1 mx-auto"
                                  onClick={() => setShowDetails({ supervisor, complaints: supData.complaints })}
                                >
                                  <Eye className="w-3 h-3" /> View
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-gray-50 font-bold">
                        <tr className="border-t-2 border-black">
                          <td colSpan={2} className="px-4 py-2 text-right uppercase text-xs text-gray-800 border-r border-b border-black">Zonal Total</td>
                          <td className="border-r border-b border-black"></td>
                          <td className="border-r border-b border-black"></td>
                          <td className="border-r border-b border-black"></td>
                          <td className="px-4 py-2 text-center text-emerald-700 font-extrabold border-r border-b border-black">{zonalTotal}</td>
                          <td className="border-b border-black"></td>
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