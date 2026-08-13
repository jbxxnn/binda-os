# Phase 1 — Technical Architecture

This document translates the Phase 1 product spec into a concrete engineering plan for this repository.

It is derived from:

- [beauty-business-operating-system-product-concept.md](./beauty-business-operating-system-product-concept.md)
- [phase-1-transaction-digitization-spec.md](./phase-1-transaction-digitization-spec.md)

This architecture is intentionally limited to Phase 1.
It should support fast manual transaction entry, offline usage, and later sync to the remote database.

## 1. Architecture Goal

Build an offline-first transaction entry system where:

- the app opens reliably on a mobile device
- staff and managers can log transactions quickly
- transaction entry does not depend on live internet access
- required reference data is available locally
- new transactions save locally first
- the system syncs safely to Supabase when internet returns

## 2. Core Technical Principles

Phase 1 should follow these principles:

- local-first writes for transaction entry
- server-backed sync for long-term persistence
- minimal required fields on the main entry path
- no network dependency for normal manual entry
- explicit sync status visible in the UI
- simple conflict handling in Phase 1
- receipt extraction is optional and isolated from the manual path

## 3. Recommended Stack Shape

The current repo should remain a Next.js application with Supabase as the remote backend.

Phase 1 should add four technical layers:

1. PWA shell
2. service worker
3. client-side local database
4. sync engine

## 4. Layer Responsibilities

### 4.1 Next.js App

The Next.js app is responsible for:

- authenticated business workspace
- transaction entry UI
- transaction list and detail UI
- reference-data management UI
- sync state UI
- receipt upload and review UI

### 4.2 PWA Layer

The PWA layer is responsible for:

- installability on supported mobile devices
- app manifest
- standalone/mobile-friendly app shell
- stable offline access to the interface

Recommended minimum outputs:

- `manifest.ts` or `manifest.webmanifest`
- installable app metadata
- mobile-ready icons

### 4.3 Service Worker Layer

The service worker is responsible for:

- caching static application assets
- making the app shell available offline
- helping route network requests in poor connectivity conditions
- optionally supporting deferred network behavior

The service worker should not be the main data store.

### 4.4 Local Database Layer

The local database is responsible for:

- cached staff data
- cached services data
- cached payment methods
- locally created transactions
- locally created transaction items
- sync queue metadata
- sync failure state

This is the core of the offline-first model.

### 4.5 Sync Layer

The sync layer is responsible for:

- pushing local pending transactions to Supabase
- pulling fresh reference data when online
- retrying failed sync jobs
- preventing duplicate writes
- updating local sync status after remote success

## 5. Recommended Local Storage Approach

For this use case, use `IndexedDB` as the primary client-side data store.

Reason:

- it is appropriate for structured offline data
- it supports larger payloads than simple browser storage
- it can store transaction drafts and receipt metadata
- it works well for queue-based sync models

Phase 1 should not rely on:

- in-memory only state
- `localStorage` as the main transaction store

`localStorage` can still be used for small UI preferences, but not as the core offline transaction database.

## 6. Recommended Local Data Model

The client should maintain local stores for:

### reference_staff

- `id`
- `business_id`
- `name`
- `active`
- `updated_at`

### reference_services

- `id`
- `business_id`
- `name`
- `active`
- `expected_price_min`
- `expected_price_max`
- `updated_at`

### reference_payment_methods

- `id`
- `code`
- `label`
- `active`
- `updated_at`

### local_transactions

- `local_id`
- `remote_id nullable`
- `business_id`
- `transaction_date`
- `customer_name nullable`
- `customer_phone nullable`
- `payment_method`
- `final_total`
- `entry_source`
- `review_status`
- `sync_status`
- `created_by`
- `device_created_at`
- `updated_at`
- `last_sync_attempt_at nullable`
- `sync_error nullable`

### local_transaction_items

- `local_id`
- `transaction_local_id`
- `remote_id nullable`
- `service_label_raw`
- `service_id nullable`
- `quantity nullable`
- `unit_price nullable`
- `line_total nullable`
- `staff_id nullable`

### sync_queue

- `id`
- `entity_type`
- `entity_local_id`
- `operation`
- `status`
- `attempt_count`
- `next_retry_at nullable`
- `last_error nullable`
- `created_at`
- `updated_at`

## 7. Recommended Remote Data Model

Supabase remains the remote system of record after sync.

Phase 1 remote tables should include:

### businesses

- `id`
- `name`
- `currency`
- `timezone`
- `created_at`

### staff

- `id`
- `business_id`
- `name`
- `active`
- `created_at`
- `updated_at`

### services

- `id`
- `business_id`
- `name`
- `active`
- `expected_price_min nullable`
- `expected_price_max nullable`
- `created_at`
- `updated_at`

### payment_methods

- `id`
- `business_id`
- `code`
- `label`
- `active`
- `created_at`
- `updated_at`

### transactions

- `id`
- `business_id`
- `client_generated_id`
- `transaction_date`
- `customer_name nullable`
- `customer_phone nullable`
- `payment_method`
- `final_total`
- `entry_source`
- `review_status`
- `receipt_image_url nullable`
- `raw_extraction_payload nullable`
- `created_by`
- `device_created_at`
- `created_at`
- `updated_at`

### transaction_items

- `id`
- `transaction_id`
- `service_label_raw`
- `service_id nullable`
- `quantity nullable`
- `unit_price nullable`
- `line_total nullable`
- `staff_id nullable`
- `created_at`
- `updated_at`

### extraction_reviews

- `id`
- `transaction_id`
- `field_name`
- `extracted_value`
- `corrected_value nullable`
- `confidence_level`
- `review_required`
- `reviewed_by nullable`
- `reviewed_at nullable`

## 8. Why `client_generated_id` Matters

Every locally created transaction should receive a client-generated stable ID before sync.

This ID is needed to:

- deduplicate retries
- avoid duplicate remote inserts
- safely retry after network failure
- correlate local and remote records

Phase 1 should treat `client_generated_id` as mandatory for all locally created transactions.

## 9. Sync Model

Phase 1 should use a simple queued sync model.

### 9.1 Write Flow

For manual entry:

1. user submits transaction
2. app validates locally as much as possible
3. transaction is written to local database
4. transaction gets `pending_sync`
5. queue job is created
6. UI confirms local save immediately
7. sync runs when connectivity is available

### 9.2 Reference Data Refresh Flow

When online:

1. fetch latest staff/services/payment methods
2. merge updates into local cache
3. update local `updated_at` markers

This refresh should not block manual entry.

### 9.3 Retry Flow

If sync fails:

1. keep the local record
2. mark queue item as failed or retryable
3. surface lightweight status in UI
4. retry automatically when conditions allow

## 10. Connectivity States

The app should recognize at least these connection conditions:

- online
- offline
- reconnecting

The app should also recognize transaction sync states:

- local_only
- pending_sync
- synced
- sync_failed

These states must be visible in the UI, but they must not interrupt fast entry.

## 11. Conflict Model for Phase 1

Phase 1 should keep conflict handling simple.

Assumptions:

- most transactions are created once and not edited from multiple devices at the same time
- reference data changes less frequently than transaction creation

Recommended Phase 1 rules:

- local create uses `client_generated_id`
- server accepts first successful create for that client ID
- retries should upsert or deduplicate by client ID
- local edits to unsynced transactions are allowed
- synced transactions can be editable later, but complex multi-device merge logic is out of scope for Phase 1

## 12. Validation Strategy

Validation should happen in two layers.

### 12.1 Local Validation

Used for speed and offline safety:

- required fields present
- numeric totals are valid
- payment method selected
- at least one line item exists

### 12.2 Server Validation

Used for final consistency:

- business ownership checks
- foreign key integrity
- duplicate protection through `client_generated_id`
- any deeper consistency rules needed at insert time

Local validation should be enough to allow fast save.
Server validation should harden the final stored record.

## 13. Receipt Workflow Architecture

Receipt upload is optional in Phase 1.

Its architecture should remain separate from the main manual flow.

Recommended receipt flow:

1. user captures or uploads image
2. image metadata is stored locally
3. image upload occurs when network allows
4. extraction pipeline creates transaction draft
5. draft is reviewed
6. reviewed result is saved as transaction

Manual transaction logging must not depend on the receipt pipeline existing first.

## 14. Security and Access Model

Phase 1 should support authenticated business users only.

At minimum:

- every record belongs to a business
- every fetch is scoped by business
- every sync write is scoped by business
- users should only read and write within their business boundary

This is where Supabase auth and row-level security should eventually enforce tenant separation.

## 15. Suggested Implementation Boundaries in This Repo

Recommended project areas:

### App UI

- `app/`
- transaction workspace pages
- auth pages

### Components

- `components/transactions/*`
- `components/sync/*`
- `components/reference-data/*`

### Local Data and Sync

- `lib/offline/*`
- local DB setup
- sync queue logic
- connectivity helpers

### Supabase Integration

- `lib/supabase/*`
- remote reads and writes

## 16. First Build Slice

The first implementation slice should not include receipt extraction yet.

It should include only:

1. transaction-focused authenticated shell
2. local reference data model
3. local transaction model
4. manual entry form
5. local save
6. pending sync state
7. transaction list from local data

This first slice is the minimum proof that the product can work offline.

## 17. Build Order

Implement in this order:

1. remove starter-template branding and tutorial UI
2. define remote schema for businesses, staff, services, payment methods, transactions, and transaction items
3. add PWA manifest and installability baseline
4. add service worker and offline app-shell caching
5. implement local IndexedDB layer
6. implement cached reference-data loading
7. build manual transaction entry form
8. save transactions locally with sync state
9. render local transaction list and detail view
10. implement queued sync to Supabase
11. add sync status indicators and retry behavior
12. add optional receipt upload flow
13. add optional extraction and review flow

## 18. What Should Not Be Built Yet

Do not add these in the first implementation cycle:

- CRM pages
- booking flows
- loyalty features
- WhatsApp messaging
- staff commissions
- advanced analytics
- branch management
- inventory

They will distract from the offline transaction core.

## 19. Definition of Technical Success

This architecture is successful when:

- the app can be installed on a phone
- the app can open without live internet
- a user can log a transaction offline
- the transaction appears immediately in the local ledger
- the transaction later syncs to Supabase without duplicate creation
- cached staff/services/payment data is usable offline

## 20. Immediate Next Implementation Step

The next engineering task after this document should be:

design and implement the first offline manual-entry slice

That means:

- replace the starter home page
- add a transaction workspace shell
- define the transaction data model in code
- introduce local persistence
- build the first manual transaction form

That is the fastest path from planning into a working product core.
