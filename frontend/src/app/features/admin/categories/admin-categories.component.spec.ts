import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AdminCategoriesComponent } from './admin-categories.component';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { Category } from '../../../core/models/api.models';

describe('AdminCategoriesComponent', () => {
  let fixture: any;
  let component: AdminCategoriesComponent;
  let adminService: AdminService;

  const mockCategories: Category[] = [
    {
      id: 1,
      name: 'Men Panjabi',
      slug: 'men-panjabi',
      description: 'Traditional & contemporary panjabis',
      is_active: 1,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminCategoriesComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    adminService = TestBed.inject(AdminService);
    vi.spyOn(adminService, 'getCategories').mockReturnValue(
      of({ success: true, message: 'OK', data: mockCategories })
    );

    fixture = TestBed.createComponent(AdminCategoriesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load categories list on init', () => {
    expect(component.categories().length).toBe(1);
    expect(component.categories()[0].slug).toBe('men-panjabi');
  });

  it('should create new category', () => {
    const toast = TestBed.inject(ToastService);
    const toastSpy = vi.spyOn(toast, 'success');
    const createSpy = vi.spyOn(adminService, 'createCategory').mockReturnValue(
      of({
        success: true,
        message: 'Created',
        data: { id: 2, name: 'Shirts', slug: 'shirts', is_active: 1 },
      })
    );

    component.form.name = 'Shirts';
    component.form.description = 'Contemporary atelier shirts';
    component.saveCategory();

    expect(createSpy).toHaveBeenCalled();
    expect(toastSpy).toHaveBeenCalledWith('Category created.');
  });
});
