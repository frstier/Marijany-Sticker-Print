import { User } from '../types';
import { USERS as DEFAULT_USERS } from '../constants'; // Fallback/Initial

const STORAGE_KEY = 'zebra_users_v1';

export const UserService = {
    getUsers(): User[] {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error("Failed to load users", e);
        }

        // Initialize with defaults if empty
        this.saveUsers(DEFAULT_USERS);
        return DEFAULT_USERS;
    },

    saveUsers(users: User[]) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
        } catch (e) {
            console.error("Failed to save users", e);
        }
    },

    addUser(user: User): User[] {
        const users = this.getUsers();
        // Simple distinct check by ID or Name
        if (users.some(u => u.id === user.id || u.name === user.name)) {
            throw new Error("User with this ID or Name already exists");
        }
        const newUsers = [...users, user];
        this.saveUsers(newUsers);
        return newUsers;
    },

    updateUser(updatedUser: User): User[] {
        const users = this.getUsers();
        const idx = users.findIndex(u => u.id === updatedUser.id);
        if (idx === -1) throw new Error("User not found");

        const newUsers = [...users];
        newUsers[idx] = updatedUser;
        this.saveUsers(newUsers);
        return newUsers;
    },

    deleteUser(userId: string): User[] {
        const users = this.getUsers();
        const newUsers = users.filter(u => u.id !== userId);
        this.saveUsers(newUsers);
        return newUsers;
    },

    // Helper to get roles
    getRoles() {
        return [
            { id: 'operator', name: 'Оператор' },
            { id: 'lab', name: 'Лабораторія' },
            { id: 'accountant', name: 'Обліковець' },
            { id: 'admin', name: 'Адміністратор' },
            { id: 'agro', name: 'Агроном' },
        ];
    }
};
