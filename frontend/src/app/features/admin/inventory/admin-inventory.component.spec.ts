import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminInventoryComponent } from './admin-inventory.component';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProductVariant } from '../../../core/models/api.models';

describe('AdminInventoryComponent', () => {
  let fixture: any;
  let component: AdminInventoryComponent;
  let adminService: AdminService;

  const mockVariants: ProductVariant[] = [
    {
      id: 201,
      product_id: 1,
      product_name: 'Artisan Linen Panjabi',
      sku: 'ECO-PJ-BLK-M',
      size: 'M',
      color: 'Black',
      price: 80,
      stock_quantity: 3, // low stock
      is_active: 1,
    },
    {
      id: 202,
      product_id: 1,
      product_name: 'Artisan Linen Panjabi',
      sku: 'ECO-PJ-BLK-L',
      size: 'L',
      color: 'Black',
      price: 80,
      stock_quantity: 45, // in stock
      is_active: 1,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminInventoryComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    adminService = TestBed.inject(AdminService);
    vi.spyOn(adminService, 'getInventory').mockReturnValue(
      of({
        success: true,
        message: 'Inventory loaded',
        data: mockVariants,
      })
    );

    fixture = TestBed.createComponent(AdminInventoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load variant inventory stock on init', () => {
    expect(component.variants().length).toBe(2);
    expect(component.variants()[0].sku).toBe('ECO-PJ-BLK-M');
    expect(component.variants()[0].stock_quantity).toBe(3);
  });

  it('should open adjustment modal and record manual stock adjustment', () => {
    const toast = TestBed.inject(ToastService);
    const toastSpy = vi.spyOn(toast, 'success');
    const adjustSpy = vi.spyOn(adminService, 'adjustInventory').mockReturnValue(
      of({ success: true, message: 'Stock adjusted', data: {} })
    );

    component.openAdjustModal(mockVariants[0]);
    expect(component.selectedVariant()).toEqual(mockVariants[0]);

    component.adjustDelta = 10;
    component.adjustReason = 'restock';
    component.adjustNote = 'Warehouse shipment received';

    component.submitAdjustment();

    expect(adjustSpy).toHaveBeenCalledWith({
      variant_id: 201,
      quantity_delta: 10,
      reason: 'restock',
      note: 'Warehouse shipment received',
    });
    expect(toastSpy).toHaveBeenCalledWith('Stock adjusted for ECO-PJ-BLK-M.');
    expect(component.selectedVariant()).toBeNull();
  });
});
