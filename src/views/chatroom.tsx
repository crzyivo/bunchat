import { Html } from '@elysiajs/html'
import type { User, ChatRoom, Message } from "../db";

interface MessageWithUser extends Message {
    username: string;
    avatar_url: string;
}

interface ChatRoomPageProps {
    user: User;
    room: ChatRoom;
    messages: MessageWithUser[];
    sessionId: string;
}

const ASCII_EMOJIS = [
    ":)", ":(", ":D", ":P", ";)", ":O", ":/", ":*", "<3",
    "XD", "B)", ":|", ":S", ">:(", "^_^", "-_-", "O_O",
    "¯\\_(ツ)_/¯", "(╯°□°)╯︵ ┻━┻", "┬─┬ノ( º _ ºノ)",
    "(ง'̀-'́)ง", "( ͡° ͜ʖ ͡°)", "ಠ_ಠ", "(☞ﾟヮﾟ)☞", "☜(ﾟヮﾟ☜)",
    "♪┏(・o・)┛♪", "(づ｡◕‿‿◕｡)づ", "ʕ•ᴥ•ʔ", "(ノಠ益ಠ)ノ彡┻━┻"
];

function formatMessageTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

function formatDateSeparator(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
        return "Yesterday";
    } else {
        return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    }
}

function getDateKey(dateStr: string): string {
    return new Date(dateStr).toDateString();
}

interface RenderableMessage {
    type: 'message';
    id: number;
    isSelf: boolean;
    dateKey: string;
    avatarUrl: string;
    username: string;
    time: string;
    content: string;
}

interface DateSeparator {
    type: 'separator';
    label: string;
}

type RenderableItem = RenderableMessage | DateSeparator;

function prepareMessagesForRender(messages: MessageWithUser[], userId: number): RenderableItem[] {
    if (messages.length === 0) return [];

    const items: RenderableItem[] = [];
    let lastDateKey = "";

    for (const msg of messages) {
        const dateKey = getDateKey(msg.created_at);
        if (dateKey !== lastDateKey) {
            items.push({ type: 'separator', label: formatDateSeparator(msg.created_at) });
            lastDateKey = dateKey;
        }

        items.push({
            type: 'message',
            id: msg.id,
            isSelf: msg.user_id === userId,
            dateKey,
            avatarUrl: msg.avatar_url,
            username: msg.username,
            time: formatMessageTime(msg.created_at),
            content: msg.content,
        });
    }

    return items;
}

export default function ChatRoomPage({ user, room, messages, sessionId }: ChatRoomPageProps) {
    return (
        <div class="chat-container">
            <header class="chat-header">
                <div class="header-left">
                    <a href="/" class="back-link">&larr; Back</a>
                    <h1 class="room-title">#{room.name}</h1>
                    <span class="room-code-display" id="room-code-display" data-code={room.join_code} title="Click to copy">Code: {room.join_code}</span>
                </div>
            </header>

            <main class="chat-main">
                <div class="messages-container" id="messages-container">
                    <div class="messages-list" id="messages-list">
                        {messages.length === 0 ? (
                            <div class="empty-chat">
                                <p>No messages yet. Start the conversation!</p>
                            </div>
                        ) : (
                            prepareMessagesForRender(messages, user.id).map((item) =>
                                item.type === 'separator' ? (
                                    <div class="date-separator"><span>{item.label}</span></div>
                                ) : (
                                    <div
                                        class={`message ${item.isSelf ? "message-self" : "message-other"}`}
                                        data-message-id={item.id}
                                        data-date={item.dateKey}
                                    >
                                        <img src={item.avatarUrl} alt={item.username} class="message-avatar" />
                                        <div class="message-content">
                                            <div class="message-header">
                                                <span class="message-username">{item.username}</span>
                                                <span class="message-time">{item.time}</span>
                                            </div>
                                            <div class="message-text">{item.content}</div>
                                        </div>
                                    </div>
                                )
                            )
                        )}
                    </div>
                </div>

                <div class="typing-indicator" id="typing-indicator"></div>

                <form class="message-form" id="message-form">
                    <div class="message-input-container">
                        <textarea
                            id="message-input"
                            name="content"
                            placeholder="Type your message..."
                            rows="1"
                            required
                        ></textarea>
                        <button type="button" class="emoji-toggle" id="emoji-toggle" title="Emojis">
                            :)
                        </button>
                    </div>
                    <button type="submit" class="btn btn-primary">Send</button>
                </form>

                <div class="emoji-picker" id="emoji-picker">
                    <div class="emoji-grid">
                        {ASCII_EMOJIS.map((emoji) => (
                            <button type="button" class="emoji-btn" data-emoji={emoji}>
                                {emoji}
                            </button>
                        ))}
                    </div>
                </div>
            </main>

            <script>{`
                (function() {
                    const roomId = ${room.id};
                    const userId = ${user.id};
                    const sessionId = '${sessionId}';
                    
                    const messagesContainer = document.getElementById('messages-container');
                    const messagesList = document.getElementById('messages-list');
                    const messageForm = document.getElementById('message-form');
                    const messageInput = document.getElementById('message-input');
                    const emojiToggle = document.getElementById('emoji-toggle');
                    const emojiPicker = document.getElementById('emoji-picker');
                    const typingIndicator = document.getElementById('typing-indicator');
                    
                    let ws;
                    let typingTimeout;
                    let isLoadingHistory = false;
                    let oldestMessageId = ${messages.length > 0 ? messages[0].id : 0};
                    
                    function connect() {
                        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                        ws = new WebSocket(protocol + '//' + window.location.host + '/ws');
                        
                        ws.onopen = function() {
                            ws.send(JSON.stringify({ type: 'auth', sessionId: sessionId }));
                        };
                        
                        ws.onmessage = function(event) {
                            const data = JSON.parse(event.data);
                            
                            if (data.type === 'auth_success') {
                                ws.send(JSON.stringify({ type: 'join', roomId: roomId }));
                            }
                            
                            if (data.type === 'message') {
                                appendMessage(data.message);
                            }
                            
                            if (data.type === 'typing') {
                                showTyping(data.username);
                            }
                        };
                        
                        ws.onclose = function() {
                            setTimeout(connect, 3000);
                        };
                    }
                    
                    function getDateKey(dateStr) {
                        return new Date(dateStr).toDateString();
                    }

                    function formatDateSeparator(dateStr) {
                        const date = new Date(dateStr);
                        const today = new Date();
                        const yesterday = new Date(today);
                        yesterday.setDate(yesterday.getDate() - 1);

                        if (date.toDateString() === today.toDateString()) {
                            return 'Today';
                        } else if (date.toDateString() === yesterday.toDateString()) {
                            return 'Yesterday';
                        } else {
                            return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
                        }
                    }

                    function appendMessage(msg) {
                        const isSelf = msg.user_id === userId;
                        const msgDateKey = getDateKey(msg.created_at);
                        
                        // Check if we need a date separator
                        const lastMessage = messagesList.querySelector('.message:last-child');
                        const lastDateKey = lastMessage ? lastMessage.dataset.date : null;
                        
                        if (msgDateKey !== lastDateKey) {
                            const separator = document.createElement('div');
                            separator.className = 'date-separator';
                            separator.innerHTML = '<span>' + formatDateSeparator(msg.created_at) + '</span>';
                            messagesList.appendChild(separator);
                        }
                        
                        const div = document.createElement('div');
                        div.className = 'message ' + (isSelf ? 'message-self' : 'message-other');
                        div.dataset.messageId = msg.id;
                        div.dataset.date = msgDateKey;
                        
                        const time = new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                        
                        div.innerHTML = 
                            '<img src="' + msg.avatar_url + '" alt="' + msg.username + '" class="message-avatar" />' +
                            '<div class="message-content">' +
                                '<div class="message-header">' +
                                    '<span class="message-username">' + msg.username + '</span>' +
                                    '<span class="message-time">' + time + '</span>' +
                                '</div>' +
                                '<div class="message-text">' + escapeHtml(msg.content) + '</div>' +
                            '</div>';
                        
                        messagesList.appendChild(div);
                        messagesContainer.scrollTop = messagesContainer.scrollHeight;
                        
                        // Remove empty state if present
                        const emptyChat = messagesList.querySelector('.empty-chat');
                        if (emptyChat) emptyChat.remove();
                    }
                    
                    function escapeHtml(text) {
                        const div = document.createElement('div');
                        div.textContent = text;
                        return div.innerHTML;
                    }
                    
                    function showTyping(username) {
                        typingIndicator.textContent = username + ' is typing...';
                        typingIndicator.style.display = 'block';
                        clearTimeout(typingTimeout);
                        typingTimeout = setTimeout(function() {
                            typingIndicator.style.display = 'none';
                        }, 2000);
                    }
                    
                    function sendMessage() {
                        const content = messageInput.value.trim();
                        if (content && ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'message', content: content }));
                            messageInput.value = '';
                            messageInput.style.height = 'auto';
                        }
                    }
                    
                    messageForm.addEventListener('submit', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        sendMessage();
                        return false;
                    });
                    
                    messageInput.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            sendMessage();
                            return false;
                        }
                    });
                    
                    messageInput.addEventListener('input', function() {
                        this.style.height = 'auto';
                        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
                        
                        if (ws && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: 'typing' }));
                        }
                    });
                    
                    emojiToggle.addEventListener('click', function() {
                        emojiPicker.classList.toggle('visible');
                    });
                    
                    emojiPicker.addEventListener('click', function(e) {
                        if (e.target.classList.contains('emoji-btn')) {
                            const emoji = e.target.dataset.emoji;
                            messageInput.value += emoji;
                            messageInput.focus();
                            emojiPicker.classList.remove('visible');
                        }
                    });
                    
                    document.addEventListener('click', function(e) {
                        if (!emojiPicker.contains(e.target) && e.target !== emojiToggle) {
                            emojiPicker.classList.remove('visible');
                        }
                    });
                    
                    // Infinite scroll
                    messagesContainer.addEventListener('scroll', async function() {
                        if (messagesContainer.scrollTop < 100 && !isLoadingHistory && oldestMessageId > 0) {
                            isLoadingHistory = true;
                            const prevHeight = messagesContainer.scrollHeight;
                            
                            try {
                                const response = await fetch('/api/rooms/' + roomId + '/history?before=' + oldestMessageId);
                                const messages = await response.json();
                                
                                if (messages.length > 0) {
                                    oldestMessageId = messages[0].id;
                                    
                                    // Get the date of the first existing message to check for separator
                                    const firstExistingMsg = messagesList.querySelector('.message');
                                    const firstExistingDate = firstExistingMsg ? firstExistingMsg.dataset.date : null;
                                    
                                    // Track dates for separators within loaded batch
                                    let lastDateKey = null;
                                    const fragment = document.createDocumentFragment();
                                    
                                    // Process messages in chronological order (oldest first)
                                    messages.forEach(function(msg) {
                                        const isSelf = msg.user_id === userId;
                                        const msgDateKey = getDateKey(msg.created_at);
                                        
                                        // Add date separator if date changes
                                        if (msgDateKey !== lastDateKey) {
                                            const separator = document.createElement('div');
                                            separator.className = 'date-separator';
                                            separator.innerHTML = '<span>' + formatDateSeparator(msg.created_at) + '</span>';
                                            separator.dataset.date = msgDateKey;
                                            fragment.appendChild(separator);
                                            lastDateKey = msgDateKey;
                                        }
                                        
                                        const div = document.createElement('div');
                                        div.className = 'message ' + (isSelf ? 'message-self' : 'message-other');
                                        div.dataset.messageId = msg.id;
                                        div.dataset.date = msgDateKey;
                                        
                                        const time = new Date(msg.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                                        
                                        div.innerHTML = 
                                            '<img src="' + msg.avatar_url + '" alt="' + msg.username + '" class="message-avatar" />' +
                                            '<div class="message-content">' +
                                                '<div class="message-header">' +
                                                    '<span class="message-username">' + msg.username + '</span>' +
                                                    '<span class="message-time">' + time + '</span>' +
                                                '</div>' +
                                                '<div class="message-text">' + escapeHtml(msg.content) + '</div>' +
                                            '</div>';
                                        
                                        fragment.appendChild(div);
                                    });
                                    
                                    // Remove duplicate separator if last loaded date matches first existing date
                                    if (lastDateKey === firstExistingDate) {
                                        const existingSeparator = messagesList.querySelector('.date-separator[data-date="' + firstExistingDate + '"]');
                                        if (existingSeparator) {
                                            existingSeparator.remove();
                                        }
                                    }
                                    
                                    messagesList.insertBefore(fragment, messagesList.firstChild);
                                    messagesContainer.scrollTop = messagesContainer.scrollHeight - prevHeight;
                                } else {
                                    oldestMessageId = 0;
                                }
                            } catch (err) {
                                console.error('Failed to load history:', err);
                            }
                            
                            isLoadingHistory = false;
                        }
                    });
                    
                    // Scroll to bottom on load
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                    
                    connect();
                })();
            `}</script>
        </div>
    );
}
