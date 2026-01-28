import * as turf from '@turf/turf';

// Types
export interface VehicleParams {
    key: string;
    cmd: string;
}

export interface Vehicle {
    sNo: number;
    vehicleNo: string;
    dvc_id: string; // Device ID
    lat: number;
    lng: number;
    speed: number;
    datetime: string; // "YYYY-MM-DD HH:mm:ss"
    provider?: 'primary' | 'secondary';
}

export interface DumpPolygon {
    id: string;
    name: string;
    geojson: any; // Using any to avoid type issues with Turf imports
    createdAt: string;
}

export interface TripEvent {
    id: string;
    vehicleNo: string;
    dumpId: string;
    dumpName: string;
    entryTime: string;
    exitTime: string;
    durationMinutes: number;
    isValid: boolean; // >= 2 mins
    status: 'In Progress' | 'Completed';
    path: number[][]; // [lat, lng] array
}

// Point to Local Backend Proxy
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api/gps/secondary';

// Cache structure
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const vehicleCache: { [key: string]: CacheEntry<Vehicle[]> } = {};
const CACHE_DURATION_MS = 2 * 60 * 1000; // 2 minutes

export const SecondaryTripReportService = {
    // 1. Fetch Vehicle List (Live)
    async getLiveVehicles(): Promise<Vehicle[]> {
        const cacheKey = 'all_vehicles';
        const now = Date.now();

        if (vehicleCache[cacheKey] && (now - vehicleCache[cacheKey].timestamp < CACHE_DURATION_MS)) {
            return vehicleCache[cacheKey].data;
        }

        try {
            // Call Local Backend
            const response = await fetch(`${BACKEND_URL}/live`, { cache: 'no-store' });

            if (!response.ok) {
                // If backend returns 4xx/5xx
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Backend API Error: ${response.status}`);
            }

            // Backend handles JSON parsing or text fallback. 
            // We expect JSON array from backend if success.
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const jsonResponse = await response.json();

                // If it's a wrapped success:false response
                if (jsonResponse.success === false) {
                    throw new Error(jsonResponse.message || "API reported failure");
                }

                // Handle both array [] and object { data: [] } formats
                const list = Array.isArray(jsonResponse) ? jsonResponse : (jsonResponse.data || []);

                const vehicles: Vehicle[] = Array.isArray(list) ? list.map((v: any, index: number) => ({
                    sNo: index + 1,
                    vehicleNo: v.name || v.vehicle_no || 'Unknown',
                    dvc_id: v.imei || v.device_id || v.id || '',
                    lat: parseFloat(v.lat),
                    lng: parseFloat(v.lng),
                    speed: parseFloat(v.speed || '0'),
                    datetime: v.dt_tracker || v.datetime || new Date().toISOString(),
                    provider: v.provider || 'secondary' // Fallback if missing
                })) : [];

                console.log(`[Frontend] Fetched ${vehicles.length} vehicles. P: ${vehicles.filter(v => v.provider === 'primary').length}, S: ${vehicles.filter(v => v.provider === 'secondary').length}`);

                vehicleCache[cacheKey] = { data: vehicles, timestamp: now };
                return vehicles;
            } else {
                // Not JSON (Backend couldn't parse 3rd party response)
                const text = await response.text();
                console.warn("Received non-JSON response from backend:", text.substring(0, 300));
                return [];
            }

        } catch (error) {
            console.error("Error fetching vehicles:", error);
            // Re-throw so the UI knows to show the "API Unavailable" alert
            throw error;
        }
    },

    // 2. Fetch History
    async getVehicleHistory(deviceId: string, from: string, to: string, provider?: string): Promise<Vehicle[]> {
        try {
            const url = `${BACKEND_URL}/history?deviceId=${deviceId}&from=${from}&to=${to}&provider=${provider || 'secondary'}`;
            const response = await fetch(url);

            if (!response.ok) {
                console.error(`Backend returned ${response.status}`);
                return [];
            }

            const contentType = response.headers.get("content-type");
            let data: any;

            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                const text = await response.text();
                try {
                    data = JSON.parse(text);
                } catch {
                    // Dynamic import for PapaParse to parse CSV if JSON fails
                    const Papa = (await import('papaparse')).default;
                    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
                    data = parsed.data;
                }
            }

            // Normalize Data
            if (!Array.isArray(data) && data?.data && Array.isArray(data.data)) {
                data = data.data;
            }

            if (Array.isArray(data)) {
                return data.map((row: any, index: number) => {
                    const lat = parseFloat(row.lat || row.latitude || '0');
                    const lng = parseFloat(row.lng || row.long || row.longitude || '0');

                    if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return null;

                    return {
                        sNo: index + 1,
                        vehicleNo: row.vehicle_name || row.vehicle_no || row.name || 'Unknown',
                        dvc_id: deviceId,
                        lat: lat,
                        lng: lng,
                        speed: parseFloat(row.speed || '0'),
                        datetime: row.dt_tracker || row.datetime || row.date_time || row.timestamp || new Date().toISOString()
                    };
                }).filter((v): v is Vehicle => v !== null);
            }

            return [];
        } catch (e) {
            console.error("Error fetching history", e);
            return [];
        }
    },

    // 3. Polygon Management
    savePolygons(polygons: DumpPolygon[]) {
        localStorage.setItem('dump_polygons', JSON.stringify(polygons));
    },

    getPolygons(): DumpPolygon[] {
        const data = localStorage.getItem('dump_polygons');
        if (data) {
            return JSON.parse(data);
        }

        // Default "Mathura MSW Plant"
        // lat: 27.50755594, lng: 77.708018
        // ~200m Box
        const defaultPoly: DumpPolygon = {
            id: 'default_msw_plant',
            name: 'Mathura MSW Plant (Default)',
            createdAt: new Date().toISOString(),
            geojson: turf.polygon([[
                [77.7070, 27.5065],
                [77.7090, 27.5065],
                [77.7090, 27.5085],
                [77.7070, 27.5085],
                [77.7070, 27.5065]
            ]])
        };

        return [defaultPoly];
    },

    // 4. Trip Detection Logic
    analyzeTrips(history: Vehicle[], polygons: DumpPolygon[]): TripEvent[] {
        const trips: TripEvent[] = [];

        // Convert history points to Turf points
        const points = history.map(h => ({
            point: turf.point([h.lng, h.lat]), // GeoJSON is Lng, Lat
            time: new Date(h.datetime).getTime(),
            vehicleNo: h.vehicleNo,
            raw: h
        })).sort((a, b) => a.time - b.time);

        let currentTrip: Partial<TripEvent> | null = null;

        for (const pt of points) {
            let insidePoly: DumpPolygon | null = null;
            for (const poly of polygons) {
                if (turf.booleanPointInPolygon(pt.point, poly.geojson)) {
                    insidePoly = poly;
                    break;
                }
            }

            const latLng = [pt.point.geometry.coordinates[1], pt.point.geometry.coordinates[0]]; // [lat, lng]

            if (insidePoly) {
                if (!currentTrip) {
                    // START
                    currentTrip = {
                        id: crypto.randomUUID(),
                        vehicleNo: pt.vehicleNo,
                        dumpId: insidePoly.id,
                        dumpName: insidePoly.name,
                        entryTime: new Date(pt.time).toISOString(),
                        status: 'In Progress',
                        path: [latLng]
                    };
                } else if (currentTrip.dumpId !== insidePoly.id) {
                    // SWITCH Polygons
                    this.closeTrip(currentTrip as TripEvent, new Date(pt.time).toISOString());
                    trips.push(currentTrip as TripEvent);

                    currentTrip = {
                        id: crypto.randomUUID(),
                        vehicleNo: pt.vehicleNo,
                        dumpId: insidePoly.id,
                        dumpName: insidePoly.name,
                        entryTime: new Date(pt.time).toISOString(),
                        status: 'In Progress',
                        path: [latLng]
                    };
                } else {
                    // CONTINUE
                    currentTrip.path?.push(latLng);
                }
            } else {
                if (currentTrip) {
                    // END
                    this.closeTrip(currentTrip as TripEvent, new Date(pt.time).toISOString());
                    trips.push(currentTrip as TripEvent);
                    currentTrip = null;
                }
            }
        }

        if (currentTrip) {
            this.closeTrip(currentTrip as TripEvent, new Date(points[points.length - 1].time).toISOString());
            trips.push(currentTrip as TripEvent);
        }

        return trips;
    },

    closeTrip(trip: TripEvent, exitTime: string) {
        trip.exitTime = exitTime;
        const start = new Date(trip.entryTime).getTime();
        const end = new Date(exitTime).getTime();
        const durationMins = (end - start) / (1000 * 60);
        trip.durationMinutes = Math.round(durationMins * 100) / 100;
        trip.isValid = durationMins >= 2;
        trip.status = 'Completed';
    }
};
