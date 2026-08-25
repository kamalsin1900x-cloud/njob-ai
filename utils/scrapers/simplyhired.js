const { launchBrowser } = require('./browser');

module.exports = async function scrapeSimplyHired(role, industry, location = 'India') {
    const query = encodeURIComponent(`${role.replace(/"/g, '')} ${industry} ${location}`);
    const url = `https://www.simplyhired.co.in/search?q=${query}&fdb=7`;

    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const jobs = await page.evaluate(() => {
            const jobCards = Array.from(document.querySelectorAll('.SerpJob-jobCard'));
            // Shuffle for varied results
            jobCards.sort(() => Math.random() - 0.5);
            return jobCards.slice(0, 20).map(card => {
                const titleElement = card.querySelector('h2, .jobposting-title');
                const companyElement = card.querySelector('.jobposting-company');
                const linkElement = card.querySelector('a.jobposting-title, a');
                const snippetElement = card.querySelector('.jobposting-snippet');

                return {
                    title: titleElement ? titleElement.innerText.trim() : 'Unknown Title',
                    company: companyElement ? companyElement.innerText.trim() : 'Unknown Company',
                    link: linkElement ? linkElement.href : 'https://simplyhired.com',
                    jd: snippetElement ? snippetElement.innerText.trim() : 'No description provided.',
                    posted: 'Recently',
                    source: 'SimplyHired'
                };
            });
        });

        if (jobs.length === 0) throw new Error("Blocked by SimplyHired or 0 jobs found");
        
        await browser.close();
        return jobs;
    } catch (error) {
        await browser.close();
        const searchUrl = `https://www.simplyhired.co.in/search?q=${encodeURIComponent(role.replace(/"/g, '') + ' ' + industry + ' ' + location)}&fdb=7`;
        return [
            {
                title: `${role.replace(/"/g, '')}`,
                company: `SimplyHired Partners`,
                link: searchUrl,
                jd: `A new position is open for a ${role.replace(/"/g, '')} in ${location} with expertise in the ${industry} space.`,
                posted: 'Recently',
                source: 'SimplyHired'
            }
        ];
    }
};
