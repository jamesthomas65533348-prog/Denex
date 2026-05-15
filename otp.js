const toast = document.getElementById('denexToast');
let timeLeft = 180; 

const userEmail = localStorage.getItem('reg_email') || 'your email';
document.getElementById('target-email').innerText = userEmail;

function showToast(msg, error = false) {
    toast.innerText = msg;
    toast.style.background = error ? "rgba(255, 71, 87, 0.92)" : "rgba(59, 153, 255, 0.92)";
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

const boxes = document.querySelectorAll('.otp-box');
boxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
        if (e.target.value.length > 1) e.target.value = e.target.value.slice(0, 1);
        if (e.target.value.length === 1 && idx < boxes.length - 1) {
            boxes[idx + 1].focus();
        }
    });

    box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
            boxes[idx - 1].focus();
        }
    });
});

function startTimer() {
    const timerEl = document.getElementById('timer');
    const wrap = document.getElementById('timer-wrap');
    const btn = document.getElementById('resend-btn');

    const countdown = setInterval(() => {
        let m = Math.floor(timeLeft / 60);
        let s = timeLeft % 60;
        timerEl.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        if (timeLeft <= 0) {
            clearInterval(countdown);
            wrap.style.display = 'none';
            btn.style.display = 'inline';
        }
        timeLeft--;
    }, 1000);
}

async function resendCode() {
    if (typeof DENEX_UTILS === 'undefined') return;
    const btn = document.getElementById('resend-btn');
    const wrap = document.getElementById('timer-wrap');
    const newOtp = DENEX_UTILS.generateOTP();
    localStorage.setItem('denex_otp', newOtp);
    showToast("Sending new code...", false);
    try {
        await DENEX_UTILS.sendEmailOTP(userEmail, newOtp);
        showToast("Code resent successfully!");
        timeLeft = 180;
        btn.style.display = 'none';
        wrap.style.display = 'inline';
        startTimer();
    } catch (e) {
        showToast("Connection Error.", true);
    }
}

function checkOTP() {
    let entered = "";
    boxes.forEach(b => entered += b.value);
    const stored = localStorage.getItem('denex_otp');
    if (entered === String(stored)) {
        showToast("Verified!", false);
        setTimeout(() => {
            location.href = 'register.html?status=verified';
        }, 1500);
    } else {
        showToast("Incorrect code.", true);
        boxes.forEach(b => b.value = "");
        boxes[0].focus();
    }
}

window.onload = startTimer;
