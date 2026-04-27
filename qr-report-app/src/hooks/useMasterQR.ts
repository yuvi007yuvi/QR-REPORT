import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import masterDataJson from '../data/masterData.json';

export const useMasterQR = () => {
    const [masterList, setMasterList] = useState<any[]>(masterDataJson);
    const [loading, setLoading] = useState(true);
    const [isUsingCloudData, setIsUsingCloudData] = useState(false);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'qr_master'), (snapshot) => {
            if (!snapshot.empty) {
                const data = snapshot.docs.map(doc => {
                    const d = doc.data();
                    // Normalize Firestore fields to match static JSON if necessary, 
                    // or rely on our robust processData logic.
                    // Static JSON fields: "QR Code ID", "Ward", "Zone & Circle", "Building/Street", "Site Name", "Type"
                    // Firestore fields: qrId, ward, zone, siteName, type, address, area
                    return {
                        'QR Code ID': d.qrId,
                        'Ward': d.ward,
                        'Zone & Circle': d.zone,
                        'Building/Street': d.address,
                        'Site Name': d.siteName,
                        'Type': d.type,
                        ...d
                    };
                });
                setMasterList(data);
                setIsUsingCloudData(true);
            } else {
                setMasterList(masterDataJson);
                setIsUsingCloudData(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return { masterList, loading, isUsingCloudData };
};
