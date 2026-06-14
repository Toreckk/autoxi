# ADR 0001: Web-First React, Tauri Later

## Status

Accepted.

## Context

Autoxi is a UI-heavy asynchronous squad-builder autobattler. The first slice needs menus, collection browsing, filters, cards, API integration, and later drafting/scouting screens. It does not need a real-time engine for Phase 1.

## Decision

Build web-first with React + Vite. Use Tauri later if the project needs desktop packaging for Steam.

## Consequences

- We can iterate quickly with web tooling.
- The first UI can run in a browser before desktop packaging exists.
- Most gameplay screens can be implemented as application UI.
- Tauri packaging remains available later without committing to it now.

## Alternatives Considered

- Godot: useful later for a highly animated match presentation, but unnecessary for Phase 1.
- Electron: mature desktop shell, but heavier than needed if Tauri works later.
- Native desktop UI: too slow for the current team and goals.
