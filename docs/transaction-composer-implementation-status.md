# Transaction Composer Implementation Status

Last updated: August 13, 2026

## Source Of Truth

The transaction composer must continue following the product note captured in:

- [docs/offline-first-product-principles.md](/Users/apple/Desktop/Binda%20Labs/binda_salon_system/docs/offline-first-product-principles.md)
- the fast transaction composer specification shared in this task

This work is **not complete yet**.

## What Is Already Implemented

- full-screen mobile-first transaction composer
- customer-first layout
- walk-in customer flow
- new customer bottom sheet
- existing-customer suggestions from local transaction history
- staff selection bottom sheet
- service selection bottom sheet
- editable service line items
- per-line-item staff support in the UI
- segmented payment selection
- auto-calculated total
- optional notes expansion
- sticky save area
- local-first save into IndexedDB
- background sync attempt after save
- duplicate warning before save
- success state with `Add another`
- dashboard updates immediately from local saved transactions

## What Still Needs To Be Completed

### Transaction Engine

- move toward one explicit transaction engine shared by manual entry, receipt extraction, and future inputs
- align transaction lifecycle more clearly with draft / confirmed / needs_review / voided concepts
- add stronger validate -> save -> sync boundaries

### Data Model

- separate `transactions`, `transaction_items`, and `payments` properly
- stop treating payment method as the long-term final transaction payment model
- add a real `customers` model instead of relying on history-derived suggestions
- support nullable or explicit guest customer state cleanly
- add audit event writing for transaction creation and later updates

### Composer Features

- create new service from inside the composer and add it to both the transaction and service catalog
- improve validation coverage beyond the current staff/services checks
- support proper `View transaction` from save success
- improve duplicate review flow once transaction detail exists

### Transaction Surfaces

- build transaction list
- build transaction detail
- show pending sync / failed sync / synced states more clearly
- support retry and later manager review flows

### Analytics / Derived Behavior

- attach customer visits to real customer history
- attach service performance to saved items
- attach staff activity to saved items with stronger derived reporting

## Implementation Rule

Do not treat the current composer as finished.

Any new transaction-related implementation should help close the remaining gaps above instead of creating a parallel path.
