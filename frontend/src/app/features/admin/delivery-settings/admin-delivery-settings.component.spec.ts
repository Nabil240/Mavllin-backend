import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AdminDeliverySettingsComponent } from './admin-delivery-settings.component';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

describe('AdminDeliverySettingsComponent', () => {
  let fixture: any;
  let component: AdminDeliverySettingsComponent;
  let adminService: AdminService;
  let toastService: ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminDeliverySettingsComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    adminService = TestBed.inject(AdminService);
    toastService = TestBed.inject(ToastService);

    vi.spyOn(adminService, 'getDeliverySettings').mockReturnValue(
      of({
        success: true,
        message: 'Settings loaded',
        data: {
          delivery_charge_inside_dhaka: 70,
          delivery_charge_outside_dhaka: 130,
          free_shipping_threshold: 2500,
          estimated_days_inside_dhaka: '24–48 hours',
          estimated_days_outside_dhaka: '3–5 business days',
        },
      })
    );

    fixture = TestBed.createComponent(AdminDeliverySettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load delivery charges in BDT', () => {
    expect(component.insideDhaka).toBe(70);
    expect(component.outsideDhaka).toBe(130);
    expect(component.freeThreshold).toBe(2500);
  });

  it('should prevent submission of negative amounts', () => {
    const errorSpy = vi.spyOn(toastService, 'error');
    component.insideDhaka = -10;
    component.saveSettings();
    expect(errorSpy).toHaveBeenCalledWith('Delivery charges and thresholds cannot be negative.');
  });

  it('should save valid delivery charges and display toast notification', () => {
    const successSpy = vi.spyOn(toastService, 'success');
    const updateSpy = vi.spyOn(adminService, 'updateDeliverySettings').mockReturnValue(
      of({ success: true, message: 'Settings saved', data: {} })
    );

    component.insideDhaka = 60;
    component.outsideDhaka = 120;
    component.freeThreshold = 2000;
    component.saveSettings();

    expect(updateSpy).toHaveBeenCalledWith({
      delivery_charge_inside_dhaka: 60,
      delivery_charge_outside_dhaka: 120,
      free_shipping_threshold: 2000,
      estimated_days_inside_dhaka: '24–48 hours',
      estimated_days_outside_dhaka: '3–5 business days',
    });
    expect(successSpy).toHaveBeenCalledWith('Regional delivery settings updated successfully.');
  });

  it('should save promotional popup settings (R9) and display toast notification', () => {
    const successSpy = vi.spyOn(toastService, 'success');
    const updateSpy = vi.spyOn(adminService, 'updateDeliverySettings').mockReturnValue(
      of({ success: true, message: 'Popup saved', data: {} })
    );

    component.promoPopupEnabled = true;
    component.promoPopupTitle = 'FLASH SALE';
    component.promoPopupSubtitle = 'Special 30% discount on panjabis';
    component.promoPopupDiscountCode = 'FLASH30';
    component.promoPopupTargetLink = '/products?category=panjabi';
    component.savePromoPopupSettings();

    expect(updateSpy).toHaveBeenCalledWith({
      promo_popup_enabled: true,
      promo_popup_title: 'FLASH SALE',
      promo_popup_subtitle: 'Special 30% discount on panjabis',
      promo_popup_discount_code: 'FLASH30',
      promo_popup_target_link: '/products?category=panjabi',
    });
    expect(successSpy).toHaveBeenCalledWith('Website promotional popup updated successfully.');
  });
});
