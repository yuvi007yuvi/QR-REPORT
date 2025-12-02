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

export const SupervisorZonalMapping: React.FC = () => {
    const mappingData = useMemo(() => {
        const data = supervisorDataJson as unknown as SupervisorData[];
        const grouped: Record<string, SupervisorData[]> = {};

        data.forEach(item => {
            const head = item["Zonal Head"] || 'Unassigned';
            if (!grouped[head]) {
                grouped[head] = [];
            }
            grouped[head].push(item);
        });

        // Sort keys
        return Object.keys(grouped).sort().reduce((acc, key) => {
            acc[key] = grouped[key];
            return acc;
        }, {} as Record<string, SupervisorData[]>);
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
                                        <th className="p-3">Ward No</th>
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
