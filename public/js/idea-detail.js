// Idea detail page functionality
document.addEventListener('DOMContentLoaded', () => {
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const ideaContent = document.getElementById('ideaContent');
    const analysisSection = document.getElementById('analysisSection');
    const pendingState = document.getElementById('pendingState');

    console.debug('ideaId check:', typeof ideaId, ideaId);
    
    if (typeof ideaId === 'undefined' || !ideaId || ideaId.trim() === '') {
        console.error('Idea ID not found - ideaId:', ideaId);
        showErrorState();
        return;
    }

    let currentIdea = null;

    // Initialize page
    init();

    async function init() {
        if (!window.gutcheckApp.userEmail) {
            showErrorState('Registration required to view ideas');
            return;
        }
        
        await loadIdeaDetails();
        setupEventListeners();
    }

    function setupEventListeners() {
        // Re-analyze button
        document.getElementById('reanalyzeBtn')?.addEventListener('click', async () => {
            await analyzeIdea();
        });

        // Archive button
        document.getElementById('archiveBtn')?.addEventListener('click', async () => {
            await archiveIdea();
        });

        // Start analysis button (for pending ideas)
        document.getElementById('startAnalysisBtn')?.addEventListener('click', async () => {
            await analyzeIdea();
        });

        // Save notes button
        document.getElementById('saveNotesBtn')?.addEventListener('click', async () => {
            await saveNotes();
        });

        // Toggle raw response
        document.getElementById('toggleRawResponse')?.addEventListener('click', () => {
            toggleRawResponse();
        });
    }

    async function loadIdeaDetails() {
        try {
            loadingState.classList.remove('hidden');
            
            const response = await window.gutcheckApp.makeApiCall(`/api/ideas/${ideaId}`, {
                method: 'GET'
            });

            const result = await response.json();

            if (result.success && result.idea) {
                currentIdea = result.idea;
                renderIdeaDetails();
            } else {
                throw new Error(result.error || 'Idea not found');
            }
        } catch (error) {
            console.error('Load idea error:', error);
            showErrorState(error.message);
        } finally {
            loadingState.classList.add('hidden');
        }
    }

    function renderIdeaDetails() {
        const idea = currentIdea;
        
        // Basic details
        document.getElementById('ideaTitle').textContent = idea.title;
        document.getElementById('ideaDate').textContent = window.gutcheckApp.formatDate(idea.createdAt);
        document.getElementById('ideaText').textContent = idea.rawText;
        document.getElementById('userNotes').value = idea.userNotes || '';

        // Status badge
        const statusBadge = document.getElementById('ideaStatus');
        statusBadge.textContent = idea.status.charAt(0).toUpperCase() + idea.status.slice(1);
        statusBadge.className = `status-badge status-${idea.status}`;

        // Show appropriate sections based on status
        if (idea.status === 'analyzed' && idea.analysis) {
            renderAnalysis(idea.analysis);
            analysisSection.classList.remove('hidden');
            pendingState.classList.add('hidden');
            document.getElementById('reanalyzeBtn').classList.remove('hidden');
        } else if (idea.status === 'pending') {
            analysisSection.classList.add('hidden');
            pendingState.classList.remove('hidden');
        } else {
            analysisSection.classList.add('hidden');
            pendingState.classList.add('hidden');
        }

        ideaContent.classList.remove('hidden');
    }

    function renderAnalysis(analysis) {
        // Score circle
        const scoreValue = document.getElementById('scoreValue');
        const scoreCircle = document.getElementById('scoreCircle');
        
        scoreValue.textContent = analysis.score;
        
        const scoreClass = analysis.score >= 70 ? 'score-high' : 
                          analysis.score >= 40 ? 'score-medium' : 'score-low';
        scoreCircle.className = `w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center text-3xl font-bold text-white ${scoreClass}`;

        // Recommendation
        const recommendations = {
            pursue: 'Strong potential - pursue this idea!',
            maybe: 'Moderate potential - needs refinement',
            shelve: 'Limited potential - consider other ideas'
        };

        document.getElementById('recommendationText').textContent = recommendations[analysis.recommendation] || 'Analysis complete';
        
        const recBadge = document.getElementById('recommendationBadge');
        recBadge.textContent = analysis.recommendation.charAt(0).toUpperCase() + analysis.recommendation.slice(1);
        recBadge.className = `recommendation-badge rec-${analysis.recommendation}`;

        // Analysis details
        document.getElementById('problemText').textContent = analysis.problem;
        document.getElementById('audienceText').textContent = analysis.audience;
        document.getElementById('potentialText').textContent = analysis.potential;

        // Competitors list
        const competitorsList = document.getElementById('competitorsList');
        competitorsList.innerHTML = '';
        
        if (analysis.competitors && analysis.competitors.length > 0) {
            analysis.competitors.forEach(competitor => {
                const item = document.createElement('div');
                item.className = 'text-sm text-gray-600 flex items-center';
                item.innerHTML = `<span class="w-2 h-2 bg-purple-400 rounded-full mr-2"></span>${competitor}`;
                competitorsList.appendChild(item);
            });
        } else {
            competitorsList.innerHTML = '<div class="text-sm text-gray-500 italic">No specific competitors identified</div>';
        }

        // Raw response
        document.getElementById('rawResponseContent').textContent = JSON.stringify(analysis.rawOpenAIResponse, null, 2);
    }

    async function analyzeIdea() {
        if (!currentIdea) return;

        try {
            window.gutcheckApp.showLoading('Analyzing your idea...');
            
            const response = await window.gutcheckApp.makeApiCall(`/api/ideas/${currentIdea._id}/analyze`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                window.gutcheckApp.showToast('Analysis completed!', 'success');
                currentIdea = result.idea;
                renderIdeaDetails();
            } else {
                throw new Error(result.error || 'Analysis failed');
            }
        } catch (error) {
            console.error('Analyze error:', error);
            window.gutcheckApp.showToast(error.message || 'Failed to analyze idea', 'error');
        } finally {
            window.gutcheckApp.hideLoading();
        }
    }

    async function archiveIdea() {
        if (!currentIdea) return;
        
        if (!confirm('Are you sure you want to archive this idea? You can still access it later.')) {
            return;
        }

        try {
            const response = await window.gutcheckApp.makeApiCall(`/api/ideas/${currentIdea._id}/archive`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                window.gutcheckApp.showToast('Idea archived successfully', 'success');
                window.location.href = '/ideas';
            } else {
                throw new Error(result.error || 'Archive failed');
            }
        } catch (error) {
            console.error('Archive error:', error);
            window.gutcheckApp.showToast(error.message || 'Failed to archive idea', 'error');
        }
    }

    async function saveNotes() {
        if (!currentIdea) return;

        const notes = document.getElementById('userNotes').value;

        try {
            const saveBtn = document.getElementById('saveNotesBtn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;

            const response = await window.gutcheckApp.makeApiCall(`/api/ideas/${currentIdea._id}/notes`, {
                method: 'PUT',
                body: JSON.stringify({ userNotes: notes })
            });
            
            const result = await response.json();
            
            if (result.success) {
                window.gutcheckApp.showToast('Notes saved', 'success');
                currentIdea = result.idea;
            } else {
                throw new Error(result.error || 'Failed to save notes');
            }
        } catch (error) {
            console.error('Save notes error:', error);
            window.gutcheckApp.showToast(error.message || 'Failed to save notes', 'error');
        } finally {
            const saveBtn = document.getElementById('saveNotesBtn');
            saveBtn.textContent = 'Save Notes';
            saveBtn.disabled = false;
        }
    }

    function toggleRawResponse() {
        const rawResponse = document.getElementById('rawResponse');
        const chevron = document.getElementById('chevron');
        
        const isHidden = rawResponse.classList.contains('hidden');
        
        if (isHidden) {
            rawResponse.classList.remove('hidden');
            chevron.style.transform = 'rotate(180deg)';
        } else {
            rawResponse.classList.add('hidden');
            chevron.style.transform = 'rotate(0deg)';
        }
    }

    function showErrorState(message = 'Idea not found or access denied') {
        loadingState.classList.add('hidden');
        ideaContent.classList.add('hidden');
        
        const errorMsg = errorState.querySelector('p');
        if (errorMsg) {
            errorMsg.textContent = message;
        }
        
        errorState.classList.remove('hidden');
    }
});
