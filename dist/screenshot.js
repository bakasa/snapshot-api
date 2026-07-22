import puppeteer from 'puppeteer';
let _browser = null;
async function getBrowser() {
    if (_browser)
        return _browser;
    _browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    return _browser;
}
export async function takeScreenshot(url, options = {}) {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setViewport({
            width: options.width || 1280,
            height: options.height || 720,
        });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 30000,
        });
        if (options.delay && options.delay > 0) {
            await new Promise(r => setTimeout(r, options.delay));
        }
        const format = options.format || 'png';
        const buffer = await page.screenshot({
            type: format,
            fullPage: options.fullPage || false,
        });
        return {
            buffer,
            contentType: format === 'png' ? 'image/png' : 'image/jpeg',
            sizeBytes: buffer.length,
        };
    }
    finally {
        await page.close();
    }
}
