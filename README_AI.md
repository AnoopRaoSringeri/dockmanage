# DockManage – AI Context File

## Overview
DockManage is a lightweight Docker management UI built for developers.

It allows users to:
- View all Docker containers
- Start / Stop / Restart containers
- View container logs (including live streaming)

This project is designed to be simple, fast, and easy to extend.

---

## Architecture

Single-service architecture:

Browser
  → Node.js (Express server)
    → Serves React frontend (static build)
    → Provides REST API under /api/*
    → Connects to Docker via dockerode
      → /var/run/docker.sock

---

## Tech Stack

Frontend:
- React (Vite)
- Tailwind CSS
- shadcn/ui
- axios
- socket.io-client

Backend:
- Node.js
- Express
- dockerode
- socket.io

---

## Project Structure

dockmanage/
├── apps/
│   ├── web/        # React frontend
│   └── api/        # Express backend
├── packages/
│   └── types/      # Shared TypeScript types
├── docker/
├── docker-compose.yml

---

## API Design

Base path: /api

Endpoints:

GET    /api/containers
POST   /api/containers/:id/start
POST   /api/containers/:id/stop
POST   /api/containers/:id/restart
GET    /api/containers/:id/logs

---

## Docker Integration

- Uses dockerode to interact with Docker
- Default Docker connection:
  - Linux/macOS: `/var/run/docker.sock`
  - Windows: `//./pipe/docker_engine`
- Optional env overrides:
  - `DOCKER_SOCKET_PATH`: force custom socket/pipe path
  - `DOCKER_HOST`: `unix://...`, `npipe://...`, `tcp://host:port`, `http://host:port`, `https://host:port`

IMPORTANT:
This gives root-level access to Docker.
All endpoints must be protected with authentication.

---

## Frontend Behavior

- Dashboard shows list of containers
- Each container has:
  - name
  - status
  - action buttons (start/stop/restart)
- Logs viewer:
  - supports live streaming via WebSocket
  - styled like a terminal

---

## UI Guidelines

- Use shadcn/ui components
- Use Tailwind for styling
- Prefer dark mode
- Keep UI minimal and developer-focused

Status colors:
- running → green
- stopped → red
- restarting → yellow

---

## Coding Principles

- Keep code simple and modular
- Avoid unnecessary abstractions
- Prefer readability over cleverness
- Use async/await (no callbacks)

---

## Development Mode

- Frontend runs on Vite dev server
- Backend runs on Express
- Vite proxies /api → backend

---

## Production Behavior

- Frontend is built using Vite
- Express serves static files from web/dist
- Single service runs both UI and API

---

## Important Constraints

- Do not introduce heavy frameworks
- Do not over-engineer
- Keep everything in a single repo
- Avoid adding databases unless necessary

---

## Future Scope (Do NOT implement unless asked)

- Docker Compose management
- Multi-server support
- Metrics and monitoring
- Role-based access control

---

## Goal

This project is primarily for:
- learning AI-assisted development
- building a real, usable internal tool

Focus on speed, clarity, and iteration.