-- Indexes for Mezgeb owner-scoped lookups and foreign-key enforcement.
create index if not exists mezgeb_credit_customers_business_fk on public.credit_customers(business_id);
create index if not exists mezgeb_credit_events_business_fk on public.credit_events(business_id);
create index if not exists mezgeb_credit_events_customer_business_fk on public.credit_events(customer_id,business_id);
create index if not exists mezgeb_payment_attempts_business_fk on public.payment_attempts(business_id);
create index if not exists mezgeb_audit_business_fk on public.audit_events(business_id);
create index if not exists mezgeb_audit_actor_fk on public.audit_events(actor_id);
