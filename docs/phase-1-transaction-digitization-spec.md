# Phase 1 — Transaction Digitization Spec

This document defines the exact scope for Phase 1 of the Beauty Business Operating System.

It is intentionally narrow.

Phase 1 is not the full salon operating system.
Phase 1 is the first product wedge: capturing reliable digital transaction records from the salon's existing workflow without forcing major behavior change.

This spec is derived from [beauty-business-operating-system-product-concept.md](./beauty-business-operating-system-product-concept.md) and must stay aligned with that roadmap.

## 1. Phase 1 Goal

Create reliable digital records of what already happens in the salon.

The system must let a business continue operating with paper receipts and informal processes while gradually turning those activities into structured transaction data.

Success in Phase 1 means:

- transactions can be recorded digitally with extremely low friction
- manual entry is fast enough to be the default mode of use
- the system remains usable in low-connectivity or offline conditions
- receipt images can be uploaded and reviewed when needed
- extracted transaction data can be validated before saving when extraction is used
- managers only correct uncertain data when needed
- the product becomes useful before asking the salon to change how it works

## 2. Phase 1 Scope

Phase 1 includes only the following capabilities:

1. Manual quick entry as the primary transaction flow
2. Offline-capable transaction capture
3. Transaction storage and sync-safe local persistence strategy
4. Receipt image capture as an optional input method
5. Receipt image upload as an optional input method
6. AI/OCR-based transaction extraction as an optional assistive workflow
7. Confidence-based review when extraction is used
8. Business-rule validation
9. Basic staff, service, and payment-method reference data required for fast entry and validation

## 3. Phase 1 Non-Goals

The following are explicitly out of scope for Phase 1:

- customer CRM and customer profiles
- visit history screens
- loyalty or rewards
- personalized follow-up messaging
- WhatsApp automation
- booking flows
- deposits and payment links
- enquiry inbox
- commission calculation
- inventory tracking
- financial intelligence beyond basic transaction records
- AI business assistant
- multi-location management beyond minimal future-proof data fields

If a proposed feature does not directly improve transaction capture accuracy, review speed, or transaction reliability, it should not be added to Phase 1.

## 4. Product Principle for This Phase

Do not ask the salon to replace its current workflow before the software has proven value.

The product must support the current reality:

- paper receipts
- informal staff recording habits
- inconsistent internet access
- periods of no internet access
- variable handwriting quality
- phone numbers that may be missing
- staff or services written inconsistently
- a manager who may need to review records later

The software should adapt to the workflow first.
Workflow change comes later.

## 5. Core User for Phase 1

Primary user:

- salon owner or manager

Secondary users:

- front desk or reception staff
- trusted operations staff entering transactions

Phase 1 is manager-first.
It is not a customer-facing product.

## 6. Main Jobs to Be Done

The system must help a manager:

- manually enter a transaction quickly when scanning is slower
- manually enter a transaction quickly even when internet access is poor or unavailable
- upload a receipt photo and get a usable transaction draft when manual entry is not preferred
- review only uncertain fields instead of retyping everything
- build a trustworthy transaction ledger from existing salon activity
- avoid duplicate or obviously invalid records

## 7. Phase 1 Inputs

Accepted transaction input methods in this phase:

1. Manual quick entry form
2. Receipt photo captured from a mobile device
3. Image upload from an existing photo

Inputs explicitly deferred to later phases:

- WhatsApp forwarded messages
- voice notes
- batch imports
- POS integrations
- CSV import
- API ingestion

## 8. Required Transaction Data

Each saved transaction should support the following fields.

Required when available:

- transaction ID
- transaction date
- staff member
- one or more service line items
- final total
- payment method
- source of entry
- review status
- sync status

Optional in Phase 1:

- customer name
- customer phone number
- notes
- receipt image reference

Each line item should support:

- service label as written
- normalized service mapping if available
- quantity
- unit price
- line total
- assigned staff if needed later

## 9. Reference Data Needed in Phase 1

To validate extracted records, the system needs lightweight reference data.

Minimum reference sets:

- staff list
- service list
- payment method list

These are not full management modules yet.
They are validation inputs for transaction capture.

Minimum fields:

### Staff

- staff ID
- display name
- active status

### Services

- service ID
- display name
- active status
- optional expected price range

### Payment Methods

- cash
- transfer
- POS
- card
- other

## 10. Functional Requirements

### 10.1 Manual Quick Entry

Manual quick entry is the main transaction workflow in Phase 1.

The default product assumption should be:

- a staff member or manager wants to record a transaction immediately
- the connection may be slow, unstable, or unavailable
- the interface must minimize taps, typing, and waiting

Manual entry should work with an offline-first approach:

- transaction drafts can be created without internet access
- required reference data should be cached locally
- entries should sync when connectivity returns
- the user should not lose work because the network is unstable

The manual flow should be optimized for speed, not completeness.
The system should capture the most operationally important data first and allow optional detail later.

### 10.1.1 Offline-First Capture Model

Phase 1 should follow an offline-first capture model.

This means:

- the user should be able to open the app without a reliable network connection
- the user should be able to log transactions without waiting for live server responses
- required reference data should already exist locally on the device
- new transactions should save locally first
- sync to the server should happen when connectivity is available

The core rule is:

do not make internet availability a dependency for recording a normal transaction

### 10.1.2 Cached Reference Data

The transaction form should not fetch core reference data on every entry attempt.

At minimum, the app should locally cache:

- staff list
- service list
- payment methods
- basic business settings needed for transaction entry

This cached data should be refreshed opportunistically when the network is available.

### 10.1.3 Local Save Before Remote Save

In Phase 1, transaction capture should prefer:

1. save locally on device
2. mark as pending sync
3. sync to remote database when connectivity returns

The user should receive immediate feedback that the transaction has been recorded locally, even if it has not yet reached the server.

### 10.2 Receipt Capture

The system must allow:

- mobile camera capture
- image upload from device storage
- one receipt per submission in the initial version

Receipt capture is a secondary workflow in Phase 1, not the primary one.
It should be available when useful, but it should not slow down the main product path.

### 10.3 Image Quality Checks

Before extraction, the system should support checks for:

- missing or heavily cropped receipt edges
- blur
- incorrect rotation
- poor contrast
- unreadable image quality

Phase 1 can start with basic warnings rather than perfect automated correction, but poor images should not silently proceed as if they are valid.

### 10.4 Extraction Pipeline

Each uploaded receipt should move through this flow:

1. image received
2. preprocessing
3. OCR/document reading
4. structured parsing
5. business-rule validation
6. confidence scoring
7. review if needed
8. save as transaction

The system must produce a transaction draft, not just raw OCR text.
This flow should run only when receipt-based extraction is being used.
It should not be imposed on manually entered transactions.

### 10.5 Confidence-Based Review

Every extracted field should have a confidence state:

- high confidence
- medium confidence
- low confidence

Expected behavior:

- high confidence fields can be accepted automatically
- medium confidence fields should be highlighted for quick manager review
- low confidence fields should require correction before final save when the field is operationally important

Confidence review is primarily for extracted transactions.
Manual transactions may still be validated, but they should not go through unnecessary extraction-review mechanics.

### 10.6 Business-Rule Validation

The system should validate transaction drafts against known rules:

- staff exists
- service exists or can remain temporarily unmapped
- quantity and pricing are numerically valid
- line totals match quantity x unit price where possible
- final total matches line totals where possible
- payment method is recognized
- transaction date is reasonable
- likely duplicates are flagged

Validation must improve trustworthiness, not block normal use unnecessarily.
Validation should be lightweight enough to preserve entry speed, especially in low-connectivity conditions.
Where necessary, some validation can happen after local save and before or during sync.

### 10.7 Manual Quick Entry Requirements

There must be a very fast path for manual transaction entry.

Minimum flow:

1. date
2. staff member
3. service line items
4. total amount
5. payment method
6. optional customer info
7. save

Manual entry should be optimized for speed, not completeness.
Phase 1 should prefer short, practical capture over perfect data collection.

The form should be designed so that:

- a common transaction can be entered in seconds
- common fields are preloaded or selectable
- repeated typing is minimized
- network calls do not block local save
- users can continue working when offline
- optional fields never slow down the core path

### 10.8 Save and Status Model

Each transaction should support a simple status model:

- draft
- needs review
- verified
- saved

Each transaction should also support a sync state:

- local only
- pending sync
- synced
- sync failed

If product implementation prefers fewer statuses, keep the meaning intact:

- not yet trustworthy
- requires human attention
- ready for final storage

## 11. Offline Architecture Responsibilities

Phase 1 should explicitly separate four responsibilities:

1. PWA shell
2. service worker
3. local data storage
4. sync engine

These are related, but they are not the same thing.

### 11.1 PWA Responsibilities

The PWA layer should provide:

- installable app behavior on supported devices
- app-like access from the home screen
- cached app shell for faster loading
- a stable entry point even under weak connectivity

The PWA is mainly about packaging, installability, and resilient access to the interface.

### 11.2 Service Worker Responsibilities

The service worker should provide:

- caching of static assets required to open the app
- controlled handling of network requests
- support for offline availability of the app shell
- optional support for deferred background work where appropriate

The service worker should not be treated as the only offline solution.
It helps the app load and behave well offline, but it is not the main storage system for transaction data.

### 11.3 Local Data Storage Responsibilities

Local data storage is the core of offline transaction capture.

It should store:

- cached reference data
- locally created transactions
- pending sync queue metadata
- sync failure state where needed

For this product shape, local storage should be designed as a real client-side data layer, not just temporary form memory.

### 11.4 Sync Engine Responsibilities

The sync engine should be responsible for:

- detecting pending locally saved transactions
- pushing them to the remote database when connectivity is available
- refreshing cached reference data when appropriate
- handling retry behavior
- marking sync success or failure clearly

The sync engine is the layer that turns offline capture into consistent remote records.

### 11.5 Guiding Constraint

PWA and service worker support are useful, but they are not enough by themselves.

The essential Phase 1 requirement is:

offline-first local transaction entry with reliable eventual sync

## 12. UX Requirements

Phase 1 UX should optimize for low-friction operations.

The primary screens should be:

1. transaction intake dashboard
2. manual quick entry form
3. receipt upload/capture flow
4. extraction review screen
5. transaction list
6. transaction detail view

The manual entry screen is the most important workflow surface in this phase.
It must be extremely fast, resilient, and usable with weak or no internet.
The review screen is important for receipt-based flows, but it is secondary.

### 12.1 Connectivity UX

The interface should clearly communicate connectivity and sync state without interrupting entry flow.

The user should be able to understand:

- whether they are offline or online
- whether a transaction is saved locally
- whether a transaction is pending sync
- whether sync failed and needs attention

This status communication should be lightweight and operationally clear.

## 13. What Good Phase 1 UX Looks Like

The user should be able to:

- manually save a transaction in seconds
- continue recording transactions while offline
- trust that entries will sync later without rework
- upload a receipt when manual entry is not the best option
- understand what the system extracted at a glance
- see exactly which fields are uncertain
- fix only the questionable parts
- save a reliable record without re-entering everything

If manual entry feels slow, network-dependent, or fragile, the Phase 1 design has failed.
If the user ends up retyping most extracted receipts, the receipt workflow has failed.

## 14. Suggested Data Model for Implementation

Phase 1 should at minimum introduce these entities:

### businesses

- id
- name
- currency
- timezone
- created_at

### staff

- id
- business_id
- name
- active
- created_at

### services

- id
- business_id
- name
- active
- expected_price_min nullable
- expected_price_max nullable
- created_at

### transactions

- id
- business_id
- transaction_date
- customer_name nullable
- customer_phone nullable
- payment_method
- final_total
- entry_source
- review_status
- sync_status
- device_created_at nullable
- synced_at nullable
- extraction_confidence nullable
- receipt_image_url nullable
- raw_extraction_payload nullable
- local_device_id nullable
- created_by
- created_at
- updated_at

### transaction_items

- id
- transaction_id
- service_label_raw
- service_id nullable
- quantity nullable
- unit_price nullable
- line_total nullable
- staff_id nullable

### extraction_reviews

- id
- transaction_id
- field_name
- extracted_value
- corrected_value nullable
- confidence_level
- review_required
- reviewed_by nullable
- reviewed_at nullable

This is the minimum product-oriented structure.
Do not expand it into a full CRM schema in this phase.

## 15. Suggested Client-Side Storage Model

The client should maintain local stores for:

- reference data cache
- unsynced transactions
- synced transactions needed for immediate local display
- sync metadata

The system should be able to render the transaction entry flow from locally available data.

## 16. Operational Rules

Phase 1 should follow these rules:

- manual entry is the default workflow
- offline use is a first-class requirement
- local capture must be fast even before sync completes
- preserve original receipt evidence when available
- keep raw extraction output for debugging and improvement
- separate raw extracted text from normalized saved data
- allow unknown service labels temporarily instead of blocking the workflow
- flag suspicious records instead of forcing perfect data every time
- avoid irreversible transformations during ingestion
- do not require every transaction to pass through the same heavy processing path
- do not make the user wait for the server before confirming local capture

## 17. Metrics for Phase 1

Track these metrics from the start:

- average time to save a manual transaction
- percentage of transactions captured manually
- percentage of transactions captured while offline
- sync success rate after offline capture
- number of receipts uploaded
- number of manually entered transactions
- extraction success rate
- average correction count per receipt
- percentage of transactions saved without major edits
- average review time per receipt
- duplicate flag rate
- missing phone number rate
- unknown staff/service match rate

The key operating metric for this phase is:

trustworthy transactions created per day at acceptable review cost

## 18. Definition of Done for Phase 1

Phase 1 is done when all of the following are true:

- a manager can manually enter a transaction quickly without using receipt scanning
- manual transactions can still be captured when the internet is poor or unavailable
- locally captured transactions sync reliably when connectivity returns
- a manager can upload a receipt image and get a structured transaction draft
- uncertain extracted fields are clearly flagged
- business-rule checks catch obvious errors and duplicates
- verified transactions are saved in a queryable structured format
- the team can measure correction rate, confidence, and review time

Phase 1 is not done merely because auth, file upload, or OCR works in isolation.

## 19. Phase 1 Delivery Order

Build in this order:

1. business auth and basic business context
2. minimal staff, services, and payment-method reference data
3. PWA shell and installability baseline
4. local reference-data cache and local transaction storage
5. offline-capable manual quick entry
6. sync model and connectivity state handling
7. transaction list/detail
8. receipt upload and image storage
9. extraction pipeline returning transaction drafts
10. review UI with confidence indicators
11. validation and duplicate detection
12. instrumentation and reporting for Phase 1 metrics

This order must be followed unless a technical dependency makes a small adjustment necessary.

## 20. Guardrails Against Drift

Do not add the following during Phase 1 unless the product decision is explicitly changed:

- booking calendar UI
- customer retention campaigns
- loyalty points
- WhatsApp inboxes
- staff payroll logic
- commission engine
- marketing dashboards
- inventory workflows
- branch comparison views

The question for any new proposed feature is:

Does this directly improve the capture, review, validation, or trustworthiness of transaction records?

If the answer is no, it belongs to a later phase.

## 21. Immediate Build Interpretation for This Repo

Given the current codebase, Phase 1 implementation should replace the starter-template focus with:

- product branding for the salon operating system
- authenticated business workspace
- transaction-focused navigation
- PWA shell and offline app setup
- local reference-data cache
- local transaction storage and sync state
- initial transaction schema
- offline-first manual entry flow
- receipt upload flow
- review workflow
- transaction ledger screens

Starter tutorial content, generic Supabase marketing content, and unrelated product modules should be removed or replaced as implementation begins.

## 22. Final Constraint

Phase 1 should solve one thing well:

turn messy, real-world salon transaction activity into reliable digital records as fast as possible, even when internet access is unreliable.

Everything else comes later.
