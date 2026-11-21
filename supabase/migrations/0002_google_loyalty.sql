-- =====================================================================
-- Cor Duls — accesso con Google + tessera punti
-- =====================================================================

-- ---------------------------------------------------------------------
-- Profili: email (per la ricerca in cassa) e numero tessera
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text,
  add column if not exists card_number text unique;

create or replace function public.generate_card_number()
returns text language plpgsql as $$
declare
  candidate text;
begin
  loop
    candidate := 'CD-' || lpad((floor(random() * 100000000))::bigint::text, 8, '0');
    exit when not exists (select 1 from public.profiles where card_number = candidate);
  end loop;
  return candidate;
end;
$$;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

update public.profiles set card_number = public.generate_card_number() where card_number is null;
alter table public.profiles alter column card_number set default public.generate_card_number();
alter table public.profiles alter column card_number set not null;

-- ---------------------------------------------------------------------
-- Impostazioni della tessera
-- ---------------------------------------------------------------------
alter table public.store_settings
  add column if not exists loyalty_enabled boolean not null default true,
  -- punti guadagnati per ogni euro speso (su ordini completati)
  add column if not exists points_per_euro int not null default 1 check (points_per_euro >= 0),
  -- punti regalati alla registrazione
  add column if not exists loyalty_welcome_points int not null default 0 check (loyalty_welcome_points >= 0);

-- ---------------------------------------------------------------------
-- Premi riscattabili con i punti (sconto in € sull'ordine)
-- ---------------------------------------------------------------------
create table public.loyalty_rewards (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  image_url       text,
  points_cost     int  not null check (points_cost > 0),
  discount_cents  int  not null check (discount_cents > 0),
  active          boolean not null default true,
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Movimenti punti: il saldo è la somma dei movimenti
-- ---------------------------------------------------------------------
create table public.loyalty_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  points      int  not null check (points <> 0),
  reason      text not null check (reason in ('order', 'redeem', 'refund', 'reversal', 'manual', 'welcome')),
  order_id    uuid references public.orders(id) on delete set null,
  note        text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index loyalty_tx_user_idx on public.loyalty_transactions(user_id, created_at desc);
-- un solo movimento per tipo e ordine: rende idempotenti accrediti e rimborsi
create unique index loyalty_tx_order_reason_idx on public.loyalty_transactions(order_id, reason) where order_id is not null;

create or replace function public.loyalty_balance(uid uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(points), 0)::int from public.loyalty_transactions where user_id = uid;
$$;
-- solo il server (service role) calcola i saldi altrui
revoke execute on function public.loyalty_balance(uuid) from public, anon, authenticated;
grant execute on function public.loyalty_balance(uuid) to service_role;

-- ---------------------------------------------------------------------
-- Ordini: premio usato
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists reward_id uuid references public.loyalty_rewards(id) on delete set null,
  add column if not exists reward_title text,
  add column if not exists points_redeemed int not null default 0,
  add column if not exists reward_discount_cents int not null default 0;

-- ---------------------------------------------------------------------
-- Nuovi utenti: email, nome (anche da Google) e bonus di benvenuto
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  bonus int;
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'phone'
  );
  select case when loyalty_enabled then loyalty_welcome_points else 0 end into bonus
  from public.store_settings where id = 1;
  if coalesce(bonus, 0) > 0 then
    insert into public.loyalty_transactions (user_id, points, reason, note)
    values (new.id, bonus, 'welcome', 'Bonus di benvenuto');
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Sicurezza
-- ---------------------------------------------------------------------
alter table public.loyalty_rewards      enable row level security;
alter table public.loyalty_transactions enable row level security;

create policy "rewards public read" on public.loyalty_rewards
  for select using (active or public.is_admin());
create policy "rewards admin write" on public.loyalty_rewards
  for all using (public.is_admin()) with check (public.is_admin());

-- il cliente vede i propri movimenti; solo l'admin aggiunge punti a mano
-- (accrediti e riscatti degli ordini li fanno le Edge Functions)
create policy "loyalty read own or admin" on public.loyalty_transactions
  for select using (user_id = auth.uid() or public.is_admin());
create policy "loyalty admin manual" on public.loyalty_transactions
  for insert with check (public.is_admin() and reason = 'manual' and created_by = auth.uid());

alter publication supabase_realtime add table public.loyalty_transactions;
