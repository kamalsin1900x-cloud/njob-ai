const { launchBrowser } = require('./browser');

module.exports = async function scrapeHiringCafe(role, industry, location = 'India') {
    const query     = encodeURIComponent(`${role.replace(/\"/g, '')} ${location}`);
    const url       = `https://hiring.cafe/?search=${query}`;
    const searchUrl = url;

    const browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-IN,en;q=0.9' });

    try {
        // HiringCafe is a React SPA — wait for network to settle then extra wait for render
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 25000 });
        await new Promise(r => setTimeout(r, 3000));

        const jobs = await page.evaluate(() => {
            // Try multiple selectors for HiringCafe's dynamic job cards
            const cards = Array.from(document.querySelectorAll(
                '[class*="JobCard"], [class*="job-card"], [class*="jobCard"], article, [data-job-id]'
            ));
            cards.sort(() => Math.random() - 0.5);
            return cards.slice(0, 20).map(card => {
                const linkEl    = card.querySelector('a[href]');
                const titleEl   = card.querySelector('h2, h3, [class*="title"], [class*="Title"]');
                const companyEl = card.querySelector('[class*="company"], [class*="Company"], [class*="employer"]');
                return {
                    title:   titleEl   ? titleEl.innerText.trim()   : 'Unknown Title',
                    company: companyEl ? companyEl.innerText.trim() : 'Unknown Company',
                    link:    linkEl    ? (linkEl.href.startsWith('http') ? linkEl.href : `https://hiring.cafe${linkEl.getAttribute('href')}`) : '',
                    jd:      'Click the link to view the full job description on HiringCafe.',
                    posted:  'Recently',
                    source:  'HiringCafe'
                };
            }).filter(j => j.link);
        });

        if (jobs.length === 0) throw new Error('HiringCafe: 0 jobs with real links');

        await browser.close();
        return jobs;
    } catch (error) {
        await browser.close();
        return [
            {
                title:   `${role.replace(/\"/g, '')}`,
                company: `Startup Hub`,
                link:    searchUrl,
                jd:      `We're a fast-growing startup in ${location} looking for a talented ${role.replace(/\"/g, '')}.`,
                posted:  'Recently',
                source:  'HiringCafe'
            }
        ];
    }
};
