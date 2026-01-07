import { User } from '../types';
import { USERS as DEFAULT_USERS } from '../constants';
import { supabase } from './supabaseClient';

export const UserService = {
    // --- Async Actions ---

    async getUsers(): Promise<User[]> {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('name');

            if (error) throw error;
            if (!data || data.length === 0) {
                // If DB is empty, maybe seed it? Or just return defaults locally?
                // Let's seed with defaults if genuinely empty to help bootstrapping
                // BUT be careful not to overwrite if it's just a network error (caught above)
                return DEFAULT_USERS;
            }
            // Map DB fields if necessary (assuming DB columns match User type)
            // User type: { id, name, role, pin }
            return data as User[];
        } catch (e) {
            console.error("Supabase: Failed to load users", e);
            return DEFAULT_USERS; // Fallback to local constants
        }
    },

    async addUser(user: User): Promise<User[]> {
        // Check for duplicates (by name, since ID might be auto-gen or provided)
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('name', user.name)
            .single();

        if (existing) {
            throw new Error("User with this name already exists");
        }

        const { error } = await supabase
            .from('users')
            .insert([user]);

        if (error) throw error;

        return this.getUsers();
    },

    async updateUser(user: User): Promise<User[]> {
        const { error } = await supabase
            .from('users')
            .update(user)
            .eq('id', user.id);

        if (error) throw error;

        return this.getUsers();
    },

    async deleteUser(userId: string): Promise<User[]> {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) throw error;

        return this.getUsers();
    },

    getRoles() {
        return [
            { id: 'operator', name: 'Оператор' },
            { id: 'lab', name: 'Лабораторія' },
            { id: 'accountant', name: 'Обліковець' },
            { id: 'report', name: 'Звіт' },
            { id: 'admin', name: 'Адміністратор' },
            { id: 'postgres_user', name: 'Postgres Test (Dev)' },
        ];
    }
};

