import Html from "@kitajs/html";
import type { User, ChatRoom } from "../db";

interface RoomWithMeta extends ChatRoom {
    last_message?: string;
    last_message_time?: string;
    unread_count: number;
}

interface DashboardPageProps {
    user: User;
    rooms: RoomWithMeta[];
    error?: string;
    sessionId: string;
}

function formatTime(dateStr: string | undefined): string {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
        return "Yesterday";
    } else if (days < 7) {
        return date.toLocaleDateString("en-US", { weekday: "short" });
    } else {
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
}

export default function DashboardPage({ user, rooms, error, sessionId }: DashboardPageProps) {
    return (
        <div class="dashboard-container">
            <header class="dashboard-header">
                <div class="header-left">
                    <h1 class="logo">BunChat</h1>
                </div>
                <div class="header-right">
                    <div class="user-info">
                        <img src={user.avatar_url} alt={user.username} class="avatar-small" />
                        <span class="username">{user.username}</span>
                    </div>
                    <nav class="header-nav">
                        <a href="/profile" class="nav-link">Profile</a>
                        <a href="/logout" class="nav-link">Logout</a>
                    </nav>
                </div>
            </header>

            <main class="dashboard-main">
                <div class="rooms-panel">
                    <div class="panel-header">
                        <h2>Your Chatrooms</h2>
                    </div>

                    <div id="feedback-message" class={error ? "error-message" : "hidden"}>
                        {error || ""}
                    </div>

                    <div class="room-actions">
                        <form id="create-room-form" class="create-room-form">
                            <input
                                type="text"
                                id="room-name-input"
                                name="name"
                                placeholder="New room name..."
                                required
                                class="input-field"
                            />
                            <button type="submit" class="btn btn-primary" id="create-btn">Create</button>
                        </form>

                        <form id="join-room-form" class="join-room-form">
                            <input
                                type="text"
                                id="join-code-input"
                                name="code"
                                placeholder="Enter join code..."
                                required
                                class="input-field"
                            />
                            <button type="submit" class="btn btn-secondary" id="join-btn">Join</button>
                        </form>
                    </div>

                    <div class="rooms-list" id="rooms-list">
                        {rooms.length === 0 ? (
                            <div class="empty-state">
                                <p>No chatrooms yet.</p>
                                <p>Create a new room or join an existing one!</p>
                            </div>
                        ) : (
                            rooms.map((room) => (
                                <div class="room-item-wrapper" data-room-id={room.id}>
                                    <a href={`/rooms/${room.id}`} class="room-item">
                                        <div class="room-info">
                                            <div class="room-name">
                                                #{room.name}
                                                <span class="unread-badge" data-unread-badge={room.id} style={room.unread_count > 0 ? "" : "display:none"}>
                                                    {room.unread_count}
                                                </span>
                                            </div>
                                            <div class="room-preview" data-room-preview={room.id}>
                                                {room.last_message
                                                    ? room.last_message.substring(0, 50) +
                                                    (room.last_message.length > 50 ? "..." : "")
                                                    : "No messages yet"}
                                            </div>
                                        </div>
                                        <div class="room-meta">
                                            <span class="room-time" data-room-time={room.id}>{formatTime(room.last_message_time)}</span>
                                            <span class="room-code" title="Join code">{room.join_code}</span>
                                        </div>
                                    </a>
                                    <button
                                        type="button"
                                        class="btn btn-danger btn-small leave-room-btn"
                                        data-room-id={room.id}
                                        title="Leave room"
                                    >
                                        Leave
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>

            <script>{`
                (function() {
                    const createForm = document.getElementById('create-room-form');
                    const joinForm = document.getElementById('join-room-form');
                    const feedbackEl = document.getElementById('feedback-message');
                    const roomNameInput = document.getElementById('room-name-input');
                    const joinCodeInput = document.getElementById('join-code-input');
                    const createBtn = document.getElementById('create-btn');
                    const joinBtn = document.getElementById('join-btn');

                    function showFeedback(message, isError) {
                        feedbackEl.textContent = message;
                        feedbackEl.className = isError ? 'error-message' : 'success-message';
                    }

                    function setLoading(btn, loading) {
                        btn.disabled = loading;
                        btn.textContent = loading ? 'Loading...' : btn.dataset.originalText || btn.textContent;
                        if (!loading && !btn.dataset.originalText) {
                            btn.dataset.originalText = btn.textContent;
                        }
                    }

                    createBtn.dataset.originalText = createBtn.textContent;
                    joinBtn.dataset.originalText = joinBtn.textContent;

                    createForm.addEventListener('submit', async function(e) {
                        e.preventDefault();
                        const name = roomNameInput.value.trim();
                        if (!name) return;

                        setLoading(createBtn, true);
                        try {
                            const response = await fetch('/api/rooms/create', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name })
                            });
                            const data = await response.json();
                            
                            if (data.success) {
                                window.location.href = data.redirect;
                            } else {
                                showFeedback(data.error || 'Failed to create room', true);
                                setLoading(createBtn, false);
                            }
                        } catch (err) {
                            showFeedback('Network error. Please try again.', true);
                            setLoading(createBtn, false);
                        }
                    });

                    joinForm.addEventListener('submit', async function(e) {
                        e.preventDefault();
                        const code = joinCodeInput.value.trim();
                        if (!code) return;

                        setLoading(joinBtn, true);
                        try {
                            const response = await fetch('/api/rooms/join', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code })
                            });
                            const data = await response.json();
                            
                            if (data.success) {
                                window.location.href = data.redirect;
                            } else {
                                showFeedback(data.error || 'Invalid join code', true);
                                setLoading(joinBtn, false);
                            }
                        } catch (err) {
                            showFeedback('Network error. Please try again.', true);
                            setLoading(joinBtn, false);
                        }
                    });

                    // Handle leave room buttons
                    document.querySelectorAll('.leave-room-btn').forEach(function(btn) {
                        btn.addEventListener('click', async function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const roomId = this.dataset.roomId;
                            if (!confirm('Are you sure you want to leave this room?')) return;

                            this.disabled = true;
                            this.textContent = '...';

                            try {
                                const response = await fetch('/api/rooms/' + roomId + '/leave', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' }
                                });
                                const data = await response.json();
                                
                                if (data.success) {
                                    const wrapper = document.querySelector('[data-room-id="' + roomId + '"]');
                                    if (wrapper) wrapper.remove();
                                    
                                    // Show empty state if no rooms left
                                    const roomsList = document.getElementById('rooms-list');
                                    if (!roomsList.querySelector('.room-item-wrapper')) {
                                        roomsList.innerHTML = '<div class="empty-state"><p>No chatrooms yet.</p><p>Create a new room or join an existing one!</p></div>';
                                    }
                                } else {
                                    showFeedback(data.error || 'Failed to leave room', true);
                                    this.disabled = false;
                                    this.textContent = 'Leave';
                                }
                            } catch (err) {
                                showFeedback('Network error. Please try again.', true);
                                this.disabled = false;
                                this.textContent = 'Leave';
                            }
                        });
                    });

                    // Handle room code copy
                    document.getElementById('rooms-list').addEventListener('click', function(e) {
                        if (e.target.classList.contains('room-code')) {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const code = e.target.textContent;
                            // Only copy if it's the code (not "Copied!")
                            if (code !== originalText) return;
                            
                            const originalText = code;
                            
                            navigator.clipboard.writeText(code).then(function() {
                                e.target.textContent = 'Copied!';
                                e.target.style.color = 'var(--success)';
                                e.target.style.borderColor = 'var(--success)';
                                
                                setTimeout(function() {
                                    e.target.textContent = originalText;
                                    e.target.style.color = '';
                                    e.target.style.borderColor = '';
                                }, 2000);
                            }).catch(function(err) {
                                console.error('Failed to copy:', err);
                            });
                        }
                    });

                    // WebSocket for real-time room updates
                    const sessionId = '${sessionId}';
                    let ws;

                    function formatTime(dateStr) {
                        if (!dateStr) return '';
                        const date = new Date(dateStr);
                        const now = new Date();
                        const diff = now.getTime() - date.getTime();
                        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

                        if (days === 0) {
                            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        } else if (days === 1) {
                            return 'Yesterday';
                        } else if (days < 7) {
                            return date.toLocaleDateString('en-US', { weekday: 'short' });
                        } else {
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                        }
                    }

                    function connectWs() {
                        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                        ws = new WebSocket(protocol + '//' + window.location.host + '/ws');
                        
                        ws.onopen = function() {
                            ws.send(JSON.stringify({ type: 'auth', sessionId: sessionId }));
                        };
                        
                        ws.onmessage = function(event) {
                            const data = JSON.parse(event.data);
                            
                            if (data.type === 'room_update') {
                                updateRoomInList(data);
                            }
                        };
                        
                        ws.onclose = function() {
                            setTimeout(connectWs, 5000);
                        };
                    }

                    function updateRoomInList(data) {
                        const roomId = data.roomId;
                        const preview = document.querySelector('[data-room-preview="' + roomId + '"]');
                        const time = document.querySelector('[data-room-time="' + roomId + '"]');
                        const badge = document.querySelector('[data-unread-badge="' + roomId + '"]');
                        
                        if (preview) {
                            preview.textContent = data.lastMessage;
                        }
                        if (time) {
                            time.textContent = formatTime(data.lastMessageTime);
                        }
                        if (badge) {
                            // Increment unread count
                            const current = parseInt(badge.textContent) || 0;
                            badge.textContent = current + 1;
                            badge.style.display = '';
                        }
                        
                        // Move room to top of list
                        const wrapper = document.querySelector('.room-item-wrapper[data-room-id="' + roomId + '"]');
                        const roomsList = document.getElementById('rooms-list');
                        if (wrapper && roomsList && wrapper !== roomsList.firstChild) {
                            roomsList.insertBefore(wrapper, roomsList.firstChild);
                        }
                    }

                    connectWs();
                })();
            `}</script>
        </div>
    );
}
