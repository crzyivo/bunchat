# Bun + Elysia Powered chat
## Objective
  Create a chat with websockets and html5, using bun as the server and elysia as the framework.
  The elysia framework will be used as a fullstack dev server. 
  The chat will have a register page where the user will enter a username and a password, the username will be unique for each user.
  After the registration or login the user will see a list of chatrooms it has joined. 
  When entering a chatroom the user will see a chat interface. The chat room will have a chat page where the user can chat with other users.
  The user can create a new chatroom or join an existing one. When creating a new chatroom the user will be asked for a name for the chatroom and a human readable code will be generated for other chat users to join. 
  - User profile: The user can only change its password, not the username. Also it can upload a image to be used as profile picture or select from some default ones. When registering for the first time a random profile image will be assigned.
  - Chatroom list: This will be the initial page of the web, after the login. The list will show all the chatrooms the user has joined or created. The list will be ordered by the last message sent and will show the name of the chatroom and the last message sent with the number of unread messages. From this page the user can join an existing chatroom, create a new one or leave a chatroom.
  - Chat: When entering a chatroom the user will see the chat interface. The chat interface will show the chat history and a form to send new messages. The chat history will show up to the last 20 messages, and older messages will be loaded on demand when scrolling up. The user messages will be shown on the left, while other users messages will be shown on the right. Each message will show the user profile picture, username and the message content. The send message form will be at the bottom of the chat interface and will be formed by a textarea, emoji picker and a send button. The emoji picker will be a popup that will show a list of ASCII emojis to choose from.
The application will have a IRC early 2000s aesthetic but with a modern interface.

## Technical Details & Requirements

### 1. Technology Stack
- **Runtime & Package Manager**: Bun
- **Web Framework**: ElysiaJS
- **Templating Engine**: @elysiajs/html (JSX/TSX)
- **Database**: SQLite (via `bun:sqlite` or `better-sqlite3`)
- **Styling**: Custom CSS (served via Elysia)
- **Real-time Communication**: Elysia WebSockets

### 2. Database Schema (SQLite)

#### Users Table
- `id`: Integer/UUID (Primary Key)
- `username`: String (Unique)
- `password_hash`: String
- `avatar_url`: String (Path to uploaded image or default asset)

#### ChatRooms Table
- `id`: Integer/UUID (Primary Key)
- `name`: String
- `join_code`: String (Unique, Human-readable, e.g., "fast-river-22")
- `created_at`: DateTime

#### Memberships Table
- `user_id`: Foreign Key -> Users
- `room_id`: Foreign Key -> ChatRooms
- `last_read_message_id`: Integer (for tracking unread counts)
- `joined_at`: DateTime

#### Messages Table
- `id`: Integer/UUID (Primary Key)
- `room_id`: Foreign Key -> ChatRooms
- `user_id`: Foreign Key -> Users
- `content`: Text
- `created_at`: DateTime

### 3. Application Routes

#### Authentication
- `GET /register`: Registration form.
- `POST /register`: Handle creation (Hash password, assign random avatar).
- `GET /login`: Login form.
- `POST /login`: Authenticate and set session cookie.
- `GET /logout`: Destroy session.

#### User Profile
- `GET /profile`: View profile settings.
- `POST /profile/update`: Change password or upload new avatar.

#### Dashboard (Home)
- `GET /`: List joined rooms (Ordered by last message desc). Shows unread count.
- `POST /rooms/create`: Create new room (Generates join code).
- `POST /rooms/join`: Join room via code.
- `POST /rooms/:id/leave`: Leave a room.

#### Chat Interface
- `GET /rooms/:id`: Render chat view (Initial 20 messages).
- `GET /api/rooms/:id/history`: API for infinite scroll (fetch older messages).

#### WebSocket (`/ws`)
- **Connect**: Authenticate via session.
- **Events**:
  - `join`: Subscribe to room updates.
  - `message`: Send/Receive payload `{ text, roomId, userId }`.
  - `typing`: (Optional) Typing indicators.

### 4. Feature Specifications

#### Authentication & Sessions
- Use **Argon2** (built-in `Bun.password`) for hashing.
- Session management via HTTP-only cookies (using Elysia cookie plugin).

#### Chat UI Layout
- **Message List**:
  - **Current User**: Aligned **LEFT** (per requirements).
  - **Other Users**: Aligned **RIGHT**.
  - **Metadata**: Show Avatar, Username, Timestamp per message bubble.
- **Input Area**: Fixed at bottom.
  - `Textarea`: Auto-expanding or fixed height.
  - `Emoji Picker`: Button toggles popup with ASCII preset list (e.g., `:)`, `¯\_(ツ)_/¯`).
  - `Send Button`: Submits form/socket message.

#### Infinite Scroll
- Frontend JS listens for scroll event on message container.
- When scroll position reaches top -> Fetch next batch of messages via API -> Prepend to list -> Maintain scroll position.

#### Image Handling
- **Uploads**: Use `Bun.write` to save uploaded files to a public directory.
- **Serving**: Configure Elysia to serve static files from the uploads directory.

#### Join Code Generation
- Logic to generate readable codes (e.g., `Adjective-Noun-Number`).

### 5. Development Steps
1.  **Setup**: Initialize Bun project, install Elysia & HTML plugin.
2.  **DB Init**: Create SQLite tables.
3.  **Auth System**: Implement Register/Login/Session logic.
4.  **Room Management**: Create/Join/List rooms.
5.  **Chat Core**: Build UI, integrate WebSockets for live messaging.
6.  **Refinement**: Add file uploads, infinite scroll, and styling.

### 6. Deployment
The server will be deployed on an Ubuntu 22.04 server with Bun installed.

#### package.json Scripts
```json
{
  "scripts": {
    "dev": "bun run --watch src/index.tsx",
    "start": "NODE_ENV=production bun run src/index.tsx",
    "build": "bun build src/index.tsx --outdir ./dist --target bun --minify"
  }
}
```

#### Commands
- **Development** (hot-reload): `bun run dev`
- **Production**: `bun run start`
- **Build** (optional, for bundled output): `bun run build`

#### Production Deployment Notes
- Set `NODE_ENV=production` to disable dev features and enable optimizations.
- Use a process manager like **systemd** or **PM2** to keep the server running.
- Example systemd service file (`/etc/systemd/system/bunchat.service`):
  ```ini
  [Unit]
  Description=Bun Chat Application
  After=network.target

  [Service]
  Type=simple
  User=www-data
  WorkingDirectory=/var/www/bunchat
  ExecStart=/usr/local/bin/bun run start
  Restart=on-failure
  Environment=NODE_ENV=production

  [Install]
  WantedBy=multi-user.target
  ```
- Enable and start: `sudo systemctl enable bunchat && sudo systemctl start bunchat`
