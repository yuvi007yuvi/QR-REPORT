import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
    Search,
    Truck,
    Clock,
    AlertCircle,
    Play,
    Download,
    FileDown
} from 'lucide-react';
import { SecondaryTripReportService, type Vehicle } from '../utils/secondaryTripReportService';
import * as XLSX from 'xlsx';

// Fix Leaflet Icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const FitBounds = ({ path }: { path: [number, number][] }) => {
    const map = useMap();
    useEffect(() => {
        if (path.length > 0) {
            const bounds = L.latLngBounds(path);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [path, map]);
    return null;
};

const SecondaryVehicleHistory: React.FC = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

    // Initial Date Range: Today 6AM to 2PM (Simulating specific times from screenshot)
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date();
        d.setHours(6, 0, 0, 0);
        return d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
    });
    const [dateTo, setDateTo] = useState(() => {
        const d = new Date();
        d.setHours(14, 0, 0, 0);
        return d.toISOString().slice(0, 16);
    });

    const [history, setHistory] = useState<Vehicle[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadVehicles();
    }, []);

    const loadVehicles = async () => {
        try {
            const list = await SecondaryTripReportService.getLiveVehicles();
            setVehicles(list);
        } catch (err) {
            console.error(err);
        }
    };

    const handleFetchHistory = async () => {
        if (!selectedVehicle) return;

        setLoading(true);
        setError(null);
        setHistory([]);

        // Convert UI datetime-local string to proper format for API if needed
        // Assuming API takes YYYY-MM-DD (as per previous code), but for "Hours" precision we normally send full timestamps.
        // For now, retaining the YYYY-MM-DD logic from previous iterations or updating if API supports time.
        // The screenshot shows specific times "Jan 4, 2026 6:00 AM". 
        // We will pass the full ISO string or substring as required.
        // Let's assume the API can handle the YYYY-MM-DD or we extract it.
        // Current API usage in SecondaryTripReport.tsx uses just date. 
        // We will strip just the date part for now to match existing API contract 
        // UNLESS the API actually supports time. 
        // Given the requirement "like the screenshot", the UI will show Time, 
        // but we might need to send just Date if the backend is limited.
        // We'll try sending just date for safety as per existing working code, 
        // or let's try to be smart:
        const datePartFrom = dateFrom.split('T')[0];
        const datePartTo = dateTo.split('T')[0];

        try {
            const data = await SecondaryTripReportService.getVehicleHistory(
                selectedVehicle.dvc_id || selectedVehicle.vehicleNo,
                datePartFrom,
                datePartTo,
                selectedVehicle.provider
            );

            if (data.length === 0) {
                setError("No history records found for this period.");
            } else {
                setHistory(data);
            }
        } catch (err: any) {
            setError(err.message || "Failed to fetch history");
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setHistory([]);
        setError(null);
    };

    // Filter vehicles
    const filteredVehicles = vehicles.filter(v =>
        v.vehicleNo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Prepare Map Path
    const path: [number, number][] = history.map(h => [h.lat, h.lng]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                // Map fields flexibly (handling different casing or names)
                const mappedHistory: Vehicle[] = data.map((row: any) => ({
                    sNo: 0,
                    vehicleNo: row.VehicleNo || row.Vehicle || row.name || 'Unknown',
                    dvc_id: row.dvc_id || '',
                    lat: parseFloat(row.Lat || row.lat || row.Latitude || 0),
                    lng: parseFloat(row.Lng || row.lng || row.Longitude || 0),
                    speed: parseFloat(row.Speed || row.speed || 0),
                    datetime: row.Timestamp || row.datetime || row.Time || new Date().toISOString(),
                    provider: row.Provider || 'imported'
                })).filter(v => v.lat && v.lng); // Valid coords only

                if (mappedHistory.length > 0) {
                    setHistory(mappedHistory);
                    setError(null);
                    // Update bounds/view to match new data
                    if (mappedHistory[0].vehicleNo) {
                        // Create a dummy vehicle object for context if needed, or just let the map render
                        setSelectedVehicle(mappedHistory[0]);
                    }
                } else {
                    setError("No valid GPS data found in file.");
                }
            } catch (err) {
                console.error(err);
                setError("Failed to parse file.");
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleExportExcel = () => {
        if (history.length === 0) return;
        const ws = XLSX.utils.json_to_sheet(history.map(h => ({
            Timestamp: h.datetime,
            VehicleNo: h.vehicleNo,
            Provider: h.provider,
            Lat: h.lat,
            Lng: h.lng,
            Speed: h.speed
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "History");
        XLSX.writeFile(wb, `History_${selectedVehicle?.vehicleNo || 'Import'}.xlsx`);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] bg-white animate-in fade-in duration-500 font-sans">

            {/* Top Control Bar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b border-gray-200 bg-gray-50 gap-4">
                {/* Search & Counts */}
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative w-64">
                        <input
                            type="text"
                            placeholder="Search Vehicle..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-3 pr-10 py-2 bg-white border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                        />
                        <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                    </div>
                </div>

                {/* Date & Time Controls */}
                <div className="flex items-center gap-2 flex-1 justify-center">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-gray-300 rounded shadow-sm">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <input
                            type="datetime-local"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="bg-transparent border-none text-sm focus:ring-0 outline-none text-gray-700"
                        />
                    </div>
                    <span className="text-gray-400">-</span>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-gray-300 rounded shadow-sm">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <input
                            type="datetime-local"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="bg-transparent border-none text-sm focus:ring-0 outline-none text-gray-700"
                        />
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    <button className="p-2 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 text-blue-600" title="Play History">
                        <Play className="w-5 h-5 fill-current" />
                    </button>
                    <button
                        onClick={handleFetchHistory}
                        disabled={!selectedVehicle || loading}
                        className="px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded shadow-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Fetching...' : 'Fetch data'}
                    </button>
                    <button
                        onClick={handleClear}
                        className="px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded shadow-sm hover:bg-gray-800"
                    >
                        Clear
                    </button>

                    {/* Export/Import Controls */}
                    <div className="flex bg-white rounded shadow-sm border border-gray-300 overflow-hidden">
                        <label className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-r border-gray-300" title="Import Excel/CSV">
                            <input type="file" accept=".csv, .xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                            <FileDown className="w-4 h-4 text-gray-600 transform rotate-180" /> {/* Upload Icon equivalent */}
                        </label>
                        <button onClick={handleExportExcel} className="px-3 py-2 hover:bg-gray-50 text-green-600" title="Export Excel">
                            <Download className="w-4 h-4" />
                        </button>
                        <button className="px-3 py-2 hover:bg-gray-50 text-blue-400" title="Save KML">
                            <Download className="w-4 h-4" />
                        </button>
                    </div>

                    <button className="px-4 py-2 bg-green-500 text-white text-sm font-medium rounded shadow-sm hover:bg-green-600">
                        GPS Reports
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">

                {/* Left Sidebar List */}
                <div className="w-80 border-r border-gray-200 bg-white flex flex-col z-10 shadow-lg">
                    {/* Filter Row */}
                    <div className="p-2 border-b border-gray-100 flex gap-2">
                        <select className="flex-1 p-1.5 text-xs bg-gray-50 border border-gray-200 rounded">
                            <option>Zone: All</option>
                        </select>
                        <select className="flex-1 p-1.5 text-xs bg-gray-50 border border-gray-200 rounded">
                            <option>Ward: All</option>
                        </select>
                    </div>

                    <div className="px-3 py-2 bg-gray-50 text-xs text-gray-500 flex justify-between border-b border-gray-200">
                        <span>Total: {vehicles.length}</span>
                        <div className="flex gap-3">
                            <span className="text-blue-600 font-semibold">Pri: {vehicles.filter(v => v.provider === 'primary').length}</span>
                            <span className="text-purple-600 font-semibold">Sec: {vehicles.filter(v => v.provider === 'secondary').length}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {filteredVehicles.map((v) => {
                            // Simulated status for UI demo
                            // const isRunning = v.speed && v.speed > 0;

                            return (
                                <div
                                    key={v.vehicleNo}
                                    onClick={() => {
                                        setSelectedVehicle(v);
                                        setHistory([]);
                                        setError(null);
                                    }}
                                    className={`p - 3 border - b border - gray - 100 hover: bg - blue - 50 cursor - pointer transition flex items - start gap - 3 ${selectedVehicle?.vehicleNo === v.vehicleNo ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''} `}
                                >
                                    <div className="mt-1">
                                        {/* Car Icon Placeholder */}
                                        <div className={`w - 8 h - 8 rounded - full flex items - center justify - center ${v.provider === 'primary' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'} `}>
                                            <Truck className="w-5 h-5 transform -scale-x-100" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-bold text-gray-800 text-sm truncate">{v.vehicleNo}</h4>
                                            <span className={`px - 2 py - 0.5 rounded text - [10px] text - white ${v.speed > 0 ? 'bg-green-500' : 'bg-orange-400'} `}>
                                                {v.speed > 0 ? 'Running' : 'Standing'}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-1 grid grid-cols-2 gap-x-2">
                                            <span>Zone: N/A</span>
                                            <span>Ward: N/A</span>
                                            <span className="col-span-2 truncate">Model Type: {v.provider === 'primary' ? 'NatureGreen' : 'Secondary'}</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Map Area */}
                <div className="flex-1 relative bg-gray-100">
                    {error && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-50 text-red-600 px-4 py-2 rounded shadow-lg z-[1000] flex items-center gap-2 text-sm border border-red-200">
                            <AlertCircle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    {!selectedVehicle && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50/80 z-[800]">
                            <Truck className="w-16 h-16 text-gray-300 mb-4" />
                            <p className="text-gray-500 font-medium">Select a vehicle to view metrics</p>
                        </div>
                    )}

                    <MapContainer center={[27.4924, 77.6737]} zoom={13} style={{ height: '100%', width: '100%' }}>
                        <LayersControl position="topleft">
                            <LayersControl.BaseLayer checked name="Map">
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution="&copy; OpenStreetMap contributors"
                                />
                            </LayersControl.BaseLayer>
                            <LayersControl.BaseLayer name="Satellite">
                                <TileLayer
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    attribution="Tiles &copy; Esri"
                                />
                            </LayersControl.BaseLayer>
                        </LayersControl>

                        {path.length > 0 && (
                            <>
                                <Polyline positions={path} color="#3b82f6" weight={5} opacity={0.8} />
                                <Marker position={path[0]}>
                                    <Popup>Start: {new Date(history[0].datetime).toLocaleString()}</Popup>
                                </Marker>
                                <Marker position={path[path.length - 1]}>
                                    <Popup>End: {new Date(history[history.length - 1].datetime).toLocaleString()}</Popup>
                                </Marker>
                                <FitBounds path={path} />
                            </>
                        )}
                    </MapContainer>

                    {/* Map Overlay Stats (Optional) */}
                    {history.length > 0 && (
                        <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur p-4 rounded-lg shadow-lg border border-gray-200 z-[900] text-xs">
                            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                <span className="text-gray-500">Total Points:</span>
                                <span className="font-mono font-bold">{history.length}</span>
                                <span className="text-gray-500">Distance:</span>
                                <span className="font-mono font-bold">-- km</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SecondaryVehicleHistory;
