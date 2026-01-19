import { supabase } from './supabaseClient';
import { Location, CreateLocationData } from '../types/location';

const STORAGE_KEY = 'zebra_locations_v1';

export const LocationService = {
    // =====================================================
    // CRUD
    // =====================================================

    async getLocations(): Promise<Location[]> {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .order('code', { ascending: true });

        if (error) {
            console.error('Error fetching locations:', error);
            return [];
        }
        return data || [];
    },

    async getLocationByCode(code: string): Promise<Location | null> {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .eq('code', code)
            .single();

        if (error) {
            // It's common to not find a location, so just return null
            return null;
        }
        return data;
    },

    async createLocation(locationData: CreateLocationData): Promise<Location | null> {
        const code = this.generateCode(locationData.zone, locationData.rack, locationData.level, locationData.position);

        const newLocation = {
            ...locationData,
            code,
            is_occupied: false
        };

        const { data, error } = await supabase
            .from('locations')
            .insert(newLocation)
            .select()
            .single();

        if (error) {
            console.error('Error creating location:', error);
            throw error;
        }
        return data;
    },

    // =====================================================
    // ASSIGNMENT
    // =====================================================

    async assignItemToLocation(itemId: string, locationId: string): Promise<void> {
        // 1. Assign to item
        const { error: itemError } = await supabase
            .from('production_items')
            .update({ location_id: locationId })
            .eq('id', itemId);

        if (itemError) throw itemError;

        // 2. Mark location as occupied
        await this.updateLocationOccupancy(locationId, true);
    },

    async assignPalletToLocation(batchId: string, locationId: string): Promise<void> {
        // 1. Assign to pallet
        const { error: batchError } = await supabase
            .from('batches')
            .update({ location_id: locationId })
            .eq('id', batchId);

        if (batchError) throw batchError;

        // 2. Mark location as occupied
        await this.updateLocationOccupancy(locationId, true);
    },

    async clearLocation(locationId: string): Promise<void> {
        // Update location status, assumes caller has cleared items
        await this.updateLocationOccupancy(locationId, false);
    },

    // =====================================================
    // HELPERS
    // =====================================================

    generateCode(zone: string, rack: string, level: string, position?: string): string {
        // Normalize
        const z = zone.toUpperCase();
        const r = rack.padStart(2, '0');
        const l = level;

        let code = `${z}-${r}-${l}`;
        if (position) {
            code += `-${position.toUpperCase()}`;
        }
        return code;
    },

    async updateLocationOccupancy(locationId: string, isOccupied: boolean): Promise<void> {
        const { error } = await supabase
            .from('locations')
            .update({ is_occupied: isOccupied })
            .eq('id', locationId);

        if (error) console.error('Error updating location occupancy:', error);
    },

    async searchItemsInLocation(locationId: string) {
        // Find items directly in this location
        const { data: items } = await supabase
            .from('production_items')
            .select('*')
            .eq('location_id', locationId);

        // Find pallets in this location
        const { data: pallets } = await supabase
            .from('batches')
            .select('*')
            .eq('location_id', locationId);

        return {
            items: items || [],
            pallets: pallets || []
        };
    }
};
