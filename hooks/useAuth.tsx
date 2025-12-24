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
    const { users } = useData();

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

    const login = (user: User) => {
        setCurrentUser(user);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    };

    const logout = () => {
        setCurrentUser(null);
        sessionStorage.removeItem(SESSION_KEY);
    };

    const isAdmin = currentUser?.role === 'admin';

    const value = {
        currentUser,
        login,
        logout,
        isAdmin,
        users
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
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
