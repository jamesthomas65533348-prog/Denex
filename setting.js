function showInfo(title, text) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalText').innerText = text;
    document.getElementById('modalOverlay').style.display = 'flex';
}

function closePopup() {
    document.getElementById('modalOverlay').style.display = 'none';
}

function copyEmail(email) {
    navigator.clipboard.writeText(email).then(() => {
        const btn = document.getElementById('copyBtn');
        const emailSpan = document.getElementById('emailText');
        
        // Visual feedback "Telegram-style"
        const originalIcon = btn.className;
        const originalColor = emailSpan.style.color;
        
        btn.className = 'fa-solid fa-check copy-icon';
        btn.style.color = '#4cd137';
        emailSpan.style.color = '#4cd137';
        
        setTimeout(() => {
            btn.className = originalIcon;
            btn.style.color = '';
            emailSpan.style.color = originalColor;
        }, 2000);
    });
}
