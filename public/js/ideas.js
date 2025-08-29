// Ideas list page functionality
document.addEventListener('DOMContentLoaded', () => {
    const ideasContainer = document.getElementById('ideasContainer');
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const filterTabs = document.querySelectorAll('.filter-tab');
    const ideaCardTemplate = document.getElementById('ideaCardTemplate');
    
    let currentFilter = 'all';
    let ideas = [];

    // Initialize page
    init();

    async function init() {
        if (!window.gutcheckApp.userEmail) {
            showRegistrationRequired();
            return;
        }
        
        await loadIdeas();
        setupEventListeners();
    }

    function setupEventListeners() {
        filterTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                currentFilter = e.target.dataset.status;
                updateFilterTabs();
                renderIdeas();
            });
        });
    }

    function updateFilterTabs() {
        filterTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.status === currentFilter);
        });
    }

    async function loadIdeas() {
        try {
            loadingState.classList.remove('hidden');
            emptyState.classList.add('hidden');

            const response = await window.gutcheckApp.makeApiCall('/api/ideas', {
                method: 'GET'
            });

            const result = await response.json();

            if (result.success) {
                ideas = result.ideas;
                renderIdeas();
            } else {
                throw new Error(result.error || 'Failed to load ideas');
            }
        } catch (error) {
            console.error('Load ideas error:', error);
            window.gutcheckApp.showToast('Failed to load ideas', 'error');
            showEmptyState();
        } finally {
            loadingState.classList.add('hidden');
        }
    }

    function renderIdeas() {
        const container = document.createElement('div');
        container.className = 'space-y-4';

        let filteredIdeas = ideas;
        if (currentFilter !== 'all') {
            filteredIdeas = ideas.filter(idea => idea.status === currentFilter);
        }

        if (filteredIdeas.length === 0) {
            showEmptyState();
            return;
        }

        filteredIdeas.forEach(idea => {
            const card = createIdeaCard(idea);
            container.appendChild(card);
        });

        // Replace container content
        ideasContainer.innerHTML = '';
        ideasContainer.appendChild(container);
        emptyState.classList.add('hidden');
    }

    function createIdeaCard(idea) {
        const template = ideaCardTemplate.content.cloneNode(true);
        const card = template.querySelector('.card');
        
        // Set data attribute
        card.dataset.ideaId = idea._id;
        
        // Basic info
        template.querySelector('.idea-title').textContent = idea.title;
        template.querySelector('.idea-preview').textContent = window.gutcheckApp.truncateText(idea.rawText, 120);
        template.querySelector('.idea-date').textContent = window.gutcheckApp.formatDate(idea.createdAt);
        
        // Status badge
        const statusBadge = template.querySelector('.status-badge');
        statusBadge.textContent = idea.status.charAt(0).toUpperCase() + idea.status.slice(1);
        statusBadge.className += ` status-${idea.status}`;
        
        // Analysis preview for analyzed ideas
        if (idea.status === 'analyzed' && idea.analysis) {
            const analysisPreview = template.querySelector('.analysis-preview');
            analysisPreview.classList.remove('hidden');
            
            // Score badge
            const scoreBadge = template.querySelector('.score-badge');
            scoreBadge.textContent = idea.analysis.score;
            const scoreClass = idea.analysis.score >= 70 ? 'score-high' : 
                             idea.analysis.score >= 40 ? 'score-medium' : 'score-low';
            scoreBadge.className += ` ${scoreClass}`;
            
            // Recommendation badge
            const recBadge = template.querySelector('.recommendation-badge');
            recBadge.textContent = idea.analysis.recommendation.charAt(0).toUpperCase() + idea.analysis.recommendation.slice(1);
            recBadge.className += ` rec-${idea.analysis.recommendation}`;
            
            // Problem and audience
            template.querySelector('.problem-text').textContent = window.gutcheckApp.truncateText(idea.analysis.problem, 80);
            template.querySelector('.audience-text').textContent = window.gutcheckApp.truncateText(idea.analysis.audience, 80);
        }
        
        // Show analyze button for pending ideas
        if (idea.status === 'pending') {
            template.querySelector('.analyze-btn').classList.remove('hidden');
        }
        
        // Event listeners
        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('analyze-btn') && !e.target.classList.contains('archive-btn')) {
                window.location.href = `/ideas/${idea._id}`;
            }
        });
        
        template.querySelector('.analyze-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            await analyzeIdea(idea._id);
        });
        
        template.querySelector('.archive-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            await archiveIdea(idea._id);
        });
        
        return template;
    }

    async function analyzeIdea(ideaId) {
        try {
            window.gutcheckApp.showLoading('Analyzing idea...');
            
            const response = await window.gutcheckApp.makeApiCall(`/api/ideas/${ideaId}/analyze`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                window.gutcheckApp.showToast('Analysis completed!', 'success');
                await loadIdeas(); // Refresh the list
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

    async function archiveIdea(ideaId) {
        if (!confirm('Are you sure you want to archive this idea?')) {
            return;
        }
        
        try {
            const response = await window.gutcheckApp.makeApiCall(`/api/ideas/${ideaId}/archive`, {
                method: 'POST'
            });
            
            const result = await response.json();
            
            if (result.success) {
                window.gutcheckApp.showToast('Idea archived', 'success');
                await loadIdeas(); // Refresh the list
            } else {
                throw new Error(result.error || 'Archive failed');
            }
        } catch (error) {
            console.error('Archive error:', error);
            window.gutcheckApp.showToast(error.message || 'Failed to archive idea', 'error');
        }
    }

    function showEmptyState() {
        ideasContainer.innerHTML = '';
        emptyState.classList.remove('hidden');
    }

    function showRegistrationRequired() {
        ideasContainer.innerHTML = `
            <div class="text-center py-12">
                <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span class="text-2xl">🔐</span>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">Registration Required</h3>
                <p class="text-gray-600 mb-4">Please register to view and manage your ideas.</p>
                <a href="/register" class="btn-primary">Register Now</a>
            </div>
        `;
        loadingState.classList.add('hidden');
    }
});
