-- Phase 2: agent intelligence, state tracking, prompt versions and integration safety.
-- Non-destructive migration: only adds nullable/defaulted columns and new tables.

alter table public.leads
  add column if not exists lead_score integer not null default 0,
  add column if not exists intent_score integer not null default 0,
  add column if not exists engagement_score integer not null default 0,
  add column if not exists booking_probability integer not null default 0,
  add column if not exists lead_temperature text not null default 'cold',
  add column if not exists next_recommended_action text,
  add column if not exists external_lead_id text,
  add column if not exists last_score_reason text;

alter table public.conversations
  add column if not exists conversation_state text not null default 'new_lead',
  add column if not exists ai_mode text not null default 'active',
  add column if not exists memory_summary text,
  add column if not exists structured_memory jsonb not null default '{}',
  add column if not exists requires_owner_attention boolean not null default false,
  add column if not exists takeover_reason text,
  add column if not exists external_conversation_id text,
  add column if not exists last_agent_run_id uuid,
  add column if not exists lead_score integer not null default 0,
  add column if not exists intent_score integer not null default 0,
  add column if not exists engagement_score integer not null default 0,
  add column if not exists booking_probability integer not null default 0,
  add column if not exists lead_temperature text not null default 'cold';

alter table public.messages
  add column if not exists external_message_id text,
  add column if not exists idempotency_key text;

alter table public.agent_runs
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists model text,
  add column if not exists prompt_version_id uuid,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists latency_ms integer,
  add column if not exists input_tokens integer not null default 0,
  add column if not exists output_tokens integer not null default 0,
  add column if not exists estimated_cost numeric(12, 6) not null default 0,
  add column if not exists success boolean not null default true,
  add column if not exists error_type text,
  add column if not exists error_message text,
  add column if not exists retry_count integer not null default 0,
  add column if not exists output_valid boolean not null default true;

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ai_agent_id uuid not null references public.ai_agents(id) on delete cascade,
  version_number integer not null,
  status text not null default 'draft',
  system_prompt text not null,
  agent_instructions text,
  qualification_rules text,
  takeover_rules text,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz,
  unique (business_id, ai_agent_id, version_number)
);

create unique index if not exists one_active_prompt_per_agent
  on public.prompt_versions (business_id, ai_agent_id)
  where status = 'active';

create table if not exists public.conversation_state_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  previous_state text not null,
  new_state text not null,
  reason text not null,
  agent_run_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_score_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  previous_score integer not null,
  new_score integer not null,
  reason text not null,
  agent_run_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.follow_up_queue (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  status text not null default 'recommended',
  draft_message text not null,
  reason text not null,
  scheduled_for timestamptz not null,
  created_by text not null default 'agent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_actions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  action_type text not null,
  reason text not null,
  priority text not null default 'medium',
  recommended_due_at timestamptz not null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null default 'goldenflow_crm',
  event_type text not null,
  external_event_id text,
  idempotency_key text not null,
  payload jsonb not null default '{}',
  status text not null default 'pending',
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (business_id, provider, idempotency_key)
);

create unique index if not exists unique_message_idempotency
  on public.messages (business_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists unique_business_phone_lead
  on public.leads (business_id, regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g'));

alter table public.prompt_versions enable row level security;
alter table public.conversation_state_events enable row level security;
alter table public.lead_score_events enable row level security;
alter table public.follow_up_queue enable row level security;
alter table public.agent_actions enable row level security;
alter table public.integration_events enable row level security;

create policy "business members can access prompt versions" on public.prompt_versions
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));

create policy "business members can access state events" on public.conversation_state_events
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));

create policy "business members can access score events" on public.lead_score_events
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));

create policy "business members can access follow up queue" on public.follow_up_queue
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));

create policy "business members can access agent actions" on public.agent_actions
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));

create policy "business members can access integration events" on public.integration_events
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));
