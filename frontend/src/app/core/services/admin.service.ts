import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  Category,
  Coupon,
  DashboardData,
  InventoryMovement,
  Order,
  Product,
  ProductVariant,
  User,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  getDashboard(): Observable<ApiResponse<DashboardData>> {
    return this.http.get<ApiResponse<DashboardData>>('/api/v1/admin/dashboard');
  }

  // Products
  getProducts(paramsObj: Record<string, string | number | boolean | undefined> = {}): Observable<ApiResponse<Product[]>> {
    let params = new HttpParams();
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<ApiResponse<Product[]>>('/api/v1/products', { params });
  }

  createProduct(payload: Record<string, unknown>): Observable<ApiResponse<Product>> {
    return this.http.post<ApiResponse<Product>>('/api/v1/products', payload);
  }

  updateProduct(id: number, payload: Record<string, unknown>): Observable<ApiResponse<Product>> {
    return this.http.put<ApiResponse<Product>>(`/api/v1/products/${id}`, payload);
  }

  deleteProduct(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`/api/v1/products/${id}`);
  }

  // Categories
  getCategories(): Observable<ApiResponse<Category[]>> {
    return this.http.get<ApiResponse<Category[]>>('/api/v1/categories');
  }

  createCategory(payload: Partial<Category>): Observable<ApiResponse<Category>> {
    return this.http.post<ApiResponse<Category>>('/api/v1/categories', payload);
  }

  updateCategory(id: number, payload: Partial<Category>): Observable<ApiResponse<Category>> {
    return this.http.put<ApiResponse<Category>>(`/api/v1/categories/${id}`, payload);
  }

  deleteCategory(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`/api/v1/categories/${id}`);
  }

  // Inventory
  getInventory(paramsObj: {
    page?: number;
    limit?: number;
    search?: string;
    stockStatus?: string;
  } = {}): Observable<ApiResponse<ProductVariant[]>> {
    let params = new HttpParams();
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<ApiResponse<ProductVariant[]>>('/api/v1/admin/inventory', { params });
  }

  getInventoryMovements(paramsObj: {
    page?: number;
    limit?: number;
    variantId?: number;
    reason?: string;
  } = {}): Observable<ApiResponse<InventoryMovement[]>> {
    let params = new HttpParams();
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<ApiResponse<InventoryMovement[]>>('/api/v1/admin/inventory/movements', { params });
  }

  adjustInventory(payload: {
    variant_id: number;
    quantity_delta: number;
    reason: string;
    note: string;
  }): Observable<ApiResponse< unknown >> {
    return this.http.post<ApiResponse<unknown>>('/api/v1/admin/inventory/adjustments', payload);
  }

  // Orders
  getOrders(paramsObj: {
    page?: number;
    limit?: number;
    status?: string;
    paymentStatus?: string;
    search?: string;
  } = {}): Observable<ApiResponse<Order[]>> {
    let params = new HttpParams();
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<ApiResponse<Order[]>>('/api/v1/admin/orders', { params });
  }

  getOrderById(id: number | string): Observable<ApiResponse<Order>> {
    return this.http.get<ApiResponse<Order>>(`/api/v1/orders/${id}`);
  }

  updateOrderStatus(
    id: number,
    payload: {
      status: string;
      courier_name?: string;
      tracking_number?: string;
      cancellation_reason?: string;
      note?: string;
    }
  ): Observable<ApiResponse<Order>> {
    return this.http.put<ApiResponse<Order>>(`/api/v1/orders/${id}/status`, payload);
  }

  updatePaymentStatus(id: number, payment_status: string): Observable<ApiResponse<Order>> {
    return this.http.put<ApiResponse<Order>>(`/api/v1/orders/${id}/payment-status`, { payment_status });
  }

  verifyPayment(id: number, note?: string): Observable<ApiResponse<Order>> {
    return this.http.put<ApiResponse<Order>>(`/api/v1/admin/orders/${id}/verify-payment`, { note });
  }

  deleteOrder(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`/api/v1/admin/orders/${id}`);
  }

  getDeliverySettings(): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.get<ApiResponse<Record<string, unknown>>>('/api/v1/admin/settings');
  }

  updateDeliverySettings(payload: Record<string, unknown>): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.put<ApiResponse<Record<string, unknown>>>('/api/v1/admin/settings', payload);
  }

  // Customers
  getCustomers(paramsObj: { page?: number; limit?: number; search?: string; role?: string } = {}): Observable<ApiResponse<User[]>> {
    let params = new HttpParams();
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<ApiResponse<User[]>>('/api/v1/admin/customers', { params });
  }

  toggleCustomerStatus(id: number, is_active: boolean | number): Observable<ApiResponse<User>> {
    return this.http.put<ApiResponse<User>>(`/api/v1/admin/customers/${id}/status`, { is_active });
  }

  // Coupons
  getCoupons(paramsObj: { page?: number; limit?: number; search?: string } = {}): Observable<ApiResponse<Coupon[]>> {
    let params = new HttpParams();
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<ApiResponse<Coupon[]>>('/api/v1/coupons', { params });
  }

  createCoupon(payload: Partial<Coupon>): Observable<ApiResponse<Coupon>> {
    return this.http.post<ApiResponse<Coupon>>('/api/v1/coupons', payload);
  }

  updateCoupon(id: number, payload: Partial<Coupon>): Observable<ApiResponse<Coupon>> {
    return this.http.put<ApiResponse<Coupon>>(`/api/v1/coupons/${id}`, payload);
  }

  deleteCoupon(id: number): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(`/api/v1/coupons/${id}`);
  }

  // Reports & Payments
  getSalesReport(paramsObj: { startDate?: string; endDate?: string } = {}): Observable<ApiResponse<Record<string, unknown>>> {
    let params = new HttpParams();
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<ApiResponse<Record<string, unknown>>>('/api/v1/admin/reports/sales', { params });
  }

  getPayments(paramsObj: { page?: number; limit?: number; status?: string } = {}): Observable<ApiResponse<Array<Record<string, unknown>>>> {
    let params = new HttpParams();
    Object.entries(paramsObj).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    });
    return this.http.get<ApiResponse<Array<Record<string, unknown>>>>('/api/v1/admin/payments', { params });
  }
}
