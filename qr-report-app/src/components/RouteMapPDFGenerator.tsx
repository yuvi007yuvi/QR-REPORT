import React, { useState, useRef } from 'react';
import {
    Upload,
    FileDown,
    Map as MapIcon,
    Route,
    CheckCircle,
    Loader2,
    Image as ImageIcon,
    Eye,
    X as CloseIcon,
    Filter,
    X,
    Building2,
    Search,
    ChevronDown,
    Check,
    Layers
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';
import { MASTER_SUPERVISORS } from '../data/master-supervisors';

// Import logos
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';

// Setup Leaflet Icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface RoutePoint {
    lat: number;
    lng: number;
    timestamp?: string;
}

interface RouteGroup {
    routeName: string;
    vehicleNo: string;
    points: RoutePoint[];
    wardName?: string;
    zoneName?: string;
    date?: string;
}

const FitBounds = ({ path }: { path: [number, number][] }) => {
    const map = useMap();
    React.useEffect(() => {
        if (path.length > 0) {
            const bounds = L.latLngBounds(path);
            map.fitBounds(bounds, { padding: [20, 20] });
        }
    }, [path, map]);
    return null;
};

// Hardcoded Route to Ward Mapping
const ROUTE_WARD_MAPPING: Record<string, { ward: string; name: string }> = {
    "W10R1": { "ward": "10-Aurangabad First", "name": "W10R1" },
    "W10R2": { "ward": "10-Aurangabad First", "name": "W10R2" },
    "W11R1": { "ward": "11-Tarsi", "name": "W11R1" },
    "W12ER3": { "ward": "12-Radhe Shyam Colony", "name": "W12ER3" },
    "W12MR1": { "ward": "12-Radhe Shyam Colony", "name": "W12MR1" },
    "W12R1": { "ward": "12-Radhe Shyam Colony", "name": "W12R1" },
    "W12R2": { "ward": "12-Radhe Shyam Colony", "name": "W12R2" },
    "W13R1": { "ward": "13-Sunrakh", "name": "W13R1" },
    "W13R2": { "ward": "13-Sunrakh", "name": "W13R2" },
    "W13R3": { "ward": "13-Sunrakh", "name": "W13R3" },
    "W14R1": { "ward": "14-Lakshmi Nagar Yamunapar", "name": "W14R1" },
    "W14R2": { "ward": "14-Lakshmi Nagar Yamunapar", "name": "W14R2" },
    "W15R1": { "ward": "15-Maholi First", "name": "W15R1" },
    "W15R2": { "ward": "15-Maholi First", "name": "W15R2" },
    "W16R1": { "ward": "16-Bakalpur", "name": "W16R1" },
    "W16R2": { "ward": "16-Bakalpur", "name": "W16R2" },
    "W16R3": { "ward": "16-Bakalpur", "name": "W16R3" },
    "W16R4": { "ward": "16-Bakalpur", "name": "W16R4" },
    "W16R5": { "ward": "16-Bakalpur", "name": "W16R5" },
    "W16R6": { "ward": "16-Bakalpur", "name": "W16R6" },
    "W17R1": { "ward": "17-Bairaagpura", "name": "W17R1" },
    "W18R1": { "ward": "18-General ganj", "name": "W18R1" },
    "W18R2": { "ward": "18-General ganj", "name": "W18R2" },
    "W18R3": { "ward": "18-General ganj", "name": "W18R3" },
    "W19R1": { "ward": "19-Ramnagar Yamunapar", "name": "W19R1" },
    "W19R2": { "ward": "19-Ramnagar Yamunapar", "name": "W19R2" },
    "W19R3": { "ward": "19-Ramnagar Yamunapar", "name": "W19R3" },
    "W19R4": { "ward": "19-Ramnagar Yamunapar", "name": "W19R4" },
    "W1R1": { "ward": "01-Birjapur", "name": "W1R1" },
    "W1R2": { "ward": "01-Birjapur", "name": "W1R2" },
    "W1R3": { "ward": "01-Birjapur", "name": "W1R3" },
    "W20R1": { "ward": "20-Krishna Nagar First", "name": "W20R1" },
    "W20R2": { "ward": "20-Krishna Nagar First", "name": "W20R2" },
    "W21R1": { "ward": "21-Chaitanya Bihar", "name": "W21R1" },
    "W21R2": { "ward": "21-Chaitanya Bihar", "name": "W21R2" },
    "W21R3": { "ward": "21-Chaitanya Bihar", "name": "W21R3" },
    "W21R4": { "ward": "21-Chaitanya Bihar", "name": "W21R4" },
    "W21R5": { "ward": "21-Chaitanya Bihar", "name": "W21R5" },
    "W21R6(C)": { "ward": "21-Chaitanya Bihar", "name": "W21R6(C)" },
    "W22R1": { "ward": "22-Badhri Nagar", "name": "W22R1" },
    "W22R2": { "ward": "22-Badhri Nagar", "name": "W22R2" },
    "W23R1": { "ward": "23-Aheer Pada", "name": "W23R1" },
    "W23R2": { "ward": "23-Aheer Pada", "name": "W23R2" },
    "W24MR1": { "ward": "24-Sarai Azamabad", "name": "W24MR1" },
    "W24R1": { "ward": "24-Sarai Azamabad", "name": "W24R1" },
    "W24R2": { "ward": "24-Sarai Azamabad", "name": "W24R2" },
    "W24R3": { "ward": "24-Sarai Azamabad", "name": "W24R3" },
    "W24R4(C)": { "ward": "24-Sarai Azamabad", "name": "W24R4(C)" },
    "W24R5": { "ward": "24-Sarai Azamabad", "name": "W24R5" },
    "W25R1": { "ward": "25-Chharaura", "name": "W25R1" },
    "W25R2": { "ward": "25-Chharaura", "name": "W25R2" },
    "W26R1": { "ward": "26-Naya Nagla", "name": "W26R1" },
    "W26R2": { "ward": "26-Naya Nagla", "name": "W26R2" },
    "W27R1": { "ward": "27-Baad", "name": "W27R1" },
    "W27R2": { "ward": "27-Baad", "name": "W27R2" },
    "W27R3": { "ward": "27-Baad", "name": "W27R3" },
    "W27R4": { "ward": "27-Baad", "name": "W27R4" },
    "W27R5": { "ward": "27-Baad", "name": "W27R5" },
    "W28R1": { "ward": "28-Aurangabad Second", "name": "W28R1" },
    "W28R2": { "ward": "28-Aurangabad Second", "name": "W28R2" },
    "W29R1": { "ward": "29-Koyla Alipur", "name": "W29R1" },
    "W2MR1": { "ward": "02-Ambedkar Nagar", "name": "W2MR1" },
    "W2R1": { "ward": "02-Ambedkar Nagar", "name": "W2R1" },
    "W2R2(C)": { "ward": "02-Ambedkar Nagar", "name": "W2R2(C)" },
    "W30R1": { "ward": "30-Krishna Nagar Second", "name": "W30R1" },
    "W30R2": { "ward": "30-Krishna Nagar Second", "name": "W30R2" },
    "W31R1": { "ward": "31-Navneet Nagar", "name": "W31R1" },
    "W31R2": { "ward": "31-Navneet Nagar", "name": "W31R2" },
    "W31R3": { "ward": "31-Navneet Nagar", "name": "W31R3" },
    "W32R1": { "ward": "32-Ranchibagar", "name": "W32R1" },
    "W32R2": { "ward": "32-Ranchibagar", "name": "W32R2" },
    "W32R3": { "ward": "32-Ranchibagar", "name": "W32R3" },
    "W32R4": { "ward": "32-Ranchibagar", "name": "W32R4" },
    "W33R1": { "ward": "33-Palikhera", "name": "W33R1" },
    "W33R2": { "ward": "33-Palikhera", "name": "W33R2" },
    "W33R3": { "ward": "33-Palikhera", "name": "W33R3" },
    "W33R4": { "ward": "33-Palikhera", "name": "W33R4" },
    "W33R5": { "ward": "33-Palikhera", "name": "W33R5" },
    "W34R1": { "ward": "34-Radhaniwas", "name": "W34R1" },
    "W34R2": { "ward": "34-Radhaniwas", "name": "W34R2" },
    "W34R3": { "ward": "34-Radhaniwas", "name": "W34R3" },
    "W34WBR1": { "ward": "34-Radhaniwas", "name": "W34WBR1" },
    "W35MR1": { "ward": "35-Bankhandi", "name": "W35MR1" },
    "W35R1": { "ward": "35-Bankhandi", "name": "W35R1" },
    "W35R2": { "ward": "35-Bankhandi", "name": "W35R2" },
    "W36R1": { "ward": "36-Jaisingh Pura", "name": "W36R1" },
    "W36R2": { "ward": "36-Jaisingh Pura", "name": "W36R2" },
    "W36R3": { "ward": "36-Jaisingh Pura", "name": "W36R3" },
    "W37R1": { "ward": "37-Baldevpuri", "name": "W37R1" },
    "W37R2": { "ward": "37-Baldevpuri", "name": "W37R2" },
    "W38R1": { "ward": "38-Civil Lines", "name": "W38R1" },
    "W38R2": { "ward": "38-Civil Lines", "name": "W38R2" },
    "W38R3": { "ward": "38-Civil Lines", "name": "W38R3" },
    "W39R1": { "ward": "39-Mahavidhya Colony", "name": "W39R1" },
    "W39R2": { "ward": "39-Mahavidhya Colony", "name": "W39R2" },
    "W39R3": { "ward": "39-Mahavidhya Colony", "name": "W39R3" },
    "W3R1": { "ward": "03-Girdharpur", "name": "W3R1" },
    "W3R2": { "ward": "03-Girdharpur", "name": "W3R2" },
    "W3R3": { "ward": "03-Girdharpur", "name": "W3R3" },
    "W3R4": { "ward": "03-Girdharpur", "name": "W3R4" },
    "W40R1": { "ward": "40-Rajkumar", "name": "W40R1" },
    "W40R2": { "ward": "40-Rajkumar", "name": "W40R2" },
    "W41MR1": { "ward": "41-Dhaulipiau", "name": "W41MR1" },
    "W41R1": { "ward": "41-Dhaulipiau", "name": "W41R1" },
    "W41R2": { "ward": "41-Dhaulipiau", "name": "W41R2" },
    "W41R3": { "ward": "41-Dhaulipiau", "name": "W41R3" },
    "W42R1": { "ward": "42-Manoharpur", "name": "W42R1" },
    "W42R2": { "ward": "42-Manoharpur", "name": "W42R2" },
    "W43R1": { "ward": "43-Ganeshra", "name": "W43R1" },
    "W43R2": { "ward": "43-Ganeshra", "name": "W43R2" },
    "W43R3": { "ward": "43-Ganeshra", "name": "W43R3" },
    "W43R4": { "ward": "43-Ganeshra", "name": "W43R4" },
    "W43R5": { "ward": "43-Ganeshra", "name": "W43R5" },
    "W43R6": { "ward": "43-Ganeshra", "name": "W43R6" },
    "W44R1": { "ward": "44-Radhika Bihar", "name": "W44R1" },
    "W44R2": { "ward": "44-Radhika Bihar", "name": "W44R2" },
    "W44R3": { "ward": "44-Radhika Bihar", "name": "W44R3" },
    "W45R1": { "ward": "45-Birla Mandir", "name": "W45R1" },
    "W45R2": { "ward": "45-Birla Mandir", "name": "W45R2" },
    "W45R3": { "ward": "45-Birla Mandir", "name": "W45R3" },
    "W46R1": { "ward": "46-Radha Nagar", "name": "W46R1" },
    "W47R1": { "ward": "47-Dwarkapuri", "name": "W47R1" },
    "W47R2": { "ward": "47-Dwarkapuri", "name": "W47R2" },
    "W47R3": { "ward": "47-Dwarkapuri", "name": "W47R3" },
    "W48R1": { "ward": "48-Satoha Asangpur", "name": "W48R1" },
    "W48R2": { "ward": "48-Satoha Asangpur", "name": "W48R2" },
    "W49R1": { "ward": "49-Daimpiriyal Nagar", "name": "W49R1" },
    "W49R2": { "ward": "49-Daimpiriyal Nagar", "name": "W49R2" },
    "W49R3": { "ward": "49-Daimpiriyal Nagar", "name": "W49R3" },
    "W49R4": { "ward": "49-Daimpiriyal Nagar", "name": "W49R4" },
    "W4R1": { "ward": "04-Ishapur Yamunapar", "name": "W4R1" },
    "W4R2": { "ward": "04-Ishapur Yamunapar", "name": "W4R2" },
    "W50ER2": { "ward": "50-Patharpura", "name": "W50ER2" },
    "W50R1": { "ward": "50-Patharpura", "name": "W50R1" },
    "W51ER5": { "ward": "51-Gaushala Nagar", "name": "W51ER5" },
    "W51R1": { "ward": "51-Gaushala Nagar", "name": "W51R1" },
    "W51R2": { "ward": "51-Gaushala Nagar", "name": "W51R2" },
    "W51R3": { "ward": "51-Gaushala Nagar", "name": "W51R3" },
    "W52R1": { "ward": "52-Chandrapuri", "name": "W52R1" },
    "W52R2": { "ward": "52-Chandrapuri", "name": "W52R2" },
    "W52R3": { "ward": "52-Chandrapuri", "name": "W52R3" },
    "W53MR1": { "ward": "53-Krishna Puri", "name": "W53MR1" },
    "W53R1": { "ward": "53-Krishna Puri", "name": "W53R1" },
    "W54R1": { "ward": "54-Pratap Nagar", "name": "W54R1" },
    "W54R2": { "ward": "54-Pratap Nagar", "name": "W54R2" },
    "W54R3": { "ward": "54-Pratap Nagar", "name": "W54R3" },
    "W55R1": { "ward": "55-Govind Nagar", "name": "W55R1" },
    "W55R2": { "ward": "55-Govind Nagar", "name": "W55R2" },
    "W55R3": { "ward": "55-Govind Nagar", "name": "W55R3" },
    "W56R1": { "ward": "56-Mandi Randas", "name": "W56R1" },
    "W56R2": { "ward": "56-Mandi Randas", "name": "W56R2" },
    "W56R3": { "ward": "56-Mandi Randas", "name": "W56R3" },
    "W56R4": { "ward": "56-Mandi Randas", "name": "W56R4" },
    "W56R5": { "ward": "56-Mandi Randas", "name": "W56R5" },
    "W56WBR1": { "ward": "56-Mandi Randas", "name": "W56WBR1" },
    "W56WBR2": { "ward": "56-Mandi Randas", "name": "W56WBR2" },
    "W56WBR3": { "ward": "56-Mandi Randas", "name": "W56WBR3" },
    "W57R1": { "ward": "57-Balajipuram", "name": "W57R1" },
    "W57R2": { "ward": "57-Balajipuram", "name": "W57R2" },
    "W57R3": { "ward": "57-Balajipuram", "name": "W57R3" },
    "W57R4": { "ward": "57-Balajipuram", "name": "W57R4" },
    "W58R1": { "ward": "58-Gau Ghat", "name": "W58R1" },
    "W58R2": { "ward": "58-Gau Ghat", "name": "W58R2" },
    "W59R1": { "ward": "59-Maholi Second", "name": "W59R1" },
    "W59R2": { "ward": "59-Maholi Second", "name": "W59R2" },
    "W5MR1": { "ward": "05-Bharatpur Gate", "name": "W5MR1" },
    "W5R1": { "ward": "05-Bharatpur Gate", "name": "W5R1" },
    "W5R2": { "ward": "05-Bharatpur Gate", "name": "W5R2" },
    "W60R1": { "ward": "60-Jagannath Puri", "name": "W60R1" },
    "W60R2": { "ward": "60-Jagannath Puri", "name": "W60R2" },
    "W61R1_C": { "ward": "61-Chaubia Para", "name": "W61R1_C" },
    "W61WR1": { "ward": "61-Chaubia Para", "name": "W61WR1" },
    "W61WR2": { "ward": "61-Chaubia Para", "name": "W61WR2" },
    "W62R1": { "ward": "62-Mathura Darwaza", "name": "W62R1" },
    "W63R1": { "ward": "63-Maliyaan Sadar", "name": "W63R1" },
    "W63R2": { "ward": "63-Maliyaan Sadar", "name": "W63R2" },
    "W64R1": { "ward": "64-Ghati Bahalray", "name": "W64R1" },
    "W64R2": { "ward": "64-Ghati Bahalray", "name": "W64R2" },
    "W65R1": { "ward": "65-Holi Gali", "name": "W65R1" },
    "W65R2": { "ward": "65-Holi Gali", "name": "W65R2" },
    "W65R3": { "ward": "65-Holi Gali", "name": "W65R3" },
    "W65R4": { "ward": "65-Holi Gali", "name": "W65R4" },
    "W65R5": { "ward": "65-Holi Gali", "name": "W65R5" },
    "W66R1": { "ward": "66-Keshighat", "name": "W66R1" },
    "W66WBR1": { "ward": "66-Keshighat", "name": "W66WBR1" },
    "W67R1": { "ward": "67-Kemar Van", "name": "W67R1" },
    "W67R2": { "ward": "67-Kemar Van", "name": "W67R2" },
    "W67R3": { "ward": "67-Kemar Van", "name": "W67R3" },
    "W67R4": { "ward": "67-Kemar Van", "name": "W67R4" },
    "W68R1": { "ward": "68-Shanti Nagar", "name": "W68R1" },
    "W69R1": { "ward": "69-Ratan Chhatri", "name": "W69R1" },
    "W69R2": { "ward": "69-Ratan Chhatri", "name": "W69R2" },
    "W69R3": { "ward": "69-Ratan Chhatri", "name": "W69R3" },
    "W6R1": { "ward": "06-Aduki", "name": "W6R1" },
    "W6R2": { "ward": "06-Aduki", "name": "W6R2" },
    "W6R3": { "ward": "06-Aduki", "name": "W6R3" },
    "W6R4": { "ward": "06-Aduki", "name": "W6R4" },
    "W6R5": { "ward": "06-Aduki", "name": "W6R5" },
    "W70R1": { "ward": "70-Biharipur", "name": "W70R1" },
    "W7R1": { "ward": "07-Lohvan", "name": "W7R1" },
    "W7R2": { "ward": "07-Lohvan", "name": "W7R2" },
    "W7R3": { "ward": "07-Lohvan", "name": "W7R3" },
    "W7R4": { "ward": "07-Lohvan", "name": "W7R4" },
    "W8R1": { "ward": "08-Atas", "name": "W8R1" },
    "W8R2": { "ward": "08-Atas", "name": "W8R2" },
    "W9R1": { "ward": "09-Gandhi Nagar", "name": "W9R1" },
};

const RouteMapPDFGenerator: React.FC = () => {
    const [routes, setRoutes] = useState<RouteGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentProcessingRoute, setCurrentProcessingRoute] = useState('');
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [activeRouteIndex, setActiveRouteIndex] = useState<number | null>(null);

    // Filter States
    const [selectedZonal, setSelectedZonal] = useState<string>('All');
    const [selectedWards, setSelectedWards] = useState<string[]>(['All']);
    const [isWardDropdownOpen, setIsWardDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [mapStyle, setMapStyle] = useState<'Street' | 'Satellite'>('Street');

    // Capture refs
    const captureRef = useRef<HTMLDivElement>(null);

    const parseKML = (text: string, fileName: string): RouteGroup[] => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const placemarks = xmlDoc.getElementsByTagName("Placemark");
        const kmlRoutes: RouteGroup[] = [];

        for (let i = 0; i < placemarks.length; i++) {
            const pm = placemarks[i];
            const nameNode = pm.getElementsByTagName("name")[0];
            const rawRouteID = nameNode ? nameNode.textContent?.trim() || '' : '';
            const finalID = (rawRouteID || fileName.replace('.kml', '')).trim();
            const mapping = ROUTE_WARD_MAPPING[finalID.toUpperCase()] || ROUTE_WARD_MAPPING[finalID];

            const routeName = mapping ? mapping.name : finalID;
            const wardName = mapping ? mapping.ward : '';

            // Enrich with Zonal information
            let zoneName = '';
            if (wardName) {
                const wardNumMatch = wardName.match(/(\d+)/);
                if (wardNumMatch) {
                    const wardNum = String(parseInt(wardNumMatch[1]));
                    const sup = MASTER_SUPERVISORS.find(s => s.ward.split(',').map(w => w.trim()).includes(wardNum));
                    zoneName = sup?.zonal || 'Unassigned';
                }
            }

            const coordinatesNodes = pm.getElementsByTagName("coordinates");
            for (let j = 0; j < coordinatesNodes.length; j++) {
                const coordsText = coordinatesNodes[j].textContent || "";
                const points: RoutePoint[] = coordsText.trim().split(/\s+/).map(coordStr => {
                    const parts = coordStr.split(',');
                    const lng = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    return { lat, lng };
                }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

                if (points.length > 0) {
                    kmlRoutes.push({
                        routeName,
                        vehicleNo: 'KML Import',
                        points,
                        wardName,
                        zoneName,
                        date: new Date().toISOString().split('T')[0]
                    });
                }
            }
        }

        // Fallback for simple KMLs
        if (kmlRoutes.length === 0) {
            const allCoords = xmlDoc.getElementsByTagName("coordinates");
            if (allCoords.length > 0) {
                const coordsText = allCoords[0].textContent || "";
                const points: RoutePoint[] = coordsText.trim().split(/\s+/).map(coordStr => {
                    const parts = coordStr.split(',');
                    const lng = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    return { lat, lng };
                }).filter(p => !isNaN(p.lat) && !isNaN(p.lng));

                if (points.length > 0) {
                    kmlRoutes.push({
                        routeName: fileName.replace('.kml', ''),
                        vehicleNo: 'KML Import',
                        points,
                        date: new Date().toISOString().split('T')[0]
                    });
                }
            }
        }

        return kmlRoutes;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setLoading(true);
        const allNewRoutes: RouteGroup[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const extension = file.name.split('.').pop()?.toLowerCase();

            try {
                if (extension === 'kml') {
                    const text = await file.text();
                    const kmlData = parseKML(text, file.name);
                    allNewRoutes.push(...kmlData);
                } else if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
                    const data = await new Promise<any[]>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (evt) => {
                            try {
                                const bstr = evt.target?.result;
                                const wb = XLSX.read(bstr, { type: 'binary' });
                                const wsname = wb.SheetNames[0];
                                const ws = wb.Sheets[wsname];
                                resolve(XLSX.utils.sheet_to_json(ws));
                            } catch (err) { reject(err); }
                        };
                        reader.onerror = reject;
                        reader.readAsBinaryString(file);
                    });

                    const groups: Record<string, RouteGroup> = {};
                    data.forEach((row: any) => {
                        const rawRouteID = String(row.RouteName || row['Route Name'] || row.Route || row['Route ID'] || '').trim();
                        const mapping = ROUTE_WARD_MAPPING[rawRouteID];

                        const routeName = mapping ? mapping.name : (rawRouteID || 'Unknown Route');
                        const vehicleNo = String(row.VehicleNo || row['Vehicle Number'] || row.Vehicle || 'N/A').trim();
                        const lat = parseFloat(row.Lat || row.lat || row.Latitude || row.latitude);
                        const lng = parseFloat(row.Lng || row.lng || row.Longitude || row.longitude);
                        let wardName = mapping ? mapping.ward : (row.WardName || row['Ward Name'] || row['Ward Area'] || '');
                        let zoneName = row.Zone || row['Zone Name'] || row.ZoneName || '';
                        const date = row.Date || row.date || '';

                        if (wardName && (!zoneName || zoneName === '')) {
                            const wardNumMatch = wardName.match(/(\d+)/);
                            if (wardNumMatch) {
                                const wardNum = String(parseInt(wardNumMatch[1]));
                                const sup = MASTER_SUPERVISORS.find(s => s.ward.split(',').map(w => w.trim()).includes(wardNum));
                                zoneName = sup?.zonal || 'Unassigned';
                            }
                        }

                        if (isNaN(lat) || isNaN(lng)) return;

                        const key = `${routeName}_${vehicleNo}`;
                        if (!groups[key]) {
                            groups[key] = { routeName, vehicleNo, points: [], wardName, zoneName, date };
                        }
                        groups[key].points.push({ lat, lng, timestamp: row.Timestamp || row.time || '' });
                    });
                    allNewRoutes.push(...Object.values(groups).filter(g => g.points.length > 0));
                }
            } catch (err) {
                console.error(`Error processing ${file.name}:`, err);
            }
        }

        setRoutes(prev => [...prev, ...allNewRoutes]);
        setLoading(false);
    };

    const toggleWard = (ward: string) => {
        if (ward === 'All') {
            setSelectedWards(['All']);
            return;
        }

        let newWards = [...selectedWards];
        if (newWards.includes('All')) {
            newWards = [];
        }

        if (newWards.includes(ward)) {
            newWards = newWards.filter(w => w !== ward);
        } else {
            newWards.push(ward);
        }

        if (newWards.length === 0) {
            newWards = ['All'];
        }

        setSelectedWards(newWards);
    };

    const filteredRoutes = React.useMemo(() => {
        return routes.filter(route => {
            const matchesZonal = selectedZonal === 'All' || route.zoneName === selectedZonal;
            const matchesWard = selectedWards.includes('All') || (route.wardName && selectedWards.includes(route.wardName));
            const matchesSearch = searchQuery === '' ||
                route.routeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                route.vehicleNo.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesZonal && matchesWard && matchesSearch;
        });
    }, [routes, selectedZonal, selectedWards, searchQuery]);

    const zonals = React.useMemo(() => {
        const unique = Array.from(new Set(routes.map(r => r.zoneName).filter(Boolean)));
        return ['All', ...unique.sort()];
    }, [routes]);

    const wardsForZonal = React.useMemo(() => {
        const relevantRoutes = selectedZonal === 'All' ? routes : routes.filter(r => r.zoneName === selectedZonal);
        const unique = Array.from(new Set(relevantRoutes.map(r => r.wardName).filter(Boolean)));
        return ['All', ...unique.sort()];
    }, [routes, selectedZonal]);

    const generatePDFs = async () => {
        const targetRoutes = filteredRoutes;
        if (targetRoutes.length === 0) return;
        setGenerating(true);
        setProgress(0);

        const pdf = new jsPDF('l', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();

        for (let i = 0; i < targetRoutes.length; i++) {
            const route = targetRoutes[i];
            setCurrentProcessingRoute(`${route.routeName} (${route.vehicleNo})`);
            setProgress(Math.round(((i) / targetRoutes.length) * 100));

            const originalIndex = routes.indexOf(route);
            setActiveRouteIndex(originalIndex);

            await new Promise(resolve => setTimeout(resolve, 2000));

            if (captureRef.current) {
                try {
                    const dataUrl = await toJpeg(captureRef.current, {
                        quality: 1.0,
                        backgroundColor: '#ffffff',
                        pixelRatio: 2,
                    });

                    if (i > 0) pdf.addPage();
                    const imgProps = pdf.getImageProperties(dataUrl);
                    const imgWidth = pageWidth;
                    const imgHeight = (imgProps.height * imgWidth) / imgProps.width;
                    pdf.addImage(dataUrl, 'JPEG', 0, 0, imgWidth, imgHeight);

                } catch (err) {
                    console.error("Capture failed for route", route.routeName, err);
                }
            }
        }

        pdf.save(`Route_Map_Reports_${new Date().toISOString().split('T')[0]}.pdf`);
        setGenerating(false);
        setProgress(100);
        setCurrentProcessingRoute('Completed');
        setActiveRouteIndex(null);
    };

    const activeRoute = (activeRouteIndex !== null)
        ? routes[activeRouteIndex]
        : (previewIndex !== null ? routes[previewIndex] : null);

    const activePath: [number, number][] = activeRoute ? activeRoute.points.map(p => [p.lat, p.lng]) : [];

    return (
        <div className="flex flex-col h-full bg-gray-50 p-6 space-y-6 overflow-y-auto font-sans">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                            <Route className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 font-sans tracking-tight">Route Map PDF Generator</h1>
                            <p className="text-gray-500 text-sm">Bulk generate map reports from GPS or KML files</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 font-sans">
                        <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer font-medium">
                            <Upload className="w-5 h-5" />
                            Upload Data (KML/CSV)
                            <input type="file" className="hidden" accept=".csv,.xlsx,.kml" multiple onChange={handleFileUpload} />
                        </label>

                        {routes.length > 0 && !generating && (
                            <button
                                onClick={generatePDFs}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-sm font-medium"
                            >
                                <FileDown className="w-5 h-5" />
                                Generate {filteredRoutes.length} PDFs
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {routes.length > 0 && (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl min-w-[200px]">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <select
                            value={selectedZonal}
                            onChange={(e) => {
                                setSelectedZonal(e.target.value);
                                setSelectedWards(['All']);
                            }}
                            className="bg-transparent text-sm font-bold text-gray-700 outline-none w-full cursor-pointer"
                        >
                            <option value="All">All Zonals</option>
                            {zonals.filter(z => z !== 'All').map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                    </div>

                    <div className="relative min-w-[250px] group">
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl h-10 transition-all hover:bg-white focus-within:ring-2 focus-within:ring-indigo-500">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <button
                                onClick={() => setIsWardDropdownOpen(!isWardDropdownOpen)}
                                className="bg-transparent text-sm font-bold text-gray-700 outline-none w-full cursor-pointer flex justify-between items-center"
                            >
                                <span className="truncate">
                                    {selectedWards.includes('All') ? 'All Wards' : `Wards (${selectedWards.length})`}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isWardDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                        </div>

                        {isWardDropdownOpen && (
                            <div className="absolute z-[100] w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto p-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div
                                    className={`px-3 py-2 cursor-pointer rounded-lg flex items-center gap-3 transition-colors ${selectedWards.includes('All') ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                    onClick={() => toggleWard('All')}
                                >
                                    <div className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors ${selectedWards.includes('All') ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                                        {selectedWards.includes('All') && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                    <span className="font-bold text-xs uppercase tracking-wide">All Wards</span>
                                </div>
                                {wardsForZonal.filter((w): w is string => Boolean(w) && w !== 'All').map(w => (
                                    <div
                                        key={w}
                                        className={`px-3 py-2 cursor-pointer rounded-lg flex items-center gap-3 transition-colors ${selectedWards.includes(w) ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'}`}
                                        onClick={() => toggleWard(w)}
                                    >
                                        <div className={`w-4 h-4 border-2 rounded flex items-center justify-center transition-colors ${selectedWards.includes(w) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                                            {selectedWards.includes(w) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className="font-bold text-xs uppercase tracking-wide">{w}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-[300px] flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by Route ID or Vehicle Number..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-transparent text-sm font-medium text-gray-700 outline-none w-full"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-gray-200 rounded-full">
                                <X className="w-3 h-3 text-gray-400" />
                            </button>
                        )}
                    </div>

                    <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">
                        {filteredRoutes.length} of {routes.length} Routes
                    </div>
                </div>
            )}

            {generating && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-8 text-center space-y-6">
                        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto" />
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Generating PDF Reports</h2>
                            <p className="text-gray-500 text-sm mt-1">Processing: {currentProcessingRoute}</p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-semibold text-gray-600">
                                <span>Progress</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden capture area */}
            <div className="overflow-hidden h-0 w-0 opacity-0 pointer-events-none">
                <div ref={captureRef} style={{ width: '1130px', height: '800px' }} className="bg-white p-6 font-sans flex flex-col border-4 border-black">
                    <div className="flex items-center justify-between border-b-4 border-black pb-4 mb-4">
                        <img src={NagarNigamLogo} alt="NN" className="h-20 object-contain" />
                        <div className="text-center flex-1">
                            <h2 className="text-2xl font-black text-gray-900 uppercase leading-none">Mathura Vrindavan Nagar Nigam</h2>
                            <div className="bg-black text-white px-6 py-1 inline-block mt-2">
                                <h1 className="text-3xl font-black tracking-[0.2em] uppercase">Official Route Map</h1>
                            </div>
                        </div>
                        <img src={NatureGreenLogo} alt="NG" className="h-20 object-contain" />
                    </div>

                    <div className="flex items-end justify-between mb-4 gap-4">
                        <div className="flex-1">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Assigned Route Path</h3>
                            <div className="border-l-8 border-emerald-600 pl-6 py-2">
                                <h1 className="text-7xl font-black text-gray-900 uppercase tracking-tighter break-words">
                                    {activeRoute?.routeName}
                                </h1>
                                <div className="flex items-center gap-6 mt-3">
                                    <p className="text-3xl font-extrabold text-emerald-700">Ward: {activeRoute?.wardName || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-left bg-white p-5 rounded-2xl border-2 border-dashed border-gray-300 min-w-[280px]">
                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Operator Details</h3>
                                <div className="mt-8 border-b-2 border-gray-900 w-full opacity-30"></div>
                                <p className="text-[9px] text-gray-400 mt-2 uppercase font-black tracking-tighter">Enter Driver Name / Signature</p>
                            </div>
                            <div className="text-center bg-gray-50 p-5 rounded-2xl border-2 border-gray-100 min-w-[150px]">
                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Vehicle No.</h3>
                                <p className="text-5xl font-black text-gray-900 tracking-tighter">
                                    {activeRoute?.vehicleNo === 'KML Import' ? '---' : activeRoute?.vehicleNo}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 rounded-3xl overflow-hidden border-8 border-gray-900 relative">
                        {activeRoute && (
                            <MapContainer
                                center={[activeRoute.points[0].lat, activeRoute.points[0].lng]}
                                zoom={15}
                                style={{ height: '100%', width: '100%' }}
                                zoomControl={false}
                            >
                                <TileLayer
                                    url={mapStyle === 'Street'
                                        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                                        : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    }
                                />
                                {mapStyle === 'Satellite' && (
                                    <TileLayer
                                        url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                                        opacity={1.0}
                                    />
                                )}
                                <Polyline positions={activePath} color="#DC2626" weight={10} opacity={1.0} />
                                <FitBounds path={activePath} />
                            </MapContainer>
                        )}
                        <div className="absolute top-6 right-6 bg-red-600 text-white px-4 py-2 font-black text-xl shadow-2xl skew-x-[-12deg]">
                            AUTHORIZED PATH
                        </div>
                    </div>

                    <div className="mt-4 flex justify-between items-center bg-gray-900 text-white p-3 rounded-xl">
                        <div className="text-sm font-bold tracking-widest uppercase">
                            Drive Safely • Follow The Assigned Path Only
                        </div>
                        <div className="text-[10px] font-black opacity-50 uppercase">
                            Generated by Nature Green Systems Buddy
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {previewIndex !== null && activeRoute && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[150] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-5xl h-[90vh] rounded-3xl overflow-hidden flex flex-col relative shadow-2xl">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                                    <Eye className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900 leading-none font-sans tracking-tight">Route Map Preview</h3>
                                    <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-widest font-sans">Official Vehicle Display Format</p>
                                </div>
                            </div>
                            <button onClick={() => setPreviewIndex(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-red-500">
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto bg-gray-200 p-8 flex justify-center items-start">
                            <div className="shadow-2xl origin-top scale-[0.6] md:scale-[0.7] lg:scale-[0.85] transform transition-transform">
                                <div style={{ width: '1130px', height: '800px' }} className="bg-white p-6 font-sans flex flex-col border-4 border-black">
                                    <div className="flex items-center justify-between border-b-4 border-black pb-4 mb-4">
                                        <img src={NagarNigamLogo} alt="NN" className="h-20 object-contain" />
                                        <div className="text-center flex-1">
                                            <h2 className="text-2xl font-black text-gray-900 uppercase leading-none">Mathura Vrindavan Nagar Nigam</h2>
                                            <div className="bg-black text-white px-6 py-1 inline-block mt-2">
                                                <h1 className="text-3xl font-black tracking-[0.2em] uppercase">Official Route Map</h1>
                                            </div>
                                        </div>
                                        <img src={NatureGreenLogo} alt="NG" className="h-20 object-contain" />
                                    </div>

                                    <div className="flex items-end justify-between mb-4 gap-4">
                                        <div className="flex-1">
                                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Assigned Route Path</h3>
                                            <div className="border-l-8 border-emerald-600 pl-6 py-2">
                                                <h1 className="text-7xl font-black text-gray-900 uppercase tracking-tighter break-words">
                                                    {activeRoute.routeName}
                                                </h1>
                                                <div className="flex items-center gap-6 mt-3">
                                                    <p className="text-3xl font-extrabold text-emerald-700">Ward: {activeRoute.wardName || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-4">
                                            <div className="text-left bg-white p-5 rounded-2xl border-2 border-dashed border-gray-300 min-w-[280px]">
                                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Operator Details</h3>
                                                <div className="mt-8 border-b-2 border-gray-900 w-full opacity-30"></div>
                                                <p className="text-[9px] text-gray-400 mt-2 uppercase font-black tracking-tighter">Enter Driver Name / Signature</p>
                                            </div>
                                            <div className="text-center bg-gray-50 p-5 rounded-2xl border-2 border-gray-100 min-w-[150px]">
                                                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Vehicle No.</h3>
                                                <p className="text-5xl font-black text-gray-900 tracking-tighter">
                                                    {activeRoute.vehicleNo === 'KML Import' ? '---' : activeRoute.vehicleNo}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 rounded-3xl overflow-hidden border-8 border-gray-900 relative">
                                        <MapContainer
                                            center={[activeRoute.points[0].lat, activeRoute.points[0].lng]}
                                            zoom={15}
                                            style={{ height: '100%', width: '100%' }}
                                            zoomControl={false}
                                        >
                                            <TileLayer
                                                url={mapStyle === 'Street'
                                                    ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                                                    : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                                }
                                            />
                                            <Polyline positions={activePath} color="#DC2626" weight={10} opacity={1.0} />
                                            {mapStyle === 'Satellite' && (
                                                <TileLayer
                                                    url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                                                    opacity={1.0}
                                                />
                                            )}
                                            <FitBounds path={activePath} />
                                        </MapContainer>

                                        {/* Style Toggle Button */}
                                        <button
                                            onClick={() => setMapStyle(prev => prev === 'Street' ? 'Satellite' : 'Street')}
                                            className="absolute bottom-6 right-6 z-[1000] bg-white p-3 rounded-2xl shadow-2xl border-2 border-gray-100 flex items-center gap-2 hover:bg-gray-50 transition-all group"
                                        >
                                            <Layers className="w-5 h-5 text-indigo-600 group-hover:rotate-12 transition-transform" />
                                            <span className="text-sm font-black text-gray-800 uppercase tracking-tighter">
                                                Switch to {mapStyle === 'Street' ? 'Satellite' : 'Road'} View
                                            </span>
                                        </button>
                                        <div className="absolute top-6 right-6 bg-red-600 text-white px-4 py-2 font-black text-xl shadow-2xl skew-x-[-12deg]">
                                            AUTHORIZED PATH
                                        </div>
                                    </div>

                                    <div className="mt-4 flex justify-between items-center bg-gray-900 text-white p-3 rounded-xl">
                                        <div className="text-sm font-bold tracking-widest uppercase">
                                            Drive Safely • Follow The Assigned Path Only
                                        </div>
                                        <div className="text-[10px] font-black opacity-50 uppercase">
                                            Preview Only - Use PDF for Printing
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 z-10">
                            <button onClick={() => setPreviewIndex(null)} className="px-6 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold rounded-xl transition-all font-sans">
                                Close Preview
                            </button>
                            <button
                                onClick={() => { setPreviewIndex(null); generatePDFs(); }}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2 font-sans"
                            >
                                <FileDown className="w-5 h-5" />
                                Proceed to Bulk PDF
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-gray-400" />
                        <h3 className="font-bold text-gray-800 font-sans tracking-tight">Detected Routes</h3>
                        <span className="ml-2 px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-bold">{filteredRoutes.length}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 space-y-4">
                            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                            <p className="text-gray-500 font-medium">Parsing GPS data...</p>
                        </div>
                    ) : routes.length > 0 ? (
                        filteredRoutes.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredRoutes.map((route, idx) => (
                                    <div
                                        key={`${route.routeName}_${idx}`}
                                        className="p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all group"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                <ImageIcon className="w-5 h-5" />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        const originalIndex = routes.indexOf(route);
                                                        setPreviewIndex(originalIndex);
                                                    }}
                                                    className="p-2 bg-white border border-gray-200 rounded-lg text-gray-400 hover:text-indigo-600 hover:border-indigo-300 transition-all shadow-sm"
                                                    title="Preview Route Map"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <div className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1 uppercase tracking-wider">
                                                    <CheckCircle className="w-3 h-3" /> Ready
                                                </div>
                                            </div>
                                        </div>
                                        <h4 className="font-bold text-gray-900 truncate font-sans tracking-tight" title={route.routeName}>{route.routeName}</h4>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <p className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-md flex items-center gap-1 font-bold">
                                                <TruckIcon className="w-3 h-3" /> {route.vehicleNo === 'KML Import' ? 'KML Feed' : route.vehicleNo}
                                            </p>
                                            {route.zoneName && (
                                                <p className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md flex items-center gap-1 font-bold">
                                                    <Building2 className="w-3 h-3" /> {route.zoneName}
                                                </p>
                                            )}
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                            <span>{route.points.length} GPS Points</span>
                                            <span>{route.date || 'No Date'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
                                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                                    <Filter className="w-8 h-8 text-gray-400" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900 font-sans tracking-tight">No Routes Match Your Filters</h4>
                                    <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                                        Try adjusting your zonal or ward selection, or clear your search query.
                                    </p>
                                    <button
                                        onClick={() => {
                                            setSelectedZonal('All');
                                            setSelectedWards(['All']);
                                            setSearchQuery('');
                                        }}
                                        className="mt-4 text-indigo-600 font-bold text-sm hover:underline"
                                    >
                                        Clear All Filters
                                    </button>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 opacity-40">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                                <Upload className="w-8 h-8 text-gray-400" />
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 font-sans tracking-tight">No Data Loaded</h4>
                                <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                                    Upload KML files or CSV/Excel files containing Route Name, Latitude, and Longitude.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TruckIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-5h-7v6h2" /><path d="M21 12l-2-4H15" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" />
    </svg>
);

export default RouteMapPDFGenerator;
