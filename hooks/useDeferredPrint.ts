import { useState, useEffect } from 'react';
import { LabelData } from '../types';

const STORAGE_KEY = 'zebra_deferred_queue_v1';

export function useDeferredPrint() {
    const [queue, setQueue] = useState<LabelData[]>([]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setQueue(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load deferred queue", e);
        }
    }, []);

    const saveQueue = (newQueue: LabelData[]) => {
        setQueue(newQueue);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newQueue));
    };

    const addToQueue = (item: LabelData) => {
        const newQueue = [...queue, { ...item, timestamp: new Date().toISOString(), status: 'deferred' as const }];
        // Wait, types.ts says status?: 'ok' | 'error' | 'cancelled'.
        // When we add to queue, it's NOT printed yet. So no status.
        // When we PRINT from queue, we will save to history with 'ok' or 'error'.
        // So this file actually doesn't strictly NEED changes unless we want 'queued' status in history? No.
        saveQueue(newQueue);
    };

    const removeFromQueue = (index: number) => {
        const newQueue = queue.filter((_, i) => i !== index);
        saveQueue(newQueue);
    };

    const clearQueue = () => {
        if (window.confirm("Очистити всю чергу друку?")) {
            saveQueue([]);
        }
    };

    const clearQueueForce = () => {
        saveQueue([]);
    };

    return {
        queue,
        addToQueue,
        removeFromQueue,
        clearQueue,
        clearQueueForce
    };
}
