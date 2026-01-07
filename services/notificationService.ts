import { ProductionService } from './productionService';

// Notification threshold - minimum count to show notification
export const NOTIFICATION_THRESHOLD = 5;

export const NotificationService = {
    /**
     * Get count of pending items for Lab role
     * Lab works with items in 'created' status (not yet graded)
     */
    async getPendingCountForLab(): Promise<number> {
        const items = await ProductionService.getPendingItems();
        return items.length;
    },

    /**
     * Get count of pending items for Accountant role
     * Accountant works with items in 'graded' status (ready to palletize)
     */
    async getPendingCountForAccountant(): Promise<number> {
        const items = await ProductionService.getGradedItems();
        return items.length;
    },

    /**
     * Check if notification should be shown based on threshold
     */
    shouldShowNotification(count: number): boolean {
        return count >= NOTIFICATION_THRESHOLD;
    }
};
