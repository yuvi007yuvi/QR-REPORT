const axiosPkg = require('./backend/node_modules/axios');
const axios = axiosPkg.default || axiosPkg;

async function check() {
    try {
        console.log("Fetching from localhost:5000...");
        const res = await axios.get('http://localhost:5000/api/gps/secondary/live');
        console.log("Status:", res.status);
        console.log("Data Type:", typeof res.data);
        console.log("Is Array?", Array.isArray(res.data));

        if (Array.isArray(res.data)) {
            console.log("Root is Array. First Item Keys:", Object.keys(res.data[0]));
        } else if (res.data.data && Array.isArray(res.data.data)) {
            console.log("Root is Object with .data Array.");
            console.log("First Item Keys:", Object.keys(res.data.data[0]));
            console.log("First Item Preview:", JSON.stringify(res.data.data[0], null, 2));
        } else {
            console.log("Unknown Structure. Keys:", Object.keys(res.data));
        }
    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) {
            console.log("Response Data:", e.response.data);
        }
    }
}

check();
