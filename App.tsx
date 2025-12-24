import React from 'react';
import { useAuth } from './hooks/useAuth';
import LoginScreen from './components/LoginScreen';
import StandardInterface from './components/interfaces/StandardInterface';
import NewUserInterface from './components/interfaces/NewUserInterface';
import LabInterface from './components/interfaces/LabInterface';

export default function App() {
    const { currentUser, login } = useAuth();

    // 1. Auth Gate
    if (!currentUser) {
        return <LoginScreen onLogin={login} />;
    }

    // ROUTER LOGIC
    // 2. Role-Based Routing
    // Check for a specific role or flag. For now, let's assume 'superuser' or similar is the new role.
    // If not standard roles ('admin', 'operator', 'lab', 'accountant'), show New Interface?
    // OR specifically if role === 'test_role' for now.

    // For testing/demo purposes, you can add a user with role 'postgres_user' to types or hardcode here.
    // For testing/demo purposes, you can add a user with role 'postgres_user' or 'accountant'
    if (currentUser.role === 'postgres_user' || currentUser.role === 'accountant') {
        return <NewUserInterface />;
    }

    if (currentUser.role === 'lab') {
        return <LabInterface />;
    }

    // Default to Standard Interface
    return <StandardInterface />;
}