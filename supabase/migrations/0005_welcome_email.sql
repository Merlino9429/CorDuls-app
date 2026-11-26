-- Email di benvenuto: registra quando è stata inviata (una sola volta per cliente).
alter table public.profiles add column if not exists welcome_sent_at timestamptz;
