const puppeteer = require('puppeteer');

async function launchBrowser() {
    const launchOptions = {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-zygote',
            '--single-process',
            '--disable-extensions',
            '--disable-features=site-per-process',
            '--js-flags=--max-old-space-size=128',
            '--disable-blink-features=AutomationControlled'
        ]
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    return await puppeteer.launch(launchOptions);
}

module.exports = { launchBrowser };
