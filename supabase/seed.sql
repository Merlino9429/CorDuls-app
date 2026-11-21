-- Dati di esempio (facoltativi): modificali o cancellali dall'area Admin dell'app.
insert into public.categories (id, name, sort_order) values
  ('00000000-0000-0000-0000-0000000000c1', 'Dolci', 1),
  ('00000000-0000-0000-0000-0000000000c2', 'Salato', 2),
  ('00000000-0000-0000-0000-0000000000c3', 'Bevande', 3);

insert into public.products (id, category_id, name, description, price_cents, featured, sort_order) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'Cornetto alla crema', 'Sfoglia burrosa con crema pasticcera', 150, true, 1),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1', 'Tiramisù monoporzione', 'Ricetta della casa', 450, true, 2),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000c2', 'Focaccia farcita', 'Prosciutto crudo e stracchino', 550, false, 1),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000c3', 'Cappuccino', null, 160, false, 1),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000c3', 'Spremuta d''arancia', null, 350, false, 2);

insert into public.combos (id, name, description, price_cents) values
  ('00000000-0000-0000-0000-0000000000b1', 'Colazione Cor Duls', 'Cappuccino + cornetto alla crema', 280);
insert into public.combo_items (combo_id, product_id, quantity) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a4', 1),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 1);

insert into public.promotions (title, description, discount_type, discount_value, min_order_cents) values
  ('Benvenuto!', '10% di sconto su ordini da almeno 15 €', 'percent', 10, 1500);
insert into public.promotions (title, description, code, discount_type, discount_value) values
  ('Codice amici', '2 € di sconto con il codice AMICI', 'AMICI', 'fixed', 200);

insert into public.loyalty_rewards (title, description, points_cost, discount_cents, sort_order) values
  ('Caffè omaggio', '1,20 € di sconto sul tuo ordine', 50, 120, 1),
  ('Colazione omaggio', '2,80 € di sconto: cappuccino e cornetto offerti da noi', 100, 280, 2),
  ('Buono 5 €', '5 € di sconto sul tuo ordine', 180, 500, 3);
