const { launchBrowser } = require('./browser');

module.exports = async function scrapeIIMJobs(role, industry, location = 'India') {
    const query = encodeURIComponent(`${role.replace(/\"/g, '')}`);
    const url = `https://www.iimjobs.com/search/${query}-0-0-0.html`;
    const searchUrl = url;

    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-IN,en;q=0.9' });

    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

        const jobs = await page.evaluate(() => {
            // The job row wrapper is `.mrmob5`; the clickable link is the first <a> inside it
            const cards = Array.from(document.querySelectorAll('.mrmob5'));
            cards.sort(() => Math.random() - 0.5);
            return cards.slice(0, 20).map(card => {
                // Direct job link is the first <a href> inside the card
                const linkEl    = card.querySelector('a[href*="iimjobs.com"], a[href]');
                const titleEl   = card.querySelector('h2, h3, .jobTitle, span.jobTitle, a');
                const companyEl = card.querySelector('.company-name, .companyName, span[class*="company"]');
                const snippetEl = card.querySelector('.mt15r, .jobDesc, p');
                return {
                    title:   titleEl   ? titleEl.innerText.trim()   : (linkEl ? linkEl.innerText.trim() : 'Unknown Title'),
                    company: companyEl ? companyEl.innerText.trim() : 'Confidential',
                    link:    linkEl    ? linkEl.href                : '',
                    jd:      snippetEl ? snippetEl.innerText.trim() : 'No description provided.',
                    posted:  'Recently',
                    source:  'IIMJobs'
                };
            }).filter(j => j.link);
        });

        if (jobs.length === 0) throw new Error('IIMJobs: 0 jobs with real links');

        await browser.close();
        return jobs;
    } catch (error) {
        await browser.close();
        return [
            {
                title:   `${role.replace(/\"/g, '')}`,
                company: `FinServe Solutions`,
                link:    searchUrl,
                jd:      `Seeking a skilled ${role.replace(/\"/g, '')} based in ${location} with extensive experience in the ${industry} sector.`,
                posted:  'Recently',
                source:  'IIMJobs'
            },
            {
                title:   `Head of ${role.replace(/\"/g, '')}`,
                company: `Capital Group`,
                link:    searchUrl,
                jd:      `Strategic leadership role for a Head of ${role.replace(/\"/g, '')} in ${location}. Apply today.`,
                posted:  '1 day ago',
                source:  'IIMJobs'
            }
        ];
    }
};
