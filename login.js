/* LOGIC REMAINS COMPLETELY UNTOUCHED */
const toast = document.getElementById('denexToast');

let _supa;
if (typeof DENEX_CONFIG !== 'undefined') {
    _supa = supabase.createClient(DENEX_CONFIG.SB_URL, DENEX_CONFIG.SB_KEY);
}

function denexAlert(msg, isError = true) {
    toast.innerText = msg;
    toast.style.background = isError ? "rgba(255, 71, 87, 0.92)" : "rgba(59, 153, 255, 0.92)";
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function togglePass() {
    const passInput = document.getElementById('loginPass');
    const eyeIcon = document.getElementById('eyeIcon');
    
    if (passInput.type === "password") {
        passInput.type = "text";
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
        eyeIcon.classList.add('active');
    } else {
        passInput.type = "password";
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
        eyeIcon.classList.remove('active');
    }
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPass').value;
    const btn = document.getElementById('loginBtn');

    if (!email || !pass) return denexAlert("Please fill in all fields.");

    btn.disabled = true;
    btn.innerText = "Verifying...";

    try {
        const { data: user, error } = await _supa
            .from('denex_profiles')
            .select('*')
            .eq('email', email)
            .eq('password', pass)
            .maybeSingle();

        if (error) throw error;

        if (user) {
            denexAlert("Login Successful!", false);
            localStorage.setItem('denex_user', JSON.stringify(user));
            setTimeout(() => { location.href = 'index.html'; }, 1500);
        } else {
            denexAlert("Invalid email or password.");
            btn.disabled = false;
            btn.innerText = "Login to Account";
        }

    } catch (err) {
        denexAlert("Connection failed.");
        btn.disabled = false;
        btn.innerText = "Login to Account";
    }
}
