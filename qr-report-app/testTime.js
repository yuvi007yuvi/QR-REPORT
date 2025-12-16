const formatExcelTime = (serial) => {
    if (!serial) return '-';

    let hours;
    let minutes;

    if (typeof serial === 'string') {
        let timePart = serial.trim();

        const timePattern = /^\d{1,2}:\d{2}(\s?[AP]M)?$/i;
        if (timePattern.test(timePart)) {
            if (timePart.toUpperCase().includes('M')) {
                return timePart.replace(/([AP]M)/i, ' $1').replace(/\s+/g, ' ').trim();
            }
            return timePart;
        }

        if (serial.includes(' ')) {
            const parts = serial.split(' ');
            if (parts[0].match(/[\d/-]/)) {
                timePart = parts[1] || parts[0];
            }
        }

        if (timePart && (timePart.toUpperCase().includes('AM') || timePart.toUpperCase().includes('PM'))) {
            return timePart;
        }

        if (!timePart || !timePart.includes(':')) return '-';

        const parts = timePart.split(':');
        hours = parseInt(parts[0], 10);
        minutes = parseInt(parts[1], 10);
    } else {
        const num = Number(serial);
        const fractionalDay = num - Math.floor(num);
        const totalSeconds = Math.round(fractionalDay * 86400);
        hours = Math.floor(totalSeconds / 3600);
        minutes = Math.floor((totalSeconds % 3600) / 60);
    }

    if (isNaN(hours) || isNaN(minutes)) return '-';

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const minutesStr = String(minutes).padStart(2, '0');

    return `${hours12}:${minutesStr} ${ampm}`;
};

console.log('Testing "12:31 PM":', formatExcelTime("12:31 PM"));
console.log('Testing "13/12/2025 12:31 PM":', formatExcelTime("13/12/2025 12:31 PM"));
console.log('Testing "12:30":', formatExcelTime("12:30"));
console.log('Testing 0.5:', formatExcelTime(0.5));
