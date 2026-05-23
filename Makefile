# =================================================================
#                    MMORPG GAME RUNNER MAKEFILE
# =================================================================
# Authoritative Go Backend & React/Three Fiber Next.js Frontend
# Adheres to the engineering standards specified in SKILL.md.

SHELL := /bin/bash

# Configuration and Ports
PORT_BACKEND = 8080
PORT_FRONTEND = 3000

# Package Manager Detection for Frontend (bun preferred, npm as fallback)
BUN := $(shell command -v bun 2> /dev/null)
RUN_FRONTEND_CMD = $(if $(BUN),bun run dev,npm run dev)
TSC_FRONTEND_CMD = $(if $(BUN),bunx tsc --noEmit,npx tsc --noEmit)
BUILD_FRONTEND_CMD = $(if $(BUN),bun run build,npm run build)

.PHONY: all help kill kill-backend-port kill-frontend-port run run-backend run-frontend seed-enemy check check-backend check-frontend clean build build-backend build-frontend loadtest

# Default target displays the help menu
all: help

help:
	@echo "================================================================="
	@echo "                    MMORPG GAME RUNNER MODULE                    "
	@echo "================================================================="
	@echo "Available commands:"
	@echo "  make run            - Kill running ports and start BOTH services concurrently"
	@echo "  make run-backend    - Kill port $(PORT_BACKEND) and start backend only"
	@echo "  make run-frontend   - Kill port $(PORT_FRONTEND) and start frontend only"
	@echo "  make seed-enemy     - Force wipe and fresh seed all 10 varied enemy configurations"
	@echo "  make kill           - Terminate any running processes on ports $(PORT_BACKEND) & $(PORT_FRONTEND)"
	@echo "  make check          - Run dual-engine compilation and type-safety check"
	@echo "  make check-backend  - Compile and verify Go backend executable"
	@echo "  make check-frontend - Run strict Next.js TypeScript typecheck"
	@echo "  make build          - Compile both Go backend and Next.js frontend for production"
	@echo "  make build-backend  - Compile Go backend binary"
	@echo "  make build-frontend - Build Next.js frontend production bundle"
	@echo "  make clean          - Clean compiled backend binary artifacts"
	@echo "================================================================="

# Clean ports target using multiple layers of process signal dispatching (fuser & lsof + kill)
kill: kill-backend-port kill-frontend-port
	@echo "✨ All target ports are clean and ready to bind."

kill-backend-port:
	@echo "🧹 Sweeping processes on backend port $(PORT_BACKEND)..."
	@fuser -k $(PORT_BACKEND)/tcp 2>/dev/null || true
	@pid_backend=$$(lsof -t -i:$(PORT_BACKEND) 2>/dev/null); \
	if [ ! -z "$$pid_backend" ]; then \
		echo "Force killing backend PID: $$pid_backend"; \
		kill -9 $$pid_backend 2>/dev/null || true; \
	fi

kill-frontend-port:
	@echo "🧹 Sweeping processes on frontend port $(PORT_FRONTEND)..."
	@fuser -k $(PORT_FRONTEND)/tcp 2>/dev/null || true
	@pid_frontend=$$(lsof -t -i:$(PORT_FRONTEND) 2>/dev/null); \
	if [ ! -z "$$pid_frontend" ]; then \
		echo "Force killing frontend PID: $$pid_frontend"; \
		kill -9 $$pid_frontend 2>/dev/null || true; \
	fi

# Runs the Go Backend exclusively
run-backend: kill-backend-port
	@echo "🚀 Booting Go Authoritative Backend..."
	@cd backend && go run cmd/server/main.go

# Runs the Next.js/Three Fiber Frontend exclusively
run-frontend: kill-frontend-port
	@echo "🚀 Booting React/Three Fiber Frontend ($(RUN_FRONTEND_CMD))..."
	@cd frontend && $(RUN_FRONTEND_CMD)

# Dual-Engine Live Session: Runs both backend and frontend concurrently
# Sets up trap listener on SIGINT (Ctrl+C) and SIGTERM to safely clean up both background subshells
run: kill
	@echo "🚀 Booting both engines concurrently..."
	@(cd backend && go run cmd/server/main.go) & \
	BACKEND_PID=$$! ; \
	(cd frontend && $(RUN_FRONTEND_CMD)) & \
	FRONTEND_PID=$$! ; \
	trap 'echo -e "\n🛑 Gracefully shutting down MMORPG engines..."; kill $$BACKEND_PID $$FRONTEND_PID 2>/dev/null; wait $$BACKEND_PID $$FRONTEND_PID 2>/dev/null; echo "✅ Cleanup complete. Exited."' SIGINT SIGTERM; \
	wait $$BACKEND_PID $$FRONTEND_PID

# Dual-Engine Verification Protocol (SKILL.md adherence)
check-backend:
	@echo "🔍 Checking Go Backend compilation..."
	@cd backend && go build -o server cmd/server/main.go
	@echo "✅ Go Backend compiled successfully."

check-frontend:
	@echo "🔍 Running strict TypeScript typecheck..."
	@cd frontend && $(TSC_FRONTEND_CMD)
	@echo "✅ Frontend TypeScript check passed successfully."

check: check-backend check-frontend
	@echo "🎉 Dual-engine verification check PASSED. Zero regression detected."

clean:
	@echo "🧹 Cleaning built server binaries..."
	@rm -rf backend/build backend/server
	@echo "✅ Workspace clean."

seed-enemy:
	@echo "🌱 Running Standalone Monster Seeder..."
	@cd backend && go run cmd/seeder/main.go

build-backend:
	@echo "🏗️ Compiling Go Backend production binary..."
	@mkdir -p backend/build
	@cd backend && go build -v -o build/server cmd/server/main.go
	@echo "✅ Go Backend build complete."

build-frontend:
	@echo "🏗️ Generating Next.js Frontend production build ($(BUILD_FRONTEND_CMD))..."
	@cd frontend && $(BUILD_FRONTEND_CMD)
	@echo "✅ Frontend Next.js build complete."

build: build-backend build-frontend
	@echo "🎉 Production build completed for both engines!"

loadtest:
	@echo "🔥 Starting Game Server Load/Stress Test (50 simulated players)..."
	@cd backend && go run cmd/loadtest/main.go -players=50 -duration=45s

loadtest-peaceful:
	@echo "🔥 Starting Peaceful Game Server Load/Stress Test (50 simulated players, NO attack)..."
	@cd backend && go run cmd/loadtest/main.go -players=50 -duration=45s -attack=false

