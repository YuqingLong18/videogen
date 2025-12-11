// Configuration
const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:${window.location.port || 3001}/api`;
const POLL_INTERVAL = 3000; // Poll every 3 seconds
const MAX_POLL_ATTEMPTS = 400; // Max 20 minutes (400 * 3s) - Kling can take a while!

// State
let currentTaskId = null;
let pollAttempts = 0;

// DOM Elements
const elements = {
    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Text to Video
    text2videoForm: document.getElementById('text2video-form'),
    textPrompt: document.getElementById('text-prompt'),
    textDuration: document.getElementById('text-duration'),
    textAspectRatio: document.getElementById('text-aspect-ratio'),
    textModel: document.getElementById('text-model'),
    textGenerateBtn: document.getElementById('text-generate-btn'),

    // Image to Video
    image2videoForm: document.getElementById('image2video-form'),
    startFrameInput: document.getElementById('start-frame'),
    endFrameInput: document.getElementById('end-frame'),
    startFramePreview: document.getElementById('start-frame-preview'),
    endFramePreview: document.getElementById('end-frame-preview'),
    imagePrompt: document.getElementById('image-prompt'),
    imageDuration: document.getElementById('image-duration'),
    imageModel: document.getElementById('image-model'),
    imageGenerateBtn: document.getElementById('image-generate-btn'),

    // Video Display
    videoPlaceholder: document.getElementById('video-placeholder'),
    videoPlayer: document.getElementById('video-player'),
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingStatus: document.getElementById('loading-status'),
    videoControls: document.getElementById('video-controls'),
    downloadBtn: document.getElementById('download-btn'),

    // User Info
    userInfo: document.getElementById('user-info'),
    userName: document.getElementById('user-name'),
    classroomCodeDisplay: document.getElementById('classroom-code-display'),
    logoutBtn: document.getElementById('logout-btn')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    hideUnavailableModels();
    checkSession();
    setupEventListeners();
});

// Temporarily hide models we don't want exposed yet
function hideUnavailableModels() {
    const hiddenModels = ['kling-v2-1'];
    hiddenModels.forEach(value => {
        document.querySelectorAll(`option[value="${value}"]`).forEach(option => {
            option.disabled = true;
            option.hidden = true;
        });
    });
}

// Check Session
async function checkSession() {
    try {
        const res = await fetch(`${API_BASE_URL}/session`);
        if (!res.ok) {
            window.location.href = '/login.html';
            return;
        }

        const data = await res.json();
        if (!data.user || data.user.role !== 'student') {
            window.location.href = '/login.html';
            return;
        }

        // Update UI
        elements.userInfo.style.display = 'block';
        elements.userName.textContent = data.user.username;
        elements.classroomCodeDisplay.textContent = `Classroom: ${data.session.classroomCode}`;

    } catch (error) {
        console.error('Session check failed', error);
        window.location.href = '/login.html';
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Tabs
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Forms
    elements.text2videoForm.addEventListener('submit', handleText2Video);
    elements.image2videoForm.addEventListener('submit', handleImage2Video);

    // File uploads
    elements.startFrameInput.addEventListener('change', (e) => handleImageUpload(e, elements.startFramePreview));
    elements.endFrameInput.addEventListener('change', (e) => handleImageUpload(e, elements.endFramePreview));

    // Remove image buttons
    document.getElementById('remove-start-frame').addEventListener('click', () => removeImage('start-frame'));
    document.getElementById('remove-end-frame').addEventListener('click', () => removeImage('end-frame'));

    // Download
    elements.downloadBtn.addEventListener('click', downloadVideo);

    // Logout
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            document.cookie.split(";").forEach(function (c) {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });
            window.location.href = '/login.html';
        });
    }
}

// Switch Tab
function switchTab(tabName) {
    // Update buttons
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update content
    elements.tabContents.forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
}

// Handle Image Upload
function handleImageUpload(event, previewElement) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        // Find the remove button and preserve it
        const removeBtn = previewElement.querySelector('.remove-image-btn');
        previewElement.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        if (removeBtn) {
            previewElement.appendChild(removeBtn);
        }
        previewElement.classList.add('active');
    };
    reader.readAsDataURL(file);
}

// Remove Image
function removeImage(inputId) {
    const input = document.getElementById(inputId);
    const previewId = `${inputId}-preview`;
    const preview = document.getElementById(previewId);

    // Clear the file input
    input.value = '';

    // Clear the preview and hide it
    const removeBtn = preview.querySelector('.remove-image-btn');
    preview.innerHTML = '';
    if (removeBtn) {
        preview.appendChild(removeBtn);
    }
    preview.classList.remove('active');
}

// Convert image file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Strip the data URL prefix (e.g., "data:image/png;base64,")
            // Kling API expects only the base64 data, not the full data URL
            const base64Data = reader.result.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Handle Text to Video
async function handleText2Video(e) {
    e.preventDefault();

    try {
        const requestData = {
            model_name: elements.textModel.value,
            prompt: elements.textPrompt.value.trim(),
            duration: elements.textDuration.value,
            aspect_ratio: elements.textAspectRatio.value,
            mode: "std"
        };

        setLoading(true, 'Submitting request...');

        const response = await fetch(`${API_BASE_URL}/text2video`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (response.status === 403) {
            window.location.href = '/login.html';
            return;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || 'Failed to generate video');
        }

        const result = await response.json();
        currentTaskId = result.data.task_id;

        // Start polling
        pollAttempts = 0;
        pollTaskStatus('text2video');

    } catch (error) {
        console.error('Error:', error);
        showNotification(error.message, 'error');
        setLoading(false);
    }
}

// Handle Image to Video
async function handleImage2Video(e) {
    e.preventDefault();

    try {
        const startFrameFile = elements.startFrameInput.files[0];
        if (!startFrameFile) {
            throw new Error('Please select a starting frame');
        }

        const startFrameBase64 = await fileToBase64(startFrameFile);

        const requestData = {
            model_name: elements.imageModel.value,
            image: startFrameBase64,
            prompt: elements.imagePrompt.value.trim() || '',
            duration: elements.imageDuration.value,
            mode: "std"
        };

        // Add ending frame if provided
        const endFrameFile = elements.endFrameInput.files[0];
        if (endFrameFile) {
            const endFrameBase64 = await fileToBase64(endFrameFile);
            requestData.image_tail = endFrameBase64;
        }

        setLoading(true, 'Submitting request...');

        const response = await fetch(`${API_BASE_URL}/image2video`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (response.status === 403) {
            window.location.href = '/login.html';
            return;
        }

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to generate video');
        }

        const result = await response.json();
        currentTaskId = result.data.task_id;

        // Start polling
        pollAttempts = 0;
        pollTaskStatus('image2video');

    } catch (error) {
        console.error('Error:', error);
        showNotification(error.message, 'error');
        setLoading(false);
    }
}

// Poll Task Status
async function pollTaskStatus(type) {
    try {
        pollAttempts++;
        const elapsedMinutes = ((pollAttempts * POLL_INTERVAL) / 60000).toFixed(1);

        console.log(`🔄 [Poll #${pollAttempts}] Checking status (${elapsedMinutes} min elapsed)...`);

        const response = await fetch(`${API_BASE_URL}/${type}/${currentTaskId}`, {
            method: 'GET'
        });

        if (response.status === 403) {
            window.location.href = '/login.html';
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to check task status');
        }

        const result = await response.json();

        // Log the FULL response for debugging
        console.log(`📥 [Poll #${pollAttempts}] Full API response:`, JSON.stringify(result, null, 2));

        // FIX: task_status is at data.task_status, not data.task_result.task_status
        const taskStatus = result.data.task_status;
        const taskStatusMsg = result.data.task_status_msg;
        const taskResult = result.data.task_result;

        console.log(`📊 [Poll #${pollAttempts}] Status: "${taskStatus}" | Message: "${taskStatusMsg || 'None'}"`);

        updateLoadingStatus(taskStatus, taskStatusMsg);

        if (taskStatus === 'succeed') {
            // Video generation complete
            console.log('✅ Video generation complete!');
            console.log('📦 Task result:', JSON.stringify(taskResult, null, 2));

            // The video URL is in task_result.videos[0].url
            const videoUrl = taskResult.videos[0].url;
            console.log('🎬 Video URL:', videoUrl);
            displayVideo(videoUrl);
            setLoading(false);
            showNotification('Video generated successfully!', 'success');
        } else if (taskStatus === 'failed') {
            console.error('❌ Video generation failed:', taskStatusMsg);
            throw new Error(taskStatusMsg || 'Video generation failed');
        } else {
            // Still processing, continue polling
            if (pollAttempts >= MAX_POLL_ATTEMPTS) {
                console.error(`⏱️ Timeout after ${pollAttempts} attempts (${elapsedMinutes} minutes)`);
                throw new Error('Video generation timed out');
            }
            console.log(`⏳ Still processing... will check again in ${POLL_INTERVAL / 1000}s`);
            setTimeout(() => pollTaskStatus(type), POLL_INTERVAL);
        }

    } catch (error) {
        console.error('❌ Polling error:', error);
        showNotification(error.message, 'error');
        setLoading(false);
    }
}

// Update Loading Status
function updateLoadingStatus(status, message) {
    const statusMap = {
        'submitted': 'Request submitted...',
        'processing': 'Generating video...',
        'succeed': 'Complete!',
        'failed': 'Failed'
    };

    let statusText = statusMap[status] || message || 'Processing...';

    // Add poll count and elapsed time if we're polling
    if (pollAttempts > 0 && status !== 'succeed' && status !== 'failed') {
        const elapsedMinutes = ((pollAttempts * POLL_INTERVAL) / 60000).toFixed(1);
        statusText += ` (Poll #${pollAttempts}, ${elapsedMinutes} min)`;
    }

    elements.loadingStatus.textContent = statusText;
}

// Display Video
function displayVideo(videoUrl) {
    elements.videoPlaceholder.classList.add('hidden');
    elements.videoPlayer.src = videoUrl;
    elements.videoPlayer.classList.add('active');
    elements.videoControls.classList.add('active');
    elements.videoPlayer.load();
}

// Download Video
async function downloadVideo() {
    const videoUrl = elements.videoPlayer.src;
    if (!videoUrl) return;

    try {
        const response = await fetch(videoUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kling-video-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        showNotification('Video downloaded!', 'success');
    } catch (error) {
        console.error('Download error:', error);
        showNotification('Failed to download video', 'error');
    }
}

// Set Loading State
function setLoading(isLoading, status = 'Processing...') {
    if (isLoading) {
        elements.loadingOverlay.classList.add('active');
        elements.loadingStatus.textContent = status;
        elements.textGenerateBtn.classList.add('loading');
        elements.imageGenerateBtn.classList.add('loading');
    } else {
        elements.loadingOverlay.classList.remove('active');
        elements.textGenerateBtn.classList.remove('loading');
        elements.imageGenerateBtn.classList.remove('loading');
    }
}

// Show Notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add styles
    Object.assign(notification.style, {
        position: 'fixed',
        top: '2rem',
        right: '2rem',
        padding: '1rem 1.5rem',
        borderRadius: '12px',
        background: type === 'success' ? 'linear-gradient(135deg, #10b981, #059669)' :
            type === 'error' ? 'linear-gradient(135deg, #ef4444, #dc2626)' :
                'linear-gradient(135deg, #6366f1, #8b5cf6)',
        color: 'white',
        fontWeight: '500',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        zIndex: '1000',
        animation: 'slideIn 0.3s ease',
        maxWidth: '400px'
    });

    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
