const linkedinScraper = require('./linkedin');
const naukriScraper = require('./naukri');
const iimjobsScraper = require('./iimjobs');
const founditScraper = require('./foundit');
const hiringcafeScraper = require('./hiringcafe');
const talent500Scraper = require('./talent500');
const indeedScraper = require('./indeed');
const simplyhiredScraper = require('./simplyhired');

/**
 * Orchestrator to run scrapers sequentially (1-by-1) to stay well within
 * Render's 512MB RAM free tier limit.
 */
async function scrapeAllPortals(role, industry, location = 'India') {
    console.log(`Starting multi-portal scrape for: "${role}" in ${industry} @ ${location}`);

    const scrapers = [
        { name: 'LinkedIn', fn: () => linkedinScraper(role, industry, location) },
        { name: 'Naukri', fn: () => naukriScraper(role, industry, location) },
        { name: 'IIMJobs', fn: () => iimjobsScraper(role, industry, location) },
        { name: 'Foundit', fn: () => founditScraper(role, industry, location) },
        { name: 'HiringCafe', fn: () => hiringcafeScraper(role, industry, location) },
        { name: 'Talent500', fn: () => talent500Scraper(role, industry, location) },
        { name: 'Indeed', fn: () => indeedScraper(role, industry, location) },
        { name: 'SimplyHired', fn: () => simplyhiredScraper(role, industry, location) }
    ];

    let allJobs = [];

    // Run 1 by 1 to keep RAM under 120MB on cloud instances
    for (const scraper of scrapers) {
        try {
            console.log(`Running scraper: ${scraper.name}...`);
            const jobs = await scraper.fn();
            if (jobs && Array.isArray(jobs)) {
                console.log(`✅ ${scraper.name} returned ${jobs.length} jobs.`);
                allJobs = allJobs.concat(jobs);
            }
        } catch (err) {
            console.log(`❌ ${scraper.name} failed: ${err.message}`);
        }
    }

    // Filter out any non‑India results
    const indiaJobs = allJobs.filter(job => {
        const lowerLink = (job.link || '').toLowerCase();
        const source = job.source || '';
        return lowerLink.includes('.in') || lowerLink.includes('india') || ['LinkedIn', 'Naukri', 'IIMJobs', 'Foundit', 'HiringCafe', 'Talent500', 'Indeed', 'SimplyHired'].includes(source);
    });
    
    // Randomize
    const finalJobs = indiaJobs.sort(() => Math.random() - 0.5);
    return finalJobs;
}

module.exports = scrapeAllPortals;
