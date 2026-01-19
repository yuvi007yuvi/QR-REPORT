const axios = require('axios');
axios.get('http://localhost:5000/api/gps/secondary/live')
    .then(res => {
        console.log('Total Count:', res.data.length);
        const prim = res.data.filter(v => v.provider === 'primary').length;
        const sec = res.data.filter(v => v.provider === 'secondary').length;
        console.log('Primary:', prim);
        console.log('Secondary:', sec);
    })
    .catch(e => console.error('Error:', e.message));
