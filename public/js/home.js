// Home page functionality - Idea submission form
document.addEventListener('DOMContentLoaded', () => {
    // Track if we have a valid voice recording
    let hasValidVoiceRecording = false;
    const form = document.getElementById('ideaForm');
    const textArea = document.getElementById('rawText');
    const charCount = document.getElementById('charCount');
    const recordBtn = document.getElementById('recordBtn');
    const recordingStatus = document.getElementById('recordingStatus');
    
    let mediaRecorder;
    let recordedChunks = [];
    let isRecording = false;

    // Character count update for title
    const updateTitleCharCount = () => {
        const titleCount = titleInput.value.length;
        const titleCharCount = document.getElementById('titleCharCount');
        if (titleCharCount) {
            titleCharCount.textContent = `${titleCount}/200`;
            titleCharCount.className = titleCount > 180 ? 'text-red-500' : titleCount > 160 ? 'text-yellow-500' : 'text-gray-400';
        }
    };

    // Character count update for notes
    const updateNotesCharCount = () => {
        const notesCount = userNotes.value.length;
        const notesCharCount = userNotes.parentElement.querySelector('.bg-gray-100');
        if (notesCharCount) {
            notesCharCount.textContent = `${notesCount}/1000`;
            notesCharCount.className = notesCount > 900 ? 'bg-red-100 text-red-600 px-2 py-1 rounded-full' : notesCount > 800 ? 'bg-yellow-100 text-yellow-600 px-2 py-1 rounded-full' : 'bg-gray-100 px-2 py-1 rounded-full';
        }
    };

    const titleInput = document.getElementById('title');
    const userNotes = document.getElementById('userNotes');
    
    // Character count update
    const updateCharCount = () => {
        const count = textArea.value.length;
        charCount.textContent = `${count}/5000`;
        charCount.className = count > 4500 ? 'text-red-500' : count > 4000 ? 'text-yellow-500' : 'text-gray-500';
    };

    textArea.addEventListener('input', updateCharCount);
    if (titleInput) titleInput.addEventListener('input', updateTitleCharCount);
    if (userNotes) userNotes.addEventListener('input', updateNotesCharCount);
    updateCharCount();
    if (titleInput) updateTitleCharCount();
    if (userNotes) updateNotesCharCount();

    // Voice recording functionality
    recordBtn.addEventListener('click', async () => {
        if (!isRecording) {
            await startRecording();
        } else {
            stopRecording();
        }
    });

    let isProcessingVoice = false;

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            recordedChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordedChunks.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const blob = new Blob(recordedChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = () => {
                    // Store base64 audio data
                    document.getElementById('voiceUrl').value = reader.result;
                    
                    // Mark that we have a valid voice recording
                    hasValidVoiceRecording = true;
                    
                    // Make text field optional
                    document.getElementById('textRequiredIndicator').textContent = ' (optional with voice)';
                    document.getElementById('rawText').removeAttribute('required');

                    // Update UI to show recording is ready
                    recordBtn.textContent = '🎤 Start Recording';
                    recordBtn.className = recordBtn.className.replace('bg-red-100', 'bg-gray-100').replace('text-red-700', 'text-gray-700');
                    recordingStatus.textContent = 'Recording saved! Voice will be transcribed automatically.';
                    recordBtn.disabled = false;
                    isProcessingVoice = false;
                };
                reader.readAsDataURL(blob);
            };

            mediaRecorder.start();
            isRecording = true;

            recordBtn.textContent = '⏹️ Stop Recording';
            recordBtn.className = recordBtn.className.replace('bg-gray-100', 'bg-red-100').replace('text-gray-700', 'text-red-700');
            recordingStatus.textContent = 'Recording... Speak clearly about your idea';
            recordingStatus.classList.remove('hidden');

        } catch (error) {
            console.error('Recording error:', error);
            window.gutcheckApp.showToast('Unable to access microphone', 'error');
        }
    }

    function stopRecording() {
        if (mediaRecorder && isRecording) {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            isRecording = false;

            // Show processing status
            recordBtn.textContent = '⏳ Processing...';
            recordBtn.disabled = true;
            recordingStatus.textContent = 'Processing your recording...';
            isProcessingVoice = true;
        }
    }

    // Voice input is already in the HTML

    // Form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Check if voice is still processing
        if (isProcessingVoice) {
            window.gutcheckApp.showToast('Please wait for voice recording to finish processing...', 'warning');
            return;
        }
        
        const formData = new FormData(form);
        const data = {
            title: formData.get('title'),
            rawText: formData.get('rawText'),
            voiceUrl: formData.get('voiceUrl'),
            userNotes: formData.get('userNotes')
        };

        // Validate form - text is optional if voice recording exists
        const hasText = data.rawText && data.rawText.trim();
        const hasVoice = data.voiceUrl && data.voiceUrl.trim() && hasValidVoiceRecording;
        
        if (!data.title.trim()) {
            window.gutcheckApp.showToast('Please enter a title for your idea', 'error');
            return;
        }
        
        if (!hasText && !hasVoice) {
            window.gutcheckApp.showToast('Please either describe your idea in text or record it with voice', 'error');
            return;
        }

        if (!hasText && hasVoice) {
            // If only voice recording, use a placeholder text
            data.rawText = '[Voice recording provided - will be transcribed by AI]';
            window.gutcheckApp.showToast('Voice recording detected! Your audio will be transcribed and analyzed.', 'info');
        }

        // Check if user needs to register
        if (!window.gutcheckApp.userEmail) {
            const shouldRegister = confirm('You need to register to submit ideas. Would you like to register now?');
            if (shouldRegister) {
                window.location.href = '/register';
                return;
            } else {
                return;
            }
        }

        const submitBtn = document.getElementById('submitBtn');
        const originalText = submitBtn.innerHTML;
        
        try {
            submitBtn.innerHTML = '<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>Analyzing...';
            submitBtn.disabled = true;

            window.gutcheckApp.showLoading('Analyzing your idea...');

            const response = await window.gutcheckApp.makeApiCall('/api/ideas', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                window.gutcheckApp.showToast('Idea analyzed successfully!', 'success');
                // Redirect to idea detail page
                window.location.href = `/ideas/${result.idea._id}`;
            } else {
                // Check if it's a Groq limit error
                if (result.needsGroqKey) {
                    window.gutcheckApp.showGroqKeyPrompt();
                    return;
                }
                throw new Error(result.error || 'Analysis failed');
            }

        } catch (error) {
            console.error('Submission error:', error);
            window.gutcheckApp.showToast(error.message || 'Failed to analyze idea', 'error');
        } finally {
            window.gutcheckApp.hideLoading();
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // Make updateCharCount globally accessible
    window.updateCharCount = updateCharCount;
});
