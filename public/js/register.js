// Registration page functionality
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registerForm');
    const emailInput = document.getElementById('email');
    const byokKeyInput = document.getElementById('byokKey');
    const toggleKeyBtn = document.getElementById('toggleKey');
    const eyeOpen = document.getElementById('eyeOpen');
    const eyeClosed = document.getElementById('eyeClosed');

    // Password visibility toggle
    toggleKeyBtn?.addEventListener('click', () => {
        const isPassword = byokKeyInput.type === 'password';
        
        byokKeyInput.type = isPassword ? 'text' : 'password';
        eyeOpen.classList.toggle('hidden', isPassword);
        eyeClosed.classList.toggle('hidden', !isPassword);
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const byokKey = byokKeyInput.value.trim();

        // Validate email
        if (!email || !isValidEmail(email)) {
            window.gutcheckApp.showToast('Please enter a valid email address', 'error');
            return;
        }

        // Validate BYOK key format if provided
        if (byokKey && !isValidOpenRouterKey(byokKey)) {
            window.gutcheckApp.showToast('OpenRouter API key should start with "sk-"', 'error');
            return;
        }

        try {
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Registering...';
            submitBtn.disabled = true;

            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    byokKey: byokKey || undefined
                })
            });

            const result = await response.json();

            if (result.success) {
                // Store encoded email in localStorage
                localStorage.setItem('gutcheck_user_email', result.user.email);

                window.gutcheckApp.showToast('Registration successful!', 'success');

                // Update app state
                window.gutcheckApp.userEmail = result.user.email;
                window.gutcheckApp.hasCustomKey = result.user.hasCustomKey;

                // Check if there's a pending idea to submit
                const pendingIdea = localStorage.getItem('gutcheck_pending_idea');
                if (pendingIdea) {
                    try {
                        const ideaData = JSON.parse(pendingIdea);

                        // Check if the idea is not too old (within last hour)
                        const oneHourAgo = Date.now() - (60 * 60 * 1000);
                        if (ideaData.timestamp > oneHourAgo) {
                            window.gutcheckApp.showToast('Submitting your idea...', 'info');

                            // Auto-submit the pending idea
                            setTimeout(async () => {
                                try {
                                    const response = await fetch('/api/ideas', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'x-user-email': result.user.email
                                        },
                                        body: JSON.stringify({
                                            title: ideaData.title,
                                            rawText: ideaData.rawText,
                                            voiceUrl: ideaData.voiceUrl,
                                            userNotes: ideaData.userNotes
                                        })
                                    });

                                    const submitResult = await response.json();

                                    if (submitResult.success) {
                                        window.gutcheckApp.showToast('Your idea has been analyzed!', 'success');
                                        // Clear the pending idea
                                        localStorage.removeItem('gutcheck_pending_idea');
                                        // Redirect to the idea detail page
                                        window.location.href = `/ideas/${submitResult.idea._id}`;
                                    } else {
                                        // If submission failed, redirect to home and let user try again
                                        window.gutcheckApp.showToast('Idea submission failed. Please try again.', 'error');
                                        window.location.href = '/';
                                    }
                                } catch (error) {
                                    console.error('Auto-submit error:', error);
                                    window.gutcheckApp.showToast('Failed to submit your idea. Please try again.', 'error');
                                    window.location.href = '/';
                                }
                            }, 1000); // Wait 1 second before auto-submitting
                            return; // Don't redirect to home yet
                        } else {
                            // Clear old pending idea
                            localStorage.removeItem('gutcheck_pending_idea');
                        }
                    } catch (error) {
                        console.error('Error parsing pending idea:', error);
                        localStorage.removeItem('gutcheck_pending_idea');
                    }
                }

                // Redirect to home page if no pending idea
                setTimeout(() => {
                    window.location.href = '/';
                }, 1500);

            } else {
                throw new Error(result.error || 'Registration failed');
            }

        } catch (error) {
            console.error('Registration error:', error);
            window.gutcheckApp.showToast(error.message || 'Registration failed', 'error');
        } finally {
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Register & Start Analyzing';
            submitBtn.disabled = false;
        }
    });

    // Helper functions
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    function isValidOpenRouterKey(key) {
        return key.startsWith('sk-') && key.length > 20;
    }

    // Auto-focus email field
    emailInput?.focus();
});
