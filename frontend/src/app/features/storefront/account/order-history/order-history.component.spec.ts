import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OrderHistoryComponent } from './order-history.component';
import { OrderService } from '../../../../core/services/order.service';
import { AuthService } from '../../../../core/services/auth.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Order } from '../../../../core/models/api.models';

describe('OrderHistoryComponent', () => {
  let fixture: any;
  let component: OrderHistoryComponent;
  let orderService: OrderService;

  const mockOrders: Order[] = [
    {
      id: 501,
      order_number: 'ORD-2026-1001',
      total_amount: 145.0,
      subtotal: 140.0,
      discount_amount: 0,
      shipping_fee: 5.0,
      status: 'pending',
      payment_status: 'unpaid',
      created_at: '2026-11-03T10:00:00Z',
      shipping_address: {
        recipient_name: 'Nabil Rahman',
        phone: '+8801711000000',
        street_address: 'House 12, Road 4',
        city: 'Dhaka',
        postal_code: '1230',
      },
      items: [
        {
          id: 1,
          order_id: 501,
          product_name: 'Artisan Linen Panjabi',
          variant_sku: 'ECO-PJ-BLK-L',
          variant_size: 'L',
          variant_color: 'Black',
          unit_price: 70.0,
          quantity: 2,
          line_total: 140.0,
        },
      ],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderHistoryComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    orderService = TestBed.inject(OrderService);
    vi.spyOn(orderService, 'getMyOrders').mockReturnValue(
      of({
        success: true,
        message: 'Orders retrieved',
        data: mockOrders,
      })
    );

    fixture = TestBed.createComponent(OrderHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should render customer placed orders on init', () => {
    expect(component.orders().length).toBe(1);
    expect(component.orders()[0].order_number).toBe('ORD-2026-1001');
    expect(component.orders()[0].status).toBe('pending');
  });

  it('should toggle order details expansion', () => {
    expect(component.expandedOrderId()).toBe(501);
    component.toggleDetails(501);
    expect(component.expandedOrderId()).toBeNull();
    component.toggleDetails(501);
    expect(component.expandedOrderId()).toBe(501);
  });

  it('should open cancellation modal for pending order and confirm cancellation', () => {
    const toast = TestBed.inject(ToastService);
    const toastSpy = vi.spyOn(toast, 'success');
    const cancelSpy = vi.spyOn(orderService, 'cancelOrder').mockReturnValue(
      of({
        success: true,
        message: 'Order cancelled',
        data: { ...mockOrders[0], status: 'cancelled' },
      })
    );

    component.openCancelModal(mockOrders[0]);
    expect(component.cancellingOrder()).toEqual(mockOrders[0]);

    component.cancelReason = 'Wrong size selected';
    component.confirmCancel();

    expect(cancelSpy).toHaveBeenCalledWith(501, 'Wrong size selected');
    expect(toastSpy).toHaveBeenCalledWith('Order ORD-2026-1001 has been cancelled.');
    expect(component.cancellingOrder()).toBeNull();
  });
});
