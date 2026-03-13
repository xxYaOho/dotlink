# Delete Links Multiselect Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace TUI index-based link deletion with a grouped multiselect flow that shows simple health badges.

**Architecture:** Keep CLI removal unchanged and add a TUI-only deletion flow. Build a small adapter that converts store links plus runtime inspection results into grouped multiselect options, then add a batch removal command that writes the config once.

**Tech Stack:** Node.js ESM, `@clack/prompts`, existing store/runtime inspection modules, node:test

---

### Task 1: Add failing tests for delete option shaping and batch removal

**Files:**
- Modify: `test/commands.test.mjs`
- Create: `test/link-remove-select.test.mjs`
- Read: `src/commands.mjs`
- Read: `src/runtime-links.mjs`

**Step 1: Write the failing tests**

Add tests covering:
- batch removal across one module and multiple modules
- grouped delete option generation
- status mapping from runtime status to `green/yellow/red` style markers or symbols

**Step 2: Run test to verify it fails**

Run: `npm test -- test/commands.test.mjs test/link-remove-select.test.mjs`
Expected: FAIL because batch removal helper and select option builder do not exist.

**Step 3: Write minimal implementation**

Create only the helpers needed by the tests.

**Step 4: Run test to verify it passes**

Run: `npm test -- test/commands.test.mjs test/link-remove-select.test.mjs`
Expected: PASS

### Task 2: Implement grouped multiselect option builder

**Files:**
- Create: `src/link-remove-select.mjs`
- Modify: `src/runtime-links.mjs`
- Test: `test/link-remove-select.test.mjs`

**Step 1: Write the failing test**

Add expectations for:
- module header items
- selectable link items
- label format `[ 🟢 ] src --> dst`
- stable grouping order by module then index

**Step 2: Run test to verify it fails**

Run: `npm test -- test/link-remove-select.test.mjs`
Expected: FAIL with missing exports or wrong label structure.

**Step 3: Write minimal implementation**

Implement:
- status-to-badge mapping
- grouped option builder
- helper to inspect links for the currently selected config source

**Step 4: Run test to verify it passes**

Run: `npm test -- test/link-remove-select.test.mjs`
Expected: PASS

### Task 3: Add batch removal command

**Files:**
- Modify: `src/commands.mjs`
- Test: `test/commands.test.mjs`

**Step 1: Write the failing test**

Add a test for removing multiple selected links with one write.

**Step 2: Run test to verify it fails**

Run: `npm test -- test/commands.test.mjs`
Expected: FAIL because `removeLinks()` does not exist.

**Step 3: Write minimal implementation**

Add a new helper that:
- validates selections
- groups removals by module
- removes links from highest index to lowest per module
- writes store once

Keep existing `removeLink()` unchanged.

**Step 4: Run test to verify it passes**

Run: `npm test -- test/commands.test.mjs`
Expected: PASS

### Task 4: Replace TUI delete flow

**Files:**
- Modify: `index.mjs`
- Read: `src/search-select.mjs`
- Read: `src/path-mode.mjs`

**Step 1: Write the failing test**

If TUI is hard to test end-to-end, cover the pure selection builder and keep `index.mjs` integration small.

**Step 2: Run targeted tests to verify current gap**

Run: `npm test -- test/link-remove-select.test.mjs test/commands.test.mjs`
Expected: PASS for helpers, while TUI flow still uses numeric index in code.

**Step 3: Write minimal implementation**

In `index.mjs`:
- replace numeric index prompt with `p.multiselect`
- use grouped options from `src/link-remove-select.mjs`
- ask one confirmation before delete
- call new batch removal helper

**Step 4: Run tests and manual verification**

Run: `npm test`
Expected: PASS

Manual check:
- run `npm start`
- open `删除链接`
- verify grouped multi-select appears
- verify one delete action can remove multiple links

### Task 5: Update docs

**Files:**
- Modify: `docs/CLI.md`
- Modify: `docs/CHANGELOG.md`

**Step 1: Write doc updates**

Document that TUI delete now uses grouped multiselect with health badges.

**Step 2: Verify docs are accurate**

Check that examples match actual label style.

**Step 3: Run final verification**

Run: `npm test`
Expected: PASS

Run diagnostics on changed files.
Expected: clean
