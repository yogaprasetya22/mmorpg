# AI Assistant Pairing Rules & Instructions

This document defines the strict workflow rules that **every** AI pairing assistant (including Antigravity) must follow when making changes to this codebase.

---

## 🛠️ Mandatory Verification Workflow

After **every single modification, addition, or refactoring**, you MUST execute the appropriate compilation and check steps before committing:

### A. Go Backend Changes
If you modify any file inside the Go backend, you MUST verify that it compiles perfectly:
```bash
# Cwd: /home/yoga/Dokumen/game mmorpg/backend
go build -o server cmd/server/main.go
```

### B. Frontend Changes
If you modify any file inside the React/Next.js frontend, you MUST verify that the TypeScript compiler passes with zero errors:
```bash
# Cwd: /home/yoga/Dokumen/game mmorpg/frontend
bunx tsc --noEmit
```

### C. Commit and Push to GitHub
Once all appropriate compilation checks pass with zero errors, automatically stage, commit, and push the changes directly to the remote main repository:
```bash
# Cwd: /home/yoga/Dokumen/game mmorpg
git add .
git commit -m "your commit message detailing the changes"
git push origin main
```

---

> [!IMPORTANT]
> **NEVER skip the compilation and type-checking phases.** It is crucial to verify that all Go schemas, HTTP routes, React components, and TypeScript states compile cleanly before committing or delivering success reports to the user.
