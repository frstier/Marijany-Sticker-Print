-- Create Shipments Table
create table if not exists shipments (
    id uuid default uuid_generate_v4() primary key,
    shipment_number text not null unique,
    destination text not null,
    destination_address text,
    carrier text,
    truck_number text,
    driver_name text,
    driver_phone text,
    status text not null default 'draft', -- draft, loading, shipped, delivered, cancelled
    
    -- Dates
    scheduled_date date,
    shipped_at timestamptz,
    delivered_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    
    -- Details
    notes text,
    cmr_number text,
    
    -- Totals (denormalized for performance)
    total_weight numeric default 0,
    total_pallets integer default 0,
    
    created_by uuid references auth.users(id)
);

-- Create Shipment Items Table (Pallets in a shipment)
create table if not exists shipment_items (
    id uuid default uuid_generate_v4() primary key,
    shipment_id uuid references shipments(id) on delete cascade,
    batch_id uuid references batches(id), -- Link to pallet
    
    -- Snapshot data (in case pallet changes)
    pallet_weight numeric not null,
    pallet_item_count integer not null,
    product_name text,
    sort text,
    display_id text,
    
    added_at timestamptz default now(),
    added_by uuid references auth.users(id),
    
    unique(shipment_id, batch_id)
);

-- Add shipping columns to Batches
alter table batches 
add column if not exists shipment_id uuid references shipments(id),
add column if not exists shipped_at timestamptz;

-- Add shipping columns to Production Items
alter table production_items 
add column if not exists shipment_id uuid references shipments(id),
add column if not exists shipped_at timestamptz;

-- Indexes
create index if not exists idx_shipments_status on shipments(status);
create index if not exists idx_shipments_number on shipments(shipment_number);
create index if not exists idx_shipment_items_shipment on shipment_items(shipment_id);
create index if not exists idx_batches_shipment on batches(shipment_id);

-- RLS Policies
alter table shipments enable row level security;
alter table shipment_items enable row level security;

create policy "Enable all access for authenticated users" on shipments
    for all using (auth.role() = 'authenticated');

create policy "Enable all access for authenticated users" on shipment_items
    for all using (auth.role() = 'authenticated');
