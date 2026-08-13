create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists customers_business_name_phone_key
  on public.customers (business_id, lower(name), coalesce(phone, ''));

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  client_payment_id text not null,
  amount numeric(12,2) not null check (amount >= 0),
  method text not null,
  status text not null check (status in ('completed', 'pending', 'failed')),
  reference text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payments_transaction_client_payment_key unique (transaction_id, client_payment_id)
);

create table if not exists public.transaction_audit_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  client_event_id text not null,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  source text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint transaction_audit_events_client_event_key unique (client_event_id)
);

alter table public.transactions
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists status text not null default 'confirmed',
  add column if not exists subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  add column if not exists discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_status_check'
  ) then
    alter table public.transactions
      add constraint transactions_status_check
      check (status in ('draft', 'confirmed', 'voided', 'processing'));
  end if;
end $$;

alter table public.transaction_items
  add column if not exists item_type text not null default 'service',
  add column if not exists notes text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transaction_items_item_type_check'
  ) then
    alter table public.transaction_items
      add constraint transaction_items_item_type_check
      check (item_type in ('service', 'product', 'fee'));
  end if;
end $$;

create index if not exists customers_business_id_idx
  on public.customers (business_id);

create index if not exists transactions_customer_id_idx
  on public.transactions (customer_id);

create index if not exists payments_transaction_id_idx
  on public.payments (transaction_id);

create index if not exists transaction_audit_events_transaction_id_idx
  on public.transaction_audit_events (transaction_id);

alter table public.customers enable row level security;
alter table public.payments enable row level security;
alter table public.transaction_audit_events enable row level security;

grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.transaction_audit_events to authenticated;

drop policy if exists "members can view customers" on public.customers;
create policy "members can view customers"
on public.customers
for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "team can manage customers" on public.customers;
create policy "team can manage customers"
on public.customers
for all
to authenticated
using (public.can_record_transactions(business_id))
with check (public.can_record_transactions(business_id));

drop policy if exists "members can view payments" on public.payments;
create policy "members can view payments"
on public.payments
for select
to authenticated
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and public.is_business_member(t.business_id)
  )
);

drop policy if exists "team can manage payments" on public.payments;
create policy "team can manage payments"
on public.payments
for all
to authenticated
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and public.can_record_transactions(t.business_id)
  )
)
with check (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and public.can_record_transactions(t.business_id)
  )
);

drop policy if exists "members can view transaction audit events" on public.transaction_audit_events;
create policy "members can view transaction audit events"
on public.transaction_audit_events
for select
to authenticated
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and public.is_business_member(t.business_id)
  )
);

drop policy if exists "team can manage transaction audit events" on public.transaction_audit_events;
create policy "team can manage transaction audit events"
on public.transaction_audit_events
for all
to authenticated
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and public.can_record_transactions(t.business_id)
  )
)
with check (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and public.can_record_transactions(t.business_id)
  )
);

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row
execute procedure app_private.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row
execute procedure app_private.set_updated_at();
