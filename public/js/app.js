// GutCheck App - Main JavaScript functionality
class GutCheckApp {
    constructor() {
        this.init();
    }

    init() {
        this.setupAuth();
        this.setupPWA();
        this.setupGlobalEventListeners();
        this.loadUserData();
    }

    // Authentication and user management
    setupAuth() {
        this.userEmail = localStorage.getItem('gutcheck_user_email');
        this.updateUsageIndicator();
    }

    async loadUserData() {
        if (this.userEmail) {
            try {
                const response = await fetch('/api/auth/check', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email: this.userEmail })
                });

                const data = await response.json();
                if (data.success) {
                    this.updateUsageIndicator(data.usageCount, data.maxUsage);
                    this.updateGroqUsageIndicator(data.groqUsageCount, data.maxGroqUsage);
                    this.hasCustomKey = data.hasCustomKey;
                    this.hasGroqKey = data.hasGroqKey;
                }
            } catch (error) {
                console.debug('Failed to load user data:', error);
            }
        }
    }

    updateUsageIndicator(usageCount = 0, maxUsage = 10) {
        const indicator = document.getElementById('usageIndicator');
        const countElement = document.getElementById('usageCount');
        
        if (indicator && countElement) {
            countElement.textContent = usageCount;
            indicator.classList.remove('hidden');
            
            // Color code based on usage
            if (usageCount >= maxUsage) {
                indicator.className = indicator.className.replace(/text-\w+-\d+/, 'text-red-500');
            } else if (usageCount >= maxUsage * 0.8) {
                indicator.className = indicator.className.replace(/text-\w+-\d+/, 'text-yellow-500');
            } else {
                indicator.className = indicator.className.replace(/text-\w+-\d+/, 'text-gray-500');
            }
        }
    }

    updateGroqUsageIndicator(groqUsageCount = 0, maxGroqUsage = 10) {
        const indicator = document.getElementById('groqUsageIndicator');
        const countElement = document.getElementById('groqUsageCount');
        
        if (indicator && countElement) {
            countElement.textContent = groqUsageCount;
            indicator.classList.remove('hidden');
            
            // Color code based on usage
            if (groqUsageCount >= maxGroqUsage) {
                indicator.className = indicator.className.replace(/text-\w+-\d+/, 'text-red-500');
            } else if (groqUsageCount >= maxGroqUsage * 0.8) {
                indicator.className = indicator.className.replace(/text-\w+-\d+/, 'text-yellow-500');
            } else {
                indicator.className = indicator.className.replace(/text-\w+-\d+/, 'text-gray-500');
            }
        }
    }

    // Helper method to show Groq API key prompt
    showGroqKeyPrompt() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div class="mt-3 text-center">
                    <h3 class="text-lg font-medium text-gray-900">Voice Transcription Limit Reached</h3>
                    <div class="mt-2 px-7 py-3">
                        <p class="text-sm text-gray-500">
                            You've used all 10 free voice transcriptions. To continue using voice features, please provide your own Groq API key.
                        </p>
                        <div class="mt-4">
                            <input type="text" id="groqApiKeyInput" placeholder="Enter your Groq API key" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                        </div>
                        <div class="mt-3 text-xs text-gray-500">
                            <a href="https://console.groq.com/keys" target="_blank" class="text-blue-600 hover:underline">
                                Get your Groq API key here
                            </a>
                        </div>
                    </div>
                    <div class="items-center px-4 py-3">
                        <button id="saveGroqKey" class="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
                            Save API Key
                        </button>
                        <button id="skipGroqKey" class="mt-2 px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md w-full shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300">
                            Skip for Now
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Handle save button
        document.getElementById('saveGroqKey').addEventListener('click', async () => {
            const groqApiKey = document.getElementById('groqApiKeyInput').value.trim();
            if (!groqApiKey) {
                this.showToast('Please enter a valid Groq API key', 'error');
                return;
            }

            try {
                const response = await fetch('/api/auth/settings', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-user-email': this.userEmail
                    },
                    body: JSON.stringify({ groqApiKey })
                });

                if (!response.ok) {
                    throw new Error('Failed to save Groq API key');
                }

                this.hasGroqKey = true;
                this.showToast('Groq API key saved successfully!', 'success');
                document.body.removeChild(modal);
                
                // Reload user data to update usage indicators
                this.loadUserData();
            } catch (error) {
                this.showToast('Failed to save Groq API key', 'error');
            }
        });

        // Handle skip button
        document.getElementById('skipGroqKey').addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        // Handle click outside modal
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    // PWA functionality
    setupPWA() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            this.showInstallPrompt();
        });

        document.getElementById('installApp')?.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.debug('PWA install outcome:', outcome);
                deferredPrompt = null;
                this.hideInstallPrompt();
            }
        });

        document.getElementById('dismissInstall')?.addEventListener('click', () => {
            this.hideInstallPrompt();
            localStorage.setItem('gutcheck_install_dismissed', 'true');
        });
    }

    showInstallPrompt() {
        const dismissed = localStorage.getItem('gutcheck_install_dismissed');
        if (!dismissed) {
            document.getElementById('installPrompt')?.classList.remove('hidden');
        }
    }

    hideInstallPrompt() {
        document.getElementById('installPrompt')?.classList.add('hidden');
    }

    // Global event listeners
    setupGlobalEventListeners() {
        // Loading overlay management
        this.setupLoadingOverlay();
    }

    setupLoadingOverlay() {
        this.loadingOverlay = document.getElementById('loadingOverlay');
    }

    showLoading(message = 'Loading...') {
        if (this.loadingOverlay) {
            const messageElement = this.loadingOverlay.querySelector('span');
            if (messageElement) {
                messageElement.textContent = message;
            }
            this.loadingOverlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        if (this.loadingOverlay) {
            this.loadingOverlay.classList.add('hidden');
        }
    }

    // API helpers
    async makeApiCall(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        // Add user email to headers or body
        if (this.userEmail) {
            if (options.method === 'GET') {
                // For GET requests, send email as header
                options.headers = {
                    ...options.headers,
                    'x-user-email': this.userEmail
                };
            } else if (options.method === 'POST' || options.method === 'PUT') {
                // For POST/PUT requests, add to body
                const body = options.body ? JSON.parse(options.body) : {};
                body.email = this.userEmail;
                options.body = JSON.stringify(body);
            }
        }

        return fetch(url, { ...defaultOptions, ...options });
    }

    // Utility functions
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    truncateText(text, maxLength = 100) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    showToast(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 transition-all transform translate-x-full`;
        
        const bgColors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            warning: 'bg-yellow-500',
            info: 'bg-blue-500'
        };
        
        toast.className += ` ${bgColors[type] || bgColors.info} text-white`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.gutcheckApp = new GutCheckApp();
});
