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
                
                // Redirect to home page
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
