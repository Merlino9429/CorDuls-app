-- =====================================================================
-- Cor Duls — versione web app (ordina.corduls.it)
-- notifiche web push + cancellazione account (GDPR)
-- =====================================================================

-- Iscrizioni alle notifiche del browser (Web Push)
create table public.web_push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index web_push_user_idx on public.web_push_subscriptions(user_id);

alter table public.web_push_subscriptions enable row level security;
create policy "web push own" on public.web_push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Cancellazione account: gli ordini restano per la contabilità ma senza dati personali
alter table public.orders alter column user_id drop not null;
alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders
  add constraint orders_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;
