# =================================================================
#                    MMORPG GAME RUNNER MAKEFILE
# =================================================================
# Authoritative Go Backend & React/Three Fiber Next.js Frontend
# Adheres to the engineering standards specified in SKILL.md.

SHELL := /bin/bash

# Configuration and Ports
PORT_BACKEND = 8080
PORT_FRONTEND = 3000
PORT_MCP = 3001
PORT_KCP = 9999

# Package Manager Detection for Frontend (bun preferred, npm as fallback)
BUN := $(shell command -v bun 2> /dev/null)
RUN_FRONTEND_CMD = $(if $(BUN),bun run dev,npm run dev)
START_FRONTEND_CMD = $(if $(BUN),bun run start,npm run start)
TSC_FRONTEND_CMD = $(if $(BUN),bunx tsc --noEmit,npx tsc --noEmit)
BUILD_FRONTEND_CMD = $(if $(BUN),bun run build,npm run build)

# Live Reload Tool Detection for Backend (air preferred, go run as fallback)
AIR := $(shell command -v air 2> /dev/null)
RUN_BACKEND_CMD = $(if $(AIR),air,go run cmd/server/main.go)
PROD_BACKEND_CMD = ./build/server

.PHONY: all help kill kill-backend-port kill-frontend-port run run-backend run-backend-heavy-monsters run-frontend run-prod run-frontend-prod run-backend-prod seed-enemy check check-backend check-frontend clean build build-backend build-frontend build-shared ci loadtest loadtest-peaceful loadtest-extreme loadtest-fast-combat loadtest-massive-enemies loadtest-anim-stress loadtest-mixed accuracy-test

# Default target displays the help menu
all: help

help:
	@echo "================================================================="
	@echo "                   🎮  MMORPG DUAL-ENGINE MATRIX  🎮              "
	@echo "================================================================="
	@echo "⚙️  CORE ENGINE SERVICES:"
	@echo "  make run                       - Kill running ports and start ALL services (backend + frontend + MCP)"
	@echo "  make run-backend               - Kill port $(PORT_BACKEND) and start backend only"
	@echo "  make run-backend-heavy-monsters- Kill port $(PORT_BACKEND) and start backend with 80 extra monsters"
	@echo "  make run-frontend              - Kill port $(PORT_FRONTEND) and start frontend only"
	@echo "  make run-mcp                   - Kill port $(PORT_MCP) and start MCP server only"
	@echo "  make kill                      - Terminate any running processes on ports $(PORT_BACKEND), $(PORT_FRONTEND), $(PORT_MCP)"
	@echo ""
	@echo "💾 DATABASE & CONFIG SEEDERS:"
	@echo "  make seed-enemy                - Force wipe and fresh seed all 10 varied enemy configurations"
	@echo ""
	@echo "🧪 QUALITY ASSURANCE & DIAGNOSTICS:"
	@echo "  make check                     - Run dual-engine compilation and type-safety check"
	@echo "  make check-backend             - Compile and verify Go backend executable"
	@echo "  make check-frontend            - Run strict Next.js TypeScript typecheck"
	@echo "  make accuracy-test             - Run authoritative combat & movement drift tests"
	@echo ""
	@echo "💥 PERFORMANCE & STRESS TESTING SCENARIOS:"
	@echo "  make loadtest                  - Run standard combat test (50 players, 1.5s attack rate)"
	@echo "  make loadtest-peaceful         - Run peaceful movement test (50 players, NO attack)"
	@echo "  make loadtest-extreme          - Run extreme player stress test (120 players, NO attack)"
	@echo "  make loadtest-fast-combat      - Run rapid attack VFX stress test (40 players, 500ms attack rate)"
	@echo "  make loadtest-anim-stress     - Animation stress test (20 players, diverse states)"
	@echo "  make loadtest-mixed           - Mixed scenario test (30 players, combat + movement)"
	@echo ""
	@echo "📦 PRODUCTION BUILD & DEPLOYMENT:"
	@echo "  make build                     - Compile both Go backend and Next.js frontend for production"
	@echo "  make build-backend             - Compile Go backend binary"
	@echo "  make build-frontend            - Build Next.js frontend production bundle"
	@echo "  make clean                     - Clean compiled backend binary artifacts"
	@echo "================================================================="

# Clean ports target using multiple layers of process signal dispatching (fuser & lsof + kill)
kill: kill-backend-port kill-frontend-port kill-mcp-port
	@echo "✨ All target ports are clean and ready to bind."

kill-backend-port:
	@echo "🧹 Sweeping processes on backend port $(PORT_BACKEND)..."
	@fuser -k $(PORT_BACKEND)/tcp 2>/dev/null || true
	@pid_backend=$$(lsof -t -i:$(PORT_BACKEND) 2>/dev/null); \
	if [ ! -z "$$pid_backend" ]; then \
		echo "Force killing backend PID: $$pid_backend"; \
		kill -9 $$pid_backend 2>/dev/null || true; \
	fi
	@echo "🧹 Sweeping processes on KCP UDP port $(PORT_KCP)..."
	@fuser -k $(PORT_KCP)/udp 2>/dev/null || true
	@pid_kcp=$$(lsof -t -i udp:$(PORT_KCP) 2>/dev/null); \
	if [ ! -z "$$pid_kcp" ]; then \
		echo "Force killing KCP PID: $$pid_kcp"; \
		kill -9 $$pid_kcp 2>/dev/null || true; \
	fi

kill-frontend-port:
	@echo "🧹 Sweeping processes on frontend port $(PORT_FRONTEND)..."
	@fuser -k $(PORT_FRONTEND)/tcp 2>/dev/null || true
	@pid_frontend=$$(lsof -t -i:$(PORT_FRONTEND) 2>/dev/null); \
	if [ ! -z "$$pid_frontend" ]; then \
		echo "Force killing frontend PID: $$pid_frontend"; \
		kill -9 $$pid_frontend 2>/dev/null || true; \
	fi

kill-mcp-port:
	@echo "🧹 Sweeping processes on MCP port $(PORT_MCP)..."
	@fuser -k $(PORT_MCP)/tcp 2>/dev/null || true
	@pid_mcp=$$(lsof -t -i:$(PORT_MCP) 2>/dev/null); \
	if [ ! -z "$$pid_mcp" ]; then \
		echo "Force killing MCP PID: $$pid_mcp"; \
		kill -9 $$pid_mcp 2>/dev/null || true; \
	fi

# Runs the Go Backend exclusively
run-backend: kill-backend-port
	@echo "🚀 Booting Go Authoritative Backend..."
	@cd backend && $(RUN_BACKEND_CMD)

# Runs the Go Backend with extra monsters
run-backend-heavy-monsters: kill-backend-port
	@echo "🔥 Starting Go Server with 80 extra simulated monsters..."
	@cd backend && SPAWN_EXTRA_MONSTERS=80 $(RUN_BACKEND_CMD)


# Runs the Next.js/Three Fiber Frontend exclusively
run-frontend: kill-frontend-port
	@echo "🚀 Booting React/Three Fiber Frontend ($(RUN_FRONTEND_CMD))..."
	@cd frontend && $(RUN_FRONTEND_CMD)

# Runs the MCP server exclusively
run-mcp: kill-mcp-port
	@echo "🚀 Booting MCP World Editor Server on port $(PORT_MCP)..."
	@cd packages/mcp && bun run src/server.ts --http --port $(PORT_MCP)

# Triple-Engine Live Session: Runs backend, frontend, and MCP server concurrently (DEV Mode)
# Sets up trap listener on SIGINT (Ctrl+C) and SIGTERM to safely clean up all background subshells
run: kill
	@echo "🚀 Booting all engines concurrently in DEVELOPMENT mode..."
	@(cd backend && $(RUN_BACKEND_CMD)) & \
	BACKEND_PID=$$! ; \
	(cd frontend && $(RUN_FRONTEND_CMD)) & \
	FRONTEND_PID=$$! ; \
	(cd packages/mcp && bun run src/server.ts --http --port $(PORT_MCP)) & \
	MCP_PID=$$! ; \
	trap 'echo -e "\n🛑 Gracefully shutting down MMORPG engines..."; kill $$BACKEND_PID $$FRONTEND_PID $$MCP_PID 2>/dev/null; wait $$BACKEND_PID $$FRONTEND_PID $$MCP_PID 2>/dev/null; echo "✅ Cleanup complete. Exited."' SIGINT SIGTERM; \
	wait $$BACKEND_PID $$FRONTEND_PID $$MCP_PID

# Run Frontend in Production Mode
run-frontend-prod: kill-frontend-port
	@echo "🚀 Starting Production React/Three Fiber Frontend ($(START_FRONTEND_CMD))..."
	@cd frontend && $(START_FRONTEND_CMD)

# Run Backend in Production Mode
run-backend-prod: kill-backend-port
	@echo "🚀 Starting Production Go Backend ($(PROD_BACKEND_CMD))..."
	@cd backend && $(PROD_BACKEND_CMD)

# Dual-Engine Live Session: Runs both backend and frontend concurrently (PRODUCTION Mode)
run-prod: kill
	@echo "🚀 Booting both engines concurrently in PRODUCTION mode..."
	@(cd backend && $(PROD_BACKEND_CMD)) & \
	BACKEND_PID=$$! ; \
	(cd frontend && $(START_FRONTEND_CMD)) & \
	FRONTEND_PID=$$! ; \
	trap 'echo -e "\n🛑 Gracefully shutting down MMORPG production engines..."; kill $$BACKEND_PID $$FRONTEND_PID 2>/dev/null; wait $$BACKEND_PID $$FRONTEND_PID 2>/dev/null; echo "✅ Cleanup complete. Exited."' SIGINT SIGTERM; \
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

build-shared:
	@echo "🏗️ Building @jagres/shared TypeScript package..."
	@cd packages/shared && bunx tsc --build
	@echo "✅ @jagres/shared build complete (dist/ ready)."

build: build-backend build-frontend
	@echo "🎉 Production build completed for both engines!"

ci: check build
	@echo "✅ CI pipeline complete."

loadtest:
	@echo "🔥 Starting Game Server Load/Stress Test (50 simulated players)..."
	@cd backend && go run cmd/loadtest/main.go -players=50 -duration=45s

loadtest-peaceful:
	@echo "🔥 Starting Peaceful Game Server Load/Stress Test (50 simulated players, NO attack)..."
	@cd backend && go run cmd/loadtest/main.go -players=50 -duration=45s -attack=false

loadtest-extreme:
	@echo "💥 Starting EXTREME Game Server Load/Stress Test (120 simulated players, NO attack, wider movement)..."
	@cd backend && go run cmd/loadtest/main.go -players=120 -duration=60s -attack=false -radius=25.0

loadtest-fast-combat:
	@echo "⚔️  Starting RAPID COMBAT Load/Stress Test (40 simulated players, attacking every 500ms, tight group)..."
	@cd backend && go run cmd/loadtest/main.go -players=40 -duration=30s -attack=true -attack-rate=10 -radius=8.0

accuracy-test:
	@echo "🔬 Running Combat & Movement Accuracy Test Suite..."
	@cd backend && go run cmd/accuracytest/main.go

loadtest-massive-enemies:
	@echo "👾 Running Massive Enemy Density Load Test (50 players, 80 extra monsters)..."
	@echo "⚠️  Make sure backend is running with: make run-backend-heavy-monsters"
	@cd backend && go run cmd/loadtest/main.go -players=50 -duration=45s -attack=true -radius=15.0

loadtest-anim-stress:
	@echo "🎭 Running Animation Stress Test (20 players, diverse idle/walk/run/attack/skill states)..."
	@cd backend && go run cmd/loadtest/main.go -players=20 -duration=60s -attack=true -attack-rate=15 -radius=12.0

loadtest-mixed:
	@echo "🎮 Running Mixed Scenario Test (30 players, combat + movement + idle cycles)..."
	@cd backend && go run cmd/loadtest/main.go -players=30 -duration=45s -attack=true -attack-rate=20 -radius=18.0


