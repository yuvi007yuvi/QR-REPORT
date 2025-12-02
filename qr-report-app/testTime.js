const formatExcelTimeOld = (serial) => {
    if (!serial) return '-';

    let hours;
    let minutes;

    if (typeof serial === 'string') {
        return serial; // Skip string logic for this test
    } else {
        const num = Number(serial);
        // Current implementation
        const date = new Date(Math.round((num - 25569) * 86400 * 1000));
        hours = date.getHours();
        minutes = date.getMinutes();
    }

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const minutesStr = String(minutes).padStart(2, '0');

    return `${hours12}:${minutesStr} ${ampm}`;
};

const formatExcelTimeNew = (serial) => {
    if (!serial) return '-';

    let hours;
    let minutes;

    if (typeof serial === 'string') {
        return serial;
    } else {
        const num = Number(serial);
        // Math-based implementation (Timezone independent)
        // Extract the fractional part (time)
        const fractionalDay = num - Math.floor(num);
        // Add a small epsilon for floating point precision
        const totalSeconds = Math.round(fractionalDay * 86400);

        hours = Math.floor(totalSeconds / 3600);
        minutes = Math.floor((totalSeconds % 3600) / 60);
    }

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const minutesStr = String(minutes).padStart(2, '0');

    return `${hours12}:${minutesStr} ${ampm}`;
};

// Test Case: 0.5833333333 is approx 14:00 (2:00 PM)
const testSerial = 0.5833333333;
// Test Case: 45849.5833333333 (Date + Time)
const testSerialWithDate = 45849.5833333333;

console.log('Current System Timezone Offset:', new Date().getTimezoneOffset());
console.log('Test Serial (0.583333... -> 14:00):');
console.log('Old Method:', formatExcelTimeOld(testSerial));
console.log('New Method:', formatExcelTimeNew(testSerial));

console.log('\nTest Serial with Date (45849.58333... -> 14:00):');
console.log('Old Method:', formatExcelTimeOld(testSerialWithDate));
console.log('New Method:', formatExcelTimeNew(testSerialWithDate));
