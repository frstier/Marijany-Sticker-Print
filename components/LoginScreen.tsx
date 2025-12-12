import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { USERS } from '../constants';
import { LockClosedIcon } from './Icons';

interface LoginScreenProps {
    onLogin: (user: User) => void;
    users?: User[];
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, users = USERS }) => {
    const [selectedUser, setSelectedUser] = useState<User>(USERS[0]); // Default to Accountant
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');

    const handleKeyPress = (key: string) => {
        if (pin.length < 4) {
            setPin(prev => prev + key);
            setError('');
        }
    };

    const handleClear = () => {
        setPin('');
        setError('');
    };

    const handleBackspace = () => {
        setPin(prev => prev.slice(0, -1));
        setError('');
    };

    const handleSubmit = () => {
        if (pin === selectedUser.pin) {
            onLogin(selectedUser);
        } else {
            setError('Невірний PIN-код');
            setPin('');
        }
    };

    // Auto-submit when 4 digits entered
    useEffect(() => {
        if (pin.length === 4) {
            handleSubmit();
        }
    }, [pin]);

    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'empty', '0', 'back'];

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-[#115740] p-6 text-center">
                    <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <LockClosedIcon />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Авторизація</h1>
                    <p className="text-emerald-100 text-sm mt-1">Marijany Sticker Print</p>
                </div>

                <div className="p-6">
                    {/* User Selection */}
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Оберіть користувача
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {USERS.map(user => (
                                <button
                                    key={user.id}
                                    onClick={() => {
                                        setSelectedUser(user);
                                        setPin('');
                                        setError('');
                                    }}
                                    className={`p-3 rounded-lg text-sm font-bold transition-all border-2 ${selectedUser.id === user.id
                                        ? 'border-[#115740] bg-green-50 text-[#115740]'
                                        : 'border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200'
                                        }`}
                                >
                                    {user.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* PIN Display */}
                    <div className="mb-6">
                        <div className="flex justify-center gap-4 mb-2">
                            {[0, 1, 2, 3].map(i => (
                                <div
                                    key={i}
                                    className={`w-4 h-4 rounded-full border-2 transition-colors ${i < pin.length
                                        ? 'bg-[#115740] border-[#115740]'
                                        : 'border-slate-300 bg-transparent'
                                        }`}
                                />
                            ))}
                        </div>
                        <div className="h-6 text-center">
                            {error && <span className="text-red-500 text-sm font-medium animate-pulse">{error}</span>}
                        </div>
                    </div>

                    {/* Simple Keypad */}
                    <div className="grid grid-cols-3 gap-3">
                        {keys.map((key) => {
                            if (key === 'empty') return <div key={key} />;
                            if (key === 'back') return (
                                <button
                                    key={key}
                                    onClick={handleBackspace}
                                    className="h-14 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-lg transition-colors font-bold"
                                >
                                    ⌫
                                </button>
                            );
                            return (
                                <button
                                    key={key}
                                    onClick={() => handleKeyPress(key)}
                                    className="h-14 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xl rounded-lg border-b-2 border-slate-200 active:border-b-0 active:translate-y-[2px] transition-all"
                                >
                                    {key}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
