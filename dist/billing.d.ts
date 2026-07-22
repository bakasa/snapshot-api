interface Plan {
    price: number;
    limit: number;
    stripePriceId: string;
}
export declare const PLANS: Record<string, Plan>;
export type PlanName = keyof typeof PLANS;
export declare function isBillingConfigured(): boolean;
export declare function createCheckoutSession(plan: PlanName, apiKeyId: number, email?: string): Promise<string | null>;
export declare function handleWebhook(body: string, signature: string): Promise<{
    ok: boolean;
}>;
export {};
