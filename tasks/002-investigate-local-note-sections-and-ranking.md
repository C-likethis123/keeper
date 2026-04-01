# Task 002: Investigate Local-First Note Sections and Ranking

## Status

- Planned
- Roadmap entry: `Phase 11: Investigate Local-First Note Sections and Ranking`

## Overview

Investigate how Keeper can group notes into sections and rank notes within those sections while keeping the ranking model local-first and compatible with the current on-device architecture.

## Why This Matters

- Keeper already has note metadata, content-derived note types, filters, and FTS-backed relevance, but it does not yet provide richer grouped browsing beyond filters
- Sectioned note views could make journals, todos, resources, active work, and reference notes easier to scan without forcing everything into folder-style organization
- Local-first ranking avoids adding a server dependency for a core browsing workflow and better matches Keeper's Git-backed storage model

## Current State

- Notes are indexed locally through SQLite and surfaced through shared note-list hooks and services
- Note type metadata already exists for journals, resources, todos, and templates
- Search and wikilink autocomplete already use local ranked FTS results for text queries
- The home note list supports filters, but not explicit grouped sections with a dedicated section-aware ranking model

## Desired State

- Keeper has a clear product and technical definition of what a note "section" is
- The app can rank notes within those sections using signals available locally on device
- The first approach is explainable, testable, and tunable against real note collections
- The initial implementation path does not require any server-side recommendation or ranking system

## Investigation Questions

- Should sections be explicit user-managed groups, inferred views, note-type buckets, MOC-style collections, or a hybrid model?
- Which local ranking signals are strong enough to use: recency, note type, title matches, backlinks, outgoing links, todo state, pinning, or derived activity?
- Should ranking happen mainly in SQLite queries, mainly in TypeScript, or as a layered approach?
- How should grouped sections interact with the current note filters and future organization features?
- What fallback should exist when there is not enough metadata or link structure to rank confidently?

## Proposed Investigation Steps

- Audit the current note-list and indexing pipeline to identify which local signals already exist and which ones would need new metadata or migrations
- Define 2-3 candidate section models and compare their UX and implementation cost
- Define an initial local ranking formula or rule set for each candidate model
- Decide which parts of the ranking should live in SQLite and which should live in app-side post-processing
- Prototype the lowest-risk local-first approach behind the existing note-list data flow
- Add focused tests around ranking behavior once the first scoring rules are chosen

## Candidate Files

- `src/services/notes/notesIndexDb.ts`
- `src/services/notes/notesIndex.ts`
- `src/services/notes/noteTypeDerivation.ts`
- `src/hooks/useNotes.ts`
- `src/app/index.tsx`
- `src/components/NoteGrid.tsx`
- `src/components/NoteFiltersDropdown.tsx`

## Acceptance Criteria

- The roadmap captures a concrete investigation path for note sections and local-first ranking
- The team has a documented first-pass definition of sections and candidate local ranking signals
- The plan explicitly prefers an on-device implementation and avoids assuming server infrastructure
- The eventual implementation can be evaluated with automated tests around ranking behavior

## Open Questions

- Should users be able to override or pin section membership manually?
- Should ranking be global first and then sectioned, or computed independently inside each section?
- Is explainability in the UI required for v1, or is an internal/debug-only explanation sufficient at first?
