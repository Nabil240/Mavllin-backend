import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Address,
  ApiResponse,
  CouponValidationResult,
  Order,
  ShippingAddressSnapshot,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);

  getAddresses(): Observable<ApiResponse<Address[]>> {
    return this.http.get<ApiResponse<Address[]>>('/api/v1/addresses');
  }

  createAddress(payload: Partial<Address>): Observable<ApiResponse<Address>> {
    return this.http.post<ApiResponse<Address>>('/api/v1/addresses', payload);
  }

  updateAddress(id: number, payload: Partial<Address>): Observable<ApiResponse<Address>> {
    return this.http.put<ApiResponse<Address>>(`/api/v1/addresses/${id}`, payload);
  }

  setDefaultAddress(id: number): Observable<ApiResponse<Address[]>> {
    return this.http.patch<ApiResponse<Address[]>>(`/api/v1/addresses/${id}/default`, {});
  }

  deleteAddress(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`/api/v1/addresses/${id}`);
  }

  validateCoupon(code: string, subtotal: number): Observable<ApiResponse<CouponValidationResult>> {
    return this.http.post<ApiResponse<CouponValidationResult>>('/api/v1/coupons/validate', {
      code,
      subtotal,
    });
  }

  placeOrder(payload: {
    shipping_address: ShippingAddressSnapshot;
    payment_provider: 'cod' | 'bkash' | 'nagad' | 'rocket' | 'upay' | 'manual' | string;
    payment_method?: string;
    transaction_id?: string | null;
    sender_phone?: string | null;
    advance_amount?: number;
    due_amount?: number;
    coupon_code?: string | null;
    notes?: string | null;
  }): Observable<ApiResponse<Order>> {
    return this.http.post<ApiResponse<Order>>('/api/v1/orders', payload);
  }

  placeGuestOrder(payload: {
    guest_email?: string | null;
    guest_phone?: string | null;
    shipping_address: ShippingAddressSnapshot;
    payment_provider: 'cod' | 'bkash' | 'nagad' | 'rocket' | 'upay' | 'manual' | string;
    payment_method?: string;
    transaction_id?: string | null;
    sender_phone?: string | null;
    advance_amount?: number;
    due_amount?: number;
    coupon_code?: string | null;
    notes?: string | null;
    items: Array<{ variant_id: number; product_id?: number; quantity: number }>;
  }): Observable<ApiResponse<Order>> {
    return this.http.post<ApiResponse<Order>>('/api/v1/orders/guest', payload);
  }

  trackOrder(orderNumber: string): Observable<ApiResponse<Order>> {
    return this.http.get<ApiResponse<Order>>(`/api/v1/orders/track/${encodeURIComponent(orderNumber.trim())}`);
  }

  getMyOrders(page = 1, limit = 10): Observable<ApiResponse<Order[]>> {
    const params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    return this.http.get<ApiResponse<Order[]>>('/api/v1/orders/my-orders', { params });
  }

  getOrderById(idOrNumber: string | number): Observable<ApiResponse<Order>> {
    return this.http.get<ApiResponse<Order>>(`/api/v1/orders/${idOrNumber}`);
  }

  cancelOrder(id: number, reason: string): Observable<ApiResponse<Order>> {
    return this.http.post<ApiResponse<Order>>(`/api/v1/orders/${id}/cancel`, { reason });
  }

  getDeliveryCharges(): Observable<ApiResponse<{
    currency: string;
    currency_symbol: string;
    inside_dhaka_fee: number;
    outside_dhaka_fee: number;
    free_shipping_threshold: number;
    estimated_days_inside_dhaka?: string;
    estimated_days_outside_dhaka?: string;
  }>> {
    return this.http.get<ApiResponse<any>>('/api/v1/delivery-charges');
  }
}
