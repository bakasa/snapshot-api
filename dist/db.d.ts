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
    referral_code: string | null;
    referred_by: number | null;
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
    createApiKey: (email?: string, plan?: string, monthlyLimit?: number, referredBy?: number) => ApiKey;
    getApiKey: (key: string) => ApiKey | undefined;
    getApiKeyById: (id: number) => ApiKey | undefined;
    getApiKeyByReferralCode: (code: string) => ApiKey | undefined;
    getOrCreateDefaultKey: () => ApiKey;
    recordScreenshot: (apiKeyId: number, url: string, width: number, format: string, status: number, sizeBytes: number | null, tookMs: number | null) => Screenshot;
    getUsage: (apiKeyId: number, days?: number) => number;
    getAllKeys: () => ApiKey[];
    addToWaitlist: (email: string, plan?: string) => {
        ok: boolean;
        error?: string;
    };
    getWaitlistCount: () => number;
};
