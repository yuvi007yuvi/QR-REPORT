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

const SECONDARY_API_KEY = '162814E902A9896655663D59F9BE98D5';
const BASE_URL = 'https://oempowersupply.in/naturegreen.php';

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
            // Using a CORS proxy to bypass browser restrictions
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            const targetUrl = encodeURIComponent(`${BASE_URL}?key=${SECONDARY_API_KEY}&cmd=ALL,*`);

            const response = await fetch(`${proxyUrl}${targetUrl}`);
            if (!response.ok) throw new Error('Failed to fetch from Secondary API');

            const text = await response.text();
            let data: any;
            try {
                data = JSON.parse(text);
            } catch (e) {
                console.warn("API response is not JSON:", text.substring(0, 100));
                data = [];
            }

            const vehicles: Vehicle[] = Array.isArray(data) ? data.map((v: any, index: number) => ({
                sNo: index + 1,
                vehicleNo: v.vehicle_no || v.name || 'Unknown',
                dvc_id: v.device_id || v.id || '',
                lat: parseFloat(v.lat),
                lng: parseFloat(v.lng),
                speed: parseFloat(v.speed || '0'),
                datetime: v.datetime || new Date().toISOString()
            })) : [];

            vehicleCache[cacheKey] = { data: vehicles, timestamp: now };
            return vehicles;

        } catch (error) {
            console.error("Error fetching vehicles:", error);
            return [];
        }
    },

    // 2. Fetch History
    async getVehicleHistory(deviceId: string, from: string, to: string): Promise<Vehicle[]> {
        // from/to format: YYYY-MM-DD
        const targetUrl = `${BASE_URL}?key=${SECONDARY_API_KEY}&cmd=TRACK,${deviceId},${from},${to}`;
        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(targetUrl);

        try {
            await fetch(proxyUrl);
            // Mocking return for now
            return [];
        } catch (e) {
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
