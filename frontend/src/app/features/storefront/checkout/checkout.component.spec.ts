import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CheckoutComponent } from './checkout.component';
import { OrderService } from '../../../core/services/order.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';

describe('CheckoutComponent', () => {
  let fixture: any;
  let component: CheckoutComponent;
  let orderService: OrderService;
  let cartService: CartService;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [
        provideHttpClient(),
        provideRouter([{ path: 'order-confirmation/:orderNumber', component: CheckoutComponent }]),
      ],
    }).compileComponents();

    orderService = TestBed.inject(OrderService);
    cartService = TestBed.inject(CartService);
    toastService = TestBed.inject(ToastService);

    vi.spyOn(orderService, 'getDeliveryCharges').mockReturnValue(
      of({
        success: true,
        message: 'Delivery charges loaded',
        data: {
          currency: 'BDT',
          currency_symbol: '৳',
          inside_dhaka_fee: 70,
          outside_dhaka_fee: 130,
          free_shipping_threshold: 2500,
        },
      })
    );

    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load dynamic regional delivery charges from backend', () => {
    expect(component).toBeTruthy();
    expect(component.insideDhakaFee()).toBe(70);
    expect(component.outsideDhakaFee()).toBe(130);
    expect(component.freeShippingThreshold()).toBe(2500);
  });

  it('should contain all 64 districts across 8 Bangladesh divisions', () => {
    const totalDistricts = component.bdDistricts.reduce(
      (sum, group) => sum + group.districts.length,
      0
    );
    expect(totalDistricts).toBe(64);
    expect(component.bdDistricts.length).toBe(8);
  });

  it('should calculate Inside Dhaka delivery fee as ৳70 when subtotal < ৳2,500', () => {
    // subtotal = 0 < 2500
    component.city.set('Dhaka');
    expect(component.shippingFee()).toBe(70);
  });

  it('should calculate Outside Dhaka delivery fee as ৳130 when subtotal < ৳2,500', () => {
    component.city.set('Chattogram');
    expect(component.shippingFee()).toBe(130);
  });

  it('should calculate Free Shipping (৳0) when subtotal reaches or exceeds ৳2,500', () => {
    // Simulate cart subtotal >= 2500
    vi.spyOn(cartService, 'subtotal').mockReturnValue(2850);
    component.city.set('Sylhet');
    expect(component.shippingFee()).toBe(0);
  });

  it('should block order placement if Terms & Conditions checkbox is unchecked', () => {
    const errorSpy = vi.spyOn(toastService, 'error');
    component.agreeTerms = false;
    component.recipientName = 'Tariqul Islam';
    component.phone = '01711000000';
    component.streetAddress = 'House 48, Road 11';
    component.postalCode = '1213';

    component.placeOrder();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Terms & Conditions')
    );
  });

  it('should validate 11-digit Bangladeshi mobile format', () => {
    const errorSpy = vi.spyOn(toastService, 'error');
    component.agreeTerms = true;
    component.recipientName = 'Tariqul Islam';
    component.phone = '12345'; // Invalid
    component.streetAddress = 'House 48, Road 11';
    component.postalCode = '1213';

    component.placeOrder();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('11-digit Bangladeshi mobile number')
    );
  });

  it('should accept valid Bangladeshi mobile number (e.g. 01711000000 or +8801711000000)', () => {
    const placeGuestSpy = vi.spyOn(orderService, 'placeGuestOrder').mockReturnValue(
      of({
        success: true,
        message: 'Order created',
        data: {
          id: 99,
          order_number: 'MAV-2026-9099',
          subtotal: 1380,
          discount_amount: 0,
          shipping_fee: 70,
          total_amount: 1450,
          status: 'pending',
          payment_status: 'unpaid',
          created_at: '2026-11-04T00:00:00Z',
          shipping_address: {
            recipient_name: 'Tariqul Islam',
            phone: '01711000000',
            street_address: 'House 48, Road 11, Banani',
            city: 'Dhaka',
            postal_code: '1213',
          },
        },
      })
    );

    component.agreeTerms = true;
    component.recipientName = 'Tariqul Islam';
    component.phone = '01711000000';
    component.streetAddress = 'House 48, Road 11, Banani';
    component.postalCode = '1213';

    component.placeOrder();
    expect(placeGuestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        guest_phone: '01711000000',
        payment_provider: 'cod',
      })
    );
  });

  it('should allow selecting manual payment gateway and require valid TrxID', () => {
    const errorSpy = vi.spyOn(toastService, 'error');
    component.selectPaymentMethod('manual');
    expect(component.paymentProvider()).toBe('manual');
    expect(component.selectedMethodLabel()).toContain('Manual Gateway');

    component.agreeTerms = true;
    component.recipientName = 'Tariqul Islam';
    component.phone = '01711000000';
    component.streetAddress = 'House 48, Road 11';
    component.postalCode = '1213';
    component.paymentTransactionId = ''; // missing TrxID

    component.placeOrder();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Transaction ID (TrxID)')
    );
  });

  it('should block unbacked Cash on Delivery when cart items require advance payment', () => {
    const errorSpy = vi.spyOn(toastService, 'error');
    // Mock cart items with advance_payment_type = 'fifty_percent'
    vi.spyOn(cartService, 'items').mockReturnValue([
      {
        product_id: 1,
        variant_id: 10,
        product_name: 'Custom Tailored Suit',
        product_slug: 'custom-suit',
        price: 5000,
        effective_price: 5000,
        quantity: 1,
        line_total: 5000,
        stock_quantity: 5,
        advance_payment_type: 'fifty_percent',
      } as any,
    ]);
    vi.spyOn(cartService, 'subtotal').mockReturnValue(5000);

    // Required advance should be 50% of 5000 = 2500
    expect(component.requiredAdvanceAmount()).toBe(2500);

    component.selectPaymentMethod('cod');
    component.agreeTerms = true;
    component.recipientName = 'Tariqul Islam';
    component.phone = '01711000000';
    component.streetAddress = 'House 48, Road 11';
    component.postalCode = '1213';

    component.placeOrder();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('advance payment of ৳2500 is required')
    );
  });

  it('should pass advance_amount and due_amount when placing order with manual gateway', () => {
    const placeGuestSpy = vi.spyOn(orderService, 'placeGuestOrder').mockReturnValue(
      of({
        success: true,
        message: 'Order created',
        data: { id: 101, order_number: 'MAV-2026-ADV-1' } as any,
      })
    );

    vi.spyOn(cartService, 'items').mockReturnValue([
      {
        product_id: 2,
        variant_id: 20,
        product_name: 'Made to Order Panjabi',
        product_slug: 'made-to-order-panjabi',
        price: 3000,
        effective_price: 3000,
        quantity: 1,
        line_total: 3000,
        stock_quantity: 10,
        advance_payment_type: 'thirty_percent',
      } as any,
    ]);
    vi.spyOn(cartService, 'subtotal').mockReturnValue(3000);

    // 30% of 3000 = 900
    expect(component.requiredAdvanceAmount()).toBe(900);

    component.selectPaymentMethod('manual');
    component.paymentTransactionId = 'CTB9928381X';
    component.agreeTerms = true;
    component.recipientName = 'Tariqul Islam';
    component.phone = '01711000000';
    component.streetAddress = 'House 48, Road 11';
    component.postalCode = '1213';

    component.placeOrder();
    expect(placeGuestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_provider: 'manual',
        transaction_id: 'CTB9928381X',
        advance_amount: 900,
        due_amount: expect.any(Number),
      })
    );
  });
});
