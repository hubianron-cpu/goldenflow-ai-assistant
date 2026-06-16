-- Phase 3: WhatsApp pilot, draft approval, background jobs, audit and CRM action queue.
-- Non-destructive migration: adds nullable/defaulted columns and new business-scoped tables.

alter table public.businesses
  add column if not exists timezone text not null default 'Asia/Jerusalem',
  add column if not exists pilot_enabled boolean not null default false,
  add column if not exists agent_enabled boolean not null default false,
  add column if not exists whatsapp_receiving_enabled boolean not null default false,
  add column if not exists whatsapp_sending_enabled boolean not null default false,
  add column if not exists crm_sync_enabled boolean not null default false,
  add column if not exists phone_allowlist_enabled boolean not null default true,
  add column if not exists automation_level text not null default 'draft_only',
  add column if not exists debounce_window_seconds integer not null default 60,
  add column if not exists daily_message_limit integer not null default 100;

alter table public.leads
  add column if not exists normalized_phone text,
  add column if not exists do_not_contact boolean not null default false,
  add column if not exists do_not_contact_at timestamptz,
  add column if not exists opt_out_reason text;

alter table public.conversations
  add column if not exists whatsapp_connection_id uuid,
  add column if not exists processing_lock_at timestamptz,
  add column if not exists processing_lock_expires_at timestamptz;

alter table public.messages
  add column if not exists provider text not null default 'simulator',
  add column if not exists external_event_id text,
  add column if not exists message_type text not null default 'text',
  add column if not exists delivery_status text not null default 'delivered',
  add column if not exists raw_payload_reference text;

create table if not exists public.business_integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null,
  status text not null default 'not_configured',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null default 'whatsapp_cloud',
  phone_number_id text not null,
  business_account_id text,
  receiver_phone text not null,
  status text not null default 'not_configured',
  last_webhook_at timestamptz,
  last_message_at timestamptz,
  last_send_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  job_type text not null,
  entity_id text not null,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  scheduled_for timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  lock_expires_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz
);

create table if not exists public.message_processing_batches (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  status text not null default 'pending',
  first_message_at timestamptz not null,
  last_message_at timestamptz not null,
  process_after timestamptz not null,
  message_ids uuid[] not null default '{}',
  agent_run_id uuid,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  failed_at timestamptz
);

create table if not exists public.outbound_drafts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  source_message_ids uuid[] not null default '{}',
  original_draft_message text not null,
  draft_message text not null,
  status text not null default 'pending_approval',
  confidence integer not null default 0,
  block_reason text,
  approved_by uuid,
  approved_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outbound_message_attempts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  draft_id uuid not null references public.outbound_drafts(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  provider text not null,
  status text not null default 'queued',
  idempotency_key text not null,
  external_message_id text,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table if not exists public.crm_sync_actions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  action_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}',
  status text not null default 'pending',
  idempotency_key text not null,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (business_id, idempotency_key)
);

create table if not exists public.crm_status_mappings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  assistant_status text not null,
  crm_status text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, assistant_status)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_type text not null,
  actor_id text,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  result text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.pilot_usage_counters (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  counter_date date not null default current_date,
  counters jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, counter_date)
);

create table if not exists public.phone_allowlist (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  normalized_phone text not null,
  label text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, normalized_phone)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  entity_id text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists unique_whatsapp_event_id
  on public.integration_events (business_id, provider, external_event_id)
  where external_event_id is not null;

create unique index if not exists unique_external_message_id
  on public.messages (business_id, provider, external_message_id)
  where external_message_id is not null;

-- Add after duplicate review in production data:
-- create unique index unique_business_normalized_phone on public.leads (business_id, normalized_phone) where normalized_phone is not null;

alter table public.business_integrations enable row level security;
alter table public.whatsapp_connections enable row level security;
alter table public.background_jobs enable row level security;
alter table public.message_processing_batches enable row level security;
alter table public.outbound_drafts enable row level security;
alter table public.outbound_message_attempts enable row level security;
alter table public.crm_sync_actions enable row level security;
alter table public.crm_status_mappings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.pilot_usage_counters enable row level security;
alter table public.phone_allowlist enable row level security;
alter table public.notifications enable row level security;

create policy "business members can access business integrations" on public.business_integrations for all using (public.user_has_business(business_id)) with check (public.user_has_business(business_id));
create policy "business members can access whatsapp connections" on public.whatsapp_connections for all using (public.user_has_business(business_id)) with check (public.user_has_business(business_id));
create policy "business members can access background jobs" on public.background_jobs for all using (public.user_has_business(business_id)) with check (public.user_has_business(business_id));
create policy "business members can access message batches" on public.message_processing_batches for all using (public.user_has_business(business_id)) with check (public.user_has_business(business_id));
create policy "business members can access outbound drafts" on public.outbound_drafts for all using (public.user_has_business(business_id)) with check (public.user_has_business(business_id));
create policy "business members can access outbound attempts" on public.outbound_message_attempts for all using (public.user_has_business(business_id)) with check (public.user_has_business(business_id));
create policy "business members can access crm sync actions" on public.crm_sync_actions for all using (public.user_has_business(business_id)) with check (public.user_has_business(business_id));
create policy "business members can access crm mappings" on public.crm_status_mappings for all using (public.user_has_business(business_id)) with check (public.user_has_business(business_id));
create policy "business members can access audit logs" on public.audit_logs for all using (public.user_has_business(business_id)) with check (public.user_has_business(business_id));
create policy "business members can access usage counters" on public.pilot_usage_counters for all using (public.user_has_business(business_id)) with check (public.user_has_business(business_id));
create policy "business members can access phone allowlist" on public.phone_allowlist for all using (public.user_has_business(business_id)) with check (public.user_has_business(business_id));
create policy "business members can access notifications" on public.notifications for all using (public.user_has_business(business_id)) with check (public.user_has_business(business_id));
