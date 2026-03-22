# Fix Startup Bugs on Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two startup crashes on desktop: `this.validatePath is not a function` during git initialization, and `expo-file-system` usage in code that runs on both mobile and desktop (Tauri).

**Architecture:** Both bugs share one root cause — `repoBootstrapper.ts` unconditionally uses `expo-file-system` (a mobile-only library) inside `hasBlockingNotesDirectory()`. On desktop (Tauri), this runs as a web platform where `expo-file-system`'s `Directory` class is a stub without `validatePath` implemented. The fix is two changes to one file: simplify the `Directory` constructor call and add a Tauri guard to skip the check on desktop.

**Tech Stack:** TypeScript, expo-file-system (mobile only), Tauri (desktop), Jest for tests

---

## Root Cause

### Startup sequence

```
StorageInitializationService.initialize()
  → storage_initialize (Tauri invoke / mobile native)
  → setNotesRoot(result.notesRoot)   ← NOTES_ROOT is now a real FS path

GitInitializationService.initialize()
  → repoBootstrapper.validateRepository()
      → gitEngine.resolveHeadOid(NOTES_ROOT)   ← throws if no repo yet
      → catch: hasBlockingNotesDirectory()      ← BUG IS HERE
          → getNotesDirectory()
              → new Directory(Paths.cache, ...pathSegments)
              ← CRASH: validatePath is not a function (web stub)
```

### Why each call fails on desktop

| Call | Problem |
|------|---------|
| `new Directory(Paths.cache, ...pathSegments)` | `Paths.cache` is a `Directory` object; on web the `Directory` stub has no `validatePath()` |
| `hasBlockingNotesDirectory()` on desktop | The "blocking directory" concept is mobile-only; Tauri manages its own data dir — this check should never run on desktop |

---

## File Structure

**Modify only:**
- `src/services/git/init/repoBootstrapper.ts` — fix constructor call + add Tauri guard
- `src/services/git/init/__tests__/repoBootstrapper.test.ts` — update test + add desktop test

---

## Task 1: Fix `getNotesDirectory()` and guard `hasBlockingNotesDirectory()` for desktop

**Files:**
- Modify: `src/services/git/init/repoBootstrapper.ts`

### Background

`getNotesDirectory()` currently does:
```typescript
// Current (broken on desktop):
const relativeNotesPath = NOTES_ROOT.replace(Paths.cache.uri, "").replace(/^\/+|\/+$/g, "");
const pathSegments = relativeNotesPath ? relativeNotesPath.split("/") : [];
return new Directory(Paths.cache, ...pathSegments);
```

`Paths.cache` is a `Directory` object. Passing it to `new Directory()` alongside spread string segments triggers `validatePath()` on a web stub that doesn't implement it.

`NOTES_ROOT` is already set to the correct full path by the time git init runs (via `StorageInitializationService` → `setNotesRoot(result.notesRoot)`). So `new Directory(NOTES_ROOT)` is equivalent and simpler.

`hasBlockingNotesDirectory()` is a safety check for mobile: "is there a non-git notes folder that would block a fresh clone?" This doesn't apply on desktop — Tauri manages its own data directory through the `storage_initialize` Rust command, which handles directory setup and reset.

The existing pattern for this kind of guard already exists in `errorMapper.ts`:
```typescript
// errorMapper.ts line 52 — already guards expo-file-system behind capability check:
if (capabilities.backend === "mobile-native") {
    const notesRootDir = new Directory(NOTES_ROOT);
    ...
}
```

- [ ] **Step 1: Open the file and understand the current imports**

Read `src/services/git/init/repoBootstrapper.ts` — current imports are:
```typescript
import { Directory, Paths } from "expo-file-system";
```

- [ ] **Step 2: Apply the fix**

In `src/services/git/init/repoBootstrapper.ts`, make these changes:

**Add the Tauri runtime import** after the existing imports:
```typescript
import { isTauriRuntime } from "@/services/storage/runtime";
```

**Remove `Paths` from the expo-file-system import** (no longer needed):
```typescript
import { Directory } from "expo-file-system";
```

**Replace `getNotesDirectory()`** — remove the path-segment reconstruction and use `NOTES_ROOT` directly:
```typescript
private getNotesDirectory(): Directory {
    return new Directory(NOTES_ROOT);
}
```

**Replace `hasBlockingNotesDirectory()`** — add Tauri guard at the top:
```typescript
private hasBlockingNotesDirectory(): boolean {
    if (isTauriRuntime()) {
        return false;
    }
    const notesDirectory = this.getNotesDirectory();
    if (!notesDirectory.exists) {
        return false;
    }
    return notesDirectory.list().length > 0;
}
```

The full updated file should look like:
```typescript
import type { GitEngine } from "@/services/git/engines/GitEngine";
import { NOTES_ROOT } from "@/services/notes/Notes";
import { isTauriRuntime } from "@/services/storage/runtime";
import { Directory } from "expo-file-system";
import type {
    CloneRepositoryResult,
    GitHubConfig,
    GitInitErrorMapper,
    RepoBootstrapper,
    RepositoryValidationResult,
} from "./types";

export class DefaultRepoBootstrapper implements RepoBootstrapper {
    constructor(
        private readonly gitEngine: GitEngine,
        private readonly config: GitHubConfig,
        private readonly errorMapper: GitInitErrorMapper,
    ) {}

    private pickPreferredBranch(branches: string[]): string | undefined {
        if (branches.includes("main")) return "main";
        if (branches.includes("master")) return "master";
        return branches[0];
    }

    private getNotesDirectory(): Directory {
        return new Directory(NOTES_ROOT);
    }

    private hasBlockingNotesDirectory(): boolean {
        if (isTauriRuntime()) {
            return false;
        }
        const notesDirectory = this.getNotesDirectory();
        if (!notesDirectory.exists) {
            return false;
        }
        return notesDirectory.list().length > 0;
    }

    async validateRepository(): Promise<RepositoryValidationResult> {
        try {
            await this.gitEngine.resolveHeadOid(NOTES_ROOT);
            return { exists: true, isValid: true };
        } catch (error) {
            console.warn(
                "[GitInitializationService] Error validating repository:",
                error,
            );
            if (error instanceof Error && error.message.includes("permission")) {
                console.error(
                    "File system permission error. Ensure app has storage permissions",
                );
            }
            const hasBlockingNotesDirectory = this.hasBlockingNotesDirectory();
            return {
                exists: hasBlockingNotesDirectory,
                isValid: false,
                reason:
                    error instanceof Error ? error.message : "Repository not initialized",
            };
        }
    }

    async cloneRepository(): Promise<CloneRepositoryResult> {
        try {
            const url = `https://github.com/${this.config.owner}/${this.config.repo}.git`;
            console.log("[GitInitializationService] Starting clone...");

            await this.gitEngine.clone(url, NOTES_ROOT);

            try {
                console.log(
                    "[GitInitializationService] Clone completed, checking out branch...",
                );
                const branches = await this.gitEngine.listBranches(NOTES_ROOT);
                const branchToCheckout = this.pickPreferredBranch(branches) ?? "main";
                await this.gitEngine.checkout(NOTES_ROOT, branchToCheckout);
                console.log(
                    `[GitInitializationService] Successfully checked out branch: ${branchToCheckout}`,
                );
            } catch (checkoutError) {
                console.error(
                    "[GitInitializationService] Error during checkout:",
                    checkoutError,
                );
                console.warn(
                    "[GitInitializationService] Checkout failed, but repository may still be usable",
                );
            }

            console.log(
                "[GitInitializationService] Clone and checkout completed, verifying repository...",
            );
            return { success: true };
        } catch (error) {
            const resolution = await this.errorMapper.resolveCloneFailure(error);
            return {
                success: false,
                failureMessage: resolution.failureMessage,
            };
        }
    }
}
```

- [ ] **Step 3: Run the linter to check for issues**

```bash
npm run lint
```

Expected: No errors in `repoBootstrapper.ts`. If `Paths` was used elsewhere in the file (it isn't after the fix), the linter would flag the unused import.

---

## Task 2: Update tests for the changes

**Files:**
- Modify: `src/services/git/init/__tests__/repoBootstrapper.test.ts`

### Background

The existing test mocks `expo-file-system` and tests `validateRepository()`. Two things need updating:
1. The `Paths` mock can be removed since it's no longer imported in the source
2. A new test should cover the desktop case: when `isTauriRuntime()` returns true, `validateRepository()` should still correctly report `{ exists: false, isValid: false }` even when git validation fails — because the blocking directory check is skipped on desktop

The mock for `Directory` still needs to exist because on mobile, `new Directory(NOTES_ROOT)` will call the constructor. The mock's `Directory` accepts any args already.

We also need to mock `@/services/storage/runtime` so `isTauriRuntime()` can be controlled.

- [ ] **Step 1: Write a failing test for the desktop behavior**

Add this test to `src/services/git/init/__tests__/repoBootstrapper.test.ts`:

```typescript
jest.mock("@/services/storage/runtime", () => ({
    isTauriRuntime: jest.fn().mockReturnValue(false),
}));
```

And add a new describe block after the existing one:

```typescript
import { isTauriRuntime } from "@/services/storage/runtime";

describe("DefaultRepoBootstrapper.validateRepository on desktop (Tauri)", () => {
    const gitEngine = {
        resolveHeadOid: jest.fn(),
    } as unknown as GitEngine;

    const bootstrapper = new DefaultRepoBootstrapper(
        gitEngine,
        { owner: "owner", repo: "repo", token: "token" },
        { resolveCloneFailure: jest.fn() },
    );

    it("reports exists: false when git validation fails on desktop (skips directory check)", async () => {
        (isTauriRuntime as jest.Mock).mockReturnValue(true);
        gitEngine.resolveHeadOid = jest
            .fn()
            .mockRejectedValue(new Error("repository not found"));

        const result = await bootstrapper.validateRepository();

        expect(result).toEqual({
            exists: false,
            isValid: false,
            reason: "repository not found",
        });
    });
});
```

- [ ] **Step 2: Run the test to verify it fails before the fix**

```bash
npm run test:component -- --testPathPattern="repoBootstrapper"
```

Expected: The new desktop test may pass or fail depending on whether `isTauriRuntime` is mockable; if the test infrastructure is correct it should fail since the code hasn't been changed yet.

- [ ] **Step 3: Update the existing mock to remove Paths**

Remove `Paths` from the `expo-file-system` mock since `repoBootstrapper.ts` no longer imports it. The mock for `Directory` stays because it's still needed for mobile paths:

```typescript
jest.mock("expo-file-system", () => ({
    __esModule: true,
    Directory: class Directory {
        exists = mockDirectoryExists;
        list() {
            return mockDirectoryEntries;
        }
    },
    File: class File {},
}));
```

Also add the `runtime` mock at the top of the file (before imports):

```typescript
jest.mock("@/services/storage/runtime", () => ({
    isTauriRuntime: jest.fn().mockReturnValue(false),
}));
```

The full updated test file:

```typescript
let mockDirectoryExists = false;
let mockDirectoryEntries: unknown[] = [];

jest.mock("expo-file-system", () => ({
    __esModule: true,
    Directory: class Directory {
        exists = mockDirectoryExists;
        list() {
            return mockDirectoryEntries;
        }
    },
    File: class File {},
}));

jest.mock("@/services/storage/runtime", () => ({
    isTauriRuntime: jest.fn().mockReturnValue(false),
}));

import type { GitEngine } from "@/services/git/engines/GitEngine";
import { DefaultRepoBootstrapper } from "@/services/git/init/repoBootstrapper";
import { isTauriRuntime } from "@/services/storage/runtime";

describe("DefaultRepoBootstrapper.validateRepository", () => {
    const gitEngine = {
        resolveHeadOid: jest.fn(),
    } as unknown as GitEngine;

    const bootstrapper = new DefaultRepoBootstrapper(
        gitEngine,
        {
            owner: "owner",
            repo: "repo",
            token: "token",
        },
        {
            resolveCloneFailure: jest.fn(),
        },
    );

    beforeEach(() => {
        mockDirectoryExists = false;
        mockDirectoryEntries = [];
        (isTauriRuntime as jest.Mock).mockReturnValue(false);
        jest.clearAllMocks();
    });

    it("marks a non-empty notes directory as existing when git validation fails", async () => {
        gitEngine.resolveHeadOid = jest
            .fn()
            .mockRejectedValue(new Error("not a git repository"));
        mockDirectoryExists = true;
        mockDirectoryEntries = [{}];

        const result = await bootstrapper.validateRepository();

        expect(result).toEqual({
            exists: true,
            isValid: false,
            reason: "not a git repository",
        });
    });

    it("allows clone to proceed when the notes directory is missing or empty", async () => {
        gitEngine.resolveHeadOid = jest.fn().mockRejectedValue(new Error("missing"));
        mockDirectoryExists = true;
        mockDirectoryEntries = [];

        const result = await bootstrapper.validateRepository();

        expect(result).toEqual({
            exists: false,
            isValid: false,
            reason: "missing",
        });
    });
});

describe("DefaultRepoBootstrapper.validateRepository on desktop (Tauri)", () => {
    const gitEngine = {
        resolveHeadOid: jest.fn(),
    } as unknown as GitEngine;

    const bootstrapper = new DefaultRepoBootstrapper(
        gitEngine,
        { owner: "owner", repo: "repo", token: "token" },
        { resolveCloneFailure: jest.fn() },
    );

    beforeEach(() => {
        (isTauriRuntime as jest.Mock).mockReturnValue(true);
        jest.clearAllMocks();
    });

    it("reports exists: false when git validation fails on desktop (skips directory check)", async () => {
        gitEngine.resolveHeadOid = jest
            .fn()
            .mockRejectedValue(new Error("repository not found"));

        const result = await bootstrapper.validateRepository();

        expect(result).toEqual({
            exists: false,
            isValid: false,
            reason: "repository not found",
        });
    });
});
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test:component -- --testPathPattern="repoBootstrapper"
```

Expected: All 3 tests pass.

- [ ] **Step 5: Run the full test suite to confirm no regressions**

```bash
npm test && npm run test:component
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/services/git/init/repoBootstrapper.ts src/services/git/init/__tests__/repoBootstrapper.test.ts
git commit -m "fix: skip expo-file-system directory check on desktop in repoBootstrapper"
```

---

## Verification Checklist

After the commit, verify on desktop:
- [ ] `npm run desktop` — app starts without `validatePath is not a function` error
- [ ] Git initialization completes (or fails with a meaningful error, not a crash)
- [ ] On mobile (`npm run android:dev`) — behavior unchanged, non-empty notes directory is still detected correctly
