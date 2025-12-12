import { User, Product, LabelData } from './index';

export interface IDataService {
    init(): Promise<void>;

    // Read
    getUsers(): Promise<User[]>;
    getProducts(): Promise<Product[]>;
    getHistory(): Promise<LabelData[]>; // Or a specific HistoryItem type if needed

    // Write
    addToHistory(entry: LabelData & { timestamp?: string }): Promise<void>;

    // Future: 
    // updateProductCount(id: string, count: number): Promise<void>;
}
