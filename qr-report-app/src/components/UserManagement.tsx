import React, { useState, useEffect } from 'react';
import { Users, Shield, RefreshCw, UserPlus, Settings, X, CheckSquare, Power, Trash2 } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import type { UserRole } from '../contexts/AuthContext';
import { menuItems } from './Sidebar';

interface UserData {
    uid: string;
    email: string;
    name: string;
    role: UserRole;
    allowedViews?: string[];
    createdAt?: string;
    passwordText?: string;
    status?: 'active' | 'disabled';
}

export const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | null }>({ message: '', type: null });
    
    // Add user state
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [newUserName, setNewUserName] = useState('');
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('viewer');
    
    // Reset password state
    const [selectedUserForPassword, setSelectedUserForPassword] = useState<UserData | null>(null);
    const [newPasswordValue, setNewPasswordValue] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);

    // Permissions modal state
    const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<UserData | null>(null);
    const [tempPermissions, setTempPermissions] = useState<string[]>([]);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
            const usersData: UserData[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                usersData.push({
                    uid: doc.id,
                    email: data.email || '',
                    name: data.name || '',
                    role: data.role || 'viewer',
                    allowedViews: data.allowedViews || [],
                    createdAt: data.createdAt,
                    status: data.status || 'active',
                    passwordText: data.passwordText
                });
            });
            // Sort by role (admin first), then name
            usersData.sort((a, b) => {
                if (a.role === 'admin' && b.role !== 'admin') return -1;
                if (a.role !== 'admin' && b.role === 'admin') return 1;
                return a.name.localeCompare(b.name);
            });
            setUsers(usersData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching users:", error);
            setStatus({ message: "Failed to load users", type: "error" });
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleRoleChange = async (uid: string, newRole: UserRole) => {
        // Prevent changing the main admin's role
        if (uid === 'nK7dyNuvKThljMMrxC0B2w3zmXz1') {
            setStatus({ message: "Cannot change the role of the master admin.", type: "error" });
            setTimeout(() => setStatus({ message: '', type: null }), 3000);
            return;
        }

        try {
            const userRef = doc(db, 'users', uid);
            await setDoc(userRef, { role: newRole }, { merge: true });
            setStatus({ message: 'Role updated successfully', type: 'success' });
            setTimeout(() => setStatus({ message: '', type: null }), 2000);
        } catch (error: any) {
            setStatus({ message: error.message || 'Failed to update role', type: 'error' });
            setTimeout(() => setStatus({ message: '', type: null }), 3000);
        }
    };

    const handleSavePermissions = async () => {
        if (!selectedUserForPermissions) return;
        
        try {
            const userRef = doc(db, 'users', selectedUserForPermissions.uid);
            await setDoc(userRef, { allowedViews: tempPermissions }, { merge: true });
            
            setStatus({ message: 'Permissions updated successfully', type: 'success' });
            setSelectedUserForPermissions(null);
            setTimeout(() => setStatus({ message: '', type: null }), 3000);
        } catch (error: any) {
            setStatus({ message: error.message || 'Failed to update permissions', type: 'error' });
            setTimeout(() => setStatus({ message: '', type: null }), 3000);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserForPassword || !newPasswordValue) return;

        if (!selectedUserForPassword.passwordText) {
            setStatus({ message: 'Cannot reset password for users without an existing manual password.', type: 'error' });
            setTimeout(() => setStatus({ message: '', type: null }), 3000);
            return;
        }

        setStatus({ message: 'Resetting password...', type: null });

        try {
            const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
            const secondaryAuth = getAuth(secondaryApp);
            
            try {
                // Sign in with old password
                const credential = await signInWithEmailAndPassword(secondaryAuth, selectedUserForPassword.email, selectedUserForPassword.passwordText);
                
                // Update to new password
                const { updatePassword } = await import('firebase/auth');
                await updatePassword(credential.user, newPasswordValue);
                
                // Update Firestore
                const userRef = doc(db, 'users', selectedUserForPassword.uid);
                await setDoc(userRef, { passwordText: newPasswordValue }, { merge: true });

                await deleteApp(secondaryApp);
                setStatus({ message: 'Password updated successfully.', type: 'success' });
                setSelectedUserForPassword(null);
                setNewPasswordValue('');
                setTimeout(() => setStatus({ message: '', type: null }), 3000);
            } catch (err: any) {
                await deleteApp(secondaryApp);
                throw err;
            }
        } catch (error: any) {
            setStatus({ message: error.message || 'Failed to update password', type: 'error' });
            setTimeout(() => setStatus({ message: '', type: null }), 3000);
        }
    };

    const handleToggleStatus = async (user: UserData) => {
        if (user.uid === 'nK7dyNuvKThljMMrxC0B2w3zmXz1') return; // Protect master admin
        
        try {
            const newStatus = user.status === 'disabled' ? 'active' : 'disabled';
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, { status: newStatus }, { merge: true });
            setStatus({ message: `User account ${newStatus}`, type: 'success' });
            setTimeout(() => setStatus({ message: '', type: null }), 2000);
        } catch (error: any) {
            setStatus({ message: error.message || 'Failed to update status', type: 'error' });
            setTimeout(() => setStatus({ message: '', type: null }), 3000);
        }
    };

    const handleDeleteUser = async (user: UserData) => {
        if (user.uid === 'nK7dyNuvKThljMMrxC0B2w3zmXz1') return; // Protect master admin
        
        if (!window.confirm(`Are you sure you want to completely delete ${user.email}? This action cannot be undone.`)) return;

        setStatus({ message: 'Deleting user...', type: null });
        try {
            const { deleteDoc } = await import('firebase/firestore');
            await deleteDoc(doc(db, 'users', user.uid));
            
            // Note: If they have a manually created Auth account, ideally we'd delete it via Admin SDK.
            // Deleting the Firestore doc disables their access to the app anyway.
            
            setStatus({ message: 'User deleted successfully', type: 'success' });
            setTimeout(() => setStatus({ message: '', type: null }), 3000);
        } catch (error: any) {
            setStatus({ message: error.message || 'Failed to delete user', type: 'error' });
            setTimeout(() => setStatus({ message: '', type: null }), 3000);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUserEmail || !newUserName) return;

        setStatus({ message: 'Creating user...', type: null });

        try {
            const emailId = newUserEmail.toLowerCase().trim();
            const name = newUserName.trim();
            
            if (newUserPassword) {
                // Create user with email and password using a secondary Firebase app to prevent logging out admin
                const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
                const secondaryAuth = getAuth(secondaryApp);
                
                try {
                    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, emailId, newUserPassword);
                    const newUid = userCredential.user.uid;
                    
                    const userRef = doc(db, 'users', newUid);
                    await setDoc(userRef, {
                        email: emailId,
                        name: name,
                        role: newUserRole,
                        passwordText: newUserPassword,
                        status: 'active',
                        createdAt: new Date().toISOString()
                    });
                    
                    await deleteApp(secondaryApp);
                    setStatus({ message: 'User created successfully with password.', type: 'success' });
                } catch (err: any) {
                    await deleteApp(secondaryApp);
                    throw err;
                }
            } else {
                // Pre-register for Google sign-in
                const userRef = doc(db, 'users', emailId);
                await setDoc(userRef, {
                    email: emailId,
                    name: name,
                    role: newUserRole,
                    status: 'active',
                    createdAt: new Date().toISOString()
                });
                setStatus({ message: 'User pre-registered successfully for Google Sign-in.', type: 'success' });
            }

            setTimeout(() => setStatus({ message: '', type: null }), 3000);
            
            // Reset form
            setNewUserName('');
            setNewUserEmail('');
            setNewUserPassword('');
            setNewUserRole('viewer');
            setIsAddingUser(false);
        } catch (error: any) {
            setStatus({ message: error.message || 'Failed to add user', type: 'error' });
            setTimeout(() => setStatus({ message: '', type: null }), 3000);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center min-h-[400px] gap-4">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                <p className="text-slate-500 font-medium text-sm">Loading users...</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 p-3 rounded-xl">
                        <Users size={24} className="text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">System Users</h2>
                        <p className="text-sm text-slate-500">Manage registered users and their access roles.</p>
                    </div>
                </div>
                <button 
                    onClick={() => setIsAddingUser(!isAddingUser)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors"
                >
                    {isAddingUser ? 'Cancel' : <><UserPlus size={18} /> Add User</>}
                </button>
            </div>

            {isAddingUser && (
                <div className="mb-8 p-6 bg-slate-50 border border-slate-200 rounded-xl">
                    <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <UserPlus size={16} className="text-indigo-600" /> Pre-register New User
                    </h3>
                    <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase">Name</label>
                            <input 
                                type="text"
                                value={newUserName}
                                onChange={(e) => setNewUserName(e.target.value)}
                                placeholder="Enter full name"
                                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500"
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase">Email</label>
                            <input 
                                type="email"
                                value={newUserEmail}
                                onChange={(e) => setNewUserEmail(e.target.value)}
                                placeholder="Email address"
                                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500"
                                required
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase">Password (Optional)</label>
                            <input 
                                type="text"
                                value={newUserPassword}
                                onChange={(e) => setNewUserPassword(e.target.value)}
                                placeholder="Leave blank for Google Auth"
                                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-bold text-slate-600 uppercase">Role</label>
                            <select 
                                value={newUserRole}
                                onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                                className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 font-semibold"
                            >
                                <option value="viewer">Viewer</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2 rounded-lg transition-colors h-[38px]">
                            Save User
                        </button>
                    </form>
                    <p className="text-xs text-slate-500 mt-3">
                        The user will be able to log in with this email using Google Sign-In.
                    </p>
                </div>
            )}

            {status.message && (
                <div className={`mb-6 p-4 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                    status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                    {status.message}
                </div>
            )}

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse bg-white">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Name</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Email</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Role</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Joined</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(user => (
                            <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-slate-800">{user.name || 'Unnamed User'}</div>
                                    <div className="text-xs text-slate-400 font-mono mt-0.5">{user.uid}</div>
                                </td>
                                <td className="px-6 py-4 text-sm font-medium text-slate-600">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${user.status === 'disabled' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                        {user.email}
                                        {user.status === 'disabled' && <span className="text-[10px] bg-rose-100 text-rose-700 px-2 py-0.5 rounded uppercase font-bold ml-2">Disabled</span>}
                                    </div>
                                </td>
                                <td className="px-6 py-4 flex items-center gap-2">
                                    <select
                                        className={`text-xs font-bold px-3 py-1.5 rounded-full outline-none cursor-pointer border-2 transition-colors ${
                                            user.role === 'admin' 
                                            ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                        }`}
                                        value={user.role}
                                        onChange={(e) => handleRoleChange(user.uid, e.target.value as UserRole)}
                                        disabled={user.uid === 'nK7dyNuvKThljMMrxC0B2w3zmXz1'}
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="viewer">Viewer</option>
                                    </select>
                                    
                                    {user.role !== 'admin' && (
                                        <button 
                                            onClick={() => {
                                                setSelectedUserForPermissions(user);
                                                setTempPermissions(user.allowedViews || []);
                                            }}
                                            className="ml-3 text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-full font-bold transition-colors inline-flex items-center gap-1 border border-indigo-200"
                                        >
                                            <Settings size={14} /> Permissions
                                        </button>
                                    )}
                                    {user.passwordText && (
                                        <button 
                                            onClick={() => {
                                                setSelectedUserForPassword(user);
                                                setNewPasswordValue('');
                                                setShowCurrentPassword(false);
                                            }}
                                            className="ml-2 text-xs bg-amber-50 text-amber-600 hover:bg-amber-100 px-3 py-1.5 rounded-full font-bold transition-colors inline-flex items-center gap-1 border border-amber-200"
                                        >
                                            <Shield size={14} /> Password
                                        </button>
                                    )}
                                    {user.role !== 'admin' && (
                                        <>
                                            <button 
                                                onClick={() => handleToggleStatus(user)}
                                                className={`ml-2 text-xs px-3 py-1.5 rounded-full font-bold transition-colors inline-flex items-center gap-1 border ${
                                                    user.status === 'disabled'
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                                    : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                                                }`}
                                            >
                                                <Power size={14} /> {user.status === 'disabled' ? 'Enable' : 'Disable'}
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteUser(user)}
                                                className="ml-2 text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-full font-bold transition-colors inline-flex items-center gap-1 border border-red-200"
                                            >
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 text-right">
                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, {
                                        year: 'numeric', month: 'short', day: 'numeric'
                                    }) : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            {users.length === 0 && (
                <div className="text-center py-12">
                    <p className="text-slate-500">No users found.</p>
                </div>
            )}

            {/* Permissions Modal */}
            {selectedUserForPermissions && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                            <div>
                                <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                                    <Shield size={20} className="text-indigo-600" />
                                    Manage Permissions
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    Configuring access for <span className="font-bold text-slate-700">{selectedUserForPermissions.name}</span>
                                </p>
                            </div>
                            <button 
                                onClick={() => setSelectedUserForPermissions(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {menuItems.map(section => (
                                    <div key={section.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                                        <div className="flex items-center gap-2 mb-3 text-slate-800 font-bold border-b border-slate-200 pb-2">
                                            <section.icon size={16} className="text-indigo-500" />
                                            {section.label}
                                        </div>
                                        <div className="flex flex-col gap-2 pl-2">
                                            {section.items.map(item => {
                                                const isChecked = tempPermissions.includes(item.id);
                                                return (
                                                    <label key={item.id} className="flex items-center gap-3 cursor-pointer group">
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                                            isChecked ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300 group-hover:border-indigo-400'
                                                        }`}>
                                                            {isChecked && <CheckSquare size={14} className="text-white" />}
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            className="hidden"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setTempPermissions(prev => [...prev, item.id]);
                                                                } else {
                                                                    setTempPermissions(prev => prev.filter(id => id !== item.id));
                                                                }
                                                            }}
                                                        />
                                                        <span className={`text-sm ${isChecked ? 'text-slate-800 font-semibold' : 'text-slate-600'}`}>
                                                            {item.label}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
                            <button 
                                onClick={() => setSelectedUserForPermissions(null)}
                                className="px-4 py-2 font-bold text-sm text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSavePermissions}
                                className="px-6 py-2 font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-sm"
                            >
                                Save Permissions
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Password Modal */}
            {selectedUserForPassword && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Manage Password</h3>
                                <p className="text-xs text-slate-500 mt-1">{selectedUserForPassword.name} ({selectedUserForPassword.email})</p>
                            </div>
                            <button 
                                onClick={() => setSelectedUserForPassword(null)}
                                className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 p-2 rounded-full transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto">
                            <div className="mb-6 p-4 bg-amber-50 rounded-xl border border-amber-100">
                                <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">Current Password</label>
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-amber-900 font-bold bg-amber-100/50 px-3 py-1.5 rounded text-lg tracking-wider">
                                        {showCurrentPassword ? selectedUserForPassword.passwordText : '••••••••'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                        className="text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-200/50 hover:bg-amber-200 px-3 py-1.5 rounded-full transition-colors"
                                    >
                                        {showCurrentPassword ? 'Hide' : 'Reveal'}
                                    </button>
                                </div>
                            </div>

                            <form onSubmit={handleResetPassword}>
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
                                    <input 
                                        type="text" 
                                        value={newPasswordValue}
                                        onChange={(e) => setNewPasswordValue(e.target.value)}
                                        placeholder="Enter new password..."
                                        className="w-full border-2 border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 font-medium transition-colors"
                                        required
                                        minLength={6}
                                    />
                                    <p className="text-xs text-slate-500 mt-2">Must be at least 6 characters. This will update their login credentials immediately.</p>
                                </div>
                                
                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                                    <button 
                                        type="button"
                                        onClick={() => setSelectedUserForPassword(null)}
                                        className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={!newPasswordValue || newPasswordValue.length < 6}
                                        className="px-5 py-2.5 text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm shadow-amber-500/20"
                                    >
                                        <Shield size={16} /> Update Password
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
