create extension if not exists "pgcrypto";

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  created_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  field text not null,
  description text,
  audience text,
  services text,
  tone text,
  hours text,
  faqs text,
  prices text,
  forbidden_topics text,
  conversation_goal text not null default 'לקבוע שיחה',
  created_at timestamptz not null default now()
);

create table public.business_users (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  role text not null,
  opening_message text,
  qualification_questions text,
  behavior_instructions text,
  handoff_rules text,
  hot_lead_rules text,
  objection_rules text,
  disqualification_rules text,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  phone text,
  source text,
  status text not null default 'פתוחה',
  heat text not null default 'קר',
  need_summary text,
  next_action text,
  follow_up_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null default 'פתוחה',
  heat text not null default 'קר',
  needs_human boolean not null default false,
  summary text,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender text not null check (sender in ('lead', 'agent')),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  input jsonb not null default '{}',
  output jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.integration_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  provider text not null default 'goldenflow_crm',
  mode text not null default 'mock',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.businesses enable row level security;
alter table public.business_users enable row level security;
alter table public.ai_agents enable row level security;
alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.lead_events enable row level security;
alter table public.agent_runs enable row level security;
alter table public.integration_settings enable row level security;

create or replace function public.user_has_business(target_business_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_users bu
    where bu.business_id = target_business_id
      and bu.user_id = auth.uid()
  );
$$;

create policy "users can read themselves" on public.users
  for select using (id = auth.uid());

create policy "users can update themselves" on public.users
  for update using (id = auth.uid());

create policy "business members can access businesses" on public.businesses
  for all using (public.user_has_business(id))
  with check (public.user_has_business(id));

create policy "business members can access memberships" on public.business_users
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));

create policy "business members can access agents" on public.ai_agents
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));

create policy "business members can access leads" on public.leads
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));

create policy "business members can access conversations" on public.conversations
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));

create policy "business members can access messages" on public.messages
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));

create policy "business members can access lead events" on public.lead_events
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));

create policy "business members can access agent runs" on public.agent_runs
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));

create policy "business members can access integration settings" on public.integration_settings
  for all using (public.user_has_business(business_id))
  with check (public.user_has_business(business_id));
