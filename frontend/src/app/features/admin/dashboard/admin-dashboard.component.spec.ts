import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminDashboardComponent } from './admin-dashboard.component';
import { AdminService } from '../../../core/services/admin.service';
import { DashboardData } from '../../../core/models/api.models';

describe('AdminDashboardComponent', () => {
  let fixture: any;
  let component: AdminDashboardComponent;
  let adminService: AdminService;

  const mockData: DashboardData = {
    stats: {
      total_revenue: 12500.5,
      total_orders: 85,
      pending_orders: 12,
      total_products: 42,
      low_stock_count: 4,
      total_customers: 65,
    },
    recent_orders: [
      {
        id: 1,
        order_number: 'ORD-2026-1001',
        total_amount: 140,
        subtotal: 135,
        discount_amount: 0,
        shipping_fee: 5,
        status: 'pending',
        payment_status: 'unpaid',
        customer_name: 'Tanvir Hossain',
        created_at: '2026-11-03T09:00:00Z',
        shipping_address: {
          recipient_name: 'Tanvir Hossain',
          phone: '+8801711223344',
          street_address: 'Banani',
          city: 'Dhaka',
          postal_code: '1213',
        },
      },
    ],
    low_stock_products: [
      {
        id: 10,
        variant_id: 10,
        sku: 'ECO-OVR-BLK-M',
        size: 'M',
        color: 'Black',
        price: 90,
        stock_quantity: 2,
        name: 'Overshirt',
      },
    ],
    top_products: [],
    monthly_revenue: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboardComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    adminService = TestBed.inject(AdminService);
    vi.spyOn(adminService, 'getDashboard').mockReturnValue(
      of({ success: true, message: 'OK', data: mockData })
    );

    fixture = TestBed.createComponent(AdminDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load dashboard KPI metrics and recent orders on init', () => {
    expect(component.data()).toEqual(mockData);
    expect(component.data()?.stats.total_revenue).toBe(12500.5);
    expect(component.data()?.stats.pending_orders).toBe(12);
    expect(component.data()?.recent_orders.length).toBe(1);
    expect(component.data()?.low_stock_products.length).toBe(1);
  });
});
