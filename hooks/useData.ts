import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { DatabaseService } from '../services/db';
import { PRODUCTS, USERS } from '../constants';
import { Product, User } from '../types';

export function useData() {
    const [products, setProducts] = useState<Product[]>(PRODUCTS); // Default to constants
    const [users, setUsers] = useState<User[]>(USERS); // Default to constants
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (Capacitor.getPlatform() !== 'web') {
                try {
                    await DatabaseService.init();

                    const dbProducts = await DatabaseService.getProducts();
                    if (dbProducts.length > 0) {
                        setProducts(dbProducts as Product[]);
                    }

                    const dbUsers = await DatabaseService.getUsers();
                    if (dbUsers.length > 0) {
                        setUsers(dbUsers as User[]);
                    }
                } catch (e) {
                    console.error("Failed to load data from DB:", e);
                }
            }
            setIsLoading(false);
        };
        loadData();
    }, []);

    return { products, users, isLoading };
}
