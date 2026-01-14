import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import {
    Map as MapIcon,
    FileDown,
    Loader2,
    AlertCircle,
    Truck
} from 'lucide-react';
import { SecondaryTripReportService, type TripEvent, type Vehicle, type DumpPolygon } from '../utils/secondaryTripReportService';
import PolygonMapManager from './PolygonMapManager';
import TripMapModal from './TripMapModal';

const SecondaryTripReport: React.FC = () => {
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [polygons, setPolygons] = useState<DumpPolygon[]>([]);

    // Filters
    const [selectedVehicle, setSelectedVehicle] = useState('All');
    const [selectedZone, setSelectedZone] = useState('All');
    const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
    const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

    const [trips, setTrips] = useState<TripEvent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState<string | null>(null);

    const [showPolygonManager, setShowPolygonManager] = useState(false);
    const [selectedTrip, setSelectedTrip] = useState<TripEvent | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const list = await SecondaryTripReportService.getLiveVehicles();
            setVehicles(list);
            const polyList = SecondaryTripReportService.getPolygons();
            setPolygons(polyList);
        } catch (err) {
            console.error(err);
            setError("Failed to load initial data.");
        }
    };

    // Reload polygons when closing manager
    const handleClosePolygonManager = () => {
        setShowPolygonManager(false);
        const polyList = SecondaryTripReportService.getPolygons();
        setPolygons(polyList);
    };

    const handleGenerate = async () => {
        const currentPolygons = SecondaryTripReportService.getPolygons();
        if (currentPolygons.length === 0) {
            setError("No Dump Zones defined. Please click 'Manage Dump Zones' to create one.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setTrips([]);

        try {
            // Filter target vehicles
            const targetVehicles = selectedVehicle === 'All'
                ? vehicles
                : vehicles.filter(v => v.vehicleNo === selectedVehicle);

            if (targetVehicles.length === 0) {
                setError("No vehicles found.");
                setIsLoading(false);
                return;
            }

            // Filter target polygons
            const targetPolygons = selectedZone === 'All'
                ? currentPolygons
                : currentPolygons.filter(p => p.id === selectedZone);

            if (targetPolygons.length === 0) {
                setError("Selected Dump Zone not found.");
                setIsLoading(false);
                return;
            }

            const allTrips: TripEvent[] = [];
            let processed = 0;

            for (const vehicle of targetVehicles) {
                setProgress(`Processing ${vehicle.vehicleNo} (${processed + 1}/${targetVehicles.length})...`);

                const history = await SecondaryTripReportService.getVehicleHistory(
                    vehicle.dvc_id || vehicle.vehicleNo,
                    dateFrom,
                    dateTo
                );

                if (history.length > 0) {
                    const vehicleTrips = SecondaryTripReportService.analyzeTrips(history, targetPolygons);
                    allTrips.push(...vehicleTrips);
                }

                processed++;
                await new Promise(r => setTimeout(r, 10));
            }

            setTrips(allTrips);
            if (allTrips.length === 0) {
                console.log("No trips detected.");
            }

        } catch (err) {
            console.error(err);
            setError("Error generating report. See console.");
        } finally {
            setIsLoading(false);
            setProgress('');
        }
    };

    const exportToExcel = () => {
        const headers = [
            "Vehicle Number", "Dump Zone", "Entry Time", "Exit Time", "Duration (Min)", "Status"
        ];
        const data = trips.map(t => [
            t.vehicleNo,
            t.dumpName,
            new Date(t.entryTime).toLocaleString(),
            t.exitTime ? new Date(t.exitTime).toLocaleString() : '-',
            t.durationMinutes,
            t.isValid ? 'Valid' : 'Invalid'
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Secondary Trips");
        XLSX.writeFile(wb, `Secondary_Trip_Report_${dateFrom}_${dateTo}.xlsx`);
    };

    const exportToPDF = async () => {
        const doc = new jsPDF('landscape');

        doc.text("Secondary Trip Report (Dump Polygon)", 14, 20);
        doc.setFontSize(10);
        doc.text(`From: ${dateFrom} To: ${dateTo}`, 14, 26);

        const tableHeaders = [
            "Vehicle", "Dump Zone", "Entry Time", "Exit Time", "Duration", "Status"
        ];
        const tableData = trips.map(t => [
            t.vehicleNo,
            t.dumpName,
            new Date(t.entryTime).toLocaleString(),
            t.exitTime ? new Date(t.exitTime).toLocaleString() : '-',
            t.durationMinutes + ' min',
            t.isValid ? 'Valid' : 'Invalid'
        ]);

        (doc as any).autoTable({
            head: [tableHeaders],
            body: tableData,
            startY: 35,
        });

        doc.save(`Secondary_Trip_Report_${dateFrom}_${dateTo}.pdf`);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <Truck className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">Secondary Trip Report</h1>
                        <p className="text-sm text-gray-500">Geofenced Dump Zone Tracking</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowPolygonManager(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                    <MapIcon className="w-4 h-4" /> Manage Dump Zones
                </button>
            </div>

            {/* Controls */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
                        <select
                            value={selectedVehicle}
                            onChange={e => setSelectedVehicle(e.target.value)}
                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 ring-blue-500"
                        >
                            <option value="All">All Vehicles</option>
                            {vehicles.map(v => (
                                <option key={v.vehicleNo} value={v.vehicleNo}>{v.vehicleNo}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dump Zone</label>
                        <select
                            value={selectedZone}
                            onChange={e => setSelectedZone(e.target.value)}
                            className="w-full p-2 border rounded-lg outline-none focus:ring-2 ring-blue-500"
                        >
                            <option value="All">All Zones</option>
                            {polygons.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="h-10 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Generate Report'}
                    </button>
                </div>
                {isLoading && <p className="mt-2 text-sm text-blue-600 animate-pulse">{progress}</p>}
                {error && <p className="mt-2 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</p>}
            </div>

            {/* Results */}
            {trips.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex justify-end gap-2">
                        <button onClick={exportToExcel} className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded shadow-sm hover:bg-green-700 text-sm">
                            <FileDown className="w-4 h-4" /> Excel
                        </button>
                        <button onClick={exportToPDF} className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded shadow-sm hover:bg-red-700 text-sm">
                            <FileDown className="w-4 h-4" /> PDF
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3">Vehicle</th>
                                    <th className="px-4 py-3">Dump Zone</th>
                                    <th className="px-4 py-3">Entry Time</th>
                                    <th className="px-4 py-3">Exit Time</th>
                                    <th className="px-4 py-3">Duration</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-center">Map</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trips.map(trip => (
                                    <tr key={trip.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                        <td className="px-4 py-3 font-medium">{trip.vehicleNo}</td>
                                        <td className="px-4 py-3 text-gray-600">{trip.dumpName}</td>
                                        <td className="px-4 py-3 text-gray-600">{new Date(trip.entryTime).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-gray-600">{trip.exitTime ? new Date(trip.exitTime).toLocaleString() : '-'}</td>
                                        <td className="px-4 py-3 font-mono">{trip.durationMinutes} m</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-0.5 rounded text-xs border ${trip.isValid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                {trip.isValid ? 'Valid' : 'Invalid'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => setSelectedTrip(trip)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                                title="View Map"
                                            >
                                                <MapIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : !isLoading && !error && (
                <div className="text-center p-12 bg-white rounded-xl border border-gray-100 text-gray-400">
                    <p>No trips generated. Select filters and click Generate.</p>
                </div>
            )}

            {/* Modals */}
            {showPolygonManager && <PolygonMapManager onClose={handleClosePolygonManager} />}
            {selectedTrip && <TripMapModal trip={selectedTrip} onClose={() => setSelectedTrip(null)} />}
        </div>
    );
};

export default SecondaryTripReport;
