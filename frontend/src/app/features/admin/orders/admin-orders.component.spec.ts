import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminOrdersComponent } from './admin-orders.component';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { Order } from '../../../core/models/api.models';

describe('AdminOrdersComponent', () => {
  let fixture: any;
  let component: AdminOrdersComponent;
  let adminService: AdminService;

  const mockOrders: Order[] = [
    {
      id: 701,
      order_number: 'ORD-2026-7001',
      total_amount: 175.0,
      subtotal: 170.0,
      discount_amount: 0,
      shipping_fee: 5.0,
      status: 'pending',
      payment_status: 'unpaid',
      customer_name: 'Imtiaz Ahmed',
      customer_email: 'imtiaz@example.com',
      created_at: '2026-11-03T11:30:00Z',
      shipping_address: {
        recipient_name: 'Imtiaz Ahmed',
        phone: '+8801811223344',
        street_address: 'Dhanmondi 27',
        city: 'Dhaka',
        postal_code: '1209',
      },
      items: [],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminOrdersComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    adminService = TestBed.inject(AdminService);
    vi.spyOn(adminService, 'getOrders').mockReturnValue(
      of({
        success: true,
        message: 'Orders loaded',
        data: mockOrders,
      })
    );
    vi.spyOn(adminService, 'getOrderById').mockReturnValue(
      of({
        success: true,
        message: 'Order loaded',
        data: mockOrders[0],
      })
    );

    fixture = TestBed.createComponent(AdminOrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load orders list on init', () => {
    expect(component.orders().length).toBe(1);
    expect(component.orders()[0].order_number).toBe('ORD-2026-7001');
  });

  it('should open order management modal and save order lifecycle transition', () => {
    const toast = TestBed.inject(ToastService);
    const toastSpy = vi.spyOn(toast, 'success');
    const updateSpy = vi.spyOn(adminService, 'updateOrderStatus').mockReturnValue(
      of({
        success: true,
        message: 'Status updated',
        data: { ...mockOrders[0], status: 'confirmed' },
      })
    );

    component.openOrderModal(mockOrders[0]);
    expect(component.selectedOrder()).toEqual(mockOrders[0]);
    expect(component.newStatus).toBe('pending');

    component.newStatus = 'confirmed';
    component.saveOrderStatus();

    expect(updateSpy).toHaveBeenCalledWith(701, {
      status: 'confirmed',
      courier_name: 'Pathao Express',
      tracking_number: undefined,
      cancellation_reason: undefined,
    });
    expect(toastSpy).toHaveBeenCalledWith('Order status updated to confirmed.');
    expect(component.selectedOrder()?.status).toBe('confirmed');
  });

  it('should update COD cash collection payment status to paid', () => {
    const toast = TestBed.inject(ToastService);
    const toastSpy = vi.spyOn(toast, 'success');
    const paymentSpy = vi.spyOn(adminService, 'updatePaymentStatus').mockReturnValue(
      of({
        success: true,
        message: 'Payment updated',
        data: { ...mockOrders[0], payment_status: 'paid' },
      })
    );

    component.openOrderModal(mockOrders[0]);
    component.newPaymentStatus = 'paid';
    component.savePaymentStatus();

    expect(paymentSpy).toHaveBeenCalledWith(701, 'paid');
    expect(toastSpy).toHaveBeenCalledWith('Payment status updated to paid.');
    expect(component.selectedOrder()?.payment_status).toBe('paid');
  });

  it('should verify manual payment and update selectedOrder payment_status to paid', () => {
    const toast = TestBed.inject(ToastService);
    const toastSpy = vi.spyOn(toast, 'success');
    const verifySpy = vi.spyOn(adminService, 'verifyPayment').mockReturnValue(
      of({
        success: true,
        message: 'Manual payment verified',
        data: {
          ...mockOrders[0],
          payment_status: 'paid',
          payment_provider: 'manual',
          transaction_id: 'CTB-VERIFY-123',
        },
      })
    );

    const testOrder = {
      ...mockOrders[0],
      payment_provider: 'manual',
      transaction_id: 'CTB-VERIFY-123',
    };
    component.openOrderModal(testOrder);
    component.verifyManualPayment(testOrder);

    expect(verifySpy).toHaveBeenCalledWith(701, expect.any(String));
    expect(toastSpy).toHaveBeenCalledWith(expect.stringContaining('verified and marked as Paid'));
    expect(component.selectedOrder()?.payment_status).toBe('paid');
  });
});
