const linkedinScraper = require('./linkedin');
const naukriScraper = require('./naukri');
const iimjobsScraper = require('./iimjobs');
const founditScraper = require('./foundit');
const hiringcafeScraper = require('./hiringcafe');
const talent500Scraper = require('./talent500');
const indeedScraper = require('./indeed');
const simplyhiredScraper = require('./simplyhired');

/**
 * Orchestrator to run scrapers in batches to avoid overwhelming the CPU.
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
    const results = [];

    // Run in batches of 3 to avoid launching 8 headless browsers at once
    for (let i = 0; i < scrapers.length; i += 3) {
        const batch = scrapers.slice(i, i + 3);
        const batchPromises = batch.map(s => s.fn());
        
        console.log(`Running batch: ${batch.map(s => s.name).join(', ')}...`);
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach((result, idx) => {
            const scraperName = batch[idx].name;
            if (result.status === 'fulfilled') {
                console.log(`✅ ${scraperName} returned ${result.value.length} jobs.`);
                allJobs = allJobs.concat(result.value);
            } else {
                console.log(`❌ ${scraperName} failed completely: ${result.reason.message}`);
            }
        });
    }

    // Filter out any non‑India results just in case
    const indiaJobs = allJobs.filter(job => {
        const lowerLink = (job.link || '').toLowerCase();
        const source = job.source || '';
        // Keep if link points to an Indian domain or source is known Indian portal
        return lowerLink.includes('.in') || lowerLink.includes('india') || ['LinkedIn', 'Naukri', 'IIMJobs', 'Foundit', 'HiringCafe', 'Talent500', 'Indeed', 'SimplyHired'].includes(source);
    });
    
    // Shuffle again for extra randomness
    const finalJobs = indiaJobs.sort(() => Math.random() - 0.5);
    return finalJobs;
}

module.exports = scrapeAllPortals;
