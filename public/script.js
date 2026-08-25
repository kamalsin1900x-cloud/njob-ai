document.addEventListener('DOMContentLoaded', () => {
    // ─── DOM References ────────────────────────────────────────────────────
    const loadingOverlay   = document.getElementById('loading-overlay');
    const loadingText      = document.getElementById('loading-text');
    const topbarTitle      = document.getElementById('topbar-title');
    const topbarSub        = document.getElementById('topbar-sub');

    // Sidebar
    const sidebarClientsList = document.getElementById('sidebar-clients-list');
    const btnAddClient       = document.getElementById('btn-add-client');
    const clientSearchInput  = document.getElementById('client-search-input');

    // Views
    const viewHome      = document.getElementById('view-home');
    const viewServices  = document.getElementById('view-services');
    const viewAbout     = document.getElementById('view-about');
    const viewWorkspace = document.getElementById('view-workspace');

    // Workspace sections
    const stepUpload    = document.getElementById('step-upload');
    const stepVerify    = document.getElementById('step-verify');
    const stepWorkspace = document.getElementById('step-client-workspace');

    // Upload/Verify form
    const resumeInput     = document.getElementById('resume-input');
    const fileNameDisplay = document.getElementById('file-name-display');
    const btnParse        = document.getElementById('btn-parse');
    const btnCancelUpload = document.getElementById('btn-cancel-upload');
    const btnCancelVerify = document.getElementById('btn-cancel-verify');
    const btnSaveClient   = document.getElementById('btn-save-client');

    // Client workspace
    const workspaceAvatar     = document.getElementById('workspace-avatar');
    const workspaceClientName = document.getElementById('workspace-client-name');
    const workspaceClientRole = document.getElementById('workspace-client-role');
    const btnSearchWorkspace  = document.getElementById('btn-search-workspace');
    const stepJobs            = document.getElementById('step-jobs');
    const jobsContainer       = document.getElementById('jobs-container');
    const jobsCountLabel      = document.getElementById('jobs-count-label');

    // ─── Global State ──────────────────────────────────────────────────────
    let allClients  = [];
    let activeClient = null;

    // ─── View Switching ────────────────────────────────────────────────────
    const allViews = [viewHome, viewServices, viewAbout, viewWorkspace];
    const allNavBtns = document.querySelectorAll('.sidebar-nav-btn');

    window.showView = (name) => {
        allViews.forEach(v => v.classList.add('hidden'));
        allNavBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.sidebar-client-btn').forEach(b => b.classList.remove('active'));

        const viewMap = { home: viewHome, services: viewServices, about: viewAbout };
        const titleMap = {
            home: ['Welcome to NJob AI', 'Your AI-powered recruitment platform'],
            services: ['Our Services', 'Everything you need to place the right candidate'],
            about: ['About NJob AI', 'Built for modern recruitment consultants'],
        };

        if (viewMap[name]) {
            viewMap[name].classList.remove('hidden');
            document.getElementById(`nav-${name}`)?.classList.add('active');
            topbarTitle.textContent = titleMap[name][0];
            topbarSub.textContent   = titleMap[name][1];
        }
    };

    // Hero CTA → goes to Add Client
    document.getElementById('btn-hero-start')?.addEventListener('click', () => {
        btnAddClient.click();
    });

    // ─── Clients: Load & Render Sidebar ───────────────────────────────────
    const loadClients = async () => {
        try {
            const res = await fetch('/api/clients');
            const data = await res.json();
            if (data.success) {
                allClients = data.clients;
                renderSidebarClients();
            }
        } catch (err) {
            console.error('Failed to load clients', err);
        }
    };

    const renderSidebarClients = () => {
        sidebarClientsList.innerHTML = '';
        if (allClients.length === 0) {
            sidebarClientsList.innerHTML = '<p style="color:var(--text-muted);font-size:0.78rem;padding:8px 14px;">No clients yet</p>';
            return;
        }
        allClients.forEach(client => {
            const btn = document.createElement('button');
            btn.className = 'sidebar-client-btn';
            btn.dataset.id = client.id;
            btn.dataset.name = client.name.toLowerCase();
            btn.innerHTML = `
                <div class="client-avatar-sm">${client.name.charAt(0).toUpperCase()}</div>
                <span class="sidebar-client-name">${client.name}</span>
                <button class="sidebar-delete-btn" title="Delete client" onclick="deleteClient(event,'${client.id}','${client.name.replace(/'/g,"\\'")}')">🗑</button>
            `;
            btn.addEventListener('click', () => openClientWorkspace(client));
            sidebarClientsList.appendChild(btn);
        });
    };

    // Search filtering
    clientSearchInput.addEventListener('input', () => {
        const query = clientSearchInput.value.toLowerCase().trim();
        sidebarClientsList.querySelectorAll('.sidebar-client-btn').forEach(btn => {
            const matches = btn.dataset.name.includes(query);
            btn.style.display = matches ? '' : 'none';
        });

        // Show "no results" hint if everything is hidden
        let anyVisible = [...sidebarClientsList.querySelectorAll('.sidebar-client-btn')].some(b => b.style.display !== 'none');
        let noResult = sidebarClientsList.querySelector('.no-result-hint');
        if (!anyVisible && query) {
            if (!noResult) {
                noResult = document.createElement('p');
                noResult.className = 'no-result-hint';
                noResult.style.cssText = 'color:var(--text-muted);font-size:0.78rem;padding:8px 14px;';
                noResult.textContent = 'No clients match your search.';
                sidebarClientsList.appendChild(noResult);
            }
        } else if (noResult) {
            noResult.remove();
        }
    });

    // ─── Open Client Workspace ─────────────────────────────────────────────
    const openClientWorkspace = (client) => {
        activeClient = client;

        // Highlight in sidebar
        document.querySelectorAll('.sidebar-client-btn').forEach(b => b.classList.remove('active'));
        const sidebarBtn = sidebarClientsList.querySelector(`[data-id="${client.id}"]`);
        if (sidebarBtn) sidebarBtn.classList.add('active');
        allNavBtns.forEach(b => b.classList.remove('active'));

        // Set topbar
        topbarTitle.textContent = client.name;
        topbarSub.textContent   = `${client.role} • ${client.industry} • ${client.location}`;

        // Set workspace header
        workspaceAvatar.textContent     = client.name.charAt(0).toUpperCase();
        workspaceClientName.textContent = client.name;
        workspaceClientRole.textContent = `${client.role} • ${client.location}`;

        // Reset job section
        stepJobs.classList.add('hidden');
        jobsContainer.innerHTML = '';

        // Switch views
        allViews.forEach(v => v.classList.add('hidden'));
        viewWorkspace.classList.remove('hidden');
        stepUpload.classList.add('hidden');
        stepVerify.classList.add('hidden');
        stepWorkspace.classList.remove('hidden');
    };

    // ─── Add New Client Flow ───────────────────────────────────────────────
    btnAddClient.addEventListener('click', () => {
        activeClient = null;
        allNavBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.sidebar-client-btn').forEach(b => b.classList.remove('active'));

        topbarTitle.textContent = 'Add New Client';
        topbarSub.textContent   = 'Upload a resume and let AI extract the details';

        allViews.forEach(v => v.classList.add('hidden'));
        viewWorkspace.classList.remove('hidden');
        stepWorkspace.classList.add('hidden');
        stepVerify.classList.add('hidden');
        stepUpload.classList.remove('hidden');

        // Reset form
        resumeInput.value = '';
        fileNameDisplay.textContent = 'No file selected';
        btnParse.disabled = true;
    });

    const cancelToHome = () => {
        stepUpload.classList.add('hidden');
        stepVerify.classList.add('hidden');
        stepWorkspace.classList.add('hidden');
        showView('home');
    };

    btnCancelUpload?.addEventListener('click', cancelToHome);
    btnCancelVerify?.addEventListener('click', cancelToHome);

    // File selection
    resumeInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            fileNameDisplay.textContent = e.target.files[0].name;
            btnParse.disabled = false;
        }
    });

    // Parse resume
    btnParse.addEventListener('click', async () => {
        const file = resumeInput.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('resume', file);

        showLoading('Analyzing resume with AI...');
        try {
            const res = await fetch('/api/parse-resume', { method: 'POST', body: formData });
            const result = await res.json();
            if (result.success) {
                document.getElementById('input-name').value     = result.data.name || '';
                document.getElementById('input-industry').value = result.data.industry || '';
                document.getElementById('input-role').value     = result.data.role || '';
                document.getElementById('input-location').value = result.data.location || 'India';
                document.getElementById('input-summary').value  = result.data.experienceSummary || '';

                stepUpload.classList.add('hidden');
                stepVerify.classList.remove('hidden');
            } else {
                alert('Failed to parse resume: ' + result.error);
            }
        } catch (err) {
            alert('Error communicating with server.');
        } finally {
            hideLoading();
        }
    });

    // Save client
    btnSaveClient.addEventListener('click', async () => {
        const clientObj = {
            name:              document.getElementById('input-name').value,
            industry:          document.getElementById('input-industry').value,
            role:              document.getElementById('input-role').value,
            location:          document.getElementById('input-location').value,
            experienceSummary: document.getElementById('input-summary').value
        };

        showLoading('Saving client profile...');
        try {
            const res = await fetch('/api/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clientObj)
            });
            const result = await res.json();
            if (result.success) {
                await loadClients();
                openClientWorkspace(result.client);
            } else {
                alert('Failed to save client: ' + result.error);
            }
        } catch (err) {
            alert('Error communicating with server.');
        } finally {
            hideLoading();
        }
    });

    // ─── Delete Client ────────────────────────────────────────────────────
    window.deleteClient = async (event, id, name) => {
        event.stopPropagation();
        if (!confirm(`Delete profile for "${name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
            const result = await res.json();
            if (result.success) {
                if (activeClient && activeClient.id === id) {
                    showView('home');
                    activeClient = null;
                }
                await loadClients();
            } else {
                alert('Failed to delete client.');
            }
        } catch (err) {
            alert('Error communicating with server.');
        }
    };

    // ─── Find Matching Jobs ───────────────────────────────────────────────
    btnSearchWorkspace.addEventListener('click', async () => {
        if (!activeClient) return;

        showLoading(`Scraping jobs for ${activeClient.role} in ${activeClient.location}...`);
        try {
            // 1. Scrape
            const scrapeRes = await fetch('/api/scrape-jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: activeClient.role,
                    industry: activeClient.industry,
                    location: activeClient.location
                })
            });
            const scrapeResult = await scrapeRes.json();
            if (!scrapeResult.success) { alert('Scraping failed: ' + scrapeResult.error); hideLoading(); return; }

            const jobs = scrapeResult.jobs;

            // 2. Score
            showLoading(`AI is scoring ${jobs.length} jobs for relevancy...`);
            const scoreRes = await fetch('/api/score-jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ candidateSummary: activeClient.experienceSummary, jobs })
            });
            const scoreResult = await scoreRes.json();

            if (scoreResult.success) {
                stepJobs.classList.remove('hidden');
                renderJobs(scoreResult.scoredJobs);
            } else {
                alert('Scoring failed: ' + scoreResult.error);
            }
        } catch (err) {
            console.error(err);
            alert('Error during job search.');
        } finally {
            hideLoading();
        }
    });

    // ─── Render Job Cards ─────────────────────────────────────────────────
    const renderJobs = (jobs) => {
        jobsContainer.innerHTML = '';
        jobsCountLabel.textContent = `${jobs.length} Jobs Found`;

        if (jobs.length === 0) {
            jobsContainer.innerHTML = '<p style="color:var(--text-muted);">No jobs found. Try adjusting the role or location.</p>';
            return;
        }

        jobs.forEach((job, index) => {
            const card = document.createElement('div');
            card.className = 'job-card fade-in';

            let scoreColor = '#10b981';
            if (job.score < 70) scoreColor = '#f59e0b';
            if (job.score < 40) scoreColor = '#ef4444';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                    <div>
                        <h3>${job.title}</h3>
                        <p class="company-name">${job.company} • ${job.source || 'Job Portal'}</p>
                    </div>
                    <span style="flex-shrink:0; padding:5px 12px; border-radius:20px; background:${scoreColor}18; color:${scoreColor}; font-weight:700; font-size:0.85rem; border:1px solid ${scoreColor}40;">
                        ${job.score}% Match
                    </span>
                </div>
                <div style="padding:10px 14px; background:var(--bg-alt); border-radius:8px; font-size:0.85rem; color:var(--text-soft); margin-bottom:14px; border-left:3px solid ${scoreColor};">
                    <strong style="color:var(--text-main);">AI Analysis:</strong> ${job.matchReason || '—'}
                </div>
                <div class="outreach-box hidden" id="msg-box-${index}">
                    <p>Click "Generate Outreach" to write a personalized AI message.</p>
                </div>
                <div class="job-actions" style="margin-top:12px;">
                    <button onclick="generateMessage(${index},'${encodeURIComponent(job.company)}','${encodeURIComponent(job.title)}','${encodeURIComponent(job.jd)}')">Generate Outreach 🤖</button>
                    <a href="${job.link}" target="_blank">View / Apply ➔</a>
                </div>
            `;
            jobsContainer.appendChild(card);
        });
    };

    // ─── Generate Outreach Message ────────────────────────────────────────
    window.generateMessage = async (index, encCompany, encRole, encJd) => {
        const company = decodeURIComponent(encCompany);
        const role    = decodeURIComponent(encRole);
        const jd      = decodeURIComponent(encJd);
        const msgBox  = document.getElementById(`msg-box-${index}`);

        msgBox.classList.remove('hidden');
        msgBox.innerHTML = '<p style="color:var(--text-muted);">Generating...</p>';

        try {
            const res = await fetch('/api/generate-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jd, company, role, resumeSummary: activeClient?.experienceSummary })
            });
            const result = await res.json();
            if (result.success) {
                msgBox.innerHTML = `
                    <p id="msg-text-${index}">${result.message.replace(/\n/g,'<br>')}</p>
                    <button onclick="copyMessage(${index})" style="margin-top:10px; background:rgba(255,255,255,0.08); color:var(--text-main); border:1px solid var(--border); border-radius:6px; padding:5px 12px; cursor:pointer; font-size:0.8rem;">Copy 📋</button>
                `;
            } else {
                msgBox.innerHTML = '<p style="color:#ef4444;">Failed to generate.</p>';
            }
        } catch {
            msgBox.innerHTML = '<p style="color:#ef4444;">Error generating message.</p>';
        }
    };

    window.copyMessage = (index) => {
        const el = document.getElementById(`msg-text-${index}`);
        if (el) {
            navigator.clipboard.writeText(el.innerHTML.replace(/<br\s*\/?>/gi, '\n'))
                .then(() => alert('Copied!'));
        }
    };

    // ─── Utils ────────────────────────────────────────────────────────────
    function showLoading(text) {
        loadingText.textContent = text;
        loadingOverlay.classList.remove('hidden');
    }
    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    // ─── Init ─────────────────────────────────────────────────────────────
    loadClients();
    showView('home');
});
