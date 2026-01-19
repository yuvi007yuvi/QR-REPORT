const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 5000;

// Middleware
app.use(cors()); // Allow all origins for development
app.use(express.json());

// Configuration
// Configuration
const DATA_SOURCES = {
    primary: { key: '09C5E59F150AFA8481F39ADCF9405858', name: 'primary' },
    secondary: { key: '162814E902A9896655663D59F9BE98D5', name: 'secondary' }
};
const BASE_URL = 'https://oempowersupply.in/naturegreen.php';
const https = require('https');
const fs = require('fs');
const path = require('path');

// Custom Agent to ignore SSL errors
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function logError(context, message) {
    try {
        const logPath = path.join(__dirname, 'data', 'error_log.txt');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[${timestamp}] [${context}] ${message}\n`);
    } catch (e) { }
}

// Helper to safely parse JSON (strips BOM, handles strings)
function tryParseJSON(str) {
    if (typeof str !== 'string') return str;
    try {
        const cleanStr = str.replace(/^\uFEFF/, '').trim();
        return JSON.parse(cleanStr);
    } catch (e) {
        // console.error('[Proxy] JSON Parse Error:', e.message);
        return null;
    }
}

// Helper to fetch with fallback
async function fetchWithFallback(targetUrl) {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    };

    // Strategy 1: Direct Call (Best for performance)
    try {
        const response = await axios.get(targetUrl, {
            headers,
            httpsAgent,
            transformResponse: [d => d],
            timeout: 15000
        });
        return response.data;
    } catch (directError) {
        const msg = `Direct failed: ${directError.message}`;
        console.warn(`[Proxy] ${msg}`);
        logError('FetchFallback', msg);
    }

    // Strategy 2: Fallback via ThingProxy
    try {
        const proxyUrl = 'https://thingproxy.freeboard.io/fetch/' + targetUrl;
        console.log(`[Proxy] Attempting Fallback: ${proxyUrl.substring(0, 50)}...`);
        const response = await axios.get(proxyUrl, {
            headers,
            transformResponse: [d => d],
            timeout: 30000
        });
        return response.data;
    } catch (proxyError) {
        const msg = `All strategies failed. Proxy error: ${proxyError.message}`;
        logError('FetchFallback', msg);
        throw new Error(msg);
    }
}

// Routes
// const fs = require('fs'); // Removed duplicate
// const path = require('path'); // Removed duplicate

// Routes
app.get('/api/gps/secondary/live', async (req, res) => {
    console.log('[API] /live request received');
    try {
        const fetchSource = async (sourceKey, sourceName) => {
            const targetUrl = `${BASE_URL}?key=${sourceKey}&cmd=ALL,*`;
            try {
                console.log(`[Proxy] Fetching ${sourceName}...`);
                const rawData = await fetchWithFallback(targetUrl);

                let parsedData = [];
                const json = tryParseJSON(rawData);

                if (!json) {
                    console.warn(`[Proxy] ${sourceName} returned invalid JSON`);
                    return [];
                }

                if (json.success === false) return [];

                parsedData = Array.isArray(json) ? json : (json.data || []);
                if (!Array.isArray(parsedData)) parsedData = [];

                console.log(`[Proxy] ${sourceName} fetched ${parsedData.length} items`);
                // Tag with provider
                return parsedData.map(v => ({ ...v, provider: sourceName }));
            } catch (err) {
                console.error(`[Proxy] Error fetching ${sourceName}:`, err.message);
                return [];
            }
        };

        const [primaryData, secondaryData] = await Promise.all([
            fetchSource(DATA_SOURCES.primary.key, DATA_SOURCES.primary.name),
            fetchSource(DATA_SOURCES.secondary.key, DATA_SOURCES.secondary.name)
        ]);

        const allVehicles = [...primaryData, ...secondaryData];

        // Persistence: Store GPS data
        try {
            const dataDir = path.join(__dirname, 'data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir);
            }

            // 1. Save Snapshot (JSON)
            fs.writeFileSync(
                path.join(dataDir, 'location_snapshot.json'),
                JSON.stringify({ timestamp: new Date(), count: allVehicles.length, vehicles: allVehicles }, null, 2)
            );

            // 2. Append to Daily CSV Log
            const today = new Date().toISOString().split('T')[0];
            const logFile = path.join(dataDir, `gps_log_${today}.csv`);

            // Create header if file doesn't exist
            if (!fs.existsSync(logFile)) {
                fs.writeFileSync(logFile, 'Timestamp,VehicleNo,Provider,Lat,Lng,Speed,Do Not Edit\n');
            }

            // Append rows
            const timestamp = new Date().toISOString();
            const rows = allVehicles.map(v => {
                // Sanitize fields to prevent CSV breakage
                const name = (v.name || v.vehicle_no || v.vehicleNo || '').replace(/,/g, ' ');
                return `${timestamp},${name},${v.provider},${v.lat},${v.lng},${v.speed},`;
            }).join('\n');

            fs.appendFileSync(logFile, rows + '\n');

            console.log(`[Storage] Logged ${allVehicles.length} records to gps_log_${today}.csv`);

        } catch (fileErr) {
            console.error('[Storage] Failed to save snapshot/log:', fileErr.message);
        }

        return res.json(allVehicles);
    } catch (error) {
        console.error('Error in /live endpoint:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});



app.get('/api/gps/secondary/history', async (req, res) => {
    try {
        const { deviceId, from, to, provider } = req.query;
        if (!deviceId || !from || !to) {
            return res.status(400).json({ success: false, message: "Missing required parameters" });
        }

        const apiKey = (provider === 'primary') ? DATA_SOURCES.primary.key : DATA_SOURCES.secondary.key;

        const targetUrl = `${BASE_URL}?key=${apiKey}&cmd=TRACK,${deviceId},${from},${to}`;
        console.log(`[Proxy] Fetching History (${provider || 'secondary'}): ${targetUrl.replace(apiKey, '***')}`);

        const rawData = await fetchWithFallback(targetUrl);

        // History data might be CSV or JSON. We pass it through.
        try {
            const parsed = JSON.parse(rawData);
            return res.json(parsed);
        } catch (e) {
            res.set('Content-Type', 'text/plain');
            return res.send(rawData);
        }

    } catch (error) {
        console.error('[Proxy] History Request Failed:', error.message);
        const status = error.response ? error.response.status : 500;
        return res.status(status).json({
            success: false,
            message: error.message || 'Internal Proxy Error',
            status: status
        });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Backend Proxy Server running on http://localhost:${PORT}`);
});
