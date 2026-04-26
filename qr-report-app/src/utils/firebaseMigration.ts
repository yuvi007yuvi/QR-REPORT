import { db } from '../firebase';
import { collection, doc, writeBatch, getDocs, query, limit } from 'firebase/firestore';
import { MASTER_SUPERVISORS } from '../data/master-supervisors';

/**
 * Migration utility to seed Firestore with master supervisor data.
 * This should only be run once by an administrator.
 */
export const seedSupervisorsToFirestore = async () => {
    try {
        console.log('Starting migration...');
        
        // Check if data already exists to avoid duplicates
        const existingQuery = query(collection(db, 'supervisors'), limit(1));
        const snapshot = await getDocs(existingQuery);
        
        if (!snapshot.empty) {
            console.warn('Supervisors collection is not empty. Migration skipped to prevent duplicates.');
            return { success: false, message: 'Data already exists in Firestore.' };
        }

        const batch = writeBatch(db);
        const supervisorsRef = collection(db, 'supervisors');

        // Firestore batch limit is 500 operations
        // MASTER_SUPERVISORS usually has around 100 items, so one batch is fine.
        MASTER_SUPERVISORS.forEach((sup) => {
            const docRef = doc(supervisorsRef, sup.empId); // Use empId as document ID
            batch.set(docRef, {
                ...sup,
                lastUpdated: new Date().toISOString(),
                updatedBy: 'system_migration'
            });
        });

        await batch.commit();
        console.log('Migration completed successfully!');
        return { success: true, message: `Successfully migrated ${MASTER_SUPERVISORS.length} supervisors.` };
    } catch (error: any) {
        console.error('Migration failed:', error);
        return { success: false, message: error.message || 'Unknown error during migration.' };
    }
};
