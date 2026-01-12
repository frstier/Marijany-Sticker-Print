import React from 'react';
import { useAuth } from './hooks/useAuth';
import LoginScreen from './components/LoginScreen';
import StandardInterface from './components/interfaces/StandardInterface';
import NewUserInterface from './components/interfaces/NewUserInterface';
import LabInterface from './components/interfaces/LabInterface';
import AdminInterface from './components/interfaces/AdminInterface';
import ReportInterface from './components/interfaces/ReportInterface';
import ReceivingInterface from './components/interfaces/ReceivingInterface';

import { UserService } from './services/userService';
import { ConfigService } from './services/configService';

export default function App() {
    const { currentUser, login } = useAuth();
    // Load users from service (Async)
    const [users, setUsers] = React.useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = React.useState(true);

    React.useEffect(() => {
        // Load global config from Supabase
        ConfigService.loadAll().then(() => {
            console.log('✅ Global config loaded');
        });

        UserService.getUsers().then(data => {
            setUsers(data);
            setLoadingUsers(false);
        });
    }, []);

    if (loadingUsers) {
        return <div className="min-h-screen flex items-center justify-center bg-slate-100 text-slate-500">Завантаження...</div>;
    }

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

    if (currentUser.role === 'report') {
        return <ReportInterface />;
    }

    if (currentUser.role === 'receiving') {
        return <ReceivingInterface />;
    }

    // Default to Standard Interface
    return <StandardInterface />;
}