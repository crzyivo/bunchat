# BunChat

A real-time chat application built with **Bun**, **Elysia.js**, and **SQLite**.

## Features

- Real-time messaging via WebSockets
- User authentication with sessions
- Create and join chatrooms with unique codes
- Message history with infinite scroll
- Custom avatars
- IRC-inspired retro aesthetic

## Prerequisites

- [Bun](https://bun.sh/) v1.0 or later

## Installation

```bash
bun install
```

## Development

Start the development server with hot reload:

```bash
bun run dev
```

Open http://localhost:3000/ with your browser.

## Production Deployment

### Option 1: Direct Bun Runtime

The simplest approach - run Bun directly on your server:

```bash
# Install dependencies
bun install --production

# Start the production server
bun run start
```

### Option 2: Compiled Binary

Build a standalone executable for faster startup:

```bash
# Build the application
bun build \
	--compile \
	--minify-whitespace \
	--minify-syntax \
	--target bun \
	--outfile bunchat \
	src/index.tsx

# Run the binary
./bunchat
```

### Option 3: Docker

Create a `Dockerfile`:

```dockerfile
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY . .

# Expose port
EXPOSE 3000

# Run
CMD ["bun", "run", "start"]
```

Build and run:

```bash
docker build -t bunchat .
docker run -p 3000:3000 -v ./data:/app/data bunchat
```

### Environment Variables

| Variable   | Default       | Description                             |
| ---------- | ------------- | --------------------------------------- |
| `NODE_ENV` | `development` | Set to `production` for production mode |
| `PORT`     | `3000`        | Server port                             |

### Process Manager (PM2)

For production, use a process manager:

```bash
# Install PM2
bun add -g pm2

# Start with PM2
pm2 start "bun run start" --name bunchat

# Auto-restart on reboot
pm2 startup
pm2 save
```

### Reverse Proxy (Nginx)

Example Nginx configuration for WebSocket support:

```nginx
server {
    listen 80;
    server_name chat.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Database

The application uses SQLite (`chat.db`). For production:

- **Backup regularly**: `cp chat.db chat.db.backup`
- **Persist the database**: Mount a volume in Docker or ensure the file is on persistent storage

## Scripts

| Script          | Description                              |
| --------------- | ---------------------------------------- |
| `bun run dev`   | Start development server with hot reload |
| `bun run start` | Start production server                  |
| `bun run build` | Build minified bundle                    |
| `bun run debug` | Start with debugger enabled              |

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [Elysia.js](https://elysiajs.com/)
- **Database**: SQLite (via `bun:sqlite`)
- **Templating**: [@elysiajs/html](https://elysiajs.com/plugins/html.html)
