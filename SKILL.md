# 🤖 Authoritative AI Assistant Pair-Programming Playbook

This document defines the strict, high-fidelity engineering directives that **every** AI pairing agent must read, acknowledge, and adhere to when contributing to this real-time multiplayer MMORPG ecosystem.

> [!NOTE]
> Before modifying any architecture, GORM database schema, or React Three Fiber pipeline, you MUST study the comprehensive tech stack and data layout blueprints documented in the main **[Project Blueprint (README.md)](README.md)**.

---

## 🎯 1. Core Engineering Philosophies

* **authoritative Server Architecture**: All gameplay mechanics (health pools, coordinate calculations, monster combat state-machines, movement updates) must remain authoritatively controlled on the Go backend server. The React/Three Fiber frontend serves solely as an interpolating visualization shell.
* **Pragmatic Persistence**: Do not store hardcoded paths, absolute local assets directory strings, or redundant network prefixes in GORM/PostgreSQL records. Save path strings in database columns as clean, portable relative formats (e.g., `/assets-model/kingdom/wall.glb`) and let the runtime load layers prepend absolute remote origins (`http://localhost:8080`) dynamically.
* **Zero Regression Standard**: Codebase modifications must not introduce compilation warnings, linting failures, or runtime crashes in either the Go server or the Next.js frontend app.

---

## 🛠️ 2. Dual-Engine Verification Protocol

After **every single modification, addition, or refactoring**, you MUST verify the compilation integrity of both engines before performing any Git actions.

### Step A: Authoritative Go Backend Compilation
Navigate to the `backend` workspace and run a complete compiler test to build a temporary executable. This ensures all struct schemas, middleware paths, GORM migration mappings, and HTTP handlers compile flawlessly:
```bash
# Execute in: /home/yoga/Dokumen/game mmorpg/backend
go build -o server cmd/server/main.go
```

### Step B: Strict Next.js TypeScript Type-Check
Navigate to the `frontend` workspace and trigger the TypeScript compiler in non-emitting validation mode to guarantee type-safety throughout the entire React Three Fiber, Zustand, and ECS pipeline:
```bash
# Execute in: /home/yoga/Dokumen/game mmorpg/frontend
bunx tsc --noEmit
```

---

## 🌐 3. Live Server & Port Maintenance

* **Port Safety**: Do not leave stale server processes listening on port `8080` (Go GIN) or `3000` (Next.js). If you alter handlers, middlewares, or models:
  1. Find and cleanly terminate the old process using: `fuser -k 8080/tcp || true`
  2. Boot the new engine version to allow seamless schema auto-migrations: `go run cmd/server/main.go`
* **Zero Interruption**: Ensure the development server environment is kept healthy so the pair programmer can load the live scene inside their client viewport immediately.

---

## 🚀 4. Automated Git Delivery & Conventional Commits

Once the Go backend compiles with zero errors and the frontend TypeScript check passes with zero type-mismatches, you are authorized to stage, commit, and push changes.

### A. Stage Changes
Stage only the files that represent functional contributions (avoid tracking irrelevant build binaries or temporary logs):
```bash
git add .
```

### B. Conventional Commit Guidelines
Draft commit messages using the professional **Conventional Commits** standard:
* `feat: ...` for new features (e.g., `feat: serve and scan game props dynamically from backend GIN`)
* `fix: ...` for bug fixes (e.g., `fix: resolve relative path generation in asset scanner to prevent 404`)
* `refactor: ...` for structural rewrites with no behavioral change
* `perf: ...` for optimizations (e.g., throttling anim loops, instancing mesh groups)

### C. Authoritative Remote Sync
Push commits immediately to ensure the remote tracking branch `main` on GitHub remains synchronized in real time:
```bash
git push origin main
```

---

> [!IMPORTANT]
> **COMPILATION & SINK CHECK ARE NON-NEGOTIABLE.** Skipping any phase of this dual validation and deployment workflow is a violation of the development protocol.
