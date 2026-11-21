-- Pagamento con carta (SumUp) attivabile dall'area Admin, quando SumUp è configurato.
alter table public.store_settings
  add column if not exists card_payments_enabled boolean not null default false;
