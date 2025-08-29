document.addEventListener('DOMContentLoaded', function() {
  // Elements
  const apiKeyForm = document.getElementById('api-key-form');
  const apiKeyInput = document.getElementById('api-key');
  const toggleApiKeyBtn = document.getElementById('toggle-api-key');
  const removeApiKeyBtn = document.getElementById('remove-api-key');
  const apiKeyStatus = document.getElementById('api-key-status');
  const modelPreferencesForm = document.getElementById('model-preferences-form');
  const preferredModelSelect = document.getElementById('preferred-model');

  // Toggle API key visibility
  toggleApiKeyBtn.addEventListener('click', function() {
    const type = apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    apiKeyInput.setAttribute('type', type);
    
    // Update icon based on visibility state
    const eyeIcon = toggleApiKeyBtn.querySelector('svg');
    if (type === 'text') {
      eyeIcon.innerHTML = `
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      `;
    } else {
      eyeIcon.innerHTML = `
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      `;
    }
  });

  // Load user settings
  async function loadUserSettings() {
    try {
      const userEmail = localStorage.getItem('gutcheck_user_email');
      if (!userEmail) {
        showNotification('Please log in to access settings', 'error');
        return;
      }

      const response = await fetch('/api/auth/settings', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load settings');
      }

      const data = await response.json();
      
      // Update API key status
      if (data.hasApiKey) {
        apiKeyStatus.textContent = 'API Key Set';
        apiKeyStatus.className = 'ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800';
        apiKeyInput.placeholder = '••••••••••••••••••••••••••';
      } else {
        apiKeyStatus.textContent = 'No API Key';
        apiKeyStatus.className = 'ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800';
      }

      // Set preferred model if available
      if (data.preferredModel) {
        preferredModelSelect.value = data.preferredModel;
      }

      // Disable model selection if no API key
      preferredModelSelect.disabled = !data.hasApiKey;
      if (!data.hasApiKey) {
        const notice = document.createElement('div');
        notice.className = 'mt-2 text-sm text-amber-600';
        notice.textContent = 'Add an API key to enable model selection';
        preferredModelSelect.parentNode.appendChild(notice);
      }

    } catch (error) {
      console.error('Error loading settings:', error);
      showNotification('Failed to load settings', 'error');
    }
  }

  // Save API key
  apiKeyForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const apiKey = apiKeyInput.value.trim();
    const userEmail = localStorage.getItem('gutcheck_user_email');
    
    if (!userEmail) {
      showNotification('Please log in to save settings', 'error');
      return;
    }
    
    try {
      const response = await fetch('/api/auth/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        },
        body: JSON.stringify({ apiKey })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save API key');
      }

      // Clear input for security
      apiKeyInput.value = '';
      
      showNotification('API key saved successfully', 'success');
      
      // Reload settings to update UI
      loadUserSettings();
      
    } catch (error) {
      console.error('Error saving API key:', error);
      showNotification(error.message, 'error');
    }
  });

  // Remove API key
  removeApiKeyBtn.addEventListener('click', async function() {
    if (!confirm('Are you sure you want to remove your API key?')) {
      return;
    }
    
    const userEmail = localStorage.getItem('gutcheck_user_email');
    if (!userEmail) {
      showNotification('Please log in to remove settings', 'error');
      return;
    }
    
    try {
      const response = await fetch('/api/auth/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        },
        body: JSON.stringify({ apiKey: '' })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove API key');
      }

      showNotification('API key removed successfully', 'success');
      
      // Reset model preference when removing API key
      preferredModelSelect.value = '';
      
      // Update model preference in the backend
      await updateModelPreference('');
      
      // Reload settings to update UI
      loadUserSettings();
      
    } catch (error) {
      console.error('Error removing API key:', error);
      showNotification(error.message, 'error');
    }
  });

  // Save model preferences
  modelPreferencesForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const preferredModel = preferredModelSelect.value;
    
    try {
      await updateModelPreference(preferredModel);
      showNotification('Model preference saved successfully', 'success');
    } catch (error) {
      console.error('Error saving model preference:', error);
      showNotification(error.message, 'error');
    }
  });

  // Update model preference
  async function updateModelPreference(preferredModel) {
    const userEmail = localStorage.getItem('gutcheck_user_email');
    if (!userEmail) {
      throw new Error('Please log in to update model preferences');
    }
    
    const response = await fetch('/api/auth/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-user-email': userEmail
      },
      body: JSON.stringify({ preferredModel })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save model preference');
    }

    return response.json();
  }

  // Show notification
  function showNotification(message, type = 'info') {
    // Check if notification container exists, if not create it
    let notificationContainer = document.getElementById('notification-container');
    
    if (!notificationContainer) {
      notificationContainer = document.createElement('div');
      notificationContainer.id = 'notification-container';
      notificationContainer.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2';
      document.body.appendChild(notificationContainer);
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `p-4 rounded-lg shadow-lg transition-all duration-300 transform translate-x-0 max-w-md ${
      type === 'success' ? 'bg-green-50 text-green-800 border-l-4 border-green-500' :
      type === 'error' ? 'bg-red-50 text-red-800 border-l-4 border-red-500' :
      'bg-blue-50 text-blue-800 border-l-4 border-blue-500'
    }`;
    
    notification.innerHTML = `
      <div class="flex items-center justify-between">
        <p>${message}</p>
        <button class="ml-4 text-gray-500 hover:text-gray-700" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    `;
    
    // Add close button functionality
    const closeButton = notification.querySelector('button');
    closeButton.addEventListener('click', () => {
      notification.classList.add('opacity-0', 'translate-x-full');
      setTimeout(() => {
        notification.remove();
      }, 300);
    });
    
    // Add to container
    notificationContainer.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('opacity-0', 'translate-x-full');
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, 5000);
  }

  // Load settings on page load
  loadUserSettings();
});
