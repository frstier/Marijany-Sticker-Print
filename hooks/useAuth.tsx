import React, { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User } from '../types';
import { useData } from './useData';

const SESSION_KEY = 'zebra_auth_user_v1';

interface AuthContextType {
    currentUser: User | null;
    login: (user: User) => void;
    logout: () => void;
    isAdmin: boolean;
    users: User[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [showLogoutWarning, setShowLogoutWarning] = useState(false);
    const { users } = useData();

    const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
    const WARNING_BEFORE = 60 * 1000; // 1 minute warning

    console.log("AuthProvider mounted", { currentUser, usersCount: users.length });

    // 1. Restore Session
    useEffect(() => {
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
            try {
                setCurrentUser(JSON.parse(saved));
            } catch (e) {
                sessionStorage.removeItem(SESSION_KEY);
            }
        }
    }, []);

    // 2. Inactivity Timer
    useEffect(() => {
        if (!currentUser) {
            setShowLogoutWarning(false);
            return;
        }

        let logoutTimer: NodeJS.Timeout;
        let warningTimer: NodeJS.Timeout;

        const resetTimers = () => {
            setShowLogoutWarning(false);
            clearTimeout(logoutTimer);
            clearTimeout(warningTimer);

            warningTimer = setTimeout(() => {
                setShowLogoutWarning(true);
            }, INACTIVITY_TIMEOUT - WARNING_BEFORE);

            logoutTimer = setTimeout(() => {
                logout();
            }, INACTIVITY_TIMEOUT);
        };

        const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
        events.forEach(event => window.addEventListener(event, resetTimers));
        resetTimers();

        return () => {
            clearTimeout(logoutTimer);
            clearTimeout(warningTimer);
            events.forEach(event => window.removeEventListener(event, resetTimers));
        };
    }, [currentUser]);

    const login = (user: User) => {
        setCurrentUser(user);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    };

    const logout = () => {
        setCurrentUser(null);
        setShowLogoutWarning(false);
        sessionStorage.removeItem(SESSION_KEY);
    };

    const isAdmin = currentUser?.role === 'admin';

    const value = {
        currentUser,
        login,
        logout,
        isAdmin,
        users,
        showLogoutWarning,
        dismissLogoutWarning: () => setShowLogoutWarning(false)
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
            {showLogoutWarning && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-[var(--bg-card)] p-6 rounded-2xl shadow-2xl max-w-sm text-center">
                        <div className="text-4xl mb-4">⏰</div>
                        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">Сесія закінчується</h2>
                        <p className="text-[var(--text-secondary)] mb-4">Через бездіяльність вас буде автоматично виведено з системи за 1 хвилину.</p>
                        <button
                            onClick={() => setShowLogoutWarning(false)}
                            className="w-full py-3 bg-[var(--accent-primary)] text-white font-bold rounded-xl hover:bg-[var(--accent-hover)] transition-colors"
                        >
                            Залишитись
                        </button>
                    </div>
                </div>
            )}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
