export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiErrorItem {
  field?: string;
  message: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
  errors?: ApiErrorItem[];
}

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  avatar_url?: string | null;
  role: 'customer' | 'admin' | 'staff';
  is_active: number | boolean;
  created_at?: string;
}

export interface Address {
  id: number;
  user_id?: number;
  label: string;
  recipient_name: string;
  phone: string;
  street_address: string;
  area?: string | null;
  city: string;
  state?: string | null;
  postal_code: string;
  country: string;
  is_default: number | boolean;
}

export interface Category {
  id: number;
  parent_id?: number | null;
  parent_name?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  is_active: number | boolean;
  product_count?: number;
  children?: Category[];
}

export interface ProductVariant {
  id: number;
  product_id: number;
  sku: string;
  size: string;
  color: string;
  price: number;
  compare_at_price?: number | null;
  stock_quantity: number;
  stockQuantity?: number;
  is_active: number | boolean;
  product_name?: string;
  product_slug?: string;
  thumbnail_url?: string;
  category_name?: string;
}

export interface ProductImage {
  id: number;
  product_id: number;
  variant_id?: number | null;
  image_url: string;
  alt_text?: string | null;
  sort_order: number;
}

export interface Product {
  id: number;
  category_id?: number | null;
  category_name?: string;
  category_slug?: string;
  name: string;
  slug: string;
  sku?: string | null;
  short_description?: string | null;
  description?: string | null;
  base_price: number;
  price: number;
  discount_price?: number | null;
  discount_type?: 'none' | 'percentage' | 'fixed';
  discount_value?: number;
  advance_payment_type?: 'none' | 'thirty_percent' | 'fifty_percent' | 'full' | 'delivery_charge' | 'percent_30' | 'percent_50' | 'percent_100';
  compare_at_price?: number | null;
  thumbnail_url?: string | null;
  secondary_image_url?: string | null;
  is_featured: number | boolean;
  is_active: number | boolean;
  avg_rating?: number;
  review_count?: number;
  total_stock?: number;
  stock_quantity?: number;
  available_sizes?: string[];
  available_colors?: string[];
  variants?: ProductVariant[];
  images?: ProductImage[];
  created_at?: string;
}

export interface Banner {
  id: number;
  title: string;
  subtitle?: string | null;
  badge_text?: string | null;
  cta_text: string;
  cta_link: string;
  image_url: string;
  sort_order: number;
  is_active: number | boolean;
}

export interface CartItem {
  id?: number;
  cart_item_id?: number;
  product_id: number;
  variant_id: number;
  product_name: string;
  product_slug: string;
  variant_sku?: string;
  product_sku?: string;
  size?: string;
  variant_size?: string;
  color?: string;
  variant_color?: string;
  price: number;
  unit_price?: number;
  effective_price: number;
  compare_at_price?: number | null;
  stock_quantity: number;
  thumbnail_url?: string | null;
  quantity: number;
  line_total: number;
  discount_type?: 'none' | 'percentage' | 'fixed';
  discount_value?: number;
  advance_payment_type?: string;
  is_active?: number | boolean;
}

export interface CartSummary {
  subtotal: number;
  total_items: number;
  item_count: number;
}

export interface CouponValidationResult {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  discount_amount: number;
  coupon_id: number;
}

export interface Coupon {
  id: number;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  usage_limit?: number | null;
  used_count: number;
  expires_at?: string | null;
  is_active: number | boolean;
  created_at?: string;
}

export interface ShippingAddressSnapshot {
  recipient_name?: string;
  full_name?: string;
  phone: string;
  street_address: string;
  area?: string;
  city: string;
  state?: string;
  postal_code: string;
  country?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id?: number | null;
  variant_id?: number | null;
  product_name: string;
  product_slug?: string;
  thumbnail_url?: string;
  variant_sku?: string | null;
  variant_size?: string | null;
  variant_color?: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  advance_amount?: number;
}

export interface OrderStatusHistoryItem {
  id: number;
  order_id: number;
  previous_status?: string | null;
  new_status: string;
  actor_id?: number | null;
  actor_name?: string | null;
  note?: string | null;
  created_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  user_id?: number | null;
  guest_email?: string | null;
  guest_phone?: string | null;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  subtotal: number;
  discount_amount: number;
  shipping_fee: number;
  total_amount: number;
  advance_amount?: number;
  due_amount?: number;
  advance_payment_status?: 'unpaid' | 'paid' | 'partially_paid';
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  payment_status: 'unpaid' | 'paid' | 'failed' | 'refunded';
  payment_method?: string;
  payment_provider?: string;
  payment_transaction_id?: string | null;
  transaction_id?: string | null;
  sender_phone?: string | null;
  shipping_address: ShippingAddressSnapshot;
  notes?: string | null;
  cancellation_reason?: string | null;
  courier_name?: string | null;
  tracking_number?: string | null;
  total_items?: number;
  items?: OrderItem[];
  status_history?: OrderStatusHistoryItem[];
  payment?: {
    id: number;
    provider: string;
    transaction_id?: string | null;
    amount: number;
    status: string;
    paid_at?: string | null;
  } | null;
  created_at: string;
  updated_at?: string;
}

export interface Review {
  id: number;
  product_id: number;
  user_id: number;
  reviewer_name?: string;
  full_name?: string;
  avatar_url?: string | null;
  rating: number;
  comment?: string | null;
  created_at: string;
}

export interface ReviewSummary {
  average_rating: string | number;
  total_reviews: number;
  breakdown: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export interface InventoryMovement {
  id: number;
  variant_id: number;
  sku?: string;
  size?: string;
  color?: string;
  product_name?: string;
  quantity_delta: number;
  before_quantity: number;
  after_quantity: number;
  reason: string;
  note?: string | null;
  actor_id?: number | null;
  actor_name?: string | null;
  reference_order_id?: number | null;
  order_number?: string | null;
  created_at: string;
}

export interface DashboardData {
  stats: {
    total_orders: number;
    total_revenue: number;
    total_products: number;
    total_customers: number;
    low_stock_count: number;
    pending_orders: number;
  };
  recent_orders: Order[];
  top_products: Array<{
    id: number;
    name: string;
    slug: string;
    thumbnail_url?: string;
    price: number;
    total_sold: number;
    total_revenue: number;
  }>;
  monthly_revenue: Array<{
    month: string;
    orders_count?: number;
    revenue: number;
  }>;
  low_stock_products: Array<{
    id: number;
    variant_id?: number;
    name: string;
    slug?: string;
    sku: string;
    size?: string;
    color?: string;
    price: number;
    stock_quantity: number;
    thumbnail_url?: string;
  }>;
}
