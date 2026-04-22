create extension if not exists vector;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  gender text check (gender in ('male','female','nonbinary','prefer_not')),
  age int check (age between 13 and 100),
  height_cm numeric check (height_cm between 100 and 250),
  current_weight_kg numeric check (current_weight_kg between 30 and 300),
  goal_weight_kg numeric check (goal_weight_kg between 30 and 300),
  goal text check (goal in ('lose_fat','build_muscle','maintain','recomp','endurance')),
  activity_level text check (activity_level in ('sedentary','light','moderate','active','very_active')),
  hours_per_week numeric check (hours_per_week between 0 and 30),
  diet_preference text check (diet_preference in ('omnivore','vegetarian','vegan','pescatarian','keto','paleo','mediterranean','halal','kosher','gluten_free')),
  allergies text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_plan jsonb not null,
  meal_plan jsonb not null,
  rationale text,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index plans_user_idx on public.plans(user_id, created_at desc);
alter table public.plans enable row level security;
create policy "plans_select_own" on public.plans for select using (auth.uid() = user_id);
create policy "plans_insert_own" on public.plans for insert with check (auth.uid() = user_id);
create policy "plans_delete_own" on public.plans for delete using (auth.uid() = user_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now()
);
create index conv_user_idx on public.conversations(user_id, created_at desc);
alter table public.conversations enable row level security;
create policy "conv_select_own" on public.conversations for select using (auth.uid() = user_id);
create policy "conv_insert_own" on public.conversations for insert with check (auth.uid() = user_id);
create policy "conv_update_own" on public.conversations for update using (auth.uid() = user_id);
create policy "conv_delete_own" on public.conversations for delete using (auth.uid() = user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index msg_conv_idx on public.messages(conversation_id, created_at);
alter table public.messages enable row level security;
create policy "msg_select_own" on public.messages for select using (auth.uid() = user_id);
create policy "msg_insert_own" on public.messages for insert with check (auth.uid() = user_id);

create table public.research_corpus (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  authors text,
  year int,
  source text,
  url text,
  topic text,
  content text not null,
  embedding vector(768),
  created_at timestamptz not null default now()
);
create index research_topic_idx on public.research_corpus(topic);
create index research_embedding_idx on public.research_corpus
  using hnsw (embedding vector_cosine_ops);

alter table public.research_corpus enable row level security;
create policy "research_read_authenticated" on public.research_corpus
  for select to authenticated using (true);

create or replace function public.match_research(
  query_embedding vector(768),
  match_count int default 5,
  topic_filter text default null
)
returns table (
  id uuid, title text, authors text, year int, source text, url text,
  topic text, content text, similarity float
)
language sql stable security definer set search_path = public as $$
  select r.id, r.title, r.authors, r.year, r.source, r.url, r.topic, r.content,
         1 - (r.embedding <=> query_embedding) as similarity
  from public.research_corpus r
  where r.embedding is not null
    and (topic_filter is null or r.topic = topic_filter)
  order by r.embedding <=> query_embedding
  limit match_count;
$$;