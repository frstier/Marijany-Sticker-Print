import React from 'react';
import { useAuth } from './hooks/useAuth';
import LoginScreen from './components/LoginScreen';
import StandardInterface from './components/interfaces/StandardInterface';
import NewUserInterface from './components/interfaces/NewUserInterface';
import LabInterface from './components/interfaces/LabInterface';
import AdminInterface from './components/interfaces/AdminInterface';

import { UserService } from './services/userService';

export default function App() {
    const { currentUser, login } = useAuth();
    // Load users from service
    const [users] = React.useState(() => UserService.getUsers());

    // 1. Auth Gate
    if (!currentUser) {
        return <LoginScreen onLogin={login} users={users} />;
    }

    // ROUTER LOGIC
    // 2. Role-Based Routing

    if (currentUser.role === 'admin') {
        return <AdminInterface />;
    }

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