import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { WishlistComponent } from './wishlist.component';
import { WishlistService } from '../../../../core/services/wishlist.service';
import { Product } from '../../../../core/models/api.models';

describe('WishlistComponent', () => {
  let fixture: any;
  let component: WishlistComponent;
  let wishlistService: WishlistService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [WishlistComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    wishlistService = TestBed.inject(WishlistService);
    fixture = TestBed.createComponent(WishlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and reflect wishlist items', () => {
    expect(component.wishlist.count()).toBe(0);

    const mockProduct: Product = {
      id: 301,
      name: 'Tailored Trouser',
      slug: 'tailored-trouser',
      base_price: 65,
      price: 65,
      is_featured: 0,
      is_active: 1,
    };

    wishlistService.toggle(mockProduct);
    expect(component.wishlist.count()).toBe(1);
    expect(component.wishlist.items()[0].name).toBe('Tailored Trouser');
  });
});
