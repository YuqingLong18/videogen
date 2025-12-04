// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const POLL_INTERVAL = 3000; // Poll every 3 seconds
const MAX_POLL_ATTEMPTS = 200; // Max 10 minutes (200 * 3s)

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
    downloadBtn: document.getElementById('download-btn')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

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

    // Download
    elements.downloadBtn.addEventListener('click', downloadVideo);
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
        previewElement.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
        previewElement.classList.add('active');
    };
    reader.readAsDataURL(file);
}

// Convert image file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Handle Text to Video
async function handleText2Video(e) {
    e.preventDefault();

    try {
        const requestData = {
            model: elements.textModel.value,
            prompt: elements.textPrompt.value.trim(),
            duration: elements.textDuration.value,
            aspect_ratio: elements.textAspectRatio.value,
            cfg_scale: 0.5,
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

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to generate video');
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
            model: elements.imageModel.value,
            image: startFrameBase64,
            prompt: elements.imagePrompt.value.trim() || '',
            duration: elements.imageDuration.value,
            cfg_scale: 0.5,
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
        const response = await fetch(`${API_BASE_URL}/${type}/${currentTaskId}`, {
            method: 'GET'
        });

        if (!response.ok) {
            throw new Error('Failed to check task status');
        }

        const result = await response.json();
        const task = result.data.task_result;

        updateLoadingStatus(task.task_status, task.task_status_msg);

        if (task.task_status === 'succeed') {
            // Video generation complete
            const videoUrl = task.task_result.videos[0].url;
            displayVideo(videoUrl);
            setLoading(false);
            showNotification('Video generated successfully!', 'success');
        } else if (task.task_status === 'failed') {
            throw new Error(task.task_status_msg || 'Video generation failed');
        } else {
            // Still processing, continue polling
            pollAttempts++;
            if (pollAttempts >= MAX_POLL_ATTEMPTS) {
                throw new Error('Video generation timed out');
            }
            setTimeout(() => pollTaskStatus(type), POLL_INTERVAL);
        }

    } catch (error) {
        console.error('Polling error:', error);
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

    elements.loadingStatus.textContent = statusMap[status] || message || 'Processing...';
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
