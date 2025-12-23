import { User, Product, LabelData } from '../types';

export interface IDataService {
    init(): Promise<void>;

    // Read
    getUsers(): Promise<User[]>;
    getProducts(): Promise<Product[]>;
    getHistory(): Promise<LabelData[]>; // Or a specific HistoryItem type if needed

    // Write
    addToHistory(entry: LabelData & { timestamp?: string }): Promise<void>;

    // Reporting
    getReportData(startDate: Date, endDate: Date): Promise<LabelData[]>;
}
