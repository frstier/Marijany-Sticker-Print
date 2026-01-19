import { supabase } from './supabaseClient';
import { Shipment, ShipmentItem, ShipmentStatus, CreateShipmentData, ShipmentSummary } from '../types/shipping';
import { Batch } from '../types/pallet';
import { LocationService } from './locationService';

const USE_SUPABASE = true;
const STORAGE_KEY = 'zebra_shipments_v1';
const SEQUENCE_KEY = 'zebra_shipment_seq_v1';

export const ShipmentService = {
    // =====================================================
    // SHIPMENT NUMBER GENERATION
    // =====================================================

    getNextShipmentNumber(): string {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const lastDate = localStorage.getItem('zebra_shipment_date_v1');

        if (lastDate !== today) {
            localStorage.setItem('zebra_shipment_date_v1', today);
            localStorage.setItem(SEQUENCE_KEY, '0');
        }

        const seq = parseInt(localStorage.getItem(SEQUENCE_KEY) || '0') + 1;
        localStorage.setItem(SEQUENCE_KEY, seq.toString());

        return `SH-${today}-${String(seq).padStart(3, '0')}`;
    },

    // =====================================================
    // CRUD OPERATIONS
    // =====================================================

    async getShipments(): Promise<Shipment[]> {
        if (USE_SUPABASE && supabase) {
            try {
                const { data: shipments, error } = await supabase
                    .from('shipments')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) throw error;
                if (!shipments) return [];

                // Fetch items for all shipments
                const { data: items } = await supabase
                    .from('shipment_items')
                    .select('*');

                return shipments.map((s: any) => this.mapShipmentFromDb(s, items || []));
            } catch (e) {
                console.error('Supabase getShipments failed:', e);
            }
        }

        // Local fallback
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Failed to load shipments:', e);
            return [];
        }
    },

    async getShipmentById(id: string): Promise<Shipment | null> {
        if (USE_SUPABASE && supabase) {
            try {
                const { data: shipment, error } = await supabase
                    .from('shipments')
                    .select('*')
                    .eq('id', id)
                    .single();

                if (error || !shipment) return null;

                const { data: items } = await supabase
                    .from('shipment_items')
                    .select('*')
                    .eq('shipment_id', id);

                return this.mapShipmentFromDb(shipment, items || []);
            } catch (e) {
                console.error('getShipmentById failed:', e);
                return null;
            }
        }

        const shipments = await this.getShipments();
        return shipments.find(s => s.id === id) || null;
    },

    async createShipment(data: CreateShipmentData, userId?: string): Promise<Shipment> {
        const shipmentNumber = this.getNextShipmentNumber();

        if (USE_SUPABASE && supabase) {
            const { data: created, error } = await supabase
                .from('shipments')
                .insert({
                    shipment_number: shipmentNumber,
                    destination: data.destination,
                    destination_address: data.destinationAddress,
                    carrier: data.carrier,
                    truck_number: data.truckNumber,
                    driver_name: data.driverName,
                    driver_phone: data.driverPhone,
                    scheduled_date: data.scheduledDate,
                    notes: data.notes,
                    status: 'draft',
                    created_by: userId
                })
                .select()
                .single();

            if (error) {
                console.error('createShipment failed:', error);
                throw new Error(`Failed to create shipment: ${error.message}`);
            }

            return this.mapShipmentFromDb(created, []);
        }

        // Local fallback
        const newShipment: Shipment = {
            id: crypto.randomUUID(),
            shipmentNumber,
            destination: data.destination,
            destinationAddress: data.destinationAddress,
            carrier: data.carrier,
            truckNumber: data.truckNumber,
            driverName: data.driverName,
            driverPhone: data.driverPhone,
            scheduledDate: data.scheduledDate,
            notes: data.notes,
            status: 'draft',
            createdAt: new Date().toISOString(),
            totalWeight: 0,
            totalPallets: 0,
            items: [],
            createdBy: userId
        };

        const shipments = await this.getShipments();
        shipments.unshift(newShipment);
        this.saveShipmentsLocal(shipments);

        return newShipment;
    },

    async updateShipment(id: string, updates: Partial<CreateShipmentData>): Promise<Shipment> {
        if (USE_SUPABASE && supabase) {
            const { error } = await supabase
                .from('shipments')
                .update({
                    destination: updates.destination,
                    destination_address: updates.destinationAddress,
                    carrier: updates.carrier,
                    truck_number: updates.truckNumber,
                    driver_name: updates.driverName,
                    driver_phone: updates.driverPhone,
                    scheduled_date: updates.scheduledDate,
                    notes: updates.notes,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
        }

        const shipment = await this.getShipmentById(id);
        if (!shipment) throw new Error('Shipment not found');
        return shipment;
    },

    async deleteShipment(id: string): Promise<void> {
        if (USE_SUPABASE && supabase) {
            // First, unlink all pallets
            await supabase
                .from('batches')
                .update({ shipment_id: null, shipped_at: null })
                .eq('shipment_id', id);

            // Delete shipment (cascades to shipment_items)
            const { error } = await supabase
                .from('shipments')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return;
        }

        const shipments = await this.getShipments();
        const filtered = shipments.filter(s => s.id !== id);
        this.saveShipmentsLocal(filtered);
    },

    // =====================================================
    // PALLET MANAGEMENT
    // =====================================================

    async addPalletToShipment(shipmentId: string, batch: Batch, userId?: string): Promise<Shipment> {
        if (USE_SUPABASE && supabase) {
            // Check if pallet is already in another shipment
            const { data: existingBatch } = await supabase
                .from('batches')
                .select('shipment_id')
                .eq('id', batch.id)
                .single();

            if (existingBatch?.shipment_id && existingBatch.shipment_id !== shipmentId) {
                throw new Error('Палета вже додана до іншого відвантаження');
            }

            // Add to shipment_items
            const { error: itemError } = await supabase
                .from('shipment_items')
                .upsert({
                    shipment_id: shipmentId,
                    batch_id: batch.id,
                    pallet_weight: batch.totalWeight,
                    pallet_item_count: batch.items.length,
                    product_name: batch.items[0]?.productName || 'Mixed',
                    sort: batch.sort,
                    added_by: userId
                }, { onConflict: 'shipment_id,batch_id' });

            if (itemError) throw itemError;

            // Link batch to shipment
            await supabase
                .from('batches')
                .update({ shipment_id: shipmentId })
                .eq('id', batch.id);

            // Update shipment totals
            await this.recalculateShipmentTotals(shipmentId);
        }

        const shipment = await this.getShipmentById(shipmentId);
        if (!shipment) throw new Error('Shipment not found');
        return shipment;
    },

    async removePalletFromShipment(shipmentId: string, batchId: string): Promise<Shipment> {
        if (USE_SUPABASE && supabase) {
            // Remove from shipment_items
            await supabase
                .from('shipment_items')
                .delete()
                .eq('shipment_id', shipmentId)
                .eq('batch_id', batchId);

            // Unlink batch
            await supabase
                .from('batches')
                .update({ shipment_id: null })
                .eq('id', batchId);

            // Update totals
            await this.recalculateShipmentTotals(shipmentId);
        }

        const shipment = await this.getShipmentById(shipmentId);
        if (!shipment) throw new Error('Shipment not found');
        return shipment;
    },

    async recalculateShipmentTotals(shipmentId: string): Promise<void> {
        if (USE_SUPABASE && supabase) {
            const { data: items } = await supabase
                .from('shipment_items')
                .select('pallet_weight')
                .eq('shipment_id', shipmentId);

            const totalWeight = items?.reduce((sum, i) => sum + (i.pallet_weight || 0), 0) || 0;
            const totalPallets = items?.length || 0;

            await supabase
                .from('shipments')
                .update({ total_weight: totalWeight, total_pallets: totalPallets })
                .eq('id', shipmentId);
        }
    },

    // =====================================================
    // STATUS MANAGEMENT
    // =====================================================

    async updateStatus(id: string, status: ShipmentStatus): Promise<Shipment> {
        const updates: Record<string, any> = { status };

        if (status === 'shipped') {
            updates.shipped_at = new Date().toISOString();
        } else if (status === 'delivered') {
            updates.delivered_at = new Date().toISOString();
        }

        if (USE_SUPABASE && supabase) {
            const { error } = await supabase
                .from('shipments')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            // If shipped, update all batches status
            if (status === 'shipped') {
                await supabase
                    .from('batches')
                    .update({ shipped_at: new Date().toISOString() })
                    .eq('shipment_id', id);

                // Also update production_items
                const { data: batches } = await supabase
                    .from('batches')
                    .select('id, location_id')
                    .eq('shipment_id', id);

                if (batches) {
                    for (const batch of batches) {
                        await supabase
                            .from('production_items')
                            .update({ status: 'shipped', shipped_at: new Date().toISOString() })
                            .eq('batch_id', batch.id);

                        // 3. Release Location if exists
                        if (batch.location_id) {
                            await LocationService.updateLocationOccupancy(batch.location_id, false);

                            // Clear location_id from batch so it doesn't show up in search
                            await supabase
                                .from('batches')
                                .update({ location_id: null })
                                .eq('id', batch.id);
                        }
                    }
                }
            }
        }

        const shipment = await this.getShipmentById(id);
        if (!shipment) throw new Error('Shipment not found');
        return shipment;
    },

    // =====================================================
    // REPORTS & ANALYTICS
    // =====================================================

    async getSummary(): Promise<ShipmentSummary> {
        const shipments = await this.getShipments();

        const summary: ShipmentSummary = {
            totalShipments: shipments.length,
            totalPallets: shipments.reduce((sum, s) => sum + s.totalPallets, 0),
            totalWeight: shipments.reduce((sum, s) => sum + s.totalWeight, 0),
            byStatus: {
                draft: 0,
                loading: 0,
                shipped: 0,
                in_transit: 0,
                delivered: 0,
                cancelled: 0
            },
            byDestination: {}
        };

        shipments.forEach(s => {
            summary.byStatus[s.status]++;
            summary.byDestination[s.destination] = (summary.byDestination[s.destination] || 0) + 1;
        });

        return summary;
    },

    async getAvailablePallets(): Promise<Batch[]> {
        if (USE_SUPABASE && supabase) {
            // Get closed pallets not yet in a shipment
            const { data: batches, error } = await supabase
                .from('batches')
                .select('*')
                .eq('status', 'closed')
                .is('shipment_id', null)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!batches) return [];

            // Get items for these batches
            const batchIds = batches.map((b: any) => b.id);
            const { data: items } = await supabase
                .from('production_items')
                .select('*')
                .in('batch_id', batchIds);

            return batches.map((b: any) => ({
                id: b.id,
                displayId: b.batch_number,
                date: b.created_at,
                sort: b.sort,
                status: b.status,
                totalWeight: b.total_weight || 0,
                items: items
                    ? items.filter((i: any) => i.batch_id === b.id).map((i: any) => ({
                        productionItemId: i.id,
                        serialNumber: i.serial_number,
                        weight: i.weight,
                        productName: i.product_name,
                        sort: i.sort,
                        date: i.date,
                        barcode: i.barcode
                    }))
                    : []
            }));
        }

        return [];
    },

    // =====================================================
    // QR CODE & CMR GENERATION
    // =====================================================

    generateDriverQRData(shipment: Shipment): string {
        const qrData = {
            id: shipment.id,
            number: shipment.shipmentNumber,
            destination: shipment.destination,
            pallets: shipment.totalPallets,
            weight: shipment.totalWeight,
            items: shipment.items.map(i => ({
                pallet: i.displayId || i.batchId,
                product: i.productName,
                weight: i.palletWeight
            }))
        };
        return JSON.stringify(qrData);
    },

    generateCMRData(shipment: Shipment): Record<string, any> {
        return {
            cmrNumber: shipment.cmrNumber || shipment.shipmentNumber,
            date: new Date().toLocaleDateString('uk-UA'),
            sender: {
                name: 'Marijany Hemp Factory',
                address: 'Ukraine'
            },
            receiver: {
                name: shipment.destination,
                address: shipment.destinationAddress || ''
            },
            carrier: {
                name: shipment.carrier || '',
                vehicle: shipment.truckNumber || '',
                driver: shipment.driverName || ''
            },
            goods: shipment.items.map(i => ({
                description: `${i.productName} - ${i.sort}`,
                weight: i.palletWeight,
                packages: 1
            })),
            totalWeight: shipment.totalWeight,
            totalPackages: shipment.totalPallets,
            notes: shipment.notes
        };
    },

    // =====================================================
    // HELPERS
    // =====================================================

    mapShipmentFromDb(s: any, items: any[]): Shipment {
        return {
            id: s.id,
            shipmentNumber: s.shipment_number,
            destination: s.destination,
            destinationAddress: s.destination_address,
            carrier: s.carrier,
            truckNumber: s.truck_number,
            driverName: s.driver_name,
            driverPhone: s.driver_phone,
            status: s.status as ShipmentStatus,
            scheduledDate: s.scheduled_date,
            shippedAt: s.shipped_at,
            deliveredAt: s.delivered_at,
            createdAt: s.created_at,
            updatedAt: s.updated_at,
            notes: s.notes,
            cmrNumber: s.cmr_number,
            totalWeight: s.total_weight || 0,
            totalPallets: s.total_pallets || 0,
            items: items
                .filter(i => i.shipment_id === s.id)
                .map(i => ({
                    id: i.id,
                    shipmentId: i.shipment_id,
                    batchId: i.batch_id,
                    palletWeight: i.pallet_weight || 0,
                    palletItemCount: i.pallet_item_count || 0,
                    productName: i.product_name || '',
                    sort: i.sort || '',
                    displayId: i.display_id,
                    addedAt: i.added_at,
                    addedBy: i.added_by
                })),
            createdBy: s.created_by
        };
    },

    saveShipmentsLocal(shipments: Shipment[]): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(shipments));
    }
};
