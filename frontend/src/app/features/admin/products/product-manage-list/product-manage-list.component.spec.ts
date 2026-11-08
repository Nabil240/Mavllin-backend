import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProductManageListComponent } from './product-manage-list.component';
import { AdminService } from '../../../../core/services/admin.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Product, Category } from '../../../../core/models/api.models';

describe('ProductManageListComponent', () => {
  let fixture: any;
  let component: ProductManageListComponent;
  let adminService: AdminService;

  const mockCategories: Category[] = [
    { id: 1, name: 'Panjabi', slug: 'panjabi', is_active: 1 },
    { id: 2, name: 'Shirts', slug: 'shirts', is_active: 1 },
  ];

  const mockProducts: Product[] = [
    {
      id: 10,
      name: 'Signature Panjabi',
      slug: 'signature-panjabi',
      base_price: 90,
      price: 90,
      is_featured: 1,
      is_active: 1,
      category_name: 'Panjabi',
      variants: [
        {
          id: 1,
          product_id: 10,
          sku: 'ECO-PJ-BLK-M',
          size: 'M',
          color: 'Black',
          price: 90,
          stock_quantity: 15,
          is_active: 1,
        },
        {
          id: 2,
          product_id: 10,
          sku: 'ECO-PJ-BLK-L',
          size: 'L',
          color: 'Black',
          price: 90,
          stock_quantity: 20,
          is_active: 1,
        },
      ],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductManageListComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    adminService = TestBed.inject(AdminService);
    vi.spyOn(adminService, 'getCategories').mockReturnValue(
      of({ success: true, message: 'OK', data: mockCategories })
    );
    vi.spyOn(adminService, 'getProducts').mockReturnValue(
      of({ success: true, message: 'OK', data: mockProducts })
    );

    fixture = TestBed.createComponent(ProductManageListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load products and categories', () => {
    expect(component.products().length).toBe(1);
    expect(component.categories().length).toBe(2);
    expect(component.computeTotalStock(component.products()[0])).toBe(35);
  });

  it('should toggle featured status', () => {
    const updateSpy = vi.spyOn(adminService, 'updateProduct').mockReturnValue(
      of({
        success: true,
        message: 'Product updated',
        data: { ...mockProducts[0], is_featured: 0 },
      })
    );

    component.toggleFeatured(component.products()[0]);
    expect(updateSpy).toHaveBeenCalledWith(10, { is_featured: 0 });
    expect(component.products()[0].is_featured).toBe(false);
  });

  it('should toggle active status', () => {
    const updateSpy = vi.spyOn(adminService, 'updateProduct').mockReturnValue(
      of({
        success: true,
        message: 'Product updated',
        data: { ...mockProducts[0], is_active: 0 },
      })
    );

    component.toggleActive(component.products()[0]);
    expect(updateSpy).toHaveBeenCalledWith(10, { is_active: 0 });
    expect(component.products()[0].is_active).toBe(false);
  });
});
