const fs = require('fs');
const path = require('path');

// 1. Read CSV
const csvPath = 'd:\\DEVELOPMENT REPORTS\\QR-REPORT\\qr-report-app\\SupervisorKYC (2).csv';
const csvContent = fs.readFileSync(csvPath, 'utf-8');
const csvLines = csvContent.split('\n').filter(l => l.trim() !== '');

const csvSupervisors = [];
// Skip header
for (let i = 1; i < csvLines.length; i++) {
    const line = csvLines[i];
    // Simple CSV parse (handling quotes)
    const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
    // The regex above is basic. Let's do a simpler split if quotes are consistent.
    // The file has quotes around all fields? 
    // "S.No.","Employee Display ID","Employee Name","Employee Mobile Number","Customer Count"
    // 1,"MVSID1644","ADIL MALIK","8445688038",17
    // It seems S.No and Count are numbers, others are quoted strings.

    // Better split approach for this specific format
    const matches = line.match(/^(\d+),"([^"]+)","([^"]+)","([^"]+)",(\d+)$/);
    if (matches) {
        csvSupervisors.push({
            empId: matches[2],
            name: matches[3],
            mobile: matches[4]
        });
    } else {
        // Fallback for lines that might strictly follow the regex
        // Try generic split if needed, or log error
        // console.log('Skipped line:', line);
    }
}

// 2. Master Data (Hardcoded from read file)
const MASTER_SUPERVISORS = [
    { sNo: "1", empId: "MVSID890", department: "UCC", name: "Sumit Khare", mobile: "6395075446", ward: "57", zonal: "SURESH / ALOK" },
    { sNo: "2", empId: "MVSID1714", department: "UCC", name: "Nirmla", mobile: "8392924492", ward: "60", zonal: "SURESH / ALOK" },
    { sNo: "3", empId: "MVSID912", department: "UCC", name: "Vishal Singh", mobile: "8543982344", ward: "65", zonal: "SURESH / ALOK" },
    { sNo: "4", empId: "MVSID891", department: "UCC", name: "Devendri", mobile: "8630860825", ward: "41", zonal: "SURESH / ALOK" },
    { sNo: "5", empId: "MVSID906", department: "UCC", name: "Vishnu Kumar", mobile: "8000658017", ward: "33", zonal: "SURESH / ALOK" },
    { sNo: "6", empId: "MVSID949", department: "UCC", name: "Krishna Kumar Kashyap", mobile: "9084786669", ward: "39", zonal: "SURESH / ALOK" },
    { sNo: "7", empId: "MVSID931", department: "UCC", name: "Lata Singh", mobile: "6398435399", ward: "57", zonal: "SURESH / ALOK" },
    { sNo: "8", empId: "MVSID886", department: "UCC", name: "Abhishek Singh", mobile: "9259785400", ward: "58", zonal: "SURESH / ALOK" },
    { sNo: "9", empId: "MVSID864", department: "UCC", name: "Kanchan Mahour", mobile: "9149302281", ward: "45", zonal: "SURESH / ALOK" },
    { sNo: "10", empId: "MVSID914", department: "UCC", name: "Akash", mobile: "7417171642", ward: "3", zonal: "SURESH / ALOK" },
    { sNo: "11", empId: "MVSID952", department: "UCC", name: "Sachin Kumar Dhangar", mobile: "7300572950", ward: "2", zonal: "SURESH / ALOK" },
    { sNo: "12", empId: "MVSID905", department: "UCC", name: "Deepak Kumar Sharma", mobile: "8218066849", ward: "37", zonal: "SURESH / ALOK" },
    { sNo: "13", empId: "MVSID921", department: "UCC", name: "Somdatta Braham", mobile: "9058612700", ward: "12", zonal: "SURESH / ALOK" },
    { sNo: "14", empId: "MVSID910", department: "UCC", name: "Yogesh Devi", mobile: "8650683275", ward: "30", zonal: "SURESH / ALOK" },
    { sNo: "15", empId: "MVSID1715", department: "UCC", name: "Suman Singh", mobile: "8923465719", ward: "52", zonal: "SURESH / ALOK" },
    { sNo: "16", empId: "MVSID883", department: "UCC", name: "Jatin Chauhan", mobile: "9012869817", ward: "32", zonal: "SURESH / ALOK" },
    { sNo: "17", empId: "MVSID878", department: "UCC", name: "Manvendra Singh", mobile: "8650977751", ward: "46", zonal: "SURESH / ALOK" },
    { sNo: "18", empId: "MVSID942", department: "UCC", name: "Shivam", mobile: "9368436915", ward: "46", zonal: "SURESH / ALOK" },
    { sNo: "19", empId: "MVSID903", department: "UCC", name: "Sundar Singh", mobile: "8979007736", ward: "16", zonal: "SURESH / ALOK" },
    { sNo: "20", empId: "MVSID893", department: "UCC", name: "Jaya Sharma", mobile: "8707085982", ward: "68", zonal: "SURESH / ALOK" },
    { sNo: "21", empId: "MVSID946", department: "UCC", name: "Poonam", mobile: "7505649617", ward: "31", zonal: "SURESH / ALOK" },
    { sNo: "22", empId: "MVSID869", department: "UCC", name: "Krishna Kumar Sharma", mobile: "9756087394", ward: "6", zonal: "SURESH / ALOK" },
    { sNo: "23", empId: "MVSID889", department: "UCC", name: "Sadgi Shrivastava", mobile: "7456005370", ward: "27", zonal: "SURESH / ALOK" },
    { sNo: "24", empId: "MVSID932", department: "UCC", name: "Praveen", mobile: "9368944761", ward: "33", zonal: "SURESH / ALOK" },
    { sNo: "25", empId: "MVSID868", department: "UCC", name: "Bharti Suryavanshi", mobile: "8595505126", ward: "30", zonal: "SURESH / ALOK" },
    { sNo: "26", empId: "MVSID881", department: "UCC", name: "Yogesh Sharma", mobile: "9368118079", ward: "53", zonal: "SURESH / ALOK" },
    { sNo: "27", empId: "MVSID935", department: "UCC", name: "Savita Sharma", mobile: "9027073574", ward: "59", zonal: "SURESH / ALOK" },
    { sNo: "28", empId: "MVSID939", department: "UCC", name: "Ashwani Kumar", mobile: "8791481010", ward: "55", zonal: "SURESH / ALOK" },
    { sNo: "29", empId: "MVSID945", department: "UCC", name: "Happy Singh", mobile: "6395596321", ward: "7", zonal: "SURESH / ALOK" },
    { sNo: "30", empId: "MVSID1192", department: "UCC", name: "Renu", mobile: "7906784685", ward: "17", zonal: "SURESH / ALOK" },
    { sNo: "31", empId: "MVSID863", department: "UCC", name: "Poonam Chauhan", mobile: "6397343162", ward: "49", zonal: "SURESH / ALOK" },
    { sNo: "32", empId: "MVSID874", department: "UCC", name: "Lucky Awasthi", mobile: "7307582581", ward: "21", zonal: "SURESH / ALOK" },
    { sNo: "33", empId: "MVSID867", department: "UCC", name: "Nikita Saini", mobile: "9286392776", ward: "47", zonal: "SURESH / ALOK" },
    { sNo: "34", empId: "MVSID877", department: "UCC", name: "Sandeep Kumar", mobile: "6395754565", ward: "33", zonal: "SURESH / ALOK" },
    { sNo: "35", empId: "MVSID954", department: "UCC", name: "Ankush Kumar", mobile: "7219928697", ward: "12", zonal: "SURESH / ALOK" },
    { sNo: "36", empId: "MVSID884", department: "UCC", name: "Kuldeep", mobile: "8923791960", ward: "33", zonal: "SURESH / ALOK" },
    { sNo: "37", empId: "MVSID941", department: "UCC", name: "Vipin Kumar", mobile: "7830326784", ward: "19", zonal: "SURESH / ALOK" },
    { sNo: "38", empId: "MVSID1713", department: "UCC", name: "Vikash Singh", mobile: "8630537979", ward: "25", zonal: "SURESH / ALOK" },
    { sNo: "39", empId: "MVSID1951", department: "UCC", name: "Sushil Kumar", mobile: "8534878947", ward: "45", zonal: "SURESH / ALOK" },
    { sNo: "40", empId: "MVSID1697", department: "UCC", name: "Ravikumar", mobile: "8775095818", ward: "61", zonal: "SURESH / ALOK" },
    { sNo: "41", empId: "MVSID2051", department: "UCC", name: "Devesh", mobile: "8859614126", ward: "N/A", zonal: "SURESH / ALOK" },
    { sNo: "42", empId: "MVSID1694", department: "UCC", name: "Babita Bhardwaj", mobile: "8439676031", ward: "19", zonal: "SURESH / ALOK" },
    { sNo: "43", empId: "MVSID1868", department: "UCC", name: "Varsha Chauhan", mobile: "7668719749", ward: "54", zonal: "SURESH / ALOK" },
    { sNo: "44", empId: "MVSID924", department: "UCC", name: "Hariom", mobile: "8077632507", ward: "NA", zonal: "SURESH / ALOK" },
    { sNo: "45", empId: "MVSID928", department: "UCC", name: "Adarsh Singh", mobile: "8299205980", ward: "13", zonal: "PANKAJ" },
    { sNo: "46", empId: "MVSID944", department: "UCC", name: "Gajendra Chaudhary", mobile: "9759528676", ward: "34", zonal: "PANKAJ" },
    { sNo: "47", empId: "MVSID902", department: "UCC", name: "Rashmi", mobile: "9897267660", ward: "70", zonal: "PANKAJ" },
    { sNo: "48", empId: "MVSID879", department: "UCC", name: "Manju Sharma", mobile: "9259576078", ward: "67", zonal: "PANKAJ" },
    { sNo: "49", empId: "MVSID930", department: "UCC", name: "Akshat Gupta", mobile: "7817853231", ward: "69", zonal: "PANKAJ" },
    { sNo: "50", empId: "MVSID916", department: "UCC", name: "Manish", mobile: "9389264031", ward: "67", zonal: "PANKAJ" },
    { sNo: "51", empId: "MVSID929", department: "UCC", name: "Manvendra", mobile: "8477949516", ward: "34", zonal: "PANKAJ" },
    { sNo: "52", empId: "MVSID870", department: "UCC", name: "Basant Kaushik", mobile: "9690657941", ward: "51", zonal: "PANKAJ" },
    { sNo: "53", empId: "MVSID936", department: "UCC", name: "Sachin Gauhar", mobile: "9557068172", ward: "21", zonal: "PANKAJ" },
    { sNo: "54", empId: "MVSID940", department: "UCC", name: "Vipin Kumar Vrindavan", mobile: "9870903653", ward: "25", zonal: "PANKAJ" },
    { sNo: "55", empId: "MVSID875", department: "UCC", name: "Preety Sharma", mobile: "8923569355", ward: "N/A", zonal: "PANKAJ" },
    { sNo: "56", empId: "MVSID1624", department: "C&T", name: "ANKIT", mobile: "9289305297", ward: "15,11,1", zonal: "BHARAT" },
    { sNo: "57", empId: "MVSID1625", department: "C&T", name: "VEERESH", mobile: "9456019802", ward: "68,54,37", zonal: "BHARAT" },
    { sNo: "58", empId: "MVSID1627", department: "C&T", name: "SONVEER", mobile: "7428541259", ward: "3,33,59", zonal: "BHARAT" },
    { sNo: "59", empId: "MVSID1626", department: "C&T", name: "VIKASH", mobile: "9917493967", ward: "30,20", zonal: "BHARAT" },
    { sNo: "60", empId: "MVSID1623", department: "C&T", name: "SACHIN", mobile: "9289305296", ward: "43", zonal: "RANVEER" },
    { sNo: "61", empId: "MVSID1629", department: "C&T", name: "GAURAV", mobile: "9289305303", ward: "35,49", zonal: "GIRISH" },
    { sNo: "62", empId: "MVSID1628", department: "C&T", name: "HARIOM", mobile: "9634891789", ward: "5", zonal: "GIRISH" },
    { sNo: "63", empId: "MVSID1638", department: "C&T", name: "MAHAVEER", mobile: "9289305320", ward: "14,53", zonal: "GIRISH" },
    { sNo: "64", empId: "MVSID1692", department: "C&T", name: "ANSHU", mobile: "9289305313", ward: "31,44,47", zonal: "BHARAT" },
    { sNo: "65", empId: "MVSID1636", department: "C&T", name: "SUDESH", mobile: "9520522925", ward: "2,4", zonal: "GIRISH" },
    { sNo: "66", empId: "MVSID1637", department: "C&T", name: "SUBHASH", mobile: "8685882119", ward: "7,19", zonal: "GIRISH" },
    { sNo: "67", empId: "MVSID1635", department: "C&T", name: "NARESH", mobile: "9368902115", ward: "61,56", zonal: "RANVEER" },
    { sNo: "68", empId: "MVSID1639", department: "C&T", name: "JITENDRA", mobile: "7428541253", ward: "26,18", zonal: "GIRISH" },
    { sNo: "69", empId: "MVSID1641", department: "C&T", name: "AMAN YADAV", mobile: "8630314347", ward: "64,65", zonal: "GIRISH" },
    { sNo: "70", empId: "MVSID1631", department: "C&T", name: "ANIL BAGHEL", mobile: "7428541261", ward: "32,29,27", zonal: "NISHANT" },
    { sNo: "71", empId: "MVSID1632", department: "C&T", name: "DILIP", mobile: "9289305312", ward: "28,10,6", zonal: "NISHANT" },
    { sNo: "72", empId: "MVSID1633", department: "C&T", name: "AMAN CHAU.", mobile: "9258475317", ward: "38,41", zonal: "NISHANT" },
    { sNo: "73", empId: "MVSID1640", department: "C&T", name: "DEEPAK", mobile: "9289305302", ward: "52,57", zonal: "NISHANT" },
    { sNo: "74", empId: "MVSID1695", department: "C&T", name: "MOHIT", mobile: "8755983564", ward: "23,63", zonal: "NISHANT" },
    { sNo: "75", empId: "MVSID1644", department: "C&T", name: "ADIL MALIK", mobile: "8445688038", ward: "42", zonal: "RANVEER" },
    { sNo: "76", empId: "MVSID1646", department: "C&T", name: "ARJUN", mobile: "9084321551", ward: "36,39", zonal: "RANVEER" },
    { sNo: "77", empId: "MVSID1648", department: "C&T", name: "ARYAN", mobile: "7217337300", ward: "60", zonal: "RANVEER" },
    { sNo: "78", empId: "MVSID1649", department: "C&T", name: "ANIL RANA", mobile: "7428541254", ward: "12,24", zonal: "RANVEER" },
    { sNo: "79", empId: "MVSID1689", department: "C&T", name: "SANJEEV", mobile: "9575872963", ward: "17,58", zonal: "RANVEER" },
    { sNo: "80", empId: "MVSID1700", department: "C&T", name: "CHARAN SINGH", mobile: "9289305315", ward: "22,40", zonal: "RANVEER" },
    { sNo: "81", empId: "MVSID1650", department: "C&T", name: "HARIKESH", mobile: "8218387116", ward: "45", zonal: "RANVEER" },
    { sNo: "82", empId: "MVSID1647", department: "C&T", name: "SURENDRA", mobile: "9289305299", ward: "46,55", zonal: "RANVEER" },
    { sNo: "83", empId: "MVSID1655", department: "C&T", name: "SATISH", mobile: "9634259837", ward: "8,13", zonal: "PANKAJ" },
    { sNo: "84", empId: "MVSID1656", department: "C&T", name: "VISHNU", mobile: "8923039276", ward: "50,66", zonal: "PANKAJ" },
    { sNo: "85", empId: "MVSID1660", department: "C&T", name: "PRIYANSHU", mobile: "9696089484", ward: "9", zonal: "PANKAJ" },
    { sNo: "86", empId: "MVSID1852", department: "C&T", name: "MANOJ", mobile: "8218893160", ward: "51,34", zonal: "PANKAJ" },
    { sNo: "87", empId: "MVSID1653", department: "C&T", name: "SATENDRA", mobile: "7428541246", ward: "21", zonal: "PANKAJ" },
    { sNo: "88", empId: "MVSID1657", department: "C&T", name: "PAVAN", mobile: "9289305293", ward: "62", zonal: "PANKAJ" },
    { sNo: "89", empId: "MVSID1651", department: "C&T", name: "HEMANT", mobile: "7428541245", ward: "67,69", zonal: "PANKAJ" },
    { sNo: "90", empId: "MVSID1659", department: "C&T", name: "MOHIT", mobile: "9761137529", ward: "70", zonal: "PANKAJ" },
    { sNo: "91", empId: "MVSID1693", department: "C&T", name: "Nikhil kumar", mobile: "7351312453", ward: "N/A", zonal: "PANKAJ" },
    { sNo: "92", empId: "MVSID3296", department: "UCC", name: "rohit kumar", mobile: "8445762660", ward: "N/A", zonal: "N/A" }
];

// Compare
const masterIds = new Set(MASTER_SUPERVISORS.map(s => s.empId.trim()));
const csvIds = new Set(csvSupervisors.map(s => s.empId.trim()));

console.log('--- Supervisors in CSV BUT NOT in MASTER ---');
csvSupervisors.forEach(s => {
    if (!masterIds.has(s.empId.trim())) {
        console.log(`${s.empId} - ${s.name}`);
    }
});

console.log('\n--- Supervisors in MASTER (UCC Only) BUT NOT in CSV ---');
MASTER_SUPERVISORS.filter(s => s.department === 'UCC').forEach(s => {
    if (!csvIds.has(s.empId.trim())) {
        console.log(`${s.empId} - ${s.name} (${s.department})`);
    }
});

console.log('\n--- Supervisors in MASTER (ALL) BUT NOT in CSV ---');
MASTER_SUPERVISORS.forEach(s => {
    if (!csvIds.has(s.empId.trim())) {
        console.log(`${s.empId} - ${s.name} (${s.department})`);
    }
});
