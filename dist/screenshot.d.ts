export declare function takeScreenshot(url: string, options?: {
    width?: number;
    height?: number;
    format?: 'png' | 'jpeg';
    fullPage?: boolean;
    delay?: number;
}): Promise<{
    buffer: Buffer;
    contentType: string;
    sizeBytes: number;
}>;
