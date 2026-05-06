const _supa = supabase.createClient(DENEX_CONFIG.SB_URL, DENEX_CONFIG.SB_KEY);
const me = JSON.parse(localStorage.getItem('denex_user'));
const urlParams = new URLSearchParams(window.location.search);
const otherUserId = urlParams.get('chat_id');
const confirmModal = document.getElementById('confirmModal');

let otherUser = null, iBlockedThem = false, pendingFile = null;
let replyingToId = null, selectedMsgId = null, selectedMsgText = "", pressTimer, touchStart = 0;
let typingTimeout; // For indicator

async function initChat() {
    if (!me || !otherUserId) return location.href = 'index.html';

    const { data: blocks } = await _supa.from('denex_blocks')
        .select('*')
        .or(`and(blocker_id.eq.${me.id},blocked_id.eq.${otherUserId}),and(blocker_id.eq.${otherUserId},blocked_id.eq.${me.id})`);
    
    const theyBlockedMe = blocks?.find(b => b.blocker_id == otherUserId);
    if (theyBlockedMe) {
        denexAlert("User Error", "User does not exist", () => {
            location.href = 'index.html';
        });
        return;
    }

    iBlockedThem = blocks?.some(b => b.blocker_id == me.id);

    const { data: profile } = await _supa.from('denex_profiles').select('*').eq('id', otherUserId).single();
    if (!profile) return location.href = 'index.html';
    
    otherUser = profile;
    document.getElementById('headerName').innerText = profile.first_name;
    updateAvatar(document.getElementById('headerAvatar'), profile);
    
    markAsRead();
    await loadMessages(); 
    subscribeToMessages();
    checkUserStatus();
    updateMyStatus();
    
    setInterval(backgroundFetchNewMessages, 3000);
    setInterval(checkUserStatus, 10000);
    setInterval(updateMyStatus, 30000);

    // TYPING SENDER LOGIC
    document.getElementById('msgInput').addEventListener('input', () => {
        if (window.chatChannel) {
            window.chatChannel.send({
                type: 'broadcast',
                event: 'typing',
                payload: { sender_id: me.id }
            });
        }
    });
}

function createBurst(el) {
    const rect = el.getBoundingClientRect();
    const count = 30;
    const color = window.getComputedStyle(el).backgroundColor;
    
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.backgroundColor = color;
        p.style.width = Math.random() * 8 + 'px';
        p.style.height = p.style.width;
        p.style.left = (rect.left + rect.width / 2) + 'px';
        p.style.top = (rect.top + rect.height / 2) + 'px';
        
        document.body.appendChild(p);
        
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 150 + 50;
        const vx = Math.cos(angle) * speed;
        const vy = Math.sin(angle) * speed;
        
        p.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${vx}px, ${vy}px) scale(0)`, opacity: 0 }
        ], {
            duration: 600 + Math.random() * 400,
            easing: 'cubic-bezier(0, .9, .57, 1)'
        }).onfinish = () => p.remove();
    }
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
}

async function backgroundFetchNewMessages() {
    const { data } = await _supa.from('denex_messages')
        .select('*, reply:reply_to_id(content, sender_id)')
        .or(`and(sender_id.eq.${me.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${me.id})`)
        .order('created_at', { ascending: true });

    if(data) {
        data.forEach(m => {
            const msgEl = document.getElementById(`msg-${m.id}`);
            
            if (msgEl) {
                if (m.is_read) {
                    const icon = msgEl.querySelector('.read-icon');
                    if (icon && icon.classList.contains('fa-check')) {
                        icon.classList.replace('fa-check', 'fa-check-double');
                        icon.style.color = "#fff"; 
                        icon.style.opacity = "1";
                    }
                }
            } else {
                if(m.reply) { m.reply_sender_id = m.reply.sender_id; m.reply_content = m.reply.content; }
                appendSingleMessage(m);
            }
        });
    }
}

async function markAsRead() {
    if (!me || !otherUserId) return;
    await _supa.from('denex_messages')
        .update({ is_read: true })
        .eq('sender_id', otherUserId)
        .eq('receiver_id', me.id)
        .eq('is_read', false);
}

async function updateMyStatus() {
    if (!me) return;
    await _supa.from('denex_profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', me.id);
}

function appendSingleMessage(m) {
    if (document.getElementById(`msg-${m.id}`)) return; 

    const chatBox = document.getElementById('chatBox');
    const isMe = m.sender_id === me.id;
    const div = document.createElement('div');
    div.className = `msg ${isMe ? 'sent' : 'received'}`;
    div.id = `msg-${m.id}`;
    
    let html = '';
    if (m.reply || (m.reply_to_id && m.reply_content)) {
        const rName = m.reply_sender_id === me.id ? 'You' : otherUser.first_name;
        const rText = m.reply_content || (m.reply ? m.reply.content : '');
        html += `<div class="reply-ref" onclick="scrollToMsg('${m.reply_to_id}')">
            <small style="font-weight:bold">${rName}:</small><br>
            ${rText ? rText.substring(0, 40) : '📷 Image'}
        </div>`;
    }
    
    if (m.image_url) html += `<img src="${m.image_url}" class="msg-img" onclick="openImageOverlay('${m.image_url}')">`;
    if (m.content) html += `<span>${m.content}</span>`;
    
    const checkIcon = m.is_read ? 'fa-check-double' : 'fa-check';
    const checkStyle = m.is_read ? 'color: #fff' : 'opacity: 0.6';
    html += `<div class="msg-meta"><i class="fa-solid ${checkIcon} read-icon" style="${isMe ? checkStyle : ''}"></i></div>`;
    div.innerHTML = html;

    // --- SMOOTH SWIPE REPLY LOGIC ---
    let startX = 0;
    div.ontouchstart = (e) => {
        startX = e.touches[0].clientX;
        div.style.transition = 'none';
        startPress(m.id, isMe, m.content);
    };

    div.ontouchmove = (e) => {
        let diff = e.touches[0].clientX - startX;
        if (diff > 0 && diff < 80) {
            div.style.transform = `translateX(${diff}px)`;
        }
    };

    div.ontouchend = (e) => {
        clearTimeout(pressTimer);
        let diff = e.changedTouches[0].clientX - startX;
        div.style.transition = 'transform 0.3s var(--spring)';
        div.style.transform = `translateX(0)`;
        if (diff > 60) triggerReply(m.id, m.content);
    };

    div.onmousedown = () => startPress(m.id, isMe, m.content);
    div.onmouseup = () => clearTimeout(pressTimer);

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function loadMessages() {
    const { data } = await _supa.from('denex_messages')
        .select('*, reply:reply_to_id(content, sender_id)')
        .or(`and(sender_id.eq.${me.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${me.id})`)
        .order('created_at', { ascending: true });

    document.getElementById('chatBox').innerHTML = '';
    if(data) data.forEach(m => {
        if(m.reply) { m.reply_sender_id = m.reply.sender_id; m.reply_content = m.reply.content; }
        appendSingleMessage(m);
    });
}

function startPress(id, isMe, text) {
    pressTimer = setTimeout(() => {
        selectedMsgId = id; selectedMsgText = text;
        document.getElementById('actionMenu').style.display = 'flex';
        document.getElementById('deleteOption').style.display = isMe ? 'flex' : 'none';
    }, 600);
}

function closeConfirmModal() { confirmModal.classList.remove('active'); }

async function confirmDelete() {
    document.getElementById('modalTitle').innerText = "Delete Message?";
    document.getElementById('modalMsg').innerText = "This action cannot be undone.";
    confirmModal.classList.add('active');
    document.getElementById('modalConfirmBtn').onclick = async () => {
        await _supa.from('denex_messages').delete().eq('id', selectedMsgId);
        closeConfirmModal();
        closeMenu();
        const el = document.getElementById(`msg-${selectedMsgId}`);
        if(el) createBurst(el);
    };
}

function triggerReply(id, text) {
    replyingToId = id;
    selectedMsgText = text || "Image";
    const preview = document.getElementById('replyPreview');
    preview.style.display = 'block';
    document.getElementById('replyText').innerText = "Replying to: " + (selectedMsgText.length > 30 ? selectedMsgText.substring(0, 30) + "..." : selectedMsgText);
}

async function handleSend() {
    const inputWrap = document.getElementById('mainInputWrap');
    const content = document.getElementById('msgInput').value.trim();
    
    if (!content && !pendingFile) {
        inputWrap.classList.add('vibrate-error');
        setTimeout(() => inputWrap.classList.remove('vibrate-error'), 300);
        return;
    }
    
    if (iBlockedThem) { alert("Unblock user to send messages."); return; }

    const tempId = 'temp-' + Date.now();
    const tempMsg = {
        id: tempId, sender_id: me.id, content: content, 
        image_url: pendingFile ? URL.createObjectURL(pendingFile) : null,
        reply_to_id: replyingToId, reply_content: selectedMsgText, is_read: false
    };
    appendSingleMessage(tempMsg);

    const savedContent = content;
    const savedFile = pendingFile;
    const savedReplyId = replyingToId;

    document.getElementById('msgInput').value = '';
    cancelImg(); cancelReply();

    let uploadedUrl = null;
    if (savedFile) {
        const fileName = `${me.id}/${Date.now()}_chat.png`;
        const { data } = await _supa.storage.from('denex_chat_media').upload(fileName, savedFile);
        if (data) uploadedUrl = _supa.storage.from('denex_chat_media').getPublicUrl(fileName).data.publicUrl;
    }

    const { data: inserted } = await _supa.from('denex_messages').insert({ 
        sender_id: me.id, receiver_id: otherUserId, 
        content: savedContent, image_url: uploadedUrl, reply_to_id: savedReplyId,
        is_read: false 
    }).select().single();

    const tempEl = document.getElementById(`msg-${tempId}`);
    if(tempEl && inserted) tempEl.id = `msg-${inserted.id}`;
}

function scrollToMsg(id) { 
    const el = document.getElementById(`msg-${id}`); 
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); 
}

function openImageOverlay(url) {
    document.getElementById('fullImg').src = url;
    document.getElementById('imageOverlay').style.display = 'flex';
}

function closeImageOverlay() { document.getElementById('imageOverlay').style.display = 'none'; }
function cancelReply() { replyingToId = null; selectedMsgText = ""; document.getElementById('replyPreview').style.display = 'none'; }
function handleReplyFromMenu() { triggerReply(selectedMsgId, selectedMsgText); closeMenu(); }
function closeMenu() { document.getElementById('actionMenu').style.display = 'none'; }
function react(emoji) { document.getElementById('msgInput').value += emoji; closeMenu(); }

function showProfile() {
    if(!otherUser) return;
    document.getElementById('modalFullName').innerText = `${otherUser.first_name} ${otherUser.last_name}`;
    document.getElementById('modalUsername').innerText = `@${otherUser.username}`;
    
    const mAvatar = document.getElementById('modalAvatar');
    if (otherUser.avatar_url) {
        mAvatar.innerHTML = `<img src="${otherUser.avatar_url}">`;
    } else {
        mAvatar.innerText = otherUser.first_name[0].toUpperCase();
    }

    const bBtn = document.getElementById('blockBtn');
    if (iBlockedThem) {
        bBtn.className = "block-btn btn-gray";
        bBtn.innerHTML = `<i class="fa-solid fa-rotate-left"></i> <span>Unblock User</span>`;
    } else {
        bBtn.className = "block-btn btn-red";
        bBtn.innerHTML = `<i class="fa-solid fa-ban"></i> <span>Block User</span>`;
    }
    document.getElementById('profileModal').style.display = 'flex';
}

async function toggleBlock() {
    if (iBlockedThem) {
        await _supa.from('denex_blocks').delete().eq('blocker_id', me.id).eq('blocked_id', otherUserId);
        iBlockedThem = false;
        alert("User Unblocked");
        showProfile(); 
    } else {
        document.getElementById('modalTitle').innerText = "Block User?";
        document.getElementById('modalMsg').innerText = "You will no longer receive messages from them.";
        confirmModal.classList.add('active');
        document.getElementById('modalConfirmBtn').onclick = async () => {
            await _supa.from('denex_blocks').insert({ blocker_id: me.id, blocked_id: otherUserId });
            location.href = 'index.html';
        };
    }
}

function previewImage(input) {
    if (input.files && input.files[0]) {
        pendingFile = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('previewImg').src = e.target.result;
            document.getElementById('imgPreviewBar').style.display = 'flex';
        };
        reader.readAsDataURL(pendingFile);
    }
}
function cancelImg() { pendingFile = null; document.getElementById('imgPreviewBar').style.display = 'none'; document.getElementById('imageInput').value = ''; }
function closeProfile() { document.getElementById('profileModal').style.display = 'none'; }
function updateAvatar(element, user) {
    if (user.avatar_url) element.innerHTML = `<img src="${user.avatar_url}"><div class="status-dot" id="onlineDot"></div>`;
    else { 
        element.innerText = user.first_name ? user.first_name[0].toUpperCase() : '?'; 
        element.innerHTML += `<div class="status-dot" id="onlineDot"></div>`; 
    }
}
async function checkUserStatus() {
    const { data } = await _supa.from('denex_profiles').select('last_login').eq('id', otherUserId).single();
    if (data?.last_login) {
        const isOnline = (new Date() - new Date(data.last_login)) / 1000 / 60 < 2;
        document.getElementById('onlineDot').className = `status-dot ${isOnline ? 'active' : ''}`;
        document.getElementById('statusText').innerText = isOnline ? "Active Now" : "Offline";
    }
}

function subscribeToMessages() {
    const channel = _supa.channel('chat-room')
        .on('postgres_changes', { event: '*', table: 'denex_messages' }, async (payload) => {
            if (payload.eventType === 'INSERT') {
                const m = payload.new;
                if ((m.sender_id === me.id && m.receiver_id === otherUserId) || 
                    (m.sender_id === otherUserId && m.receiver_id === me.id)) {
                    
                    if (m.receiver_id === me.id) markAsRead();
                    
                    if(m.reply_to_id) {
                        const { data: rMsg } = await _supa.from('denex_messages').select('content, sender_id').eq('id', m.reply_to_id).single();
                        if(rMsg) { m.reply_sender_id = rMsg.sender_id; m.reply_content = rMsg.content; }
                    }
                    appendSingleMessage(m);
                }
            }

            if (payload.eventType === 'UPDATE') {
                const m = payload.new;
                const msgEl = document.getElementById(`msg-${m.id}`);
                if (msgEl && m.is_read) {
                    const icon = msgEl.querySelector('.read-icon');
                    if (icon) {
                        icon.classList.replace('fa-check', 'fa-check-double');
                        icon.style.color = "#fff"; 
                        icon.style.opacity = "1";
                    }
                }
            }
            
            if (payload.eventType === 'DELETE') {
                const el = document.getElementById(`msg-${payload.old.id}`);
                if(el) createBurst(el);
            }
        })
        .on('postgres_changes', { event: 'UPDATE', table: 'denex_profiles', filter: `id=eq.${otherUserId}` }, () => {
            checkUserStatus();
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
            if (payload.payload.sender_id === otherUserId) {
                const indicator = document.getElementById('typingIndicator');
                indicator.style.display = 'block';
                document.getElementById('chatBox').scrollTop = document.getElementById('chatBox').scrollHeight;
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(() => {
                    indicator.style.display = 'none';
                }, 3000);
            }
        })
        .subscribe();

    window.chatChannel = channel;
}

window.onclick = (e) => {
    if(e.target == confirmModal) closeConfirmModal();
};

function denexAlert(title, msg, onConfirm) {
    document.getElementById('modalTitle').innerText = title;
    document.getElementById('modalMsg').innerText = msg;
    const btn = document.getElementById('modalConfirmBtn');
    btn.className = "btn-modal-confirm"; // Reset color to standard
    btn.innerText = "OK";
    // Hide Cancel button for alerts
    document.querySelector('.btn-modal-cancel').style.display = 'none';
    confirmModal.classList.add('active');
    btn.onclick = () => {
        closeConfirmModal();
        if(onConfirm) onConfirm();
    };
}

initChat();
