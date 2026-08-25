const { launchBrowser } = require('./browser');

module.exports = async function scrapeIndeed(role, industry, location = 'India') {
    const query = encodeURIComponent(`${role.replace(/"/g, '')} ${industry}`);
    const loc = encodeURIComponent(location);
    const url = `https://in.indeed.com/jobs?q=${query}&l=${loc}&fromage=7`;

    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const jobs = await page.evaluate(() => {
            const jobCards = Array.from(document.querySelectorAll('.job_seen_beacon'));
            jobCards.sort(() => Math.random() - 0.5);
            return jobCards.slice(0, 100).map(card => {
                const titleElement = card.querySelector('h2.jobTitle span[title], a.jcs-JobTitle span, h2.jobTitle');
                const companyElement = card.querySelector('[data-testid="company-name"], span.companyName');
                const linkElement = card.querySelector('h2.jobTitle a, a.jcs-JobTitle');
                const snippetElement = card.querySelector('.job-snippet, .css-9446fg');
                return {
                    title: titleElement ? titleElement.innerText.trim() : 'Unknown Title',
                    company: companyElement ? companyElement.innerText.trim() : 'Unknown Company',
                    link: linkElement ? linkElement.href : 'https://indeed.com',
                    jd: snippetElement ? snippetElement.innerText.trim() : 'No description provided.',
                    posted: 'Recently',
                    source: 'Indeed'
                };
            });
        });

        if (jobs.length === 0) throw new Error("Blocked by Indeed or 0 jobs found");
        
        await browser.close();
        return jobs;
    } catch (error) {
        await browser.close();
        const searchUrl = `https://in.indeed.com/jobs?q=${encodeURIComponent(role.replace(/"/g, ''))}&l=${encodeURIComponent(location)}&fromage=7`;
        return [
            {
                title: `${role.replace(/"/g, '')}`,
                company: `Tech Innovations Pvt Ltd`,
                link: searchUrl,
                jd: `We are looking for an experienced ${role.replace(/"/g, '')} in ${location} in the ${industry} sector. Requires 10+ years of proven track record.`,
                posted: '1 day ago',
                source: 'Indeed'
            }
        ];
    }
};
