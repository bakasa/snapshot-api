import Database from 'better-sqlite3';
export declare function getDb(): Database.Database;
export declare function migrate(db: Database.Database): void;
export interface ApiKey {
    id: number;
    key: string;
    email: string | null;
    plan: string;
    monthly_limit: number;
    usage_count: number;
    reset_at: string;
    created_at: string;
}
export interface Screenshot {
    id: number;
    api_key_id: number;
    url: string;
    width: number;
    format: string;
    status: number | null;
    size_bytes: number | null;
    took_ms: number | null;
    created_at: string;
}
export declare function db(): {
    createApiKey: (email?: string, plan?: string, monthlyLimit?: number) => ApiKey;
    getApiKey: (key: string) => ApiKey | undefined;
    getApiKeyById: (id: number) => ApiKey | undefined;
    getOrCreateDefaultKey: () => ApiKey;
    recordScreenshot: (apiKeyId: number, url: string, width: number, format: string, status: number, sizeBytes: number | null, tookMs: number | null) => Screenshot;
    getUsage: (apiKeyId: number, days?: number) => number;
    getAllKeys: () => ApiKey[];
};
