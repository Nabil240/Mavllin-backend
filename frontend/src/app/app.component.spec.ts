import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { App } from './app.component';
import { ToastService } from './core/services/toast.service';
import { CartService } from './core/services/cart.service';
import { WishlistService } from './core/services/wishlist.service';
import { Product } from './core/models/api.models';

describe('MAVLLIN Frontend Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();
  });

  it('should create the root App component', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
    expect(app.title).toBe('MAVLLIN');
  });

  it('should add and dismiss toast notifications via ToastService', () => {
    const toast = TestBed.inject(ToastService);
    expect(toast.toasts().length).toBe(0);
    toast.success('Added to bag');
    expect(toast.toasts().length).toBe(1);
    expect(toast.toasts()[0].message).toBe('Added to bag');
    toast.dismiss(toast.toasts()[0].id);
    expect(toast.toasts().length).toBe(0);
  });

  it('should manage guest cart items and cap quantity at variant stock via CartService', () => {
    const cart = TestBed.inject(CartService);
    cart.clearCart(true);

    const mockProduct: Product = {
      id: 101,
      name: 'Artisan Linen Panjabi',
      slug: 'artisan-linen-panjabi',
      base_price: 1500,
      price: 1500,
      is_featured: 1,
      is_active: 1,
      variants: [
        {
          id: 501,
          product_id: 101,
          sku: 'MAV-PJ-501-L',
          size: 'L',
          color: 'Ivory',
          price: 1500,
          stock_quantity: 3,
          is_active: 1,
        },
      ],
    };

    cart.addItem(mockProduct, mockProduct.variants![0], 2, false);
    expect(cart.totalItems()).toBe(2);
    expect(cart.subtotal()).toBe(3000);
    expect(cart.freeShippingRemaining()).toBe(0);

    // Attempt to exceed stock_quantity (3)
    cart.addItem(mockProduct, mockProduct.variants![0], 5, false);
    expect(cart.totalItems()).toBe(3);

    cart.clearCart(true);
    expect(cart.totalItems()).toBe(0);
  });

  it('should toggle products in guest wishlist via WishlistService', () => {
    const wishlist = TestBed.inject(WishlistService);
    const mockProduct: Product = {
      id: 202,
      name: 'Structured Cotton Overshirt',
      slug: 'structured-cotton-overshirt',
      base_price: 55,
      price: 55,
      is_featured: 1,
      is_active: 1,
    };

    expect(wishlist.isWishlisted(202)).toBe(false);
    wishlist.toggle(mockProduct);
    expect(wishlist.isWishlisted(202)).toBe(true);
    expect(wishlist.count()).toBe(1);

    wishlist.toggle(mockProduct);
    expect(wishlist.isWishlisted(202)).toBe(false);
    expect(wishlist.count()).toBe(0);
  });
});
