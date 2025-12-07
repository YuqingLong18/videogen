document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const code = document.getElementById('classroom-code').value;
    const name = document.getElementById('nickname').value;
    const btn = document.getElementById('login-btn');
    const errorMsg = document.getElementById('error-msg');

    if (code.length !== 8) {
        showError('Classroom code must be 8 digits');
        return;
    }

    setLoading(true);
    errorMsg.style.display = 'none';

    try {
        const res = await fetch('/api/student/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classroomCode: code, name })
        });

        const data = await res.json();

        if (res.ok && data.success) {
            window.location.href = '/index.html';
        } else {
            showError(data.message || 'Login failed');
        }
    } catch (error) {
        showError('Connection error. Please try again.');
        console.error(error);
    } finally {
        setLoading(false);
    }

    function showError(msg) {
        errorMsg.textContent = msg;
        errorMsg.style.display = 'block';
    }

    function setLoading(isLoading) {
        if (isLoading) {
            btn.classList.add('loading');
        } else {
            btn.classList.remove('loading');
        }
    }
});
