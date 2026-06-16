-- Phase 4: staging auth onboarding and safer business membership bootstrap.
-- Non-destructive migration. Required because RLS correctly blocks direct
-- business insertion before the first membership exists.

alter table public.business_users
  drop constraint if exists business_users_role_check;

alter table public.business_users
  add constraint business_users_role_check check (role in ('owner', 'admin', 'member'));

create or replace function public.create_business_for_current_user(business_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_business_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authenticated user required';
  end if;

  insert into public.users (id, email, full_name)
  values (
    current_user_id,
    coalesce(auth.jwt() ->> 'email', ''),
    coalesce(auth.jwt() #>> '{user_metadata,full_name}', auth.jwt() ->> 'email')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(public.users.full_name, excluded.full_name);

  insert into public.businesses (
    name,
    field,
    description,
    audience,
    services,
    tone,
    hours,
    faqs,
    prices,
    forbidden_topics,
    conversation_goal,
    pilot_enabled,
    agent_enabled,
    whatsapp_receiving_enabled,
    whatsapp_sending_enabled,
    crm_sync_enabled,
    phone_allowlist_enabled,
    automation_level
  )
  values (
    nullif(trim(business_payload ->> 'name'), ''),
    nullif(trim(business_payload ->> 'field'), ''),
    business_payload ->> 'description',
    business_payload ->> 'audience',
    business_payload ->> 'services',
    business_payload ->> 'tone',
    business_payload ->> 'hours',
    business_payload ->> 'faqs',
    business_payload ->> 'prices',
    business_payload ->> 'forbidden_topics',
    coalesce(nullif(trim(business_payload ->> 'conversation_goal'), ''), 'לקבוע שיחה'),
    false,
    true,
    false,
    false,
    false,
    true,
    'draft_only'
  )
  returning id into new_business_id;

  insert into public.business_users (business_id, user_id, role)
  values (new_business_id, current_user_id, 'owner');

  return new_business_id;
end;
$$;

grant execute on function public.create_business_for_current_user(jsonb) to authenticated;
