import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderConfirmationComponent } from './order-confirmation.component';
import { OrderService } from '../../../core/services/order.service';
import { Order } from '../../../core/models/api.models';

describe('OrderConfirmationComponent — Challenger Adversarial Matrix', () => {
  let fixture: any;
  let component: OrderConfirmationComponent;
  let orderService: OrderService;

  const baseOrder: Order = {
    id: 9999,
    order_number: 'MAV-CHAL-2026-001',
    user_id: 88,
    customer_name: 'Mahmudul Hasan',
    customer_email: 'mahmud@mavllin.test',
    customer_phone: '+8801712345678',
    subtotal: 5499.50,
    discount_amount: 500.00,
    shipping_fee: 70.00,
    total_amount: 5069.50,
    advance_amount: 1520.85,
    due_amount: 3548.65,
    advance_payment_status: 'paid',
    status: 'confirmed',
    payment_status: 'paid',
    payment_provider: 'manual',
    payment_method: 'manual',
    transaction_id: 'TRX-BANK-882910471',
    sender_phone: '01899112233',
    created_at: '2026-11-07T18:00:00Z',
    shipping_address: {
      recipient_name: 'Mahmudul Hasan',
      phone: '+8801712345678',
      street_address: 'Flat 4B, House 18, Road 11, Banani',
      area: 'Banani',
      city: 'Dhaka',
      postal_code: '1213',
      country: 'Bangladesh',
    },
    items: [
      {
        id: 101,
        order_id: 9999,
        product_id: 12,
        variant_id: 45,
        product_name: 'Silk Embroidered Panjabi',
        variant_sku: 'MAV-PANJ-SLK-M',
        variant_size: 'M',
        variant_color: 'Onyx Black',
        unit_price: 3999.50,
        quantity: 1,
        line_total: 3999.50,
      },
      {
        id: 102,
        order_id: 9999,
        product_id: 14,
        variant_id: 62,
        product_name: 'Heritage Fine Cotton Kurta',
        variant_sku: 'MAV-KRT-COT-L',
        variant_size: 'L',
        variant_color: 'Alabaster White',
        unit_price: 1500.00,
        quantity: 1,
        line_total: 1500.00,
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
            paramMap: of(new Map([['orderNumber', 'MAV-CHAL-2026-001']])),
          },
        },
      ],
    }).compileComponents();

    orderService = TestBed.inject(OrderService);
    vi.spyOn(orderService, 'trackOrder').mockReturnValue(
      of({
        success: true,
        message: 'Order details retrieved',
        data: baseOrder,
      })
    );

    fixture = TestBed.createComponent(OrderConfirmationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // =========================================================================
  // 1. Payment Method Mapping Adversarial Matrix
  // =========================================================================
  describe('1. Payment Method Title Resolution Matrix', () => {
    const paymentMatrix = [
      { provider: 'manual', method: 'manual', expected: 'Manual Bank Transfer (City Bank PLC)' },
      { provider: 'manual_payment', method: 'manual_payment', expected: 'Manual Bank Transfer (City Bank PLC)' },
      { provider: 'MANUAL', method: 'MANUAL', expected: 'Manual Bank Transfer (City Bank PLC)' },
      { provider: 'bkash', method: 'bkash', expected: 'bKash Mobile Banking' },
      { provider: 'BKASH', method: 'bkash', expected: 'bKash Mobile Banking' },
      { provider: 'nagad', method: 'nagad', expected: 'Nagad Mobile Banking' },
      { provider: 'NAGAD', method: 'nagad', expected: 'Nagad Mobile Banking' },
      { provider: 'rocket', method: 'rocket', expected: 'Dutch-Bangla Rocket' },
      { provider: 'ROCKET', method: 'rocket', expected: 'Dutch-Bangla Rocket' },
      { provider: 'upay', method: 'upay', expected: 'Upay Mobile Wallet' },
      { provider: 'UPAY', method: 'upay', expected: 'Upay Mobile Wallet' },
      { provider: 'cod', method: 'cash_on_delivery', expected: 'Cash on Delivery (COD)' },
      { provider: 'cash_on_delivery', method: 'cash_on_delivery', expected: 'Cash on Delivery (COD)' },
      { provider: undefined, method: 'bkash', expected: 'bKash Mobile Banking' },
      { provider: undefined, method: undefined, expected: 'Cash on Delivery (COD)' },
      { provider: 'unknown_gateway', method: 'unknown_gateway', expected: 'Cash on Delivery (COD)' },
    ];

    paymentMatrix.forEach(({ provider, method, expected }) => {
      it(`resolves provider="${provider}" / method="${method}" to "${expected}"`, () => {
        const testOrder = {
          ...baseOrder,
          payment_provider: provider as any,
          payment_method: method as any,
        };
        const title = component.getPaymentMethodTitle(testOrder);
        expect(title).toBe(expected);
      });
    });

    it('handles null order gracefully returning Cash on Delivery', () => {
      expect(component.getPaymentMethodTitle(null)).toBe('Cash on Delivery');
    });
  });

  // =========================================================================
  // 2. HTML Receipt Blob Generation Integrity
  // =========================================================================
  describe('2. Standalone HTML Receipt Blob Verification', () => {
    it('generates HTML blob containing all required transaction, customer, and item fields', () => {
      let capturedBlob: Blob | null = null;
      let downloadFilename = '';

      // Intercept URL.createObjectURL and link.click
      const origCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return 'blob:mock-receipt-url';
      });
      URL.revokeObjectURL = vi.fn();

      const origCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const el = origCreateElement(tagName);
        if (tagName.toLowerCase() === 'a') {
          vi.spyOn(el, 'click').mockImplementation(() => {});
          Object.defineProperty(el, 'download', {
            set: (val: string) => {
              downloadFilename = val;
            },
            get: () => downloadFilename,
          });
        }
        return el;
      });

      component.downloadReceiptHtml();

      // Invariant 1: Blob was created and has HTML mime type
      expect(capturedBlob).not.toBeNull();
      expect(capturedBlob!.type).toBe('text/html;charset=utf-8');

      // Invariant 2: Download filename matches expected pattern
      expect(downloadFilename).toBe('receipt-MAV-CHAL-2026-001.html');

      // Invariant 3: Extract blob text and verify critical invoice fields
      // Use FileReader or sync read if possible
      // Read blob via promise
      return capturedBlob!.text().then((htmlContent) => {
        const blobText = htmlContent;

        // Check required structural tags
        expect(blobText).toContain('<!DOCTYPE html>');
        expect(blobText).toContain('<title>MAVLLIN Receipt - MAV-CHAL-2026-001</title>');
        expect(blobText).toContain('MAVLLIN');

        // Check customer fields
        expect(blobText).toContain('Mahmudul Hasan');
        expect(blobText).toContain('+8801712345678');
        expect(blobText).toContain('mahmud@mavllin.test');
        expect(blobText).toContain('Banani');
        expect(blobText).toContain('1213');

        // Check order reference & payment info
        expect(blobText).toContain('MAV-CHAL-2026-001');
        expect(blobText).toContain('Manual Bank Transfer (City Bank PLC)');
        expect(blobText).toContain('TRX-BANK-882910471');
        expect(blobText).toContain('01899112233');

        // Check line items
        expect(blobText).toContain('Silk Embroidered Panjabi');
        expect(blobText).toContain('MAV-PANJ-SLK-M');
        expect(blobText).toContain('Onyx Black');
        expect(blobText).toContain('3999.50');

        expect(blobText).toContain('Heritage Fine Cotton Kurta');
        expect(blobText).toContain('MAV-KRT-COT-L');
        expect(blobText).toContain('Alabaster White');
        expect(blobText).toContain('1500.00');

        // Check financial breakdown in BDT (৳)
        expect(blobText).toContain('৳5499.50'); // Subtotal
        expect(blobText).toContain('৳500.00');  // Discount
        expect(blobText).toContain('৳70.00');   // Shipping Fee
        expect(blobText).toContain('৳5069.50'); // Total Order Value
        expect(blobText).toContain('Advance Paid / Required:');
        expect(blobText).toContain('৳1520.85'); // Advance
        expect(blobText).toContain('Balance Due on Delivery:');
        expect(blobText).toContain('৳3548.65'); // Due amount

        // Restore mocks
        URL.createObjectURL = origCreateObjectURL;
      });
    });

    it('generates clean receipt without advance section when advance_amount is zero', () => {
      const zeroAdvanceOrder: Order = {
        ...baseOrder,
        order_number: 'MAV-CHAL-NOADV-002',
        advance_amount: 0,
        due_amount: 5069.50,
      };
      component.order.set(zeroAdvanceOrder);

      let capturedBlob: Blob | null = null;
      const origCreateObjectURL = URL.createObjectURL;
      URL.createObjectURL = vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return 'blob:mock-url';
      });

      component.downloadReceiptHtml();
      expect(capturedBlob).not.toBeNull();

      return capturedBlob!.text().then((htmlContent) => {
        expect(htmlContent).not.toContain('Advance Paid / Required:');
        URL.createObjectURL = origCreateObjectURL;
      });
    });
  });

  // =========================================================================
  // 3. Print Functionality Trigger
  // =========================================================================
  describe('3. Receipt Printing & Actions', () => {
    it('invokes window.print when printReceipt is called', () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      component.printReceipt();
      expect(printSpy).toHaveBeenCalledTimes(1);
    });
  });
});
