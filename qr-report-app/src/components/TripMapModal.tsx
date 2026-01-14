import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { type TripEvent, SecondaryTripReportService } from '../utils/secondaryTripReportService';
import { X } from 'lucide-react';

// Fix Icons
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
    trip: TripEvent;
    onClose: () => void;
}

const FitBounds = ({ path }: { path: number[][] }) => {
    const map = useMap();
    useEffect(() => {
        if (path.length > 0) {
            const bounds = L.latLngBounds(path.map(p => [p[0], p[1]]));
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [path, map]);
    return null;
};

const TripMapModal: React.FC<Props> = ({ trip, onClose }) => {
    const polygons = SecondaryTripReportService.getPolygons();
    const polygon = polygons.find(p => p.id === trip.dumpId);

    // Convert GeoJSON polygon to Leaflet expected format
    const polyCoords = polygon
        ? polygon.geojson.geometry.coordinates[0].map((c: any) => [c[1], c[0]] as [number, number])
        : [];

    const path = trip.path || [];
    const startPoint = path.length > 0 ? path[0] : null;
    const endPoint = path.length > 0 ? path[path.length - 1] : null;

    return (
        <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl h-[80vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800">Trip Visualization</h3>
                        <p className="text-xs text-gray-500">
                            Vehicle: <span className="font-mono font-bold text-blue-600">{trip.vehicleNo}</span> •
                            Zone: <span className="font-bold">{trip.dumpName}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 relative">
                    <MapContainer center={startPoint ? [startPoint[0], startPoint[1]] : [27.4924, 77.6737]} zoom={13} style={{ height: "100%", width: "100%" }}>
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                        {/* Dump Zone */}
                        {polyCoords.length > 0 && (
                            <Polygon positions={polyCoords} pathOptions={{ color: 'purple', fillColor: 'purple', fillOpacity: 0.1 }} />
                        )}

                        {/* Path */}
                        <Polyline positions={path as L.LatLngExpression[]} color="blue" weight={4} opacity={0.7} />

                        {/* Entry */}
                        {startPoint && (
                            <Marker position={startPoint as L.LatLngExpression}>
                                <Popup>Entry: {new Date(trip.entryTime).toLocaleTimeString()}</Popup>
                            </Marker>
                        )}

                        {/* Exit */}
                        {endPoint && (
                            <Marker position={endPoint as L.LatLngExpression}>
                                <Popup>Exit: {new Date(trip.exitTime).toLocaleTimeString()}</Popup>
                            </Marker>
                        )}

                        <FitBounds path={path} />
                    </MapContainer>
                </div>

                <div className="p-4 bg-white border-t flex gap-6 text-sm">
                    <div>
                        <span className="text-gray-400 block text-xs uppercase">Duration</span>
                        <span className="font-bold text-gray-800">{trip.durationMinutes} min</span>
                    </div>
                    <div>
                        <span className="text-gray-400 block text-xs uppercase">Status</span>
                        <span className={`font-bold px-2 py-0.5 rounded text-xs ${trip.isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {trip.isValid ? 'Valid' : 'Invalid (<2m)'}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TripMapModal;
