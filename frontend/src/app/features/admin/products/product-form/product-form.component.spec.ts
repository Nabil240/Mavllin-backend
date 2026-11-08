import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { ProductFormComponent } from './product-form.component';
import { AdminService } from '../../../../core/services/admin.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Product } from '../../../../core/models/api.models';

describe('ProductFormComponent', () => {
  let fixture: any;
  let component: ProductFormComponent;
  let adminService: AdminService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductFormComponent],
      providers: [
        provideHttpClient(),
        provideRouter([{ path: 'admin/products', component: class {} }]),
      ],
    }).compileComponents();

    adminService = TestBed.inject(AdminService);
    router = TestBed.inject(Router);
    vi.spyOn(adminService, 'getCategories').mockReturnValue(
      of({ success: true, message: 'OK', data: [] })
    );

    fixture = TestBed.createComponent(ProductFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize with 1 default variant row', () => {
    expect(component.isEditMode()).toBe(false);
    expect(component.variants.length).toBe(1);
    expect(component.variants[0].size).toBe('M');
  });

  it('should auto-derive slug and default SKU on name change', () => {
    component.onNameChange('Formal Twill Shirt');
    expect(component.form.slug).toBe('formal-twill-shirt');
    expect(component.variants[0].sku).toContain('ECO-FORMAL-TWI');
  });

  it('should add and remove variant rows', () => {
    component.form.slug = 'test-shirt';
    component.addVariantRow();
    expect(component.variants.length).toBe(2);

    component.removeVariantRow(1);
    expect(component.variants.length).toBe(1);
  });

  it('should generate matrix combinations from sizes and colors', () => {
    component.form.slug = 'linen-shirt';
    component.genSizes = 'M, L';
    component.genColors = 'Black, White';
    component.genDefaultStock = 12;

    component.generateMatrix();
    // 2 sizes * 2 colors = 4 variants
    expect(component.variants.length).toBe(4);
    expect(component.variants[0].stock_quantity).toBe(12);
  });

  it('should prevent submission when SKUs are duplicated', () => {
    const toast = TestBed.inject(ToastService);
    const toastSpy = vi.spyOn(toast, 'error');
    const createSpy = vi.spyOn(adminService, 'createProduct');

    component.form.name = 'Test Garment';
    component.form.slug = 'test-garment';
    component.variants = [
      {
        sku: 'DUPLICATE-SKU',
        size: 'M',
        color: 'Black',
        price: 80,
        stock_quantity: 10,
        is_active: true,
      },
      {
        sku: 'DUPLICATE-SKU',
        size: 'L',
        color: 'Black',
        price: 80,
        stock_quantity: 10,
        is_active: true,
      },
    ];

    component.saveProduct();
    expect(toastSpy).toHaveBeenCalledWith('Duplicate SKU detected: DUPLICATE-SKU');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should successfully submit valid product and navigate to /admin/products', () => {
    const navigateSpy = vi.spyOn(router, 'navigate');
    const createSpy = vi.spyOn(adminService, 'createProduct').mockReturnValue(
      of({
        success: true,
        message: 'Product created',
        data: {} as Product,
      })
    );

    component.form.name = 'Unique Garment';
    component.form.slug = 'unique-garment';
    component.variants = [
      {
        sku: 'ECO-UNIQ-M',
        size: 'M',
        color: 'Navy',
        price: 95,
        stock_quantity: 30,
        is_active: true,
      },
    ];

    component.saveProduct();
    expect(createSpy).toHaveBeenCalled();
    expect(navigateSpy).toHaveBeenCalledWith(['/admin/products']);
  });

  it('should accurately compute calculatedDiscountPrice for percentage and fixed discounts', () => {
    component.form.base_price = 1000;
    component.form.discount_type = 'percentage';
    component.form.discount_value = 20;
    expect(component.calculatedDiscountPrice).toBe(800);

    component.form.discount_type = 'fixed';
    component.form.discount_value = 150;
    expect(component.calculatedDiscountPrice).toBe(850);

    component.form.discount_type = 'none';
    expect(component.calculatedDiscountPrice).toBe(1000);
  });

  it('should validate percentage discount range and block submission if invalid', () => {
    const toast = TestBed.inject(ToastService);
    const toastSpy = vi.spyOn(toast, 'error');
    const createSpy = vi.spyOn(adminService, 'createProduct');

    component.form.name = 'Discounted Garment';
    component.form.slug = 'discounted-garment';
    component.form.base_price = 500;
    component.form.discount_type = 'percentage';
    component.form.discount_value = 120; // >100% invalid
    component.variants = [
      {
        sku: 'ECO-DISC-M',
        size: 'M',
        color: 'Navy',
        price: 500,
        stock_quantity: 10,
        is_active: true,
      },
    ];

    component.saveProduct();
    expect(toastSpy).toHaveBeenCalledWith('Percentage discount must be between 0% and 100%.');
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('should include discount_type, discount_value, and advance_payment_type in payload', () => {
    const createSpy = vi.spyOn(adminService, 'createProduct').mockReturnValue(
      of({ success: true, message: 'Created', data: {} as Product })
    );

    component.form.name = 'Advance Linen Shirt';
    component.form.slug = 'advance-linen-shirt';
    component.form.base_price = 2000;
    component.form.discount_type = 'percentage';
    component.form.discount_value = 10;
    component.form.advance_payment_type = 'thirty_percent';
    component.variants = [
      {
        sku: 'ECO-ADV-M',
        size: 'M',
        color: 'White',
        price: 2000,
        stock_quantity: 15,
        is_active: true,
      },
    ];

    component.saveProduct();
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        discount_type: 'percentage',
        discount_value: 10,
        discount_price: 1800,
        advance_payment_type: 'thirty_percent',
      })
    );
  });
});
