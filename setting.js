let me = JSON.parse(localStorage.getItem('denex_user'));

document.addEventListener('DOMContentLoaded', () => {
    applyPremiumDesign();
});

function applyPremiumDesign() {
    if (!me) return;

    // Check if premium is active AND not expired
    const now = new Date();
    const expiry = me.premium_until ? new Date(me.premium_until) : null;
    const isActuallyPremium = !!me.is_premium && expiry && expiry > now;

    const standardHeader = document.getElementById('standardHeader');
    const premiumHeader = document.getElementById('premiumHeader');
    const premBtnLabel = document.getElementById('premBtnLabel');
    const premBtnSubtext = document.getElementById('premBtnSubtext');

    // Toggle Water Background
    document.body.classList.toggle('premium-mode-active', isActuallyPremium);

    if (isActuallyPremium) {
        if (standardHeader) standardHeader.style.display = 'none';
        if (premiumHeader) premiumHeader.style.display = 'block';
        
        // Update the Button Label
        if (premBtnLabel) premBtnLabel.innerText = "Premium Active";
        if (premBtnSubtext) {
            premBtnSubtext.innerText = `Membership expires ${expiry.toLocaleDateString()}`;
            premBtnSubtext.style.color = "var(--denex-blue)";
        }
    } else {
        if (standardHeader) standardHeader.style.display = 'flex';
        if (premiumHeader) premiumHeader.style.display = 'none';
        
        // Reset Button if not premium
        if (premBtnLabel) premBtnLabel.innerText = "Denex Premium";
        if (premBtnSubtext) {
            premBtnSubtext.innerText = "Unlock exclusive 99.9% iOS features";
            premBtnSubtext.style.color = "";
        }
    }
}

function showInfo(title, text) {
    const modal = document.getElementById('modalOverlay');
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalText').innerText = text;
    modal.style.display = 'flex';
}

function closePopup() {
    document.getElementById('modalOverlay').style.display = 'none';
}

function copyEmail(email) {
    navigator.clipboard.writeText(email).then(() => {
        const btn = document.getElementById('copyBtn');
        const emailText = document.getElementById('emailText');
        
        const originalIcon = btn.className;
        const originalText = emailText.innerText;

        btn.className = 'fa-solid fa-check';
        btn.style.color = '#4cd137';
        emailText.style.color = '#4cd137';
        emailText.innerText = 'Copied to Clipboard';

        setTimeout(() => {
            btn.className = originalIcon;
            btn.style.color = '';
            emailText.style.color = '';
            emailText.innerText = originalText;
        }, 2000);
    });
}
