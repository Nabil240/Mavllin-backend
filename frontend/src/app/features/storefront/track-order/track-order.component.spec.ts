import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { TrackOrderComponent } from './track-order.component';
import { OrderService } from '../../../core/services/order.service';
import { Order } from '../../../core/models/api.models';

describe('TrackOrderComponent', () => {
  let fixture: any;
  let component: TrackOrderComponent;
  let orderService: OrderService;

  const mockOrder: Order = {
    id: 99,
    order_number: 'ORD-2026-1002',
    total_amount: 195.0,
    subtotal: 190.0,
    discount_amount: 0,
    shipping_fee: 5.0,
    status: 'shipped',
    payment_status: 'unpaid',
    courier_name: 'Steadfast Courier',
    tracking_number: 'STF-BD-99120',
    created_at: '2026-11-03T11:00:00Z',
    shipping_address: {
      recipient_name: 'Recipient Name',
      phone: '+8801700000000',
      street_address: 'Banani 11',
      city: 'Dhaka',
      postal_code: '1213',
    },
    items: [
      {
        id: 1,
        order_id: 99,
        product_name: 'Structured Cotton Overshirt',
        variant_sku: 'ECO-OVR-NVY-M',
        variant_size: 'M',
        variant_color: 'Navy',
        unit_price: 95.0,
        quantity: 2,
        line_total: 190.0,
      },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackOrderComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => (key === 'orderNumber' ? 'ORD-2026-1002' : null),
              },
            },
          },
        },
      ],
    }).compileComponents();

    orderService = TestBed.inject(OrderService);
    vi.spyOn(orderService, 'trackOrder').mockReturnValue(
      of({
        success: true,
        message: 'Order tracked',
        data: mockOrder,
      })
    );

    fixture = TestBed.createComponent(TrackOrderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should auto-track order when orderNumber is in query params', () => {
    expect(component.orderNumberInput).toBe('ORD-2026-1002');
    expect(orderService.trackOrder).toHaveBeenCalledWith('ORD-2026-1002');
    expect(component.order()).toEqual(mockOrder);
    expect(component.order()?.courier_name).toBe('Steadfast Courier');
  });

  it('should evaluate lifecycle steps accurately', () => {
    // For shipped status: step 1 (placed), 2 (processing), 3 (shipped) are done; 4 (delivered) is false
    expect(component.isStepDone(1, 'shipped')).toBe(true);
    expect(component.isStepDone(2, 'shipped')).toBe(true);
    expect(component.isStepDone(3, 'shipped')).toBe(true);
    expect(component.isStepDone(4, 'shipped')).toBe(false);
  });
});
