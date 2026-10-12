-- Mezgeb v1 secure, non-destructive foundation, 2026-10-12.
-- Application database for the DEDICATED Mezgeb Supabase project.
-- Do not run against the NexRide, EliteTrade, or Hisab Technologies projects.
-- Issued fiscal receipts and paid subscriptions are intentionally server-only.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(char_length(display_name)<=160),
 created_at timestamptz not null default now()
);

create table if not exists public.businesses (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null check (char_length(btrim(name)) between 1 and 180),
 tin text not null default '' check(char_length(tin)<=60),
 phone text not null default '' check(char_length(phone)<=60),
 vat_registered boolean not null default false,
 created_at timestamptz not null default now()
);

-- Encrypted transport is provided by HTTPS. This document is NOT an
-- end-to-end encrypted backup: do not store passwords or payment secrets in it.
-- The snapshot is an explicit opt-in backup of local financial drafts, not
-- certified fiscal records and not an automatically reconciled live ledger.
create table if not exists public.business_snapshots (
 business_id uuid primary key references public.businesses(id) on delete cascade,
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=2000000),
 revision bigint not null default 1 check(revision >= 1),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create or replace function public.mezgeb_increment_snapshot_revision()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if new.business_id is distinct from old.business_id then
  raise exception 'Cannot transfer a snapshot between businesses';
 end if;
 new.revision := old.revision + 1;
 new.created_at := old.created_at;
 new.updated_at := now();
 return new;
end;
$$;
create trigger mezgeb_snapshot_revision
before update on public.business_snapshots
for each row execute function public.mezgeb_increment_snapshot_revision();

-- Future canonical financial tables. Existing local-first client does not
-- automatically write to these. Record issuance and payments require backend RPC.
create table if not exists public.ledger_entries (
 id uuid primary key,
 business_id uuid not null references public.businesses(id) on delete restrict,
 entry_type text not null check(entry_type in ('sale','expense')),
 amount_cents bigint not null check(amount_cents>0),
 category text not null check(char_length(category) between 1 and 100),
 payment_method text not null check(char_length(payment_method) between 1 and 90),
 note text not null default '' check(char_length(note)<=1000),
 entry_date date not null,
 receipt_draft_number text,
 posted_at timestamptz not null default now(),
 voided_at timestamptz,
 unique(business_id,id)
);
create index if not exists mezgeb_ledger_business_date on public.ledger_entries(business_id,entry_date desc);

create table if not exists public.credit_customers (
 id uuid primary key,
 business_id uuid not null references public.businesses(id) on delete restrict,
 name text not null check(char_length(name) between 1 and 180),
 phone text not null default '' check(char_length(phone)<=60),
 created_at timestamptz not null default now(),
 unique(id,business_id)
);
create table if not exists public.credit_events (
 id uuid primary key,
 business_id uuid not null references public.businesses(id) on delete restrict,
 customer_id uuid not null,
 entry_type text not null check(entry_type in ('credit','payment')),
 amount_cents bigint not null check(amount_cents>0),
 note text not null default '' check(char_length(note)<=1000),
 created_at timestamptz not null default now(),
 foreign key(customer_id,business_id) references public.credit_customers(id,business_id)
);
create index if not exists mezgeb_credit_events_customer on public.credit_events(customer_id,created_at desc);

create table if not exists public.receipt_records (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete restrict,
 ledger_entry_id uuid not null unique references public.ledger_entries(id) on delete restrict,
 serial_number text not null,
 issued_at timestamptz not null default now(),
 unique(business_id,serial_number)
);

create table if not exists public.subscriptions (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null unique references public.businesses(id) on delete restrict,
 plan text not null check(plan in ('free','standard','premium')),
 status text not null check(status in ('active','expired','pending','cancelled')),
 expires_at timestamptz,
 provider_reference text,
 updated_at timestamptz not null default now()
);
create table if not exists public.payment_attempts (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete restrict,
 provider text not null,
 provider_reference text not null unique,
 plan text not null check(plan in ('standard','premium')),
 amount_cents bigint not null check(amount_cents>0),
 status text not null check(status in ('pending','verified','failed','cancelled')),
 created_at timestamptz not null default now()
);
create table if not exists public.audit_events (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete restrict,
 actor_id uuid references auth.users(id),
 operation text not null,
 entity_type text not null,
 entity_id text not null,
 created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_snapshots enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.credit_customers enable row level security;
alter table public.credit_events enable row level security;
alter table public.receipt_records enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.audit_events enable row level security;

-- Remove broad default API grants. Return only explicit, RLS-filtered access.
revoke all on table public.profiles,public.businesses,public.business_snapshots,
 public.ledger_entries,public.credit_customers,public.credit_events,
 public.receipt_records,public.subscriptions,public.payment_attempts,public.audit_events
 from anon, authenticated;
grant select,insert,update on public.profiles to authenticated;
grant select,insert,update on public.businesses to authenticated;
grant select,insert,update on public.business_snapshots to authenticated;
grant select,insert,update on public.ledger_entries to authenticated;
grant select,insert,update on public.credit_customers to authenticated;
grant select,insert on public.credit_events to authenticated; -- append-only
grant select on public.receipt_records,public.subscriptions,public.payment_attempts,public.audit_events to authenticated;

create policy profile_self_read on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy profile_self_insert on public.profiles for insert to authenticated with check(id=(select auth.uid()));
create policy profile_self_update on public.profiles for update to authenticated
 using(id=(select auth.uid())) with check(id=(select auth.uid()));

create policy business_owner_read on public.businesses for select to authenticated using(owner_id=(select auth.uid()));
create policy business_owner_insert on public.businesses for insert to authenticated with check(owner_id=(select auth.uid()));
create policy business_owner_update on public.businesses for update to authenticated
 using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));

create policy snapshot_owner_read on public.business_snapshots for select to authenticated
 using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy snapshot_owner_insert on public.business_snapshots for insert to authenticated
 with check(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy snapshot_owner_update on public.business_snapshots for update to authenticated
 using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())))
 with check(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));

create policy ledger_owner_read on public.ledger_entries for select to authenticated
 using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy ledger_owner_insert on public.ledger_entries for insert to authenticated
 with check(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy ledger_owner_update on public.ledger_entries for update to authenticated
 using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())))
 with check(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy credit_customer_owner_read on public.credit_customers for select to authenticated
 using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy credit_customer_owner_insert on public.credit_customers for insert to authenticated
 with check(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy credit_customer_owner_update on public.credit_customers for update to authenticated
 using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())))
 with check(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy credit_event_owner_read on public.credit_events for select to authenticated
 using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy credit_event_owner_insert on public.credit_events for insert to authenticated
 with check(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));

-- The service role is responsible for certified issuance, verified payment
-- status changes, subscriptions, and immutable operational auditing.
create policy receipt_owner_read on public.receipt_records for select to authenticated
 using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy subscription_owner_read on public.subscriptions for select to authenticated
 using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy payment_owner_read on public.payment_attempts for select to authenticated
 using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy audit_owner_read on public.audit_events for select to authenticated
 using(exists(select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));

-- Privileged immutable receipt guard, even if update privileges are granted in
-- future migrations. Issued receipt entries cannot be altered/voided in-place.
create or replace function public.mezgeb_block_issued_entry_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if exists(select 1 from public.receipt_records where ledger_entry_id=old.id) then
  raise exception 'Issued-receipt ledger entries are immutable';
 end if;
 return new;
end;
$$;
create trigger mezgeb_immutable_issued_entry
before update or delete on public.ledger_entries
for each row execute function public.mezgeb_block_issued_entry_change();

-- Functions are triggers only; untrusted clients need no EXECUTE privilege.
revoke all on function public.mezgeb_increment_snapshot_revision() from public,anon,authenticated;
revoke all on function public.mezgeb_block_issued_entry_change() from public,anon,authenticated;
