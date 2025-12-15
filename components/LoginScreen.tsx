import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { USERS } from '../constants';

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
                <div className="bg-[#115740] p-4 md:p-6 text-center">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-4 shadow-lg p-3">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold text-white">Авторизація</h1>
                    <p className="text-emerald-100 text-sm mt-1 mb-1">Marijany Sticker Print</p>
                </div>

                <div className="p-6">
                    {/* User Selection */}
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Оберіть користувача
                        </label>
                        <div className="relative">
                            <select
                                value={selectedUser.id}
                                onChange={(e) => {
                                    const user = users.find(u => u.id === e.target.value);
                                    if (user) {
                                        setSelectedUser(user);
                                        setPin('');
                                        setError('');
                                    }
                                }}
                                className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-3 px-4 pr-8 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-[#115740] font-bold"
                            >
                                {users.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.name}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                            </div>
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
                    <div className="grid grid-cols-3 gap-2 md:gap-3">
                        {keys.map((key) => {
                            if (key === 'empty') return <div key={key} />;
                            if (key === 'back') return (
                                <button
                                    key={key}
                                    onClick={handleBackspace}
                                    className="h-12 md:h-14 flex items-center justify-center text-slate-500 hover:bg-slate-100 rounded-lg transition-colors font-bold"
                                >
                                    ⌫
                                </button>
                            );
                            return (
                                <button
                                    key={key}
                                    onClick={() => handleKeyPress(key)}
                                    className="h-12 md:h-14 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xl rounded-lg border-b-2 border-slate-200 active:border-b-0 active:translate-y-[2px] transition-all"
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
