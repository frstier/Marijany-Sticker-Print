import { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { USERS } from '../constants';
import { useData } from './useData';

const SESSION_KEY = 'zebra_auth_user_v1';

export function useAuth() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const { users } = useData();

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

    return {
        currentUser,
        login,
        logout,
        isAdmin,
        users
    };
}
