/* LOGIC REMAINS COMPLETELY UNTOUCHED */
const toast = document.getElementById('denexToast');

let _supa;
function initSupabase() {
    if (typeof DENEX_CONFIG !== 'undefined') {
        _supa = supabase.createClient(DENEX_CONFIG.SB_URL, DENEX_CONFIG.SB_KEY);
    }
}
initSupabase();

function denexAlert(msg, isError = true) {
    toast.innerText = msg;
    toast.style.background = isError ? "rgba(255, 71, 87, 0.92)" : "rgba(59, 153, 255, 0.92)";
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function validatePass() {
    const passEl = document.getElementById('pass');
    const btn = document.getElementById('mainNextBtn');
    const val = passEl.value;

    if (val.length > 0 && (val.length < 6 || val.length > 10)) {
        passEl.style.borderColor = "var(--denex-red)";
        btn.setAttribute('pass-error', 'true');
    } else {
        passEl.style.borderColor = "#eee";
        btn.removeAttribute('pass-error');
    }
    checkInputs();
}

function checkInputs() {
    const f = document.getElementById('fname').value;
    const l = document.getElementById('lname').value;
    const p = document.getElementById('pass').value;
    const d = document.getElementById('dob').value;
    const btn = document.getElementById('mainNextBtn');
    
    const isAllFilled = f && l && p && d;
    const passValid = p.length >= 6 && p.length <= 10;
    const noErrors = !btn.getAttribute('age-error') && !btn.getAttribute('pass-error') && passValid;
    
    btn.disabled = !(isAllFilled && noErrors);
}

function calculateAge() {
    const dob = document.getElementById('dob').value;
    const badge = document.getElementById('ageBadge');
    const btn = document.getElementById('mainNextBtn');
    if(!dob) return;
    const age = new Date().getFullYear() - new Date(dob).getFullYear();
    badge.innerText = age + " yrs";
    badge.style.display = "block";

    if(age < 17) {
        btn.setAttribute('age-error', 'true');
        denexAlert("You must be at least 17 years old.");
        badge.style.background = "var(--denex-red)";
    } else {
        btn.removeAttribute('age-error');
        badge.style.background = "var(--denex-blue)";
    }
    checkInputs();
}

function openStep(stepId) {
    document.getElementById('denexModal').style.display = 'flex';
    document.querySelectorAll('.step-box').forEach(s => s.classList.remove('active'));
    document.getElementById(stepId).classList.add('active');
    
    if(stepId === 'profile_step') {
        document.getElementById('mainView').style.display = 'none';
    }
}

function closeModal() { 
    document.getElementById('denexModal').style.removeProperty('display');
    document.getElementById('mainView').style.display = 'flex';
}

async function handleSendOTP() {
    const email = document.getElementById('userEmail').value;
    const sendBtn = document.getElementById('sendBtn');
    if(!email.includes('@') || !email.includes('.')) return denexAlert("Invalid email address.");
    
    sendBtn.disabled = true;
    sendBtn.innerText = "Checking...";
    try {
        const { data: existingUser } = await _supa.from('denex_profiles').select('email').eq('email', email).maybeSingle();
        if (existingUser) {
            denexAlert("Email already exists.");
            sendBtn.disabled = false;
            sendBtn.innerText = "Get Code";
            return;
        }
        localStorage.setItem('reg_fname', document.getElementById('fname').value);
        localStorage.setItem('reg_lname', document.getElementById('lname').value);
        localStorage.setItem('reg_pass', document.getElementById('pass').value);
        localStorage.setItem('reg_dob', document.getElementById('dob').value);
        localStorage.setItem('reg_email', email);
        const otp = DENEX_UTILS.generateOTP();
        localStorage.setItem('denex_otp', otp);
        await DENEX_UTILS.sendEmailOTP(email, otp);
        denexAlert("Code sent!", false);
        setTimeout(() => { location.href = 'otp.html'; }, 1000);
    } catch (e) {
        denexAlert("Connection Error.");
        sendBtn.disabled = false;
    }
}

async function saveToDatabase() {
    const finishBtn = document.getElementById('finishBtn');
    const usernameInput = document.getElementById('uname').value.trim().toLowerCase();
    finishBtn.disabled = true;
    finishBtn.innerText = "Processing...";
    if(usernameInput) {
        const { data: taken } = await _supa.from('denex_profiles').select('username').eq('username', usernameInput).maybeSingle();
        if(taken) {
            denexAlert("Username taken!");
            finishBtn.disabled = false;
            finishBtn.innerText = "Finish Registration";
            return;
        }
    }
    const finalData = {
        first_name: localStorage.getItem('reg_fname'),
        last_name: localStorage.getItem('reg_lname'),
        email: localStorage.getItem('reg_email'),
        password: localStorage.getItem('reg_pass'),
        dob: localStorage.getItem('reg_dob'),
        username: usernameInput || null,
        is_verified: true
    };
    try {
        const file = document.getElementById('pic').files[0];
        if (file) {
            const fileExt = file.name.split('.').pop();
            const fileName = `avatar_${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;
            await _supa.storage.from('avatars').upload(filePath, file);
            const { data: urlData } = _supa.storage.from('avatars').getPublicUrl(filePath);
            finalData.avatar_url = urlData.publicUrl;
        }
        const { error: insertError } = await _supa.from('denex_profiles').insert([finalData]);
        if (insertError) throw insertError;
        denexAlert("Welcome to Denex!", false);
        setTimeout(() => { location.href = 'index.html'; }, 2000);
    } catch (err) {
        denexAlert("Signup failed.");
        finishBtn.disabled = false;
    }
}

window.onload = () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('status') === 'verified') {
        document.getElementById('fname').value = localStorage.getItem('reg_fname') || '';
        document.getElementById('lname').value = localStorage.getItem('reg_lname') || '';
        document.getElementById('pass').value = localStorage.getItem('reg_pass') || '';
        document.getElementById('dob').value = localStorage.getItem('reg_dob') || '';
        document.getElementById('userEmail').value = localStorage.getItem('reg_email') || '';
        calculateAge();
        validatePass();
        checkInputs();
        openStep('profile_step');
    }
};
