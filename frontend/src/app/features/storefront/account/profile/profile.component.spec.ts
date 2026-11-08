import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../../../core/services/auth.service';
import { OrderService } from '../../../../core/services/order.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Address } from '../../../../core/models/api.models';

describe('ProfileComponent', () => {
  let fixture: any;
  let component: ProfileComponent;
  let authService: AuthService;
  let orderService: OrderService;

  const mockAddresses: Address[] = [
    {
      id: 1,
      label: 'Home',
      recipient_name: 'Nabil Rahman',
      phone: '+8801711000000',
      street_address: 'House 10, Road 2',
      city: 'Dhaka',
      postal_code: '1212',
      country: 'Bangladesh',
      is_default: 1,
    },
  ];

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    orderService = TestBed.inject(OrderService);

    authService.user.set({
      id: 1,
      full_name: 'Nabil Rahman',
      email: 'nabil@projecteco.com',
      phone: '+8801711000000',
      role: 'customer',
      is_active: 1,
    });

    vi.spyOn(orderService, 'getAddresses').mockReturnValue(
      of({
        success: true,
        message: 'Addresses loaded',
        data: mockAddresses,
      })
    );

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize profile details and load addresses', () => {
    expect(component.profileName).toBe('Nabil Rahman');
    expect(component.profilePhone).toBe('+8801711000000');
    expect(component.addresses().length).toBe(1);
  });

  it('should save updated profile details', () => {
    const toast = TestBed.inject(ToastService);
    const toastSpy = vi.spyOn(toast, 'success');
    const updateSpy = vi.spyOn(authService, 'updateProfile').mockReturnValue(
      of({
        success: true,
        message: 'Profile updated',
        data: {
          id: 1,
          full_name: 'Nabil Updated',
          email: 'nabil@projecteco.com',
          phone: '+8801722222222',
          role: 'customer',
          is_active: 1,
        },
      })
    );

    component.profileName = 'Nabil Updated';
    component.profilePhone = '+8801722222222';
    component.saveProfile();

    expect(updateSpy).toHaveBeenCalledWith({
      full_name: 'Nabil Updated',
      phone: '+8801722222222',
    });
    expect(toastSpy).toHaveBeenCalledWith('Your profile has been updated.');
  });

  it('should add a new delivery address', () => {
    const createSpy = vi.spyOn(orderService, 'createAddress').mockReturnValue(
      of({
        success: true,
        message: 'Address created',
        data: {
          id: 2,
          label: 'Office',
          recipient_name: 'Nabil Work',
          phone: '+8801711000000',
          street_address: 'Gulshan 1',
          city: 'Dhaka',
          postal_code: '1212',
          country: 'Bangladesh',
          is_default: 0,
        },
      })
    );

    component.openAddressModal();
    expect(component.editingAddress()).toBeTruthy();

    component.modalAddressForm = {
      label: 'Office',
      recipient_name: 'Nabil Work',
      phone: '+8801711000000',
      street_address: 'Gulshan 1',
      city: 'Dhaka',
      postal_code: '1212',
      is_default: false,
    };

    component.saveAddress();
    expect(createSpy).toHaveBeenCalled();
  });
});
