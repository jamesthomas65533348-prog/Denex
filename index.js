/* LOGIC - PRESERVED EXACTLY AS PROVIDED */
const me = JSON.parse(localStorage.getItem('denex_user'));
const alertBox = document.getElementById('denexAlert');
const dropdown = document.getElementById('userDropdown');
const chatListDiv = document.getElementById('chatList');
const emptyState = document.getElementById('empty-state');
const confirmModal = document.getElementById('confirmModal');

let _supa;
let typingTimers = {}; 

if (typeof DENEX_CONFIG !== 'undefined') {
    _supa = supabase.createClient(DENEX_CONFIG.SB_URL, DENEX_CONFIG.SB_KEY);
}

async function initPage() {
    if (!me) {
        document.getElementById('appBody').classList.add('guest-mode');
        document.getElementById('topProfile').style.display = 'none';
        emptyState.style.display = 'none';
        return;
    }
    
    document.getElementById('headUname').innerText = "@" + me.username;
    if(me.avatar_url) document.getElementById('headAvatar').src = me.avatar_url;
    
    loadRecentChats();
    updateMyStatus();
    setInterval(updateMyStatus, 30000); 

    _supa.channel('denex_global')
        .on('postgres_changes', { event: '*', table: 'denex_messages' }, (payload) => {
            if (payload.new.receiver_id === me.id || payload.new.sender_id === me.id) {
                loadRecentChats();
            }
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
            handleGlobalTyping(payload.payload.sender_id);
        })
        .subscribe();
}

function handleGlobalTyping(senderId) {
    const msgEl = document.getElementById(`last-msg-${senderId}`);
    if (msgEl) {
        const originalText = msgEl.innerText;
        msgEl.innerText = "....typing(italic font style)";
        msgEl.classList.add('is-typing');
        
        clearTimeout(typingTimers[senderId]);
        typingTimers[senderId] = setTimeout(() => {
            msgEl.classList.remove('is-typing');
            msgEl.innerText = originalText;
        }, 3000);
    }
}

async function updateMyStatus() {
    if (!me) return;
    await _supa.from('denex_profiles').update({ last_login: new Date().toISOString() }).eq('id', me.id);
}

async function loadRecentChats() {
    const { data: blocks } = await _supa.from('denex_blocks')
        .select('blocker_id, blocked_id')
        .or(`blocker_id.eq.${me.id},blocked_id.eq.${me.id}`);
    
    const blockedIds = blocks ? blocks.map(b => b.blocker_id === me.id ? b.blocked_id : b.blocker_id) : [];

    const { data: messages } = await _supa.from('denex_messages')
        .select('sender_id, receiver_id, content, created_at, is_read')
        .or(`sender_id.eq.${me.id},receiver_id.eq.${me.id}`)
        .order('created_at', { ascending: false });

    if (!messages || messages.length === 0) {
        emptyState.style.display = 'flex';
        chatListDiv.style.display = 'none';
        return;
    }

    const usersMap = new Map();
    messages.forEach(m => {
        const otherId = m.sender_id === me.id ? m.receiver_id : m.sender_id;
        if (blockedIds.includes(otherId)) return;
        if (!usersMap.has(otherId)) {
            usersMap.set(otherId, {
                lastMsg: m.content || "📷 Image",
                unread: (m.receiver_id === me.id && !m.is_read)
            });
        }
    });

    if (usersMap.size === 0) {
        emptyState.style.display = 'flex';
        chatListDiv.style.display = 'none';
        return;
    }

    emptyState.style.display = 'none';
    chatListDiv.style.display = 'block';
    chatListDiv.innerHTML = '';

    let delay = 0;
    for (const [uid, info] of usersMap) {
        const { data: u } = await _supa.from('denex_profiles').select('*').eq('id', uid).single();
        if(!u) continue;

        const isOnline = (new Date() - new Date(u.last_login)) / 1000 / 60 < 2;

        const item = document.createElement('div');
        item.className = 'chat-item';
        item.style.animationDelay = `${delay}s`;
        delay += 0.06;
        
        let pressTimer;
        item.onpointerdown = () => {
            pressTimer = window.setTimeout(() => handleLongPress(u.id, u.first_name), 800);
        };
        item.onpointerup = () => clearTimeout(pressTimer);
        item.onpointerleave = () => clearTimeout(pressTimer);

        item.onclick = () => {
            _supa.from('denex_messages').update({ is_read: true }).eq('sender_id', uid).eq('receiver_id', me.id);
            location.href = `chat.html?chat_id=${u.id}&username=${u.username}`;
        };

        item.innerHTML = `
            <div class="pfp-wrap">
                <img src="${u.avatar_url || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}">
                <div class="online-status ${isOnline ? 'active' : ''}"></div>
                <div class="unread-dot" style="display: ${info.unread ? 'block' : 'none'}"></div>
            </div>
            <div class="chat-info">
                <h4>${u.first_name}</h4>
                <p id="last-msg-${u.id}">${info.lastMsg}</p>
            </div>
        `;
        chatListDiv.appendChild(item);
    }
}

async function handleLongPress(targetId, name) {
    document.getElementById('modalTitle').innerText = `Block ${name}?`;
    confirmModal.classList.add('active');
    document.getElementById('modalActionBtn').onclick = async () => {
        closeModal();
        popAlert("Blocking...");
        const { error } = await _supa.from('denex_blocks').insert({ blocker_id: me.id, blocked_id: targetId });
        if (!error) {
            popAlert(`${name} removed`);
            loadRecentChats();
        } else {
            popAlert("Action failed");
        }
    };
}

function closeModal() { confirmModal.classList.remove('active'); }

function popAlert(msg) {
    alertBox.innerText = msg;
    alertBox.classList.add('show');
    setTimeout(() => alertBox.classList.remove('show'), 2500);
}

function toggleMenu(e) { e.stopPropagation(); dropdown.classList.toggle('active'); }
window.onclick = (event) => {
    dropdown.classList.remove('active');
    if(event.target == confirmModal) closeModal();
};

function handleLogout() {
    localStorage.removeItem('denex_user');
    location.href = 'login.html';
}

const searchInput = document.getElementById('userSearch');
searchInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const query = searchInput.value.trim().toLowerCase();
        if (!me) return popAlert("Please login first");
        if (query === me.username.toLowerCase()) {
            popAlert("Viewing profile...");
            setTimeout(() => location.href = 'profile.html', 1000);
            return;
        }
        popAlert("Searching...");
        const { data } = await _supa.from('denex_profiles').select('id, username, first_name').eq('username', query).maybeSingle();
        if (data) {
            popAlert(`Found ${data.first_name}!`);
            setTimeout(() => location.href = `chat.html?chat_id=${data.id}&username=${data.username}`, 1000);
        } else {
            popAlert("User not found");
        }
    }
});

initPage();
