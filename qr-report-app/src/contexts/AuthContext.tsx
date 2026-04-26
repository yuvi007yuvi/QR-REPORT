import React, { createContext, useContext, useEffect, useState } from 'react';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    type User
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

// ── Types ──────────────────────────────────────────────
export type UserRole = 'admin' | 'viewer';

export interface PortalUser {
    uid: string;
    email: string;
    name: string;
    role: UserRole;
}

interface AuthContextType {
    currentUser: PortalUser | null;
    firebaseUser: User | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    loginWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
    isAdmin: boolean;
}

// ── Context ─────────────────────────────────────────────
const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    firebaseUser: null,
    isLoading: true,
    login: async () => {},
    loginWithGoogle: async () => {},
    logout: async () => {},
    isAdmin: false,
});

// ── Helper: load or create user profile ─────────────────
const loadUserProfile = async (fbUser: User): Promise<PortalUser> => {
    const userRef = doc(db, 'users', fbUser.uid);
    const userDoc = await getDoc(userRef);

    if (userDoc.exists()) {
        const data = userDoc.data();
        return {
            uid: fbUser.uid,
            email: fbUser.email || '',
            name: data.name || fbUser.displayName || fbUser.email || '',
            role: data.role || 'viewer',
        };
    } else {
        // First time Google sign-in — create a viewer profile automatically
        const newUser: PortalUser = {
            uid: fbUser.uid,
            email: fbUser.email || '',
            name: fbUser.displayName || fbUser.email || '',
            role: 'viewer',
        };
        await setDoc(userRef, {
            email: newUser.email,
            name: newUser.name,
            role: newUser.role,
            createdAt: new Date().toISOString(),
        });
        return newUser;
    }
};

// ── Provider ────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
    const [currentUser, setCurrentUser] = useState<PortalUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
            setFirebaseUser(fbUser);
            if (fbUser) {
                try {
                    const profile = await loadUserProfile(fbUser);
                    setCurrentUser(profile);
                } catch (err) {
                    console.error('Failed to load user profile:', err);
                    // Fallback: grant access as viewer even if Firestore fails
                    setCurrentUser({
                        uid: fbUser.uid,
                        email: fbUser.email || '',
                        name: fbUser.displayName || fbUser.email || '',
                        role: 'viewer',
                    });
                }
            } else {
                setCurrentUser(null);
            }
            setIsLoading(false);
        });

        return unsubscribe;
    }, []);

    const login = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const loginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, provider);
    };

    const logout = async () => {
        await signOut(auth);
        setCurrentUser(null);
    };

    const isAdmin = currentUser?.role === 'admin';

    return (
        <AuthContext.Provider value={{ currentUser, firebaseUser, isLoading, login, loginWithGoogle, logout, isAdmin }}>
            {children}
        </AuthContext.Provider>
    );
};

// ── Hook ─────────────────────────────────────────────────
export const useAuth = () => useContext(AuthContext);
