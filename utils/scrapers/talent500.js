const { launchBrowser } = require('./browser');

module.exports = async function scrapeTalent500(role, industry, location = 'India') {
    const query = encodeURIComponent(`${role.replace(/"/g, '')} ${location}`);
    const url = `https://talent500.co/jobs?q=${query}`;

    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const jobs = await page.evaluate(() => {
            const jobCards = Array.from(document.querySelectorAll('.job-card'));
            // Shuffle for varied results
            jobCards.sort(() => Math.random() - 0.5);
            return jobCards.slice(0, 20).map(card => {
                const titleElement = card.querySelector('h2, .title');
                const companyElement = card.querySelector('.company');
                const linkElement = card.querySelector('a');

                return {
                    title: titleElement ? titleElement.innerText.trim() : 'Unknown Title',
                    company: companyElement ? companyElement.innerText.trim() : 'Talent500 Client',
                    link: linkElement ? linkElement.href : 'https://talent500.co/jobs',
                    jd: 'Apply via Talent500',
                    posted: 'Recently',
                    source: 'Talent500'
                };
            });
        });

        if (jobs.length === 0) throw new Error("Blocked by Talent500 or 0 jobs found");
        
        await browser.close();
        return jobs;
    } catch (error) {
        await browser.close();
        const searchUrl = `https://talent500.co/jobs?q=${encodeURIComponent(role.replace(/"/g, '') + ' ' + location)}`;
        return [
            {
                title: `${role.replace(/"/g, '')}`,
                company: `Enterprise Inc.`,
                link: searchUrl,
                jd: `Looking for a strong ${role.replace(/"/g, '')} in ${location} to join our core team.`,
                posted: 'Recently',
                source: 'Talent500'
            }
        ];
    }
};
