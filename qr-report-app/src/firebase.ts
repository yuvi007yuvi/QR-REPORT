import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA9qyk4eaRdZZW7MY5ajM9KYqQjn3mmYZ8",
  authDomain: "portal-buddy-mvnn.firebaseapp.com",
  projectId: "portal-buddy-mvnn",
  storageBucket: "portal-buddy-mvnn.firebasestorage.app",
  messagingSenderId: "463304822217",
  appId: "1:463304822217:web:0b1e01e24a1b3267966c18"
};

const app = initializeApp(firebaseConfig);

export const db   = getFirestore(app);
export const auth = getAuth(app);
export default app;
