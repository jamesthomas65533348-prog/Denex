const _supa = supabase.createClient(DENEX_CONFIG.SB_URL, DENEX_CONFIG.SB_KEY);
let me = JSON.parse(localStorage.getItem('denex_user'));
let originalData = {};
let currentAvatarUrl = null;
let rotation = 0;
let activeFile = null;

// --- 1. INSTANT CACHE LOAD ---
function loadCachedProfile() {
    if (!me) return;
    
    document.getElementById('firstName').value = me.first_name || "";
    document.getElementById('lastName').value = me.last_name || "";
    document.getElementById('username').value = me.username || "";
    document.getElementById('email').value = me.email || "";
    
    originalData = {
        first_name: me.first_name || "",
        last_name: me.last_name || "",
        username: me.username || ""
    };

    const avatarDiv = document.getElementById('profileAvatar');
    if (me.avatar_url) {
        currentAvatarUrl = me.avatar_url;
        avatarDiv.innerHTML = `<img src="${me.avatar_url}" style="width:100%; height:100%; object-fit:cover;">`;
        document.getElementById('btnDeletePhoto').style.display = 'flex';
    } else {
        avatarDiv.innerText = me.first_name ? me.first_name[0].toUpperCase() : '?';
    }

    applyPremiumDesign(me.is_premium);
}

// --- PREMIUM UI LOGIC ---
function applyPremiumDesign(isPremium) {
    const isPrem = !!isPremium;
    document.body.classList.toggle('premium-mode-active', isPrem);
    document.getElementById('premiumHeader').style.display = isPrem ? 'block' : 'none';
    document.getElementById('standardHeader').style.display = isPrem ? 'none' : 'flex';
    document.getElementById('premiumWatermark').style.display = isPrem ? 'flex' : 'none';
    document.getElementById('photoVerifiedBadge').style.display = isPrem ? 'flex' : 'none';
}

function checkChanges() {
    const currentName = document.getElementById('firstName').value.trim();
    const currentLast = document.getElementById('lastName').value.trim();
    const currentUser = document.getElementById('username').value.trim().replace('@','');

    const hasChanged = (currentName !== originalData.first_name) || 
                       (currentLast !== originalData.last_name) || 
                       (currentUser !== originalData.username);
    
    const btn = document.getElementById('saveBtn');
    if(hasChanged) {
        btn.style.display = 'block';
        setTimeout(() => btn.classList.add('visible'), 10);
    } else {
        btn.classList.remove('visible');
        setTimeout(() => { if(!btn.classList.contains('visible')) btn.style.display = 'none'; }, 400);
    }
}

// --- DENEX EDITOR LOGIC (FIXED SCALING) ---
function openEditor(input) {
    const file = input.files[0];
    if(!file) return;
    activeFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            rotation = 0;
            window.activeImg = img;
            drawCanvas(img);
            document.getElementById('editorOverlay').style.display = 'flex';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function drawCanvas(img) {
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 600;
    
    ctx.clearRect(0,0,600,600);
    ctx.save();
    ctx.translate(300, 300);
    ctx.rotate(rotation * Math.PI / 180);
    
    // Logic to make sure the image fills the crop area properly
    const ratio = Math.max(600 / img.width, 600 / img.height);
    const nw = img.width * ratio;
    const nh = img.height * ratio;
    
    ctx.drawImage(img, -nw/2, -nh/2, nw, nh);
    ctx.restore();
}

function rotateImage() {
    rotation += 90;
    drawCanvas(window.activeImg);
}

function closeEditor() {
    document.getElementById('editorOverlay').style.display = 'none';
    document.getElementById('avatarInput').value = "";
    rotation = 0;
}

async function finalUpload() {
    const canvas = document.getElementById('previewCanvas');
    canvas.toBlob(async (blob) => {
        toggleLoading(true);
        const fileName = `${me.id}/avatar_${Date.now()}.jpg`;
        const { data, error } = await _supa.storage.from('avatars').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
        
        if(data) {
            const { data: { publicUrl } } = _supa.storage.from('avatars').getPublicUrl(fileName);
            await _supa.from('denex_profiles').update({ avatar_url: publicUrl }).eq('id', me.id);
            
            me.avatar_url = publicUrl;
            localStorage.setItem('denex_user', JSON.stringify(me));
            location.reload();
        } else {
            showPopup("Error", error.message);
        }
        toggleLoading(false);
    }, 'image/jpeg', 0.8);
}

// --- POPUP LOGIC ---
function showPopup(title, text, type = 'alert', onConfirm = null) {
    const overlay = document.getElementById('denexPopupOverlay');
    document.getElementById('popupTitle').innerText = title;
    document.getElementById('popupMsg').innerText = text;
    const actions = document.getElementById('popupActions');
    actions.innerHTML = '';

    if (type === 'confirm') {
        const btnCancel = document.createElement('button');
        btnCancel.className = 'popup-btn btn-cancel';
        btnCancel.innerText = 'Cancel';
        btnCancel.onclick = () => overlay.classList.remove('active');
        
        const btnConfirm = document.createElement('button');
        btnConfirm.className = 'popup-btn btn-confirm';
        btnConfirm.innerText = 'Confirm';
        btnConfirm.onclick = () => { overlay.classList.remove('active'); if(onConfirm) onConfirm(); };
        actions.append(btnCancel, btnConfirm);
    } else {
        const btnOk = document.createElement('button');
        btnOk.className = 'popup-btn btn-confirm';
        btnOk.innerText = 'OK';
        btnOk.onclick = () => overlay.classList.remove('active');
        actions.append(btnOk);
    }
    overlay.classList.add('active');
}

// --- PROFILE REFRESH ---
async function loadProfile() {
    if(!me) return location.href = 'login.html';
    
    loadCachedProfile();

    const { data: user } = await _supa.from('denex_profiles').select('*').eq('id', me.id).single();

    if(user) {
        localStorage.setItem('denex_user', JSON.stringify(user));
        me = user;
        applyPremiumDesign(user.is_premium);

        originalData = {
            first_name: user.first_name || "",
            last_name: user.last_name || "",
            username: user.username || ""
        };

        document.getElementById('firstName').value = originalData.first_name;
        document.getElementById('lastName').value = originalData.last_name;
        document.getElementById('username').value = originalData.username;
        document.getElementById('email').value = user.email || "";
        
        const avatarDiv = document.getElementById('profileAvatar');
        const deleteBtn = document.getElementById('btnDeletePhoto');
        
        if(user.avatar_url) {
            currentAvatarUrl = user.avatar_url;
            avatarDiv.innerHTML = `<img src="${user.avatar_url}" style="width:100%; height:100%; object-fit:cover;">`;
            deleteBtn.style.display = 'flex';
        } else {
            currentAvatarUrl = null;
            avatarDiv.innerHTML = ""; 
            avatarDiv.innerText = user.first_name ? user.first_name[0].toUpperCase() : '?';
            deleteBtn.style.display = 'none';
        }
        loadBlocks();
    }
}

function askDeletePhoto() {
    showPopup("Remove Photo", "Are you sure you want to delete your profile picture?", "confirm", deleteAvatar);
}

async function deleteAvatar() {
    toggleLoading(true);
    const { error: dbError } = await _supa.from('denex_profiles').update({ avatar_url: null }).eq('id', me.id);
    if(!dbError) {
        if(currentAvatarUrl) {
            const path = currentAvatarUrl.split('/public/avatars/')[1];
            if(path) await _supa.storage.from('avatars').remove([path]);
        }
        me.avatar_url = null;
        localStorage.setItem('denex_user', JSON.stringify(me));
        location.reload();
    }
    toggleLoading(false);
}

async function updateProfile() {
    const first_name = document.getElementById('firstName').value.trim();
    const last_name = document.getElementById('lastName').value.trim();
    const username = document.getElementById('username').value.trim().replace('@','').toLowerCase();

    if(!first_name || !last_name) return showPopup("Incomplete", "Names cannot be empty.");

    toggleLoading(true);
    const { error } = await _supa.from('denex_profiles').update({ first_name, last_name, username }).eq('id', me.id);
    toggleLoading(false);
    
    if(!error) {
        showPopup("Saved", "Profile updated successfully!");
        me.first_name = first_name;
        me.last_name = last_name;
        me.username = username;
        localStorage.setItem('denex_user', JSON.stringify(me));
        originalData = { first_name, last_name, username }; 
        checkChanges(); 
    } else {
        showPopup("Error", "Could not update profile. Username might be taken.");
    }
}

// --- BLOCKED USERS (FIXED RHYMING DESIGN) ---
async function loadBlocks() {
    const { data: blocks } = await _supa.from('denex_blocks')
        .select('id, blocked_id, denex_profiles!blocked_id(first_name, last_name)')
        .eq('blocker_id', me.id);

    const container = document.getElementById('blockList');
    container.innerHTML = (blocks && blocks.length > 0) ? '' : '<p style="padding:20px; text-align:center; color:var(--denex-gray); font-size: 14px;">No blocked users</p>';

    if(blocks) {
        blocks.forEach((b, i) => {
            const p = b.denex_profiles;
            const div = document.createElement('div');
            div.className = 'blocked-user';
            div.innerHTML = `
                <div class="blocked-content">
                    <div class="blocked-avatar-sm">${p.first_name[0].toUpperCase()}</div>
                    <div style="font-weight:700; color:var(--denex-dark); font-size:14px;">${p.first_name} ${p.last_name}</div>
                </div>
                <button class="unblock-btn">Unblock</button>
            `;
            div.onclick = () => showPopup("Unblock", `Do you want to unblock ${p.first_name}?`, "confirm", () => unblock(b.id));
            container.appendChild(div);
        });
    }
}

async function unblock(id) {
    await _supa.from('denex_blocks').delete().eq('id', id);
    loadBlocks();
}

function toggleLoading(show) { document.getElementById('loading').style.display = show ? 'flex' : 'none'; }

loadProfile();
