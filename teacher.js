const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('teacher-login-form');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');

// Check session on load
checkSession();

async function checkSession() {
    try {
        const res = await fetch('/api/session');
        if (res.ok) {
            const data = await res.json();
            if (data.user && data.user.role === 'teacher') {
                showDashboard(data.session);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    setLoading(true);
    loginError.style.display = 'none';

    try {
        const res = await fetch('/api/teacher/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            showDashboard(data.session);
        } else {
            loginError.textContent = data.message || 'Login failed';
            loginError.style.display = 'block';
        }
    } catch (error) {
        loginError.textContent = 'Connection error';
        loginError.style.display = 'block';
    } finally {
        setLoading(false);
    }
});

document.getElementById('end-session-btn').addEventListener('click', async () => {
    if (!confirm('Are you sure you want to end this session? All students will be disconnected.')) return;

    try {
        await fetch('/api/session/end', { method: 'POST' });
        window.location.reload();
    } catch (e) {
        alert('Failed to end session');
    }
});

document.getElementById('refresh-btn').addEventListener('click', loadActivity);

function setLoading(isLoading) {
    if (isLoading) {
        loginBtn.classList.add('loading');
    } else {
        loginBtn.classList.remove('loading');
    }
}

function showDashboard(session) {
    loginSection.style.display = 'none';
    dashboardSection.style.display = 'block';
    document.getElementById('classroom-code-display').textContent = session.classroomCode;

    loadActivity();
    // Poll every 10 seconds
    setInterval(loadActivity, 10000);
}

async function loadActivity() {
    try {
        const res = await fetch('/api/teacher/activity');
        if (!res.ok) return;

        const data = await res.json();
        renderStudents(data.students);
        renderSubmissions(data.submissions);
    } catch (e) {
        console.error('Failed to load activity', e);
    }
}

function renderStudents(students) {
    const container = document.getElementById('students-container');
    document.getElementById('student-count').textContent = students.length;

    if (students.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.875rem;">No students joined yet.</p>';
        return;
    }

    container.innerHTML = students.map(s => `
        <div class="student-item">
            <span style="font-weight: 500;">${escapeHtml(s.username)}</span>
            <span class="status-badge">Active</span>
        </div>
    `).join('');
}

function renderSubmissions(submissions) {
    const container = document.getElementById('activity-feed');

    if (submissions.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted);">No videos generated yet.</p>';
        return;
    }

    container.innerHTML = submissions.map(sub => {
        let mediaContent = '';
        if (sub.status === 'SUCCESS' && sub.videoUrl) {
            mediaContent = `<video src="${sub.videoUrl}" controls></video>`;
        } else if (sub.status === 'PENDING') {
            mediaContent = `<div style="color: white;">Generating...</div>`;
        } else {
            mediaContent = `<div style="color: #fca5a5;">Failed</div>`;
        }

        return `
            <div class="submission-card">
                <div class="submission-media">
                    ${mediaContent}
                </div>
                <div class="submission-info">
                    <div class="submission-meta">
                        <span>${escapeHtml(sub.student?.username || 'Unknown')}</span>
                        <span>${new Date(sub.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div class="submission-prompt" title="${escapeHtml(sub.prompt)}">
                        ${escapeHtml(sub.prompt)}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
