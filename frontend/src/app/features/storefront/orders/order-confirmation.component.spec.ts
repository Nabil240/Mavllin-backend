import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderConfirmationComponent } from './order-confirmation.component';
import { OrderService } from '../../../core/services/order.service';
import { Order } from '../../../core/models/api.models';

describe('OrderConfirmationComponent', () => {
  let fixture: any;
  let component: OrderConfirmationComponent;
  let orderService: OrderService;

  const mockOrder: Order = {
    id: 901,
    order_number: 'MAV-2026-CONF-901',
    user_id: 12,
    customer_name: 'Tanvir Hossain',
    customer_email: 'tanvir@example.com',
    customer_phone: '01711223344',
    subtotal: 3500,
    discount_amount: 500,
    shipping_fee: 70,
    total_amount: 3070,
    advance_amount: 1000,
    due_amount: 2070,
    advance_payment_status: 'paid',
    status: 'confirmed',
    payment_status: 'paid',
    payment_provider: 'manual',
    payment_method: 'manual',
    transaction_id: 'CTB-TX-998822',
    sender_phone: '01711223344',
    created_at: '2026-11-04T10:00:00Z',
    shipping_address: {
      recipient_name: 'Tanvir Hossain',
      phone: '01711223344',
      street_address: 'Road 7, Sector 3, Uttara',
      area: 'Uttara',
      city: 'Dhaka',
      postal_code: '1230',
      country: 'Bangladesh',
    },
    items: [
      {
        id: 1,
        order_id: 901,
        product_id: 5,
        variant_id: 15,
        product_name: 'Classic Linen Panjabi',
        variant_sku: 'MAV-PANJ-WHT-L',
        variant_size: 'L',
        variant_color: 'White',
        unit_price: 3500,
        quantity: 1,
        line_total: 3500,
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderConfirmationComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(new Map([['orderNumber', 'MAV-2026-CONF-901']])),
          },
        },
      ],
    }).compileComponents();

    orderService = TestBed.inject(OrderService);
    vi.spyOn(orderService, 'trackOrder').mockReturnValue(
      of({
        success: true,
        message: 'Order retrieved',
        data: mockOrder,
      })
    );

    fixture = TestBed.createComponent(OrderConfirmationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load order by orderNumber route param', () => {
    expect(component).toBeTruthy();
    expect(component.orderNumber()).toBe('MAV-2026-CONF-901');
    expect(component.order()).toEqual(mockOrder);
    expect(component.loading()).toBe(false);
  });

  it('should resolve dynamic payment method titles accurately', () => {
    expect(component.getPaymentMethodTitle(mockOrder)).toBe('Manual Bank Transfer (City Bank PLC)');

    const bkashOrder = { ...mockOrder, payment_provider: 'bkash' };
    expect(component.getPaymentMethodTitle(bkashOrder)).toBe('bKash Mobile Banking');

    const nagadOrder = { ...mockOrder, payment_provider: 'nagad' };
    expect(component.getPaymentMethodTitle(nagadOrder)).toBe('Nagad Mobile Banking');

    const codOrder = { ...mockOrder, payment_provider: 'cod' };
    expect(component.getPaymentMethodTitle(codOrder)).toBe('Cash on Delivery (COD)');
  });

  it('should trigger window.print on printReceipt', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    component.printReceipt();
    expect(printSpy).toHaveBeenCalled();
  });

  it('should generate standalone HTML blob and trigger download on downloadReceiptHtml', () => {
    let clickedLink: any = null;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'a') {
        clickedLink = el;
        vi.spyOn(el, 'click').mockImplementation(() => {});
      }
      return el;
    });

    component.downloadReceiptHtml();

    expect(clickedLink).not.toBeNull();
    expect(clickedLink.download).toBe('receipt-MAV-2026-CONF-901.html');
    expect(clickedLink.href).toContain('blob:');
  });
});
