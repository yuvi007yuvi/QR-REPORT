import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import NagarNigamLogo from '../assets/nagar-nigam-logo.png';
import NatureGreenLogo from '../assets/NatureGreen_Logo.png';
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';

// Google icon SVG
const GoogleIcon = () => (
    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.5 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.5 29.4 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.3 0 10-1.9 13.7-5l-6.3-5.3C29.5 35.6 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-8H6.1C9.4 36.5 16.2 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.9 2.4-2.5 4.5-4.6 6l6.3 5.3C40 36 44 30.5 44 24c0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
);

const LoginPage: React.FC = () => {
    const { login, loginWithGoogle } = useAuth();
    const [email, setEmail]         = useState('');
    const [password, setPassword]   = useState('');
    const [showPass, setShowPass]   = useState(false);
    const [error, setError]         = useState('');
    const [loading, setLoading]     = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const getErrorMessage = (code: string) => {
        switch (code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                return 'Invalid email or password. Please try again.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please wait a few minutes.';
            case 'auth/invalid-email':
                return 'Please enter a valid email address.';
            case 'auth/popup-closed-by-user':
                return 'Sign-in popup was closed. Please try again.';
            case 'auth/popup-blocked':
                return 'Popup blocked by browser. Please allow popups for this site.';
            case 'auth/unauthorized-domain':
                return 'This domain is not authorized for login. Check Firebase Console settings.';
            case 'auth/operation-not-allowed':
                return 'Google Sign-in is not enabled in Firebase Console. Please enable it.';
            default:
                return 'Login failed. Check your credentials or contact the administrator.';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email.trim(), password);
        } catch (err: any) {
            setError(getErrorMessage(err?.code || ''));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setError('');
        setGoogleLoading(true);
        try {
            await loginWithGoogle();
        } catch (err: any) {
            setError(getErrorMessage(err?.code || ''));
        } finally {
            setGoogleLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Inter, Outfit, sans-serif', position: 'relative', overflow: 'hidden',
        }}>
            {/* Background blobs */}
            <div style={{ position: 'absolute', top: '-200px', left: '-200px', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-200px', right: '-150px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.03) 0%, transparent 70%)', pointerEvents: 'none' }} />

            {/* Card */}
            <div style={{
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.06)', borderRadius: '28px',
                padding: '40px', width: '100%', maxWidth: '420px',
                boxShadow: '0 40px 100px rgba(0,0,0,0.08)',
                animation: 'fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                zIndex: 10
            }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                        <img src={NagarNigamLogo} alt="Nagar Nigam" style={{ height: '54px', objectFit: 'contain' }} />
                        <div style={{ width: '1px', height: '40px', background: 'rgba(0,0,0,0.06)' }} />
                        <img src={NatureGreenLogo} alt="Nature Green" style={{ height: '46px', objectFit: 'contain' }} />
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '99px', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.1)', marginBottom: '12px' }}>
                        <ShieldCheck size={14} color="#10b981" />
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#10b981', letterSpacing: '0.1em' }}>PORTAL BUDDY ADMIN</span>
                    </div>
                    <h1 style={{ fontFamily: 'Outfit, Inter, sans-serif', fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px', letterSpacing: '-0.03em' }}>Welcome Back</h1>
                    <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>Secure Authentication Required</p>
                </div>

                {/* Error */}
                {error && (
                    <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#b91c1c', fontSize: '13px', fontWeight: 500, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>⚠️</span> {error}
                    </div>
                )}

                {/* Google Sign-In Button */}
                <button
                    onClick={handleGoogle}
                    disabled={googleLoading || loading}
                    style={{
                        width: '100%', padding: '13px', borderRadius: '12px',
                        border: '1.5px solid rgba(0,0,0,0.06)',
                        background: '#ffffff',
                        color: '#0f172a', fontSize: '14px', fontWeight: 600,
                        cursor: (googleLoading || loading) ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', marginBottom: '20px',
                        fontFamily: 'Inter, sans-serif',
                        opacity: (googleLoading || loading) ? 0.5 : 1,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}
                    onMouseEnter={e => { if (!googleLoading && !loading) { (e.currentTarget as HTMLButtonElement).style.background = '#f8fafc'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.1)'; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#ffffff'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,0,0,0.06)'; }}
                >
                    {googleLoading ? (
                        <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
                    ) : <GoogleIcon />}
                    {googleLoading ? 'Verifying...' : 'Continue with Google'}
                </button>

                {/* Divider */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.06)' }} />
                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 600 }}>OR</span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.06)' }} />
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '8px', letterSpacing: '0.08em' }}>CORPORATE EMAIL</label>
                        <input
                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="name@portalbuddy.com" required
                            style={{ width: '100%', boxSizing: 'border-box', padding: '12px 16px', borderRadius: '12px', border: '1.5px solid rgba(0,0,0,0.08)', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif' }}
                            onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 0 4px rgba(16,185,129,0.08)'; }}
                            onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none'; }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '8px', letterSpacing: '0.08em' }}>PASSWORD</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type={showPass ? 'text' : 'password'} value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••" required
                                style={{ width: '100%', boxSizing: 'border-box', padding: '12px 48px 12px 16px', borderRadius: '12px', border: '1.5px solid rgba(0,0,0,0.08)', background: '#f8fafc', color: '#0f172a', fontSize: '14px', outline: 'none', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif' }}
                                onFocus={e => { e.target.style.borderColor = '#10b981'; e.target.style.boxShadow = '0 0 0 4px rgba(16,185,129,0.08)'; }}
                                onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.08)'; e.target.style.boxShadow = 'none'; }}
                            />
                            <button type="button" onClick={() => setShowPass(!showPass)}
                                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', padding: 0, transition: 'color 0.2s' }}
                                onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
                                onMouseLeave={e => (e.currentTarget.style.color = '#475569')}>
                                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" disabled={loading || googleLoading}
                        style={{
                            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                            background: (loading || googleLoading) ? 'rgba(16,185,129,0.3)' : '#10b981',
                            color: '#ffffff', fontSize: '15px', fontWeight: 800,
                            cursor: (loading || googleLoading) ? 'not-allowed' : 'pointer',
                            boxShadow: (loading || googleLoading) ? 'none' : '0 10px 25px -5px rgba(16,185,129,0.4)',
                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                            fontFamily: 'Outfit, Inter, sans-serif', marginTop: '4px'
                        }}
                        onMouseEnter={e => { if (!loading && !googleLoading) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                        onMouseLeave={e => { if (!loading && !googleLoading) e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                        {loading ? (
                            <><div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '3px solid rgba(0,0,0,0.1)', borderTopColor: '#020617', animation: 'spin 0.8s linear infinite' }} /> Processing...</>
                        ) : (
                            <><LogIn size={18} /> Authenticate System</>
                        )}
                    </button>
                </form>

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: '32px' }}>
                    <p style={{ fontSize: '11px', color: '#475569', marginBottom: '8px', fontWeight: 600, letterSpacing: '0.02em' }}>
                        Portal Buddy Management Console v3.1
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', fontSize: '10px', color: '#334155' }}>
                        <span>SYSTEM STATUS: ONLINE</span>
                        <span style={{ color: '#10b981' }}>●</span>
                        <span>ENCRYPTION: AES-256</span>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(30px) scale(0.98); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
};

export default LoginPage;
