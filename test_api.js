// Quick test script for all three endpoints
const http = require('http');

function post(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path,
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        }, (res) => {
            let chunks = '';
            res.on('data', c => chunks += c);
            res.on('end', () => {
                try { resolve(JSON.parse(chunks)); } catch { resolve(chunks); }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

(async () => {
    console.log('\n========== TEST 2: Scrape Jobs ==========');
    try {
        const jobs = await post('/api/scrape-jobs', { role: 'Software Engineer', industry: 'Technology' });
        console.log('Success:', jobs.success);
        console.log('Jobs found:', Array.isArray(jobs.jobs) ? jobs.jobs.length : 0);
        if (jobs.jobs && jobs.jobs.length > 0) {
            jobs.jobs.slice(0, 3).forEach((j, i) => {
                console.log(`  ${i+1}. ${j.title || 'N/A'} @ ${j.company || 'N/A'} [Source: ${j.source || 'N/A'}]`);
            });
        }
    } catch (e) {
        console.error('Scrape jobs failed:', e.message);
    }

    console.log('\n========== TEST 3: Generate Message ==========');
    try {
        const msg = await post('/api/generate-message', {
            company: 'Google',
            role: 'Software Engineer',
            jd: 'We are looking for a Software Engineer with 5 years of experience in full-stack development.',
            resumeSummary: 'Experienced software engineer with 5 years building scalable web apps using Node.js and React.',
        });
        console.log('Success:', msg.success);
        console.log('Message:\n', msg.message);
    } catch (e) {
        console.error('Generate message failed:', e.message);
    }
})();
