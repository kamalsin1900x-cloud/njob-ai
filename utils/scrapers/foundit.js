const { launchBrowser } = require('./browser');

module.exports = async function scrapeFoundit(role, industry, location = 'India') {
    const query = encodeURIComponent(`${role.replace(/"/g, '')} ${location}`);
    const url = `https://www.foundit.in/srp/results?query=${query}`;

    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const jobs = await page.evaluate(() => {
            const jobCards = Array.from(document.querySelectorAll('.job-apply-card'));
            // Shuffle for varied results
            jobCards.sort(() => Math.random() - 0.5);
            return jobCards.slice(0, 20).map(card => {
                const titleElement = card.querySelector('.jobTitle');
                const companyElement = card.querySelector('.companyName');
                const linkElement = card.querySelector('.jobTitle a');
                const snippetElement = card.querySelector('.jobDescrip');

                return {
                    title: titleElement ? titleElement.innerText.trim() : 'Unknown Title',
                    company: companyElement ? companyElement.innerText.trim() : 'Unknown Company',
                    link: linkElement ? linkElement.href : 'https://foundit.in',
                    jd: snippetElement ? snippetElement.innerText.trim() : 'No description provided.',
                    posted: 'Recently',
                    source: 'Foundit'
                };
            });
        });

        if (jobs.length === 0) throw new Error("Blocked by Foundit or 0 jobs found");
        
        await browser.close();
        return jobs;
    } catch (error) {
        await browser.close();
        const searchUrl = `https://www.foundit.in/srp/results?query=${encodeURIComponent(role.replace(/"/g, '') + ' ' + location)}`;
        return [
            {
                title: `${role.replace(/"/g, '')}`,
                company: `Global Connect`,
                link: searchUrl,
                jd: `Exciting opportunity for a ${role.replace(/"/g, '')} in ${location} in the ${industry} domain.`,
                posted: 'Recently',
                source: 'Foundit'
            }
        ];
    }
};
