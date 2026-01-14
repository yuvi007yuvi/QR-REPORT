import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css'; // Fix: Import Leaflet CSS
import * as turf from '@turf/turf';
import { Trash2, Save, Plus, Map as MapIcon, X } from 'lucide-react';
import { SecondaryTripReportService, type DumpPolygon } from '../utils/secondaryTripReportService';

// Fix Leaflet marker icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface Props {
    onClose: () => void;
}

const PolygonMapManager: React.FC<Props> = ({ onClose }) => {
    const [polygons, setPolygons] = useState<DumpPolygon[]>([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentPoints, setCurrentPoints] = useState<L.LatLngExpression[]>([]);
    const [newPolygonName, setNewPolygonName] = useState('');

    useEffect(() => {
        loadPolygons();
    }, []);

    const loadPolygons = () => {
        const saved = SecondaryTripReportService.getPolygons();
        setPolygons(saved);
    };

    const handleSavePolygon = () => {
        if (!newPolygonName || currentPoints.length < 3) {
            alert("Please enter a name and draw a polygon with at least 3 points.");
            return;
        }

        // Close key path to make it a polygon (first == last)
        const closedRing = [...currentPoints, currentPoints[0]];
        const coordinates = closedRing.map((p: any) => [p.lng, p.lat]); // Turf uses [lng, lat]

        const newPoly: DumpPolygon = {
            id: crypto.randomUUID(),
            name: newPolygonName,
            createdAt: new Date().toISOString(),
            geojson: turf.polygon([coordinates])
        };

        const updated = [...polygons, newPoly];
        SecondaryTripReportService.savePolygons(updated);
        setPolygons(updated);
        setCurrentPoints([]);
        setIsDrawing(false);
        setNewPolygonName('');
    };

    const handleDelete = (id: string) => {
        if (confirm('Delete this polygon?')) {
            const updated = polygons.filter(p => p.id !== id);
            SecondaryTripReportService.savePolygons(updated);
            setPolygons(updated);
        }
    };

    const DrawingEvents = () => {
        useMapEvents({
            click(e) {
                if (isDrawing) {
                    setCurrentPoints(prev => [...prev, e.latlng]);
                }
            }
        });
        return null;
    };

    const [mapLayer, setMapLayer] = useState<'street' | 'satellite'>('street');

    const tileLayerUrl = mapLayer === 'street'
        ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        : 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

    const tileAttr = mapLayer === 'street'
        ? '&copy; OpenStreetMap contributors'
        : 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community';

    return (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col">
            {/* Header ... */}
            <div className="h-16 border-b px-6 flex items-center justify-between bg-white shadow-sm z-10">
                <div className="flex items-center gap-2">
                    <MapIcon className="text-purple-600" />
                    <h2 className="text-xl font-bold font-sans">Dump Zone Manager</h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <X className="w-6 h-6 text-gray-500" />
                </button>
            </div>

            <div className="flex-1 flex">
                <div className="w-80 border-r bg-gray-50 p-4 flex flex-col gap-6 overflow-y-auto">
                    {/* ... Sidebar Controls ... */}
                    {/* Drawing Tools */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <Plus className="w-4 h-4" /> Add New Zone
                        </h3>
                        {/* ... (rest of controls) ... */}
                        {!isDrawing ? (
                            <button
                                onClick={() => setIsDrawing(true)}
                                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
                            >
                                Start Drawing
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs text-blue-600 font-medium bg-blue-50 p-2 rounded">
                                    Click on map to add points. Needs 3+ points.
                                </p>
                                <input
                                    type="text"
                                    placeholder="Zone Name (e.g. Dump Site A)"
                                    className="w-full p-2 border rounded text-sm"
                                    value={newPolygonName}
                                    onChange={e => setNewPolygonName(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSavePolygon}
                                        className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                                    >
                                        <Save className="w-4 h-4 inline mr-1" /> Save
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsDrawing(false);
                                            setCurrentPoints([]);
                                        }}
                                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* List */}
                    <div className="flex-1">
                        <h3 className="font-bold text-gray-700 mb-3 text-sm uppercase tracking-wider">Existing Zones</h3>
                        <div className="space-y-2">
                            {polygons.length === 0 && <p className="text-sm text-gray-400 italic">No zones defined.</p>}
                            {polygons.map(poly => (
                                <div key={poly.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between group">
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">{poly.name}</p>
                                        <p className="text-[10px] text-gray-400">Created: {new Date(poly.createdAt).toLocaleDateString()}</p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(poly.id)}
                                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Map */}
                <div className="flex-1 relative bg-gray-100">
                    <MapContainer
                        center={[27.4924, 77.6737]}
                        zoom={12}
                        style={{ height: "100%", width: "100%" }}
                        className="z-0"
                    >
                        <TileLayer
                            url={tileLayerUrl}
                            attribution={tileAttr}
                        />

                        {/* Layer Toggle */}
                        <div className="leaflet-top leaflet-right">
                            <div className="leaflet-control leaflet-bar">
                                <a
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); setMapLayer(prev => prev === 'street' ? 'satellite' : 'street'); }}
                                    className="bg-white text-black p-2 font-bold text-xs hover:bg-gray-100 flex items-center justify-center w-auto px-3 no-underline"
                                    title="Toggle Satellite View"
                                    style={{ width: 'auto', height: 'auto', lineHeight: 'normal' }}
                                >
                                    {mapLayer === 'street' ? '🛰️ Satellite' : '🗺️ Street'}
                                </a>
                            </div>
                        </div>

                        <DrawingEvents />

                        {/* Drawing Preview */}
                        {isDrawing && currentPoints.length > 0 && (
                            <>
                                <Polyline positions={currentPoints} color="blue" dashArray="5, 10" />
                                {currentPoints.map((pos, idx) => (
                                    <Marker key={idx} position={pos as L.LatLngExpression} />
                                ))}
                            </>
                        )}

                        {/* Existing Polygons */}
                        {polygons.map(poly => {
                            // Turf Polygon coords are [[[lng, lat], ...]] (nested array)
                            // Leaflet needs [[lat, lng], ...]
                            const coords = poly.geojson.geometry.coordinates[0].map((c: any) => [c[1], c[0]] as L.LatLngExpression);
                            return (
                                <Polygon
                                    key={poly.id}
                                    positions={coords}
                                    pathOptions={{ color: 'purple', fillColor: 'purple', fillOpacity: 0.2 }}
                                />
                            );
                        })}
                    </MapContainer>
                </div>
            </div>
        </div>
    );
};

export default PolygonMapManager;
