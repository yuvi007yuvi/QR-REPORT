import React, { useMemo } from 'react';
import supervisorDataJson from '../data/supervisorData.json';
import { Image as ImageIcon } from 'lucide-react';
import { exportToJPEG } from '../utils/exporter';

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

export const SupervisorZonalMapping: React.FC = () => {

    const mappingData = useMemo(() => {
        const data = supervisorDataJson as unknown as SupervisorData[];
        const groupedByZone: Record<string, Record<string, SupervisorData[]>> = {};

        // Group by Zone and then by Supervisor
        data.forEach(item => {
            const head = item["Zonal Head"] || 'Unassigned';
            const supervisor = item["Supervisor"] || 'Unknown';

            if (!groupedByZone[head]) {
                groupedByZone[head] = {};
            }
            if (!groupedByZone[head][supervisor]) {
                groupedByZone[head][supervisor] = [];
            }
            groupedByZone[head][supervisor].push(item);
        });

        // Consolidate and format data
        const consolidated: Record<string, SupervisorData[]> = {};

        Object.keys(groupedByZone).sort().forEach(zone => {
            const supervisorsInZone = groupedByZone[zone];
            consolidated[zone] = Object.keys(supervisorsInZone).sort().map(supName => {
                const entries = supervisorsInZone[supName];
                const wards = entries
                    .map(e => {
                        const num = e["Ward No"].toString();
                        return WARD_NAMES[num] || `Ward ${num}`;
                    })
                    // Sort by the numeric prefix of the ward string
                    .sort((a, b) => {
                        const numA = parseInt(a.match(/^(\d+)/)?.[1] || '0', 10);
                        const numB = parseInt(b.match(/^(\d+)/)?.[1] || '0', 10);
                        return numA - numB;
                    })
                    .join(", ");

                // Use the first entry for other details and override Ward No
                return {
                    ...entries[0],
                    "Ward No": wards
                };
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
                <div className="text-center mb-6 border-b-2 border-gray-200 pb-4">
                    <h2 className="text-2xl font-bold text-gray-800">Supervisor & Zonal Head Mapping</h2>
                    <p className="text-gray-500 text-sm mt-1">Official Assignment List</p>
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
            </div>
        </div>
    );
};
