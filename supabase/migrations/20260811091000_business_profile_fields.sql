alter table public.businesses
add column if not exists business_type text not null default 'Salon',
add column if not exists country text not null default 'Nigeria';
