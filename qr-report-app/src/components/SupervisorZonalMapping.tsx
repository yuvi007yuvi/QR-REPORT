import React, { useMemo } from 'react';
import supervisorDataJson from '../data/supervisorData.json';
import { Image as ImageIcon } from 'lucide-react';
import { exportToJPEG } from '../utils/exporter';
import nagarNigamLogo from '../assets/nagar-nigam-logo.png';
import natureGreenLogo from '../assets/NatureGreen_Logo.png';

interface SupervisorData {
    "S.No.": number;
    "Zone & Circle": string;
    "Ward No": string | number;
    "Supervisor": string;
    "Mobile No": string | number;
    "Zonal Head": string;
}

const WARD_NAMES: Record<string, string> = {
    "1": "01-Birjapur", "2": "02-Ambedkar Nagar", "3": "03-Girdharpur", "4": "04-Ishapur Yamunapar",
    "5": "05-Bharatpur Gate", "6": "06-Aduki", "7": "07-Lohvan", "8": "08-Atas", "9": "09-Gandhi Nagar",
    "10": "10-Aurangabad First", "11": "11-Tarsi", "12": "12-Radhe Shyam Colony", "13": "13-Sunrakh",
    "14": "14-Lakshmi Nagar Yamunapar", "15": "15-Maholi First", "16": "16-Bakalpur", "17": "17-Bairaagpura",
    "18": "18-General Ganj", "19": "19-Ramnagar Yamunapar", "20": "20-Krishna Nagar First", "21": "21-Chaitanya Bihar",
    "22": "22-Badhri Nagar", "23": "23-Aheer Pada", "24": "24-Sarai Azamabad", "25": "25-Chharaura",
    "26": "26-Naya Nagla", "27": "27-Baad", "28": "28-Aurangabad Second", "29": "29-Koyla Alipur",
    "30": "30-Krishna Nagar Second", "31": "31-Navneet Nagar", "32": "32-Ranchibagar", "33": "33-Palikhera",
    "34": "34-Radhaniwas", "35": "35-Bankhandi", "36": "36-Jaisingh Pura", "37": "37-Baldevpuri",
    "38": "38-Civil Lines", "39": "39-Mahavidhya Colony", "40": "40-Rajkumar", "41": "41-Dhaulipiau",
    "42": "42-Manoharpur", "43": "43-Ganeshra", "44": "44-Radhika Bihar", "45": "45-Birla Mandir",
    "46": "46-Radha Nagar", "47": "47-Dwarkapuri", "48": "48-Satoha Asangpur", "49": "49-Daimpiriyal Nagar",
    "50": "50-Patharpura", "51": "51-Gaushala Nagar", "52": "52-Chandrapuri", "53": "53-Krishna Puri",
    "54": "54-Pratap Nagar", "55": "55-Govind Nagar", "56": "56-Mandi Randas", "57": "57-Balajipuram",
    "58": "58-Gau Ghat", "59": "59-Maholi Second", "60": "60-Jagannath Puri", "61": "61-Chaubia Para",
    "62": "62-Mathura Darwaza", "63": "63-Maliyaan Sadar", "64": "64-Ghati Bahalray", "65": "65-Holi Gali",
    "66": "66-Keshighat", "67": "67-Kemar Van", "68": "68-Shanti Nagar", "69": "69-Ratan Chhatri", "70": "70-Biharipur"
};

import { MASTER_SUPERVISORS } from '../data/master-supervisors';

export const SupervisorZonalMapping: React.FC = () => {

    const mappingData = useMemo(() => {
        // Filter for C&T supervisors from the master list
        const ctSupervisors = MASTER_SUPERVISORS.filter(s => s.department === 'C&T');

        const groupedByZone: Record<string, typeof ctSupervisors> = {};

        // Group by Zonal Head
        ctSupervisors.forEach(sup => {
            const head = sup.zonal || 'Unassigned';
            if (!groupedByZone[head]) {
                groupedByZone[head] = [];
            }
            groupedByZone[head].push(sup);
        });

        // Format data for display
        const consolidated: Record<string, SupervisorData[]> = {};

        Object.keys(groupedByZone).sort().forEach(zone => {
            const supervisors = groupedByZone[zone];

            consolidated[zone] = supervisors.map(sup => {
                // Parse ward numbers (handle comma separated)
                const wardNums = sup.ward.toString().split(',').map(s => s.trim());

                const wardNames = wardNums
                    .map(num => WARD_NAMES[num] || `Ward ${num}`)
                    // Sort numerically based on the leading number
                    .sort((a, b) => {
                        const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0', 10);
                        const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0', 10);
                        return numA - numB;
                    })
                    .join(", ");

                return {
                    "S.No.": parseInt(sup.sNo) || 0, // Best effort parse
                    "Supervisor": sup.name,
                    "Mobile No": sup.mobile,
                    "Ward No": wardNames,
                    "Zonal Head": sup.zonal,
                    "Zone & Circle": sup.zonal // Map Zonal to Zone & Circle for now as they are proxy
                } as SupervisorData;
            });
        });

        return consolidated;
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-end gap-2 items-center">
                <button
                    onClick={() => exportToJPEG('mapping-report-container', 'Supervisor_Zonal_Mapping')}
                    className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                >
                    <ImageIcon className="w-4 h-4" />
                    Export JPEG
                </button>
            </div>

            <div id="mapping-report-container" className="bg-white p-8 min-w-[800px] mx-auto shadow-lg rounded-lg">
                {/* Professional Logo Header */}
                <div className="bg-white rounded-xl shadow-lg border-2 border-blue-100 p-6 mb-8">
                    <div className="grid grid-cols-3 items-center gap-6">
                        {/* Left Side - Nagar Nigam Logo */}
                        <div className="flex flex-col items-center sm:items-start">
                            <img
                                src={nagarNigamLogo}
                                alt="Nagar Nigam Logo"
                                className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm"
                            />

                            <p className="hidden sm:block text-[10px] font-bold text-blue-800 mt-2 uppercase tracking-tight text-center sm:text-left">
                                Nagar Nigam<br />Mathura-Vrindavan
                            </p>
                        </div>

                        {/* Center - Title Section */}
                        <div className="text-center flex flex-col items-center justify-center">
                            <div className="bg-blue-50 px-4 py-1 rounded-full mb-3">
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em]">Official Report</span>
                            </div>
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 tracking-tight leading-none mb-2">
                                SUPERVISOR<br />
                                <span className="text-blue-600">MAPPING</span>
                            </h1>
                            <div className="h-1 w-20 bg-blue-600 rounded-full mb-2"></div>
                            <p className="text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-widest">
                                Zone & Ward Assignments
                            </p>
                        </div>

                        {/* Right Side - Nature Green Logo */}
                        <div className="flex flex-col items-center sm:items-end">
                            <img
                                src={natureGreenLogo}
                                alt="Nature Green Logo"
                                className="h-16 sm:h-20 w-auto object-contain drop-shadow-sm"
                            />

                            <p className="hidden sm:block text-[10px] font-bold text-green-700 mt-2 uppercase tracking-tight text-center sm:text-right">
                                Nature Green<br />Waste Management
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {Object.entries(mappingData).map(([head, supervisors]) => (
                        <div key={head} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="bg-blue-50 p-3 border-b border-blue-100 flex justify-between items-center">
                                <h3 className="font-bold text-blue-800 text-lg">
                                    Zonal Head: {head}
                                </h3>
                                <span className="text-xs font-medium bg-blue-200 text-blue-800 px-2 py-1 rounded-full">
                                    {supervisors.length} Supervisors
                                </span>
                            </div>

                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                                    <tr>
                                        <th className="p-3 w-16 text-center">S.No.</th>
                                        <th className="p-3">Supervisor Name</th>
                                        <th className="p-3">Ward Name</th>
                                        <th className="p-3">Mobile No</th>
                                        <th className="p-3">Zone & Circle</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {supervisors.map((sup, index) => (
                                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-3 text-center text-gray-500">{index + 1}</td>
                                            <td className="p-3 font-medium text-gray-900">{sup.Supervisor}</td>
                                            <td className="p-3 text-gray-600">{sup["Ward No"]}</td>
                                            <td className="p-3 text-gray-600">{sup["Mobile No"]}</td>
                                            <td className="p-3 text-gray-600">{sup["Zone & Circle"]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-12 mb-6 text-center">
                    <div className="inline-block bg-white px-8 py-4 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-slate-600 font-medium text-lg tracking-wide">
                            Generated by <span className="font-extrabold text-indigo-600 mx-1">Reports Buddy Pro</span>
                            <span className="text-slate-300 mx-3">|</span>
                            Created by <span className="font-extrabold text-slate-800 mx-1 border-b-2 border-indigo-200">Yuvraj Singh Tomar</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
