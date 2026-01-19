export interface Location {
    id: string;
    zone: string;       // "A", "B", "C"
    rack: string;       // "01", "02"
    level: string;      // "1", "2", "3"
    position?: string;  // "L", "R"
    code: string;       // "A-01-2-L"
    description?: string;
    isOccupied: boolean; // Computed or manual flag
    createdAt: string;
    updatedAt?: string;
}

export interface CreateLocationData {
    zone: string;
    rack: string;
    level: string;
    position?: string;
    description?: string;
}

// Helper to parse location code
// e.g. "A-01-2-L" -> { zone: "A", rack: "01", level: "2", position: "L" }
export interface ParsedLocation {
    zone: string;
    rack: string;
    level: string;
    position?: string;
}
