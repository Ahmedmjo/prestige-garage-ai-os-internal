# Prestige Garage ERP — Worklog

---
Task ID: SUBMIT-FIX
Agent: Frontend Debug Agent (Explore)
Task: Diagnose why all save/submit buttons in Protection module do nothing on click (no toast, no error, no save)

Investigation Scope:
- src/components/modules/protection-module.tsx (AddRollDialog, ConsumptionDialog — consumption + waste modes)
- src/components/modules/rolls-module.tsx (AddRoll, EditRoll, EditPrice, Consumption, EditConsumption)
- src/components/prestige/error-boundary.tsx
- src/app/layout.tsx, src/app/page.tsx
- src/components/ui/{button,dialog,toaster,sonner,toast}.tsx
- src/hooks/use-toast.ts
- src/app/api/consumptions/route.ts, src/app/api/rolls/route.ts
- src/middleware.ts (CSP / rate-limit)
- Git history (commit c634888 "fix: all save buttons ... verified working")

Root Cause — Sonner Toaster is NOT mounted:

  All 8 modules call `toast.success/error(...)` imported from `'sonner'`:
    protection-module.tsx, rolls-module.tsx, attendance-module.tsx,
    services-module.tsx, settings-module.tsx, stock-module.tsx,
    employees-module.tsx, ai-chat.tsx, plus notification-bell.tsx and
    attendance-grid.tsx.

  But src/app/layout.tsx mounts the WRONG Toaster:
    Line 3:  import { Toaster } from "@/components/ui/toaster";   // ← radix-based
    Line 62: <Toaster />

  `@/components/ui/toaster.tsx` is the shadcn radix Toaster — it only renders
  toasts dispatched via the `useToast()` hook from `@/hooks/use-toast`.
  NO module uses that hook (verified by grep).

  The Sonner-specific Toaster exists at `@/components/ui/sonner.tsx`
  (wraps `sonner`'s `<Sonner>` with next-themes) but is NEVER mounted.
  Result: every `toast.success/error(...)` call from sonner is silently
  dropped — Sonner pushes the toast to its internal state, but there is
  no renderer to display it.

Why the user perceives "no save":
  - handleSubmit code in every dialog is CORRECT — verified line-by-line:
      * Button onClick={handleSubmit} is properly wired
      * setSaving(true) called; setSaving(false) in finally
      * fetch URLs correct (/api/rolls, /api/consumptions, /api/consumptions/[id], /api/rolls/[id])
      * body = JSON.stringify(form) or JSON.stringify(payload)
      * Validation toast.error + catch toast.error(e.message) present
      * No silent error swallowing
  - The API itself works (curl returns 201; verified by user AND by reading route.ts).
  - On success path: fetch succeeds → dialog closes → loadData() refreshes data.
    BUT toast.success() is dropped → user has zero visible feedback.
  - On validation/API-error path: toast.error() is dropped → dialog stays open,
    button re-enables. User sees "nothing happened".
  - The user concludes "no save" because no toast confirms success or explains failure.
    (Some saves may actually be succeeding silently — they just have no confirmation.)

Why previous fix commit (c634888) didn't fix it:
  The commit only changed ONE line in protection-module.tsx (button label
  from `'تسجيل الاستهلاك'` to `isWasteMode ? 'تسجيل الهالك' : 'تسجيل الاستهلاك'`).
  The commit message says "verified working" — but the verification was only
  curl against the API (which works). The actual UX bug (missing Sonner Toaster)
  was missed.

ErrorBoundary check:
  src/components/prestige/error-boundary.tsx uses getDerivedStateFromError to
  catch RENDER errors only. It does NOT swallow runtime errors in event handlers
  (handleSubmit). It is mounted only around <ProtectionModule/> (page.tsx:185).
  NOT the cause of this bug.

CSP check:
  middleware.ts sets `connect-src 'self'` — fetch to same-origin /api/* is allowed.
  NOT blocking the fetch.

Exact Fix (one-line change):

  File:  src/app/layout.tsx
  Line:  3
  OLD:   import { Toaster } from "@/components/ui/toaster";
  NEW:   import { Toaster } from "@/components/ui/sonner";

  Line 62 (<Toaster />) stays the same. Both components export `Toaster` with
  the same call signature, so no other code changes are needed.

  After this fix, all toast.success/error calls in all 8 modules will render
  correctly via Sonner's mounted <Toaster>. The save buttons themselves were
  never broken — only the feedback was.

Secondary cleanup (optional, not required for the fix):
  After the fix, these files become dead code and can be deleted:
    - src/components/ui/toaster.tsx
    - src/components/ui/toast.tsx
    - src/hooks/use-toast.ts
  No module imports useToast() or the radix toast components.

Verification steps after applying the fix:
  1. Run `bun run dev` (or build + start)
  2. Open Protection module → click "رول جديد" → fill brand/type/length → click "إضافة الرول"
     Expected: toast.success appears + dialog closes + new roll in matrix.
  3. Click any roll card → fill meters → click "تسجيل الاستهلاك"
     Expected: toast.success with remaining balance + dialog closes + card updates.
  4. Click "تسجيل هالك بـ OBXn" → fill waste → click "تسجيل الهالك"
     Expected: toast.success + dialog closes + card balance decreases.
  5. Repeat equivalent flows in Rolls module (Add/Edit/EditPrice/Consumption/EditConsumption).

Status: Diagnosis complete. NO files modified (read-only mission per task brief).
        Fix is a single one-line import swap in src/app/layout.tsx — ready for
        the implementation agent to apply.
