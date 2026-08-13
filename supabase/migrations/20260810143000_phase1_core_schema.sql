create extension if not exists pgcrypto;

create schema if not exists app_private;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  currency text not null default 'NGN',
  timezone text not null default 'Africa/Lagos',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.business_users (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'reception', 'staff', 'accountant')),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (business_id, user_id)
);

create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  active boolean not null default true,
  expected_price_min numeric(12,2),
  expected_price_max numeric(12,2),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payment_methods_business_code_key unique (business_id, code)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  client_generated_id uuid not null,
  staff_id uuid not null references public.staff(id) on delete restrict,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  transaction_date date not null,
  customer_name text,
  customer_phone text,
  payment_method_code text not null,
  final_total numeric(12,2) not null check (final_total >= 0),
  entry_source text not null check (entry_source in ('manual', 'receipt_upload', 'receipt_extraction')),
  review_status text not null check (review_status in ('draft', 'needs_review', 'verified', 'saved')),
  receipt_image_url text,
  raw_extraction_payload jsonb,
  device_created_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint transactions_business_client_generated_key unique (business_id, client_generated_id)
);

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_label_raw text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0 check (unit_price >= 0),
  line_total numeric(12,2) not null default 0 check (line_total >= 0),
  staff_id uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists business_users_user_id_idx
  on public.business_users (user_id);

create index if not exists staff_business_id_idx
  on public.staff (business_id);

create index if not exists services_business_id_idx
  on public.services (business_id);

create index if not exists payment_methods_business_id_idx
  on public.payment_methods (business_id);

create index if not exists transactions_business_id_idx
  on public.transactions (business_id, transaction_date desc);

create index if not exists transactions_staff_id_idx
  on public.transactions (staff_id);

create index if not exists transaction_items_transaction_id_idx
  on public.transaction_items (transaction_id);

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = target_business_id
      and bu.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_business(target_business_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = target_business_id
      and bu.user_id = auth.uid()
      and bu.role in ('owner', 'manager')
  );
$$;

create or replace function public.can_record_transactions(target_business_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = target_business_id
      and bu.user_id = auth.uid()
      and bu.role in ('owner', 'manager', 'reception', 'staff')
  );
$$;

alter table public.businesses enable row level security;
alter table public.business_users enable row level security;
alter table public.staff enable row level security;
alter table public.services enable row level security;
alter table public.payment_methods enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;

grant select, insert, update, delete on public.businesses to authenticated;
grant select, insert, update, delete on public.business_users to authenticated;
grant select, insert, update, delete on public.staff to authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.payment_methods to authenticated;
grant select, insert, update, delete on public.transactions to authenticated;
grant select, insert, update, delete on public.transaction_items to authenticated;

drop policy if exists "business members can view businesses" on public.businesses;
create policy "business members can view businesses"
on public.businesses
for select
to authenticated
using (public.is_business_member(id));

drop policy if exists "owners can create businesses" on public.businesses;
create policy "owners can create businesses"
on public.businesses
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "managers can update businesses" on public.businesses;
create policy "managers can update businesses"
on public.businesses
for update
to authenticated
using (public.can_manage_business(id))
with check (public.can_manage_business(id));

drop policy if exists "owners can delete businesses" on public.businesses;
create policy "owners can delete businesses"
on public.businesses
for delete
to authenticated
using (
  exists (
    select 1
    from public.business_users bu
    where bu.business_id = id
      and bu.user_id = auth.uid()
      and bu.role = 'owner'
  )
);

drop policy if exists "members can view business users" on public.business_users;
create policy "members can view business users"
on public.business_users
for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "owners can add themselves to their businesses" on public.business_users;
create policy "owners can add themselves to their businesses"
on public.business_users
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.businesses b
    where b.id = business_id
      and b.owner_user_id = auth.uid()
  )
);

drop policy if exists "owners can manage business users" on public.business_users;
create policy "owners can manage business users"
on public.business_users
for update
to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists "owners can remove business users" on public.business_users;
create policy "owners can remove business users"
on public.business_users
for delete
to authenticated
using (public.can_manage_business(business_id));

drop policy if exists "members can view staff" on public.staff;
create policy "members can view staff"
on public.staff
for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "managers can manage staff" on public.staff;
create policy "managers can manage staff"
on public.staff
for all
to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists "members can view services" on public.services;
create policy "members can view services"
on public.services
for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "managers can manage services" on public.services;
create policy "managers can manage services"
on public.services
for all
to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists "members can view payment methods" on public.payment_methods;
create policy "members can view payment methods"
on public.payment_methods
for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "managers can manage payment methods" on public.payment_methods;
create policy "managers can manage payment methods"
on public.payment_methods
for all
to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

drop policy if exists "members can view transactions" on public.transactions;
create policy "members can view transactions"
on public.transactions
for select
to authenticated
using (public.is_business_member(business_id));

drop policy if exists "team can insert transactions" on public.transactions;
create policy "team can insert transactions"
on public.transactions
for insert
to authenticated
with check (
  public.can_record_transactions(business_id)
  and created_by_user_id = auth.uid()
);

drop policy if exists "team can update transactions" on public.transactions;
create policy "team can update transactions"
on public.transactions
for update
to authenticated
using (public.can_record_transactions(business_id))
with check (public.can_record_transactions(business_id));

drop policy if exists "managers can delete transactions" on public.transactions;
create policy "managers can delete transactions"
on public.transactions
for delete
to authenticated
using (public.can_manage_business(business_id));

drop policy if exists "members can view transaction items" on public.transaction_items;
create policy "members can view transaction items"
on public.transaction_items
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

drop policy if exists "team can insert transaction items" on public.transaction_items;
create policy "team can insert transaction items"
on public.transaction_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and public.can_record_transactions(t.business_id)
  )
);

drop policy if exists "team can update transaction items" on public.transaction_items;
create policy "team can update transaction items"
on public.transaction_items
for update
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

drop policy if exists "managers can delete transaction items" on public.transaction_items;
create policy "managers can delete transaction items"
on public.transaction_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.transactions t
    where t.id = transaction_id
      and public.can_manage_business(t.business_id)
  )
);

drop trigger if exists set_businesses_updated_at on public.businesses;
create trigger set_businesses_updated_at
before update on public.businesses
for each row
execute function app_private.set_updated_at();

drop trigger if exists set_staff_updated_at on public.staff;
create trigger set_staff_updated_at
before update on public.staff
for each row
execute function app_private.set_updated_at();

drop trigger if exists set_services_updated_at on public.services;
create trigger set_services_updated_at
before update on public.services
for each row
execute function app_private.set_updated_at();

drop trigger if exists set_payment_methods_updated_at on public.payment_methods;
create trigger set_payment_methods_updated_at
before update on public.payment_methods
for each row
execute function app_private.set_updated_at();

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
before update on public.transactions
for each row
execute function app_private.set_updated_at();

drop trigger if exists set_transaction_items_updated_at on public.transaction_items;
create trigger set_transaction_items_updated_at
before update on public.transaction_items
for each row
execute function app_private.set_updated_at();
