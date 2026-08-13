drop policy if exists "business members can view businesses" on public.businesses;

create policy "business members can view businesses"
on public.businesses
for select
to authenticated
using (
  public.is_business_member(id)
  or owner_user_id = auth.uid()
);
