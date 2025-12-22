import React, { useState, useMemo } from 'react';
import Papa from 'papaparse';
import {
    Upload,
    FileText,
    Search,
    CheckCircle,
    Download,
    User,
    BarChart3,
    TrendingUp
} from 'lucide-react';
import { exportToJPEG } from '../utils/exporter';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';

interface SupervisorInfo {
    sNo: string;
    empId: string;
    department: string;
    name: string;
    mobile: string;
    ward: string;
    zonal: string;
}

interface KYCRecord {
    empId: string;
    count: number;
    name?: string;
    mobile?: string;
}

// Full master list from TOTAL SUPERVISOR.csv content
const MASTER_SUPERVISORS: SupervisorInfo[] = [
    { sNo: "1", empId: "MVSID1623", department: "C&T", name: "SACHIN", mobile: "9289305296", ward: "16,43,48", zonal: "BHARAT" },
    { sNo: "2", empId: "MVSID1624", department: "C&T", name: "ANKIT", mobile: "9289305297", ward: "15,11,1", zonal: "BHARAT" },
    { sNo: "3", empId: "MVSID1625", department: "C&T", name: "VEERESH", mobile: "9456019802", ward: "68,54,37", zonal: "BHARAT" },
    { sNo: "4", empId: "MVSID1626", department: "C&T", name: "VIKASH", mobile: "9917493967", ward: "30,20", zonal: "BHARAT" },
    { sNo: "5", empId: "MVSID1627", department: "C&T", name: "SONVEER", mobile: "7428541259", ward: "3,33,59", zonal: "BHARAT" },
    { sNo: "6", empId: "MVSID1629", department: "C&T", name: "GAURAV", mobile: "9289305303", ward: "31,35,44", zonal: "BHARAT" },
    { sNo: "7", empId: "MVSID1628", department: "C&T", name: "HARIOM", mobile: "9634891789", ward: "5", zonal: "GIRISH" },
    { sNo: "8", empId: "MVSID1635", department: "C&T", name: "NARESH", mobile: "9368902115", ward: "61", zonal: "GIRISH" },
    { sNo: "9", empId: "MVSID1636", department: "C&T", name: "SUDESH", mobile: "9520522925", ward: "2,4", zonal: "GIRISH" },
    { sNo: "10", empId: "MVSID1637", department: "C&T", name: "SUBHASH", mobile: "8685882119", ward: "7,19", zonal: "GIRISH" },
    { sNo: "11", empId: "MVSID1638", department: "C&T", name: "MAHAVEER", mobile: "9289305320", ward: "14,53", zonal: "GIRISH" },
    { sNo: "12", empId: "MVSID1639", department: "C&T", name: "JITENDRA", mobile: "7428541253", ward: "26,18", zonal: "GIRISH" },
    { sNo: "13", empId: "MVSID1641", department: "C&T", name: "AMAN YADAV", mobile: "8630314347", ward: "64,65", zonal: "GIRISH" },
    { sNo: "14", empId: "MVSID1692", department: "C&T", name: "ANSHU", mobile: "9289305313", ward: "49,47", zonal: "GIRISH" },
    { sNo: "15", empId: "MVSID1631", department: "C&T", name: "ANIL BAGHEL", mobile: "7428541261", ward: "32,29,27", zonal: "NISHANT" },
    { sNo: "16", empId: "MVSID1632", department: "C&T", name: "DILIP", mobile: "9289305312", ward: "28,10,6", zonal: "NISHANT" },
    { sNo: "17", empId: "MVSID1633", department: "C&T", name: "AMAN CHAU.", mobile: "9258475317", ward: "38,41", zonal: "NISHANT" },
    { sNo: "18", empId: "MVSID1640", department: "C&T", name: "DEEPAK", mobile: "9289305302", ward: "52,57", zonal: "NISHANT" },
    { sNo: "19", empId: "MVSID1695", department: "C&T", name: "MOHIT", mobile: "8755983564", ward: "23,63", zonal: "NISHANT" },
    { sNo: "20", empId: "MVSID1651", department: "C&T", name: "HEMANT", mobile: "7428541245", ward: "67,69", zonal: "PANKAJ" },
    { sNo: "21", empId: "MVSID1653", department: "C&T", name: "SATENDRA", mobile: "7428541246", ward: "21", zonal: "PANKAJ" },
    { sNo: "22", empId: "MVSID1654", department: "C&T", name: "SUMIT", mobile: "8445667133", ward: "25", zonal: "PANKAJ" },
    { sNo: "23", empId: "MVSID1655", department: "C&T", name: "SATISH", mobile: "9634259837", ward: "8,13", zonal: "PANKAJ" },
    { sNo: "24", empId: "MVSID1656", department: "C&T", name: "VISHNU", mobile: "8923039276", ward: "50,66", zonal: "PANKAJ" },
    { sNo: "25", empId: "MVSID1657", department: "C&T", name: "PAVAN", mobile: "9289305293", ward: "62", zonal: "PANKAJ" },
    { sNo: "26", empId: "MVSID1659", department: "C&T", name: "MOHIT", mobile: "9761137529", ward: "70", zonal: "PANKAJ" },
    { sNo: "27", empId: "MVSID1660", department: "C&T", name: "PRIYANSHU", mobile: "9696089484", ward: "9", zonal: "PANKAJ" },
    { sNo: "28", empId: "MVSID1852", department: "C&T", name: "MANOJ", mobile: "8218893160", ward: "51,34", zonal: "PANKAJ" },
    { sNo: "29", empId: "MVSID1644", department: "C&T", name: "ADIL MALIK", mobile: "8445688038", ward: "42", zonal: "RANVEER" },
    { sNo: "30", empId: "MVSID1646", department: "C&T", name: "ARJUN", mobile: "9084321551", ward: "36,39", zonal: "RANVEER" },
    { sNo: "31", empId: "MVSID1647", department: "C&T", name: "SURENDRA", mobile: "9289305299", ward: "46,55", zonal: "RANVEER" },
    { sNo: "32", empId: "MVSID1648", department: "C&T", name: "ARYAN", mobile: "7217337300", ward: "60", zonal: "RANVEER" },
    { sNo: "33", empId: "MVSID1649", department: "C&T", name: "ANIL RANA", mobile: "7428541254", ward: "12,24", zonal: "RANVEER" },
    { sNo: "34", empId: "MVSID1650", department: "C&T", name: "HARIKESH", mobile: "8218387116", ward: "45", zonal: "RANVEER" },
    { sNo: "35", empId: "MVSID1689", department: "C&T", name: "SANJEEV", mobile: "9575872963", ward: "17,58,56", zonal: "RANVEER" },
    { sNo: "36", empId: "MVSID1700", department: "C&T", name: "CHARAN SINGH", mobile: "9289305315", ward: "22,40", zonal: "RANVEER" },
    { sNo: "37", empId: "MVSID930", department: "UCC", name: "Akshat Gupta", mobile: "7817853231", ward: "69", zonal: "PANKAJ" },
    { sNo: "38", empId: "MVSID936", department: "UCC", name: "Sachin Gauhar", mobile: "9557068172", ward: "21", zonal: "PANKAJ" },
    { sNo: "39", empId: "MVSID952", department: "UCC", name: "Sachin Kumar Dhangar", mobile: "7300572950", ward: "2", zonal: "SURESH / ALOK" },
    { sNo: "40", empId: "MVSID935", department: "UCC", name: "Savita Sharma", mobile: "9027073574", ward: "59", zonal: "SURESH / ALOK" },
    { sNo: "41", empId: "MVSID942", department: "UCC", name: "Shivam", mobile: "9368436915", ward: "46", zonal: "SURESH / ALOK" },
    { sNo: "42", empId: "MVSID1715", department: "UCC", name: "Suman Singh", mobile: "8923465719", ward: "52", zonal: "SURESH / ALOK" },
    { sNo: "43", empId: "MVSID903", department: "UCC", name: "Sundar Singh", mobile: "8979007736", ward: "16", zonal: "SURESH / ALOK" },
    { sNo: "44", empId: "MVSID941", department: "UCC", name: "Vipin Kumar", mobile: "7830326784", ward: "19", zonal: "SURESH / ALOK" },
    { sNo: "45", empId: "MVSID867", department: "UCC", name: "Nikita Saini", mobile: "9286392776", ward: "47", zonal: "SURESH / ALOK" },
    { sNo: "46", empId: "MVSID881", department: "UCC", name: "Yogesh Sharma", mobile: "9368118079", ward: "53", zonal: "SURESH / ALOK" },
    { sNo: "47", empId: "MVSID902", department: "UCC", name: "Rashmi ", mobile: "9897267660", ward: "70", zonal: "PANKAJ" },
    { sNo: "48", empId: "MVSID889", department: "UCC", name: "Sadgi Shrivastava", mobile: "7456005370", ward: "27", zonal: "SURESH / ALOK" },
    { sNo: "49", empId: "MVSID921", department: "UCC", name: "Somdatta Braham", mobile: "9058612700", ward: "12", zonal: "SURESH / ALOK" },
    { sNo: "50", empId: "MVSID916", department: "UCC", name: "Manish", mobile: "9389264031", ward: "67", zonal: "PANKAJ" },
    { sNo: "51", empId: "MVSID929", department: "UCC", name: "Manvendra", mobile: "8477949516", ward: "34", zonal: "PANKAJ" },
    { sNo: "52", empId: "MVSID946", department: "UCC", name: "Poonam ", mobile: "7505649617", ward: "31", zonal: "SURESH / ALOK" },
    { sNo: "53", empId: "MVSID869", department: "UCC", name: "Krishna Kumar Sharma", mobile: "9756087394", ward: "6", zonal: "SURESH / ALOK" },
    { sNo: "54", empId: "MVSID1951", department: "UCC", name: "Sushil Kumar", mobile: "8534878947", ward: "45", zonal: "SURESH / ALOK" },
    { sNo: "55", empId: "MVSID870", department: "UCC", name: "Basant Kaushik", mobile: "9690657941", ward: "51", zonal: "PANKAJ" },
    { sNo: "56", empId: "MVSID945", department: "UCC", name: "Happy Singh", mobile: "6395596321", ward: "7", zonal: "SURESH / ALOK" },
    { sNo: "57", empId: "MVSID940", department: "UCC", name: "Vipin Kumar Vrindavan", mobile: "9870903653", ward: "25", zonal: "PANKAJ" },
    { sNo: "58", empId: "MVSID939", department: "UCC", name: "Ashwani Kumar", mobile: "8791481010", ward: "55", zonal: "SURESH / ALOK" },
    { sNo: "59", empId: "MVSID1697", department: "UCC", name: "Ravikumar", mobile: "8775095818", ward: "61", zonal: "SURESH / ALOK" },
    { sNo: "60", empId: "MVSID1868", department: "UCC", name: "Varsha Chauhan", mobile: "7668719749", ward: "54", zonal: "SURESH / ALOK" },
    { sNo: "61", empId: "MVSID1713", department: "UCC", name: "Vikash Singh", mobile: "8630537979", ward: "25", zonal: "SURESH / ALOK" },
    { sNo: "62", empId: "MVSID1694", department: "UCC", name: "Babita Bhardwaj", mobile: "8439676031", ward: "19", zonal: "SURESH / ALOK" },
    { sNo: "63", empId: "MVSID924", department: "UCC", name: "Hariom", mobile: "8077632507", ward: "NA", zonal: "SURESH / ALOK" },
    { sNo: "64", empId: "MVSID879", department: "UCC", name: "Manju Sharma", mobile: "9259576078", ward: "67", zonal: "PANKAJ" },
    { sNo: "65", empId: "MVSID928", department: "UCC", name: "Adarsh Singh", mobile: "8299205980", ward: "13", zonal: "PANKAJ" },
    { sNo: "66", empId: "MVSID944", department: "UCC", name: "Gajendra Chaudhary", mobile: "9759528676", ward: "34", zonal: "PANKAJ" },
    { sNo: "67", empId: "MVSID905", department: "UCC", name: "Deepak Kumar Sharma", mobile: "8218066849", ward: "37", zonal: "SURESH / ALOK" },
    { sNo: "68", empId: "MVSID906", department: "UCC", name: "Vishnu Kumar", mobile: "8000658017", ward: "33", zonal: "SURESH / ALOK" },
    { sNo: "69", empId: "MVSID910", department: "UCC", name: "Yogesh Devi", mobile: "8650683275", ward: "30", zonal: "SURESH / ALOK" },
    { sNo: "70", empId: "MVSID884", department: "UCC", name: "Kuldeep", mobile: "8923791960", ward: "33", zonal: "SURESH / ALOK" },
    { sNo: "71", empId: "MVSID886", department: "UCC", name: "Abhishek Singh", mobile: "9259785400", ward: "58", zonal: "SURESH / ALOK" },
    { sNo: "72", empId: "MVSID890", department: "UCC", name: "Sumit Khare", mobile: "6395075446", ward: "57", zonal: "SURESH / ALOK" },
    { sNo: "73", empId: "MVSID949", department: "UCC", name: "Krishna Kumar Kashyap", mobile: "9084786669", ward: "39", zonal: "SURESH / ALOK" },
    { sNo: "74", empId: "MVSID1714", department: "UCC", name: "Nirmla", mobile: "8392924492", ward: "60", zonal: "SURESH / ALOK" },
    { sNo: "75", empId: "MVSID877", department: "UCC", name: "Sandeep Kumar", mobile: "6395754565", ward: "33", zonal: "SURESH / ALOK" },
    { sNo: "76", empId: "MVSID883", department: "UCC", name: "Jatin Chauhan", mobile: "9012869817", ward: "32", zonal: "SURESH / ALOK" },
    { sNo: "77", empId: "MVSID932", department: "UCC", name: "Praveen", mobile: "9368944761", ward: "33", zonal: "SURESH / ALOK" },
    { sNo: "78", empId: "MVSID874", department: "UCC", name: "Lucky Awasthi", mobile: "7307582581", ward: "21", zonal: "SURESH / ALOK" },
    { sNo: "79", empId: "MVSID1192", department: "UCC", name: "Renu", mobile: "7906784685", ward: "17", zonal: "SURESH / ALOK" },
    { sNo: "80", empId: "MVSID878", department: "UCC", name: "Manvendra Singh", mobile: "8650977751", ward: "46", zonal: "SURESH / ALOK" },
    { sNo: "81", empId: "MVSID863", department: "UCC", name: "Poonam Chauhan", mobile: "6397343162", ward: "49", zonal: "SURESH / ALOK" },
    { sNo: "82", empId: "MVSID864", department: "UCC", name: "Kanchan Mahour", mobile: "9149302281", ward: "45", zonal: "SURESH / ALOK" },
    { sNo: "83", empId: "MVSID868", department: "UCC", name: "Bharti Suryavanshi", mobile: "8595505126", ward: "30", zonal: "SURESH / ALOK" },
    { sNo: "84", empId: "MVSID912", department: "UCC", name: "Vishal Singh", mobile: "8543982344", ward: "65", zonal: "SURESH / ALOK" },
    { sNo: "85", empId: "MVSID914", department: "UCC", name: "Akash", mobile: "7417171642", ward: "3", zonal: "SURESH / ALOK" },
    { sNo: "86", empId: "MVSID891", department: "UCC", name: "Devendri", mobile: "8630860825", ward: "41", zonal: "SURESH / ALOK" },
    { sNo: "87", empId: "MVSID893", department: "UCC", name: "Jaya Sharma", mobile: "8707085982", ward: "68", zonal: "SURESH / ALOK" },
    { sNo: "88", empId: "MVSID931", department: "UCC", name: "Lata Singh", mobile: "6398435399", ward: "57", zonal: "SURESH / ALOK" },
    { sNo: "89", empId: "MVSID954", department: "UCC", name: "Ankush Kumar", mobile: "7219928697", ward: "12", zonal: "SURESH / ALOK" },
];

export const KYCSurveyChecker: React.FC = () => {
    const [fileName, setFileName] = useState<string | null>(null);
    const [kycData, setKycData] = useState<KYCRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedZonal, setSelectedZonal] = useState('All');

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        setLoading(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as any[];
                const empIdRecords: Record<string, KYCRecord> = {};

                // Find the likely columns (flexible matching)
                const headers = results.meta.fields || [];
                const empIdHeader = headers.find(h =>
                    h.toLowerCase().includes('id') ||
                    h.toLowerCase().includes('emp') ||
                    h.toLowerCase().includes('code')
                );

                const countHeader = headers.find(h =>
                    h.toLowerCase().includes('count') ||
                    h.toLowerCase().includes('kyc') ||
                    h.toLowerCase().includes('done')
                );

                const nameHeader = headers.find(h =>
                    h.toLowerCase().includes('name') ||
                    h.toLowerCase().includes('supervisor')
                );

                const mobileHeader = headers.find(h =>
                    h.toLowerCase().includes('mobile') ||
                    h.toLowerCase().includes('phone')
                );

                if (empIdHeader) {
                    data.forEach(row => {
                        const id = String(row[empIdHeader] || '').trim().toUpperCase();
                        if (id) {
                            if (!empIdRecords[id]) {
                                empIdRecords[id] = {
                                    empId: id,
                                    count: 0,
                                    name: nameHeader ? row[nameHeader] : undefined,
                                    mobile: mobileHeader ? row[mobileHeader] : undefined
                                };
                            }

                            if (countHeader) {
                                empIdRecords[id].count += parseInt(row[countHeader]) || 0;
                            } else {
                                empIdRecords[id].count += 1;
                            }
                        }
                    });

                    setKycData(Object.values(empIdRecords));
                } else {
                    alert("Could not find Employee ID column in the CSV. Please ensure the CSV has a column containing 'ID', 'EMP', or 'CODE'.");
                }
                setLoading(false);
            },
            error: (error) => {
                console.error("PapaParse error:", error);
                alert("Error parsing CSV file.");
                setLoading(false);
            }
        });
    };

    const zonals = useMemo(() => {
        return ['All', ...new Set(MASTER_SUPERVISORS.map(s => s.zonal))].sort();
    }, []);

    const matchedResults = useMemo(() => {
        // Start with the Master List
        const results = MASTER_SUPERVISORS.map(sup => {
            const kycMatch = kycData.find(k => k.empId === sup.empId);
            return {
                ...sup,
                // Prioritize the name from the CSV if it exists
                name: kycMatch?.name || sup.name,
                kycCount: kycMatch ? kycMatch.count : 0,
                isMaster: true
            };
        });

        // Add supervisors from CSV that are NOT in the Master List
        kycData.forEach(kyc => {
            if (!results.some(r => r.empId === kyc.empId)) {
                results.push({
                    sNo: "EXT",
                    empId: kyc.empId,
                    department: "UCC",
                    name: kyc.name || "NEW SUPERVISOR (" + kyc.empId + ")",
                    mobile: kyc.mobile || "N/A",
                    ward: "Unmapped",
                    zonal: "UNASSIGNED",
                    kycCount: kyc.count,
                    isMaster: false
                });
            }
        });

        return results.filter(res => {
            const nameMatch = res.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                res.empId.toLowerCase().includes(searchTerm.toLowerCase());
            const zonalMatch = selectedZonal === 'All' || res.zonal === selectedZonal;
            return nameMatch && zonalMatch;
        }).sort((a, b) => b.kycCount - a.kycCount);
    }, [kycData, searchTerm, selectedZonal]);

    const totalUploadedSupervisors = kycData.length;
    const totalKYCCount = kycData.reduce((acc, curr) => acc + curr.count, 0);
    const activeSurveyors = matchedResults.filter(r => r.kycCount > 0).length;

    const ctTotal = matchedResults
        .filter(r => r.department === 'C&T')
        .reduce((acc, curr) => acc + curr.kycCount, 0);

    const uccTotal = matchedResults
        .filter(r => r.department === 'UCC')
        .reduce((acc, curr) => acc + curr.kycCount, 0);

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-slate-50 min-h-screen">
            {/* Professional Logos Header */}
            <div className="max-w-7xl mx-auto mb-8 bg-white rounded-2xl border-b border-indigo-100 p-6 shadow-sm flex items-center justify-between">
                <div className="flex flex-col items-center gap-1">
                    <img src={nagarNigamLogo} alt="Nagar Nigam" className="h-12 w-auto object-contain" />
                    <span className="text-[10px] font-black text-blue-800 uppercase leading-none">Nagar Nigam Mathura</span>
                </div>

                <div className="text-center group">
                    <h1 className="text-2xl font-black text-slate-900 leading-none">KYC SURVEY</h1>
                    <div className="h-0.5 w-12 bg-indigo-500 mx-auto mt-2 rounded-full"></div>
                </div>

                <div className="flex flex-col items-center gap-1">
                    <img src={natureGreenLogo} alt="Nature Green" className="h-12 w-auto object-contain" />
                    <span className="text-[10px] font-black text-green-700 uppercase leading-none">Nature Green Waste</span>
                </div>
            </div>

            {/* Title Section */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            SURVEYOR <span className="text-indigo-600">ANALYTICS</span>
                        </h2>
                        <p className="text-slate-500 mt-2 font-medium flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            Match and verify supervisor-wise KYC survey counts from uploaded CSV.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="relative flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-200 group overflow-hidden">
                            <Upload className="w-5 h-5 relative z-10" />
                            <span className="font-bold relative z-10">{fileName ? "Update CSV" : "Upload KYC CSV"}</span>
                            <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                            <input
                                type="file"
                                className="hidden"
                                accept=".csv"
                                onChange={handleFileUpload}
                                disabled={loading}
                            />
                        </label>

                        <button
                            onClick={() => exportToJPEG('kyc-checker-container', 'KYC_Survey_Report')}
                            className="p-3 bg-white border-2 border-slate-200 rounded-xl hover:border-indigo-400 hover:text-indigo-600 transition-all text-slate-600 shadow-sm"
                            title="Export as JPEG"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            <div id="kyc-checker-container" className="max-w-7xl mx-auto space-y-8">
                {/* Status Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                    <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex items-center gap-5">
                        <div className="p-4 bg-blue-50 rounded-2xl">
                            <BarChart3 className="w-10 h-10 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Total KYC</p>
                            <h2 className="text-4xl font-black text-slate-900">{totalKYCCount.toLocaleString()}</h2>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-6 rounded-2xl shadow-xl shadow-amber-200 flex items-center gap-5 text-white">
                        <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
                            <User className="w-10 h-10 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-amber-100 uppercase tracking-wider mb-1">C&T Total</p>
                            <h2 className="text-4xl font-black">{ctTotal.toLocaleString()}</h2>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-2xl shadow-xl shadow-indigo-200 flex items-center gap-5 text-white">
                        <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
                            <User className="w-10 h-10 text-white" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-indigo-100 uppercase tracking-wider mb-1">UCC Total</p>
                            <h2 className="text-4xl font-black">{uccTotal.toLocaleString()}</h2>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex items-center gap-5">
                        <div className="p-4 bg-green-50 rounded-2xl">
                            <div className="w-10 h-10 flex items-center justify-center font-black text-2xl text-green-600">AS</div>
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Active</p>
                            <h2 className="text-4xl font-black text-slate-900">{activeSurveyors}</h2>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 flex items-center gap-5">
                        <div className="p-4 bg-purple-50 rounded-2xl">
                            <TrendingUp className="w-10 h-10 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Avg Perf</p>
                            <h2 className="text-4xl font-black text-slate-900">
                                {activeSurveyors > 0 ? (totalKYCCount / activeSurveyors).toFixed(1) : 0}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search Supervisor Name or Emp ID..."
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-indigo-400 transition-all outline-none font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <select
                            className="bg-slate-50 border-2 border-slate-100 rounded-xl px-6 py-3 font-bold text-slate-700 outline-none focus:border-indigo-400 cursor-pointer w-full"
                            value={selectedZonal}
                            onChange={(e) => setSelectedZonal(e.target.value)}
                        >
                            {zonals.map(z => <option key={z} value={z}>{z === 'All' ? 'All Zonals' : z}</option>)}
                        </select>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row items-center justify-center gap-12 text-center">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Supervisors</span>
                            <span className="text-2xl font-black text-slate-900">{totalUploadedSupervisors}</span>
                        </div>
                        <div className="w-px h-10 bg-slate-200 hidden md:block"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total KYC Counts</span>
                            <span className="text-2xl font-black text-slate-900">{totalKYCCount.toLocaleString()}</span>
                        </div>
                    </div>

                    {fileName && (
                        <div className="px-8 py-4 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
                            <span className="text-indigo-800 text-sm font-bold flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                Analyzing CSV: {fileName}
                            </span>
                            <span className="text-xs font-black text-indigo-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full shadow-sm">
                                {matchedResults.length} Matched Master Entries
                            </span>
                        </div>
                    )}

                    <div className="overflow-x-auto shadow-2xl rounded-2xl border border-slate-200">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
                                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest border-r border-white/10 text-center w-12">SN</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest border-r border-white/10">Employee ID</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest border-r border-white/10">Supervisor / Surveyor</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest border-r border-white/10 text-center">Dept</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest border-r border-white/10">Mobile No</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest border-r border-white/10">Zonal Head</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest border-r border-white/10">Wards</th>
                                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-center">KYC Done</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {matchedResults.length > 0 ? (
                                    matchedResults.map((row, idx) => {
                                        const zonalColors: Record<string, string> = {
                                            'BHARAT': 'bg-blue-100/40',
                                            'GIRISH': 'bg-purple-100/40',
                                            'NISHANT': 'bg-orange-100/40',
                                            'PANKAJ': 'bg-emerald-100/40',
                                            'RANVEER': 'bg-rose-100/40',
                                            'SURESH / ALOK': 'bg-cyan-100/40'
                                        };

                                        const rowBgColor = zonalColors[row.zonal] || 'bg-slate-50/30';

                                        return (
                                            <tr key={idx} className={`hover:bg-indigo-100/50 transition-colors border-b border-slate-200 ${idx % 2 === 0 ? rowBgColor : 'bg-white'}`}>
                                                <td className="px-4 py-3 text-slate-500 font-bold border-r border-slate-200 text-center text-xs">{idx + 1}</td>
                                                <td className="px-4 py-3 text-[11px] font-black text-slate-600 font-mono border-r border-slate-200">{row.empId}</td>
                                                <td className="px-4 py-3 border-r border-slate-200">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded flex items-center justify-center text-white font-black text-[10px] shadow-sm">
                                                            {row.name.charAt(0)}
                                                        </div>
                                                        <span className="font-black text-slate-800 text-xs whitespace-nowrap uppercase">{row.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center border-r border-slate-200">
                                                    <span className="text-xs font-black text-slate-700 uppercase">
                                                        {row.department}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-[11px] font-bold text-slate-600 border-r border-slate-200 font-mono">{row.mobile}</td>
                                                <td className="px-4 py-3 border-r border-slate-200">
                                                    <span className="text-xs font-black text-slate-700 uppercase">
                                                        {row.zonal}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-[10px] font-bold text-slate-500 border-r border-slate-200">{row.ward}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className={`inline-block px-4 py-2 rounded-lg font-black text-base min-w-[50px] shadow-md ${row.kycCount > 0 ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' : 'bg-gradient-to-r from-red-500 to-red-600 text-white'}`}>
                                                        {row.kycCount}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="px-8 py-24 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="p-8 bg-slate-50 rounded-full text-slate-200">
                                                    <Search className="w-16 h-16" />
                                                </div>
                                                <p className="font-black text-slate-300 text-lg">No data found. Upload a CSV to start the audit.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
