create or replace function app_private.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = target_business_id
      and bu.user_id = auth.uid()
  );
$$;

create or replace function app_private.can_manage_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = target_business_id
      and bu.user_id = auth.uid()
      and bu.role in ('owner', 'manager')
  );
$$;

create or replace function app_private.can_record_transactions(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = target_business_id
      and bu.user_id = auth.uid()
      and bu.role in ('owner', 'manager', 'reception', 'staff')
  );
$$;

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
set search_path = public, auth
as $$
  select app_private.is_business_member(target_business_id);
$$;

create or replace function public.can_manage_business(target_business_id uuid)
returns boolean
language sql
stable
set search_path = public, auth
as $$
  select app_private.can_manage_business(target_business_id);
$$;

create or replace function public.can_record_transactions(target_business_id uuid)
returns boolean
language sql
stable
set search_path = public, auth
as $$
  select app_private.can_record_transactions(target_business_id);
$$;

revoke all on function app_private.is_business_member(uuid) from public;
revoke all on function app_private.can_manage_business(uuid) from public;
revoke all on function app_private.can_record_transactions(uuid) from public;
