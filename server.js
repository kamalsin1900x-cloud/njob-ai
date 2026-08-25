require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const scrapeAllPortals = require('./utils/scrapers/index');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ─── Multer setup ─────────────────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage() });

// ─── AI Provider Setup ────────────────────────────────────────────────────
const geminiKey = process.env.GEMINI_API_KEY || 'AQ.Ab8RN6Lmtq9apVCWlAMESqzO233yAv4DcV_6GBON20bdLk7GfQ';
const groqKey   = process.env.GROQ_API_KEY || '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';

const genAI = new GoogleGenerativeAI(geminiKey);

let groq = null;
if (groqKey) {
    try {
        const Groq = require('groq-sdk');
        groq = new Groq({ apiKey: groqKey });
        console.log('✅ Groq initialised — will try Groq first, then Gemini as fallback.');
    } catch (e) {
        console.log('⚠️  groq-sdk not found — using Gemini only.');
    }
} else {
    console.log('ℹ️  No GROQ_API_KEY — using Gemini as sole AI provider.');
}

// ─── Unified AI helper ────────────────────────────────────────────────────
// Tries Groq first (groq/compound-mini), then falls back to Gemini.
async function callAI(prompt, jsonMode = false) {
    // --- Try Groq ---
    if (groq) {
        try {
            const opts = {
                messages: [{ role: 'user', content: prompt }],
                model: 'groq/compound-mini',
                temperature: jsonMode ? 0.1 : 0.7,
            };

            const chat = await groq.chat.completions.create(opts);
            console.log('✅ Groq responded OK.');
            let content = chat.choices[0]?.message?.content || '';
            content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
            return content;
        } catch (groqErr) {
            console.warn('⚠️ Groq failed, trying Gemini:', groqErr.message);
        }
    }

    // --- Try Gemini with retry + exponential backoff ---
    const gemModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const result = await gemModel.generateContent(prompt);
            const text = result.response.text().replace(/```json/gi, '').replace(/```/g, '').trim();
            console.log(`✅ Gemini responded OK (attempt ${attempt}).`);
            return text;
        } catch (err) {
            const isRateLimit = err.status === 429 || err.status === 503;
            if (isRateLimit && attempt < maxRetries) {
                const waitSec = attempt * 15;
                console.log(`⏳ Gemini rate-limited (attempt ${attempt}/${maxRetries}). Retrying in ${waitSec}s...`);
                await new Promise(r => setTimeout(r, waitSec * 1000));
            } else {
                throw err;
            }
        }
    }
}

// ─── 1. Groq Health Check ─────────────────────────────────────────────────
app.get('/api/test-groq', async (req, res) => {
    if (!groq) {
        return res.status(400).json({ ok: false, error: 'Groq not configured — no GROQ_API_KEY set.' });
    }
    try {
        const chat = await groq.chat.completions.create({
            messages: [{ role: 'user', content: 'Return the single word OK.' }],
            model: 'groq/compound-mini',
            temperature: 0,
            max_tokens: 5,
        });
        const reply = chat.choices[0]?.message?.content?.trim();
        res.json({ ok: true, reply });
    } catch (e) {
        console.error('Groq test failed:', e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

// ─── 2. Parse Resume ──────────────────────────────────────────────────────
app.post('/api/parse-resume', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No resume file uploaded.' });

        // Extract text
        let resumeText = '';
        if (req.file.mimetype === 'application/pdf') {
            const pdfData = await pdfParse(req.file.buffer);
            resumeText = pdfData.text;
        } else {
            resumeText = req.file.buffer.toString('utf8');
        }

        const prompt = `
Analyze the following resume text and extract the key details in JSON format with exactly these keys:
- "name": Full name of the candidate
- "industry": The primary industry (e.g., Software, Finance, Healthcare)
- "role": The NEXT-LEVEL target job role based on their experience (e.g. if current is Manager, target is Director; if current is Director, target is VP; if current is Developer, target is Senior Developer)
- "location": The candidate's current city/location in India (e.g. "Bangalore", "Mumbai", "Delhi"). Default to "India" if not found.
- "functions": A brief summary of key functions or skills (1-2 sentences)
- "experienceSummary": A brief 2-sentence summary of their overall experience.

Resume Text:
${resumeText}

Output only valid JSON. Do not include markdown formatting or extra text.
        `;

        const responseText = await callAI(prompt, true);
        const extractedData = JSON.parse(responseText);
        res.json({ success: true, data: extractedData, rawText: resumeText.substring(0, 5000) });

    } catch (error) {
        console.error('Error parsing resume:', error.message || error);

        // If quota is exceeded, return mock data so the UI stays usable
        const isQuota = error.status === 429 || error.status === 503 ||
            (error.message && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('503')));

        if (isQuota) {
            console.log('⚠️  API quota exceeded — returning mock profile.');
            return res.json({
                success: true,
                isMock: true,
                data: {
                    name: 'Demo User (API Quota Exceeded)',
                    role: 'Software Engineer',
                    industry: 'Technology',
                    functions: 'Full-stack development, system design, API integration.',
                    experienceSummary: 'Experienced software engineer with 5 years in building scalable web applications. Skilled in Node.js, React, and cloud infrastructure.',
                },
                rawText: 'Mock text — API quota exceeded.',
            });
        }

        res.status(500).json({ error: error.message || 'Failed to parse resume.' });
    }
});

// ─── 2b. Parse JD File ────────────────────────────────────────────────────
app.post('/api/parse-jd', upload.single('jd'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No JD file uploaded.' });

        // Extract text
        let jdText = '';
        if (req.file.mimetype === 'application/pdf') {
            const pdfData = await pdfParse(req.file.buffer);
            jdText = pdfData.text;
        } else {
            jdText = req.file.buffer.toString('utf8');
        }

        res.json({ success: true, rawText: jdText.trim() });
    } catch (error) {
        console.error('Error parsing JD:', error.message || error);
        res.status(500).json({ error: error.message || 'Failed to parse JD file.' });
    }
});

// ─── Clients Management ───────────────────────────────────────────────────
const clientsFile = path.join(__dirname, 'data', 'clients.json');

// Ensure clients file exists
if (!fs.existsSync(clientsFile)) {
    if (!fs.existsSync(path.dirname(clientsFile))) {
        fs.mkdirSync(path.dirname(clientsFile));
    }
    fs.writeFileSync(clientsFile, '[]');
}

app.get('/api/clients', (req, res) => {
    try {
        const data = fs.readFileSync(clientsFile, 'utf8');
        res.json({ success: true, clients: JSON.parse(data) });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read clients.' });
    }
});

app.post('/api/clients', (req, res) => {
    try {
        const newClient = req.body;
        const data = fs.readFileSync(clientsFile, 'utf8');
        const clients = JSON.parse(data);
        
        // Add ID and timestamp
        newClient.id = Date.now().toString();
        newClient.createdAt = new Date().toISOString();
        
        clients.push(newClient);
        fs.writeFileSync(clientsFile, JSON.stringify(clients, null, 2));
        
        res.json({ success: true, client: newClient });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save client.' });
    }
});

app.delete('/api/clients/:id', (req, res) => {
    try {
        const { id } = req.params;
        const data = fs.readFileSync(clientsFile, 'utf8');
        const clients = JSON.parse(data);
        const updated = clients.filter(c => c.id !== id);
        fs.writeFileSync(clientsFile, JSON.stringify(updated, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete client.' });
    }
});

// ─── 3. Scrape Jobs ───────────────────────────────────────────────────────
app.post('/api/scrape-jobs', async (req, res) => {
    try {
        const { industry, role, location } = req.body;
        if (!role) return res.status(400).json({ error: 'Role is required.' });

        const loc = location || 'India';
        console.log(`🔍 Scraping all portals for: "${role}" in "${industry || 'any industry'}" at "${loc}"`);
        const jobs = await scrapeAllPortals(role, industry, loc);
        res.json({ success: true, jobs });
    } catch (error) {
        console.error('Error scraping jobs:', error.message || error);
        res.status(500).json({ error: 'Failed to scrape jobs.' });
    }
});

// ─── 4. Generate Outreach Message ─────────────────────────────────────────
app.post('/api/generate-message', async (req, res) => {
    try {
        const { jd, resumeSummary, company, role } = req.body;

        const prompt = `
Write a professional and concise outreach message (like a LinkedIn connection note or short email) to a recruiter at ${company} for the role of ${role}.

Job Description context:
${jd}

Candidate background:
${resumeSummary}

The message should be under 150 words, enthusiastic, and highly relevant. Do not include a subject line.
        `;

        const message = await callAI(prompt, false);
        res.json({ success: true, message });
    } catch (error) {
        console.error('Error generating message:', error.message || error);
        res.status(500).json({ error: 'AI is temporarily overloaded. Please wait 1 minute and try again.' });
    }
});

// ─── 5. Generate Outreach Variations (3 Audiences) ─────────────────────────
app.post('/api/generate-outreach-variations', async (req, res) => {
    try {
        const { jd, resumeSummary } = req.body;

        const prompt = `
You are an expert executive recruiter and copywriter.
I will provide you with a Job Description and a Candidate's Resume Summary.
Your task is to generate 3 distinct outreach message variations on behalf of the candidate, tailored to different audiences.
The tone should be professional, highly persuasive, concise, and focused on value.

Audience 1: HR / Recruiter
- Focus: Highlight skills match, keyword alignment, and process fit. Keep it under 100 words.

Audience 2: CEO / Founder
- Focus: Highlight high-level business impact, strategic vision, and ROI. Keep it under 100 words.

Audience 3: C-Suite / Hiring Manager (Reporting Manager)
- Focus: Highlight functional expertise, operational problem solving, and direct relevance to their team's pain points based on the JD. Keep it under 100 words.

Candidate Summary:
${resumeSummary}

Job Description:
${jd}

Return ONLY valid JSON in the following format:
{
  "hr": "message here",
  "ceo": "message here",
  "csuite": "message here"
}
        `;

        const responseText = await callAI(prompt, true);
        const extractedData = JSON.parse(responseText);
        res.json({ success: true, data: extractedData });
    } catch (error) {
        console.error('Error generating outreach variations:', error.message || error);
        res.status(500).json({ error: 'AI is temporarily overloaded or failed to generate variations.' });
    }
});

// ─── 6. Score Jobs Relevancy ──────────────────────────────────────────────
app.post('/api/score-jobs', async (req, res) => {
    try {
        const { candidateSummary, jobs } = req.body;
        if (!jobs || jobs.length === 0) return res.json({ success: true, scoredJobs: [] });

        const CHUNK_SIZE = 10; // Smaller chunks = less tokens per call
        let allScores = [];

        // Process in sequential chunks to avoid AI token limits
        for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
            const chunk = jobs.slice(i, i + CHUNK_SIZE);

            // Trim JD to 200 chars max per job to avoid massive prompts
            const jobsList = chunk.map((j, idx) => {
                const snippet = (j.jd || '').slice(0, 200).replace(/\n/g, ' ');
                return `[ID: ${i + idx}] Title: ${j.title} | Company: ${j.company} | JD: ${snippet}`;
            }).join('\n');
            
            const prompt = `
You are an expert recruiter evaluating job-to-candidate relevancy.
Candidate Profile:
${(candidateSummary || '').slice(0, 400)}

Jobs:
${jobsList}

Return ONLY valid JSON — no extra text. Format:
{
  "scores": [
    { "id": <ID number>, "score": <0-100 integer>, "reason": "<one sentence reason>" }
  ]
}
Score every job listed above. Higher score = better fit.`;
            
            try {
                const responseText = await callAI(prompt, true);
                const extractedData = JSON.parse(responseText);
                if (extractedData && Array.isArray(extractedData.scores)) {
                    allScores = allScores.concat(extractedData.scores);
                }
            } catch (chunkErr) {
                console.error(`Error scoring chunk at index ${i}:`, chunkErr.message);
                // If chunk fails, assign 0 to all in this chunk so they still appear
                chunk.forEach((_, idx) => {
                    allScores.push({ id: i + idx, score: 0, reason: 'Could not be scored due to AI limits.' });
                });
            }

            // Small delay between chunks to avoid rate limits
            if (i + CHUNK_SIZE < jobs.length) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
        
        // Merge scores back into jobs
        const scoredJobs = jobs.map((job, idx) => {
            const scoreData = allScores.find(s => Number(s.id) === idx) || { score: 0, reason: 'Not scored.' };
            return {
                ...job,
                score: scoreData.score,
                matchReason: scoreData.reason
            };
        });

        // Sort descending by score
        scoredJobs.sort((a, b) => b.score - a.score);

        res.json({ success: true, scoredJobs });
    } catch (error) {
        console.error('Error scoring jobs:', error.message || error);
        res.status(500).json({ error: 'Failed to score jobs.' });
    }
});

// ─── Start ────────────────────────────────────────────────────────────────
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}`);
});
