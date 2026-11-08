import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HomeComponent } from './home.component';
import { CatalogService } from '../../../core/services/catalog.service';
import { SeoService } from '../../../core/services/seo.service';
import { Banner, Category, Product } from '../../../core/models/api.models';

describe('HomeComponent', () => {
  let fixture: any;
  let component: HomeComponent;
  let catalogService: CatalogService;
  let seoService: SeoService;

  const mockBanners: Banner[] = [
    {
      id: 1,
      title: 'MAVLLIN Festive Panjabi 2026',
      subtitle: 'Artisanal embroidery on pure cotton',
      badge_text: 'NEW ARRIVAL',
      cta_text: 'Shop Panjabi',
      cta_link: '/category/heritage-panjabi',
      image_url: '/uploads/products/banner-hero-1.svg',
      is_active: true,
      sort_order: 1,
    },
    {
      id: 2,
      title: 'Tailored Minimal Shirts',
      subtitle: 'Structured silhouettes for modern living',
      badge_text: 'SUMMER EDIT',
      cta_text: 'Shop Shirts',
      cta_link: '/catalog',
      image_url: '/uploads/products/banner-hero-2.svg',
      is_active: true,
      sort_order: 2,
    },
  ];

  const mockCategories: Category[] = [
    { id: 10, name: 'Heritage Panjabi', slug: 'heritage-panjabi', is_active: true },
    { id: 20, name: 'Menswear', slug: 'menswear', is_active: true },
  ];

  const mockProducts: Product[] = [
    {
      id: 101,
      name: 'Black Pearl Silk Blend Panjabi',
      slug: 'black-pearl-silk-panjabi',
      base_price: 2850,
      price: 2450,
      discount_price: 2450,
      is_featured: true,
      is_active: true,
      total_stock: 12,
      variants: [],
      images: [],
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    catalogService = TestBed.inject(CatalogService);
    seoService = TestBed.inject(SeoService);

    vi.spyOn(catalogService, 'getBanners').mockReturnValue(
      of({ success: true, message: 'Banners loaded', data: mockBanners })
    );
    vi.spyOn(catalogService, 'getCategories').mockReturnValue(
      of({ success: true, message: 'Categories loaded', data: mockCategories })
    );
    vi.spyOn(catalogService, 'getProducts').mockReturnValue(
      of({ success: true, message: 'Products loaded', data: mockProducts })
    );

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
  });

  it('should initialize and load banners, categories, and products', () => {
    expect(component).toBeTruthy();
    expect(component.banners().length).toBe(2);
    expect(component.categories().length).toBe(2);
    expect(component.showcaseProducts().length).toBe(1);
    expect(component.activeSlide()).toBe(0);
  });

  it('should advance slide on nextSlide() and wrap around', () => {
    expect(component.activeSlide()).toBe(0);
    component.nextSlide();
    expect(component.activeSlide()).toBe(1);
    component.nextSlide();
    expect(component.activeSlide()).toBe(0);
  });

  it('should move to previous slide on prevSlide() and wrap around', () => {
    expect(component.activeSlide()).toBe(0);
    component.prevSlide();
    expect(component.activeSlide()).toBe(1);
    component.prevSlide();
    expect(component.activeSlide()).toBe(0);
  });

  it('should jump to target slide on goToSlide()', () => {
    component.goToSlide(1);
    expect(component.activeSlide()).toBe(1);
  });

  it('should pause and resume carousel on mouse/focus events', () => {
    component.pauseCarousel();
    // @ts-expect-error test private state
    expect(component.isPaused).toBe(true);
    component.resumeCarousel();
    // @ts-expect-error test private state
    expect(component.isPaused).toBe(false);
  });

  it('should clear autoSlide timer on ngOnDestroy to prevent memory leaks', () => {
    component.startCarouselTimer();
    // @ts-expect-error test private state
    expect(component.autoSlideTimer).not.toBeNull();
    component.ngOnDestroy();
    // @ts-expect-error test private state
    expect(component.autoSlideTimer).toBeNull();
  });

  it('should filter showcase products by category tab', () => {
    const panjabiTab = component.showcaseTabs[1];
    const spy = vi.spyOn(catalogService, 'getProducts');
    component.selectTab(panjabiTab);
    expect(component.activeTab()).toBe('heritage-panjabi');
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ categorySlug: 'heritage-panjabi' })
    );
  });
});
