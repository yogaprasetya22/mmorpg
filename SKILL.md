# AI Assistant Pairing Rules & Instructions

This document defines the strict workflow rules that **every** AI pairing assistant (including Antigravity) must follow when making changes to this codebase.

---

## 🛠️ Mandatory Verification Workflow

After **every single modification, addition, or refactoring** in the frontend codebase, you MUST execute the following verification steps:

1. **Run TypeScript Check**  
   Execute the non-emitting compiler check in the `frontend` directory to ensure type safety is 100% correct with no regressions:
   ```bash
   # Cwd: /home/yoga/Dokumen/game mmorpg/frontend
   bunx tsc --noEmit
   ```

2. **Commit and Push to GitHub**  
   Once the TypeScript check passes with zero errors, automatically stage, commit, and push the changes directly to the remote main repository:
   ```bash
   # Cwd: /home/yoga/Dokumen/game mmorpg
   git add .
   git commit -m "your commit message detailing the changes"
   git push origin main
   ```

---

> [!IMPORTANT]
> **NEVER skip the type-checking phase.** It is crucial to verify that all React Three Fiber, Zustand, and TypeScript states compile cleanly before committing or delivering success reports to the user.
