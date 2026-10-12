-- Mezgeb future Supabase schema. Review and apply only after linking a Supabase project.
-- Local-first frontend does NOT write to these tables yet.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 created_at timestamptz not null default now()
);
create table if not exists public.businesses (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) > 0),
 tin text not null default '',
 phone text not null default '',
 vat_registered boolean not null default false,
 created_at timestamptz not null default now(),
 unique (id, owner_id)
);
create table if not exists public.ledger_entries (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 owner_id uuid not null references auth.users(id),
 entry_type text not null check (entry_type in ('sale','expense')),
 amount_cents bigint not null check (amount_cents > 0),
 category text not null,
 payment_method text not null,
 note text not null default '',
 entry_date date not null,
 created_at timestamptz not null default now(),
 client_mutation_id uuid not null,
 unique (business_id,client_mutation_id)
);
create index if not exists ledger_entries_business_date on public.ledger_entries (business_id,entry_date desc);
create table if not exists public.credit_customers (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 name text not null,
 phone text not null default '',
 created_at timestamptz not null default now()
);
create table if not exists public.credit_events (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 customer_id uuid not null references public.credit_customers(id) on delete restrict,
 entry_type text not null check(entry_type in ('credit','payment')),
 amount_cents bigint not null check(amount_cents > 0),
 note text not null default '',
 client_mutation_id uuid not null,
 created_at timestamptz not null default now(),
 unique (business_id,client_mutation_id)
);
create index if not exists credit_events_customer_date on public.credit_events (customer_id,created_at desc);

-- Issued receipts require a trusted server-side numbering transaction;
-- this table is intentionally not writable by browser roles.
create table if not exists public.receipt_records (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete restrict,
 ledger_entry_id uuid not null unique references public.ledger_entries(id) on delete restrict,
 serial_number text not null,
 issued_at timestamptz not null default now(),
 unique (business_id,serial_number)
);
create table if not exists public.subscriptions (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null unique references public.businesses(id) on delete cascade,
 plan text not null check(plan in ('free','standard','premium')),
 status text not null check(status in ('active','expired','pending','cancelled')),
 expires_at timestamptz,
 provider_reference text,
 updated_at timestamptz not null default now()
);
create table if not exists public.payment_attempts (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 provider text not null,
 provider_reference text not null unique,
 plan text not null check(plan in ('standard','premium')),
 amount_cents bigint not null check(amount_cents > 0),
 status text not null check(status in ('pending','verified','failed','cancelled')),
 created_at timestamptz not null default now()
);
create table if not exists public.audit_events (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.businesses(id) on delete cascade,
 actor_id uuid references auth.users(id),
 operation text not null,
 entity_type text not null,
 entity_id text not null,
 created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.credit_customers enable row level security;
alter table public.credit_events enable row level security;
alter table public.receipt_records enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.audit_events enable row level security;

create policy "profiles_self_select" on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy "profiles_self_insert" on public.profiles for insert to authenticated with check (id=(select auth.uid()));
create policy "profiles_self_update" on public.profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));
create policy "business_owner_all" on public.businesses for all to authenticated
 using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
create policy "ledger_owner_select" on public.ledger_entries for select to authenticated
 using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "ledger_owner_insert" on public.ledger_entries for insert to authenticated
 with check (owner_id=(select auth.uid()) and exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "ledger_owner_update" on public.ledger_entries for update to authenticated
 using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())))
 with check (owner_id=(select auth.uid()) and exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "ledger_owner_delete" on public.ledger_entries for delete to authenticated
 using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid()))
 and not exists (select 1 from public.receipt_records r where r.ledger_entry_id=id));
create policy "customer_owner_all" on public.credit_customers for all to authenticated
 using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())))
 with check (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "credit_owner_all" on public.credit_events for all to authenticated
 using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())))
 with check (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid()))
 and exists(select 1 from public.credit_customers c where c.id=customer_id and c.business_id=business_id));
create policy "receipts_read_only" on public.receipt_records for select to authenticated
 using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "subscriptions_read_only" on public.subscriptions for select to authenticated
 using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "payments_read_only" on public.payment_attempts for select to authenticated
 using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));
create policy "audit_read_only" on public.audit_events for select to authenticated
 using (exists (select 1 from public.businesses b where b.id=business_id and b.owner_id=(select auth.uid())));

-- IMPORTANT BEFORE PRODUCTION:
-- Harden audit triggers, enforce immutable posted entries, create transactional
-- credit-balance validation, and implement privileged, verified receipt/payment
-- server functions. This is a baseline migration, NOT a completed fiscal backend.
