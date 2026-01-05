import { useState, useEffect, useCallback } from 'react';

const OFFLINE_QUEUE_KEY = 'offline_print_queue';
const OFFLINE_STATUS_KEY = 'offline_status';

interface OfflineItem {
    id: string;
    type: 'print' | 'sync';
    data: any;
    timestamp: number;
}

export function useOfflineSync() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [offlineQueue, setOfflineQueue] = useState<OfflineItem[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    // Load queue from localStorage
    useEffect(() => {
        const saved = localStorage.getItem(OFFLINE_QUEUE_KEY);
        if (saved) {
            try {
                setOfflineQueue(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse offline queue:', e);
            }
        }
    }, []);

    // Save queue to localStorage
    useEffect(() => {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(offlineQueue));
    }, [offlineQueue]);

    // Online/Offline detection
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            console.log('📶 Back online - syncing...');
            syncQueue();
        };

        const handleOffline = () => {
            setIsOnline(false);
            console.log('📵 Offline mode activated');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Add item to offline queue
    const addToQueue = useCallback((type: 'print' | 'sync', data: any) => {
        const item: OfflineItem = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            data,
            timestamp: Date.now()
        };
        setOfflineQueue(prev => [...prev, item]);
        console.log('📥 Added to offline queue:', item);
        return item.id;
    }, []);

    // Remove item from queue
    const removeFromQueue = useCallback((id: string) => {
        setOfflineQueue(prev => prev.filter(item => item.id !== id));
    }, []);

    // Sync queue when online
    const syncQueue = useCallback(async () => {
        if (!navigator.onLine || offlineQueue.length === 0 || isSyncing) {
            return;
        }

        setIsSyncing(true);
        console.log(`🔄 Syncing ${offlineQueue.length} items...`);

        const failedItems: OfflineItem[] = [];

        for (const item of offlineQueue) {
            try {
                // Process based on type
                if (item.type === 'print') {
                    // Retry print action (implement based on your print service)
                    console.log('🖨️ Retrying print:', item.data);
                    // await printService.print(item.data);
                } else if (item.type === 'sync') {
                    // Sync data to server (implement based on your data service)
                    console.log('📤 Syncing data:', item.data);
                    // await dataService.sync(item.data);
                }
            } catch (e) {
                console.error('Failed to sync item:', item.id, e);
                failedItems.push(item);
            }
        }

        setOfflineQueue(failedItems);
        setIsSyncing(false);

        if (failedItems.length === 0) {
            console.log('✅ All items synced successfully');
        } else {
            console.log(`⚠️ ${failedItems.length} items failed to sync`);
        }
    }, [offlineQueue, isSyncing]);

    return {
        isOnline,
        offlineQueue,
        queueLength: offlineQueue.length,
        isSyncing,
        addToQueue,
        removeFromQueue,
        syncQueue
    };
}
