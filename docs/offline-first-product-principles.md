# Offline-First Product Principles

## Core Rule

Binda should assume the network is unreliable.

The product must let a receptionist, cashier, or manager keep working even when:

- internet is slow;
- internet drops completely;
- Supabase is temporarily unavailable;
- the app has just reopened after a connection change.

## Implementation Rule

For core operating flows, especially transaction capture:

- open the interface immediately;
- read from local state first;
- save locally first;
- sync in the background;
- refresh remote data opportunistically, not as a blocking prerequisite.

This is the default product direction unless a feature explicitly requires live server validation.

## What This Means For UI

- Navigation into core flows should feel instant.
- Screens should render their shell without waiting for Supabase.
- Reference data like staff, services, and payment methods should come from local cache first.
- A slow network should never prevent opening the transaction composer.
- Loading states should be lightweight and non-blocking.

## What This Means For Data

- Manual transaction entry is local-first.
- Server sync is a secondary process, not the primary write path.
- Remote catalogs should be mirrored into IndexedDB for reuse.
- Derived suggestions, such as recent customers or frequent services, should be computed from local history whenever possible.
- Remote refresh should merge into local cache instead of replacing the app experience.

## Architectural Guidance

Use one transaction engine:

- manual entry
- receipt extraction
- future WhatsApp ingestion
- future integrations

All of them should flow into the same draft/validate/save/sync structure.

Do not build separate persistence paths per input source.

## Build-Time Decision Filter

When implementing a new feature, prefer the option that:

1. keeps the screen usable offline;
2. avoids blocking on network before interaction;
3. preserves local progress automatically;
4. syncs later when connectivity returns.

If an implementation violates these rules, it needs a specific reason.
