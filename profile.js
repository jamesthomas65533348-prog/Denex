const _supa = supabase.createClient(DENEX_CONFIG.SB_URL, DENEX_CONFIG.SB_KEY);
let me = JSON.parse(localStorage.getItem('denex_user'));
let originalData = {};
let currentAvatarUrl = null;
let rotation = 0;
let activeFile = null;

function checkChanges() {
    const currentName = document.getElementById('firstName').value.trim();
    const currentLast = document.getElementById('lastName').value.trim();
    const currentUser = document.getElementById('username').value.trim().replace('@','');

    const hasChanged = (currentName !== originalData.first_name) || 
                       (currentLast !== originalData.last_name) || 
                       (currentUser !== originalData.username);
    
    const btn = document.getElementById('saveBtn');
    if(hasChanged) {
        btn.classList.add('visible');
    } else {
        btn.classList.remove('visible');
    }
}

// --- DENEX EDITOR LOGIC ---
function openEditor(input) {
    const file = input.files[0];
    if(!file) return;
    activeFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.getElementById('previewCanvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 600;
            canvas.height = 600;
            drawCanvas(img);
            document.getElementById('editorOverlay').style.display = 'flex';
        };
        img.src = e.target.result;
        window.activeImg = img;
    };
    reader.readAsDataURL(file);
}

function drawCanvas(img) {
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,600,600);
    ctx.save();
    ctx.translate(300,300);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.drawImage(img, -300, -300, 600, 600);
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
            location.reload();
        } else {
            showPopup("Error", error.message);
        }
        toggleLoading(false);
    }, 'image/jpeg', 0.8);
}

function showPopup(title, text, type = 'alert', onConfirm = null) {
    const overlay = document.getElementById('modalOverlay');
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalText').innerText = text;
    const actions = document.getElementById('modalActions');
    actions.innerHTML = '';

    if (type === 'confirm') {
        const btnCancel = document.createElement('button');
        btnCancel.className = 'modal-btn btn-cancel';
        btnCancel.innerText = 'Cancel';
        btnCancel.onclick = () => overlay.style.display = 'none';
        
        const btnConfirm = document.createElement('button');
        btnConfirm.className = 'modal-btn btn-confirm';
        btnConfirm.innerText = 'Confirm';
        btnConfirm.onclick = () => { overlay.style.display = 'none'; if(onConfirm) onConfirm(); };
        actions.append(btnCancel, btnConfirm);
    } else {
        const btnOk = document.createElement('button');
        btnOk.className = 'modal-btn btn-confirm';
        btnOk.innerText = 'OK';
        btnOk.onclick = () => overlay.style.display = 'none';
        actions.append(btnOk);
    }
    overlay.style.display = 'flex';
}

async function loadProfile() {
    if(!me) return location.href = 'login.html';
    toggleLoading(true);
    const { data: user } = await _supa.from('denex_profiles').select('*').eq('id', me.id).single();
    toggleLoading(false);

    if(user) {
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
        localStorage.setItem('denex_user', JSON.stringify(me));
        originalData = { first_name, last_name, username }; // Update baseline
        checkChanges(); // Hide button
    } else {
        showPopup("Error", "Could not update profile. Username might be taken.");
    }
}

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
            div.style.animationDelay = `${(i * 0.05)}s`;
            div.innerHTML = `
                <div class="blocked-content">
                    <div class="avatar-main" style="width:40px; height:40px; font-size:16px;">${p.first_name[0]}</div>
                    <div style="font-weight:600; color: #1a1a1a;">${p.first_name} ${p.last_name}</div>
                </div>
                <i class="fa-solid fa-unlock" style="color:var(--denex-blue); font-size: 18px;"></i>
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
