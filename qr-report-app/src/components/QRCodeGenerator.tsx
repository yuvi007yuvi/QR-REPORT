import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Upload, Smartphone } from 'lucide-react';
import { toPng } from 'html-to-image';
import Papa from 'papaparse';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';

interface VehicleData {
  number: string;
  type?: string;
}

interface UploadStats {
  total: number;
  active: number;
  inactive: number;
  byType: Record<string, number>;
}

interface QRCodeCardProps {
  vehicle: VehicleData;
}

const QRCodeCard: React.FC<QRCodeCardProps> = ({ vehicle }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const downloadCard = async () => {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, quality: 1, pixelRatio: 3 });
      const link = document.createElement('a');
      link.download = `QR_${vehicle.number}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error downloading QR Code', err);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div 
        ref={cardRef} 
        className="qr-card-export-target flex flex-col items-center bg-[#e8f2f2] rounded-xl overflow-hidden shadow-sm border border-slate-200"
        style={{ width: '350px' }}
      >
        {/* Header with Logos */}
        <div className="w-full flex justify-center items-center gap-6 px-6 pt-6 pb-2">
          <img src={NagarNigamLogo} alt="Nagar Nigam" className="h-16 w-auto object-contain" />
          <img src={NatureGreenLogo} alt="Nature Green" className="h-16 w-auto object-contain" />
        </div>

        <div className="px-6 pb-0 w-full">
          {/* Phone Mockup Frame */}
          <div className="relative border-[4px] border-[#0a4d46] rounded-[2rem] p-4 w-full aspect-[4/5] bg-[#e8f2f2] flex items-center justify-center shadow-inner">
            
            {/* Top Notch */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#0a4d46] rounded-b-xl rounded-t-sm z-10" />
            
            {/* Side buttons */}
            <div className="absolute top-1/4 -left-[6px] w-[6px] h-12 bg-[#0a4d46] rounded-l-md" />
            <div className="absolute top-1/2 -left-[6px] w-[6px] h-12 bg-[#0a4d46] rounded-l-md" />
            <div className="absolute top-1/3 -right-[6px] w-[6px] h-16 bg-[#0a4d46] rounded-r-md" />

            {/* Scanner Brackets */}
            <div className="absolute top-8 left-8 w-8 h-8 border-t-[3px] border-l-[3px] border-[#0a4d46] rounded-tl-lg" />
            <div className="absolute top-8 right-8 w-8 h-8 border-t-[3px] border-r-[3px] border-[#0a4d46] rounded-tr-lg" />
            <div className="absolute bottom-8 left-8 w-8 h-8 border-b-[3px] border-l-[3px] border-[#0a4d46] rounded-bl-lg" />
            <div className="absolute bottom-8 right-8 w-8 h-8 border-b-[3px] border-r-[3px] border-[#0a4d46] rounded-br-lg" />

            {/* QR Code Background & Container */}
            <div className="bg-white p-4 z-10 shadow-sm rounded-sm">
              <QRCodeSVG 
                value={vehicle.number} 
                size={180}
                level="H"
                includeMargin={false}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>
          </div>
        </div>

        {/* Text Section (Below Phone, integrated in card) */}
        <div className="mt-4 bg-[#e8f2f2] w-full flex flex-col items-center text-center py-3 border-t-2 border-[#0a4d46]">
          <span className="text-[#0a4d46] text-lg leading-tight">
            Vehicle Number: <span className="font-bold">{vehicle.number}</span>
          </span>
          {vehicle.type && (
            <span className="text-[#0a4d46] text-sm font-semibold mt-1 opacity-80 uppercase tracking-wide">
              {vehicle.type}
            </span>
          )}
        </div>
      </div>
      
      <button 
        onClick={downloadCard}
        className="mt-3 flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-100 transition-colors text-sm"
      >
        <Download size={16} /> Download
      </button>
    </div>
  );
};

export const QRCodeGenerator: React.FC = () => {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [singleInput, setSingleInput] = useState('');
  const [singleTypeInput, setSingleTypeInput] = useState('');
  const [bulkInput, setBulkInput] = useState('');
  const [generatedList, setGeneratedList] = useState<VehicleData[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [uploadStats, setUploadStats] = useState<UploadStats | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const uniqueTypes = Array.from(new Set(generatedList.map(v => v.type).filter(Boolean))) as string[];
  const displayedList = filterTypes.length === 0 ? generatedList : generatedList.filter(v => v.type && filterTypes.includes(v.type));
  
  const handleGenerateSingle = () => {
    if (singleInput.trim()) {
      setGeneratedList([{ number: singleInput.trim().toUpperCase(), type: singleTypeInput.trim() || undefined }]);
    }
  };

  const handleGenerateBulk = () => {
    if (bulkInput.trim()) {
      // Split by newline
      const items = bulkInput
        .split('\n')
        .map(line => {
          // Allow parsing format: NUMBER, TYPE
          const parts = line.split(',');
          const num = parts[0].trim().toUpperCase();
          const type = parts.length > 1 ? parts.slice(1).join(',').trim() : undefined;
          return { number: num, type: type || undefined };
        })
        .filter(i => i.number.length > 0);
      
      // Remove duplicates based on vehicle number
      const uniqueItems: VehicleData[] = [];
      const seen = new Set<string>();
      items.forEach(item => {
        if (!seen.has(item.number)) {
          seen.add(item.number);
          uniqueItems.push(item);
        }
      });
      
      const proceed = window.confirm(`Are you sure you want to generate ${uniqueItems.length} QR codes?`);
      if (proceed) {
        setGeneratedList(uniqueItems);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const items: VehicleData[] = [];
          const seen = new Set<string>();
          let totalCount = 0;
          let activeCount = 0;
          let inactiveCount = 0;
          const typesCount: Record<string, number> = {};
          
          results.data.forEach((row: any) => {
            let val = '';
            let type = '';

            // Extract values
            if (row['Vehicle Number']) {
              val = String(row['Vehicle Number']).trim().toUpperCase();
            } else {
              const values = Object.values(row);
              if (values.length > 0) {
                val = String(values[0]).trim().toUpperCase();
              }
            }
            if (!val) return;

            if (row['Vehicle Type']) {
              type = String(row['Vehicle Type']).trim();
            }

            totalCount++;

            let isActive = true;
            // Check active column if present
            if (row['Active'] !== undefined) {
              const activeVal = String(row['Active']).trim().toUpperCase();
              if (activeVal === 'FALSE' || activeVal === 'NO' || activeVal === '0') {
                isActive = false;
              }
            }

            if (isActive) {
              activeCount++;
              const typeKey = type || 'Unknown';
              typesCount[typeKey] = (typesCount[typeKey] || 0) + 1;
              
              if (!seen.has(val)) {
                seen.add(val);
                items.push({ number: val, type: type || undefined });
              }
            } else {
              inactiveCount++;
            }
          });
          
          setUploadStats({
            total: totalCount,
            active: activeCount,
            inactive: inactiveCount,
            byType: typesCount
          });

          // Format text area with: NUMBER, TYPE
          setBulkInput(items.map(i => i.type ? `${i.number}, ${i.type}` : i.number).join('\n'));
        }
      });
    }
    e.target.value = '';
  };

  const downloadAllAsPDF = async () => {
    if (generatedList.length === 0) return;
    setIsExporting(true);
    
    try {
      const { jsPDF } = await import('jspdf');
      
      const elements = document.querySelectorAll('.qr-card-export-target');
      if (elements.length === 0) {
        setIsExporting(false);
        return;
      }

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const margin = 15;
      const spacing = 10;
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const cols = 2;
      const cardWidthMM = (pdfWidth - (margin * 2) - spacing) / cols;
      let currentY = margin;

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        const dataUrl = await toPng(el, { cacheBust: true, quality: 1, pixelRatio: 2 });
        
        const img = new Image();
        img.src = dataUrl;
        await new Promise(resolve => { img.onload = resolve; });
        
        const cardHeightMM = (img.height / img.width) * cardWidthMM;

        const col = i % cols;
        const x = margin + col * (cardWidthMM + spacing);
        
        if (i > 0 && col === 0) {
           currentY += cardHeightMM + spacing;
        }

        if (currentY + cardHeightMM > pdfHeight - margin) {
           pdf.addPage();
           currentY = margin;
        }

        pdf.addImage(dataUrl, 'PNG', x, currentY, cardWidthMM, cardHeightMM);
      }

      pdf.save('Bulk_QR_Codes.pdf');
    } catch (err) {
      console.error('Error generating PDF', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto bg-slate-50">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Vehicle QR Generator</h1>
            <p className="text-slate-500 mt-1">Generate unified QR code assets for vehicles</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button
              onClick={() => setMode('single')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'single' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Single
            </button>
            <button
              onClick={() => setMode('bulk')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'bulk' 
                ? 'bg-indigo-600 text-white shadow-md' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              Bulk
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Controls Panel */}
          <div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              {mode === 'single' ? (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    value={singleInput}
                    onChange={(e) => setSingleInput(e.target.value)}
                    placeholder="e.g. DL51EV-0241"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 uppercase transition-all mb-4"
                  />
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Vehicle Type (Optional)
                  </label>
                  <input
                    type="text"
                    value={singleTypeInput}
                    onChange={(e) => setSingleTypeInput(e.target.value)}
                    placeholder="e.g. Primary - Auto Tipper"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 uppercase transition-all"
                  />
                  <button
                    onClick={handleGenerateSingle}
                    disabled={!singleInput.trim()}
                    className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors"
                  >
                    Generate QR
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <label className="block text-sm font-bold text-slate-700">
                      Vehicle Numbers (List)
                    </label>
                    <label className="cursor-pointer flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md hover:bg-indigo-100 transition-colors">
                      <Upload size={12} /> Upload CSV
                      <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                  <textarea
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    placeholder="DL51EV-0241&#10;UP80CD-1234&#10;..."
                    className="w-full h-48 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 uppercase transition-all resize-none"
                  />
                  <p className="text-xs text-slate-500 mt-2">Enter one number per line or separated by commas.</p>
                  
                  {uploadStats && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-xl text-sm border border-slate-200">
                      <div className="flex justify-between items-center pb-3 mb-3 border-b border-slate-200">
                        <span className="font-bold text-slate-700">Total Found: {uploadStats.total}</span>
                        <div className="flex gap-4">
                          <span className="font-bold text-emerald-600">Active: {uploadStats.active}</span>
                          <span className="font-bold text-rose-600">Inactive: {uploadStats.inactive}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider text-center">Active by Type</div>
                        <div className="overflow-hidden rounded-lg border border-slate-200">
                          <table className="w-full text-sm text-center">
                            <thead className="bg-slate-200 text-slate-700">
                              <tr>
                                <th className="px-4 py-2 font-bold border-r border-slate-200 w-16">Sr. No.</th>
                                <th className="px-4 py-2 font-bold border-r border-slate-200">Vehicle Type</th>
                                <th className="px-4 py-2 font-bold">Count</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white text-slate-700">
                              {Object.entries(uploadStats.byType).map(([t, count], idx) => (
                                <tr key={t}>
                                  <td className="px-4 py-2 font-medium border-r border-slate-200 text-slate-500">{idx + 1}</td>
                                  <td className="px-4 py-2 font-medium border-r border-slate-200">{t}</td>
                                  <td className="px-4 py-2 font-bold">{count}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleGenerateBulk}
                    disabled={!bulkInput.trim()}
                    className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors"
                  >
                    Generate {bulkInput.split(/[\n,]+/).filter(i => i.trim()).length || 0} QR Codes
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Preview Panel */}
          <div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[500px]">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
                <h3 className="text-lg font-bold text-slate-800">Generated QR Codes</h3>
                <div className="flex items-center gap-4">
                  {generatedList.length > 0 && uniqueTypes.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setFilterTypes([])}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          filterTypes.length === 0 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        All Types
                      </button>
                      {uniqueTypes.map(t => (
                        <button
                          key={t}
                          onClick={() => {
                            if (filterTypes.includes(t)) {
                              setFilterTypes(filterTypes.filter(type => type !== t));
                            } else {
                              setFilterTypes([...filterTypes, t]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                            filterTypes.includes(t)
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                  {displayedList.length > 1 && (
                    <button 
                      onClick={downloadAllAsPDF}
                      disabled={isExporting}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-sm transition-colors whitespace-nowrap"
                    >
                      <Download size={16} /> {isExporting ? 'Exporting...' : 'Bulk Export PDF'}
                    </button>
                  )}
                </div>
              </div>

              {generatedList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                  <Smartphone size={64} className="mb-4 text-slate-200" />
                  <p className="text-lg font-medium">No QR codes generated yet</p>
                  <p className="text-sm">Enter a vehicle number to see the preview here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-2 gap-8 justify-items-center">
                  {displayedList.map((item, idx) => (
                    <QRCodeCard key={idx} vehicle={item} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeGenerator;
