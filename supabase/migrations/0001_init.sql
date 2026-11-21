-- =====================================================================
-- Cor Duls — schema iniziale
-- Tabelle: profili, catalogo (categorie, prodotti, combo, promozioni),
-- impostazioni negozio, ordini, token push, storico notifiche.
-- Sicurezza: Row Level Security su tutto. Gli ordini vengono creati SOLO
-- dalle Edge Functions (service role), che ricalcolano i prezzi lato server.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Profili utente
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  address     text,
  role        text not null default 'customer' check (role in ('customer', 'admin')),
  created_at  timestamptz not null default now()
);

-- crea automaticamente il profilo alla registrazione
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------
-- Catalogo
-- ---------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid references public.categories(id) on delete set null,
  name         text not null,
  description  text,
  price_cents  int  not null check (price_cents >= 0),
  image_url    text,
  allergens    text,
  available    boolean not null default true,
  featured     boolean not null default false,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index products_category_idx on public.products(category_id);

create table public.combos (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  price_cents  int  not null check (price_cents >= 0),
  image_url    text,
  available    boolean not null default true,
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.combo_items (
  combo_id    uuid not null references public.combos(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  quantity    int  not null default 1 check (quantity > 0),
  primary key (combo_id, product_id)
);

create table public.promotions (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text,
  image_url        text,
  -- se valorizzato, lo sconto si applica solo inserendo il codice al checkout
  code             text unique,
  discount_type    text not null default 'percent' check (discount_type in ('percent', 'fixed', 'none')),
  -- percentuale (es. 10 = 10%) oppure centesimi (es. 200 = 2,00 €); 'none' = solo banner informativo
  discount_value   int  not null default 0 check (discount_value >= 0),
  min_order_cents  int  not null default 0,
  starts_at        timestamptz,
  ends_at          timestamptz,
  active           boolean not null default true,
  -- se false la promo non compare nella lista "Promo" dell'app (es. codici riservati)
  show_in_app      boolean not null default true,
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Impostazioni negozio (riga unica, id = 1)
-- ---------------------------------------------------------------------
create table public.store_settings (
  id                        int primary key default 1 check (id = 1),
  store_name                text not null default 'Cor Duls',
  address                   text,
  phone                     text,
  opening_hours             text,
  accepting_orders          boolean not null default true,
  pickup_enabled            boolean not null default true,
  delivery_enabled          boolean not null default true,
  delivery_fee_cents        int not null default 250,
  delivery_min_order_cents  int not null default 1000,
  delivery_free_over_cents  int,
  cash_enabled              boolean not null default true,
  prep_time_minutes         int not null default 20,
  updated_at                timestamptz not null default now()
);
insert into public.store_settings (id) values (1);

-- ---------------------------------------------------------------------
-- Ordini
-- ---------------------------------------------------------------------
create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  number              bigint generated always as identity,
  user_id             uuid not null references auth.users(id) on delete restrict,
  status              text not null default 'pending_payment' check (status in (
                        'pending_payment', 'payment_failed', 'received', 'preparing',
                        'ready', 'out_for_delivery', 'completed', 'cancelled')),
  fulfillment         text not null check (fulfillment in ('pickup', 'delivery')),
  payment_method      text not null check (payment_method in ('sumup', 'cash')),
  paid                boolean not null default false,
  paid_at             timestamptz,
  subtotal_cents      int not null,
  discount_cents      int not null default 0,
  delivery_fee_cents  int not null default 0,
  total_cents         int not null,
  promotion_id        uuid references public.promotions(id) on delete set null,
  promo_code          text,
  customer_name       text not null,
  phone               text not null,
  address             text,
  scheduled_for       timestamptz,
  notes               text,
  sumup_checkout_id   text unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index orders_user_idx on public.orders(user_id, created_at desc);
create index orders_status_idx on public.orders(status, created_at desc);

create table public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  item_type         text not null check (item_type in ('product', 'combo')),
  product_id        uuid references public.products(id) on delete set null,
  combo_id          uuid references public.combos(id) on delete set null,
  name              text not null,
  unit_price_cents  int  not null,
  quantity          int  not null check (quantity > 0),
  notes             text
);
create index order_items_order_idx on public.order_items(order_id);

-- ---------------------------------------------------------------------
-- Notifiche push
-- ---------------------------------------------------------------------
create table public.push_tokens (
  token       text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  platform    text,
  updated_at  timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens(user_id);

create table public.notifications_log (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text not null,
  audience    text not null default 'all',
  sent_count  int  not null default 0,
  sent_by     uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- updated_at automatico
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger combos_touch before update on public.combos
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.store_settings
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles          enable row level security;
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.combos            enable row level security;
alter table public.combo_items       enable row level security;
alter table public.promotions        enable row level security;
alter table public.store_settings    enable row level security;
alter table public.orders            enable row level security;
alter table public.order_items       enable row level security;
alter table public.push_tokens       enable row level security;
alter table public.notifications_log enable row level security;

-- Profili: ognuno vede/modifica il proprio, l'admin vede tutti.
create policy "profiles read own or admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
-- il ruolo NON è modificabile dai client (solo da SQL / dashboard Supabase)
revoke update on public.profiles from authenticated, anon;
grant update (full_name, phone, address) on public.profiles to authenticated;

-- Catalogo: lettura pubblica degli elementi attivi; scrittura solo admin.
create policy "categories public read" on public.categories
  for select using (active or public.is_admin());
create policy "categories admin write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy "products public read" on public.products
  for select using (available or public.is_admin());
create policy "products admin write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

create policy "combos public read" on public.combos
  for select using (available or public.is_admin());
create policy "combos admin write" on public.combos
  for all using (public.is_admin()) with check (public.is_admin());

create policy "combo_items public read" on public.combo_items
  for select using (true);
create policy "combo_items admin write" on public.combo_items
  for all using (public.is_admin()) with check (public.is_admin());

-- I clienti vedono solo le promo attive, nel periodo di validità e con show_in_app = true.
-- I codici vengono comunque validati dalla Edge Function create-order.
create policy "promotions public read" on public.promotions
  for select using (
    public.is_admin() or (
      active and show_in_app
      and (starts_at is null or starts_at <= now())
      and (ends_at   is null or ends_at   >= now())
    )
  );
create policy "promotions admin write" on public.promotions
  for all using (public.is_admin()) with check (public.is_admin());

create policy "settings public read" on public.store_settings
  for select using (true);
create policy "settings admin update" on public.store_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- Ordini: il cliente legge i propri; l'admin legge e aggiorna tutti.
-- Nessun insert dai client: si passa dalla funzione create-order.
create policy "orders read own or admin" on public.orders
  for select using (user_id = auth.uid() or public.is_admin());
create policy "orders admin update" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

create policy "order_items read own or admin" on public.order_items
  for select using (
    public.is_admin() or exists (
      select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
    )
  );

-- Token push: ogni utente gestisce solo i propri.
create policy "push_tokens own" on public.push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notifications_log admin" on public.notifications_log
  for select using (public.is_admin());

-- =====================================================================
-- Realtime: aggiornamenti live degli ordini (cliente e cucina)
-- =====================================================================
alter publication supabase_realtime add table public.orders;

-- =====================================================================
-- Storage: bucket pubblico per le foto (scrittura solo admin)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

create policy "images public read" on storage.objects
  for select using (bucket_id = 'images');
create policy "images admin insert" on storage.objects
  for insert with check (bucket_id = 'images' and public.is_admin());
create policy "images admin update" on storage.objects
  for update using (bucket_id = 'images' and public.is_admin());
create policy "images admin delete" on storage.objects
  for delete using (bucket_id = 'images' and public.is_admin());
