export type Role = 'customer' | 'admin';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
  email: string | null;
  card_number: string;
  role: Role;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  allergens: string | null;
  available: boolean;
  featured: boolean;
  sort_order: number;
}

export interface ComboItem {
  product_id: string;
  quantity: number;
  products?: Pick<Product, 'id' | 'name'> | null;
}

export interface Combo {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  image_url: string | null;
  available: boolean;
  sort_order: number;
  combo_items?: ComboItem[];
}

export type DiscountType = 'percent' | 'fixed' | 'none';

export interface Promotion {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  code: string | null;
  discount_type: DiscountType;
  discount_value: number;
  min_order_cents: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  show_in_app: boolean;
  sort_order: number;
}

export interface StoreSettings {
  id: 1;
  store_name: string;
  address: string | null;
  phone: string | null;
  opening_hours: string | null;
  accepting_orders: boolean;
  pickup_enabled: boolean;
  delivery_enabled: boolean;
  delivery_fee_cents: number;
  delivery_min_order_cents: number;
  delivery_free_over_cents: number | null;
  cash_enabled: boolean;
  prep_time_minutes: number;
  loyalty_enabled: boolean;
  points_per_euro: number;
  loyalty_welcome_points: number;
}

export interface LoyaltyReward {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  points_cost: number;
  discount_cents: number;
  active: boolean;
  sort_order: number;
}

export type LoyaltyReason = 'order' | 'redeem' | 'refund' | 'reversal' | 'manual' | 'welcome';

export interface LoyaltyTransaction {
  id: string;
  user_id: string;
  points: number;
  reason: LoyaltyReason;
  order_id: string | null;
  note: string | null;
  created_at: string;
}

export type OrderStatus =
  | 'pending_payment'
  | 'payment_failed'
  | 'received'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

export interface OrderItem {
  id: string;
  item_type: 'product' | 'combo';
  name: string;
  unit_price_cents: number;
  quantity: number;
  notes: string | null;
}

export interface Order {
  id: string;
  number: number;
  user_id: string;
  status: OrderStatus;
  fulfillment: 'pickup' | 'delivery';
  payment_method: 'sumup' | 'cash';
  paid: boolean;
  subtotal_cents: number;
  discount_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  promo_code: string | null;
  reward_title: string | null;
  points_redeemed: number;
  reward_discount_cents: number;
  customer_name: string;
  phone: string;
  address: string | null;
  scheduled_for: string | null;
  notes: string | null;
  created_at: string;
  order_items?: OrderItem[];
}
