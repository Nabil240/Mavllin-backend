import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HomeComponent } from './home.component';
import { CatalogService } from '../../../core/services/catalog.service';
import { Banner } from '../../../core/models/api.models';

describe('Empirical Challenger: Carousel Edge Conditions, Timer Cleanup & Boundary Wrap-Arounds', () => {
  let fixture: any;
  let component: HomeComponent;
  let catalogService: CatalogService;

  const mockThreeBanners: Banner[] = [
    {
      id: 1,
      title: 'Slide 1 - Heritage Panjabi',
      subtitle: 'Artisanal embroidery',
      badge_text: 'NEW ARRIVAL',
      cta_text: 'Shop Now',
      cta_link: '/catalog',
      image_url: '/uploads/products/banner-hero-1.svg',
      is_active: true,
      sort_order: 1,
    },
    {
      id: 2,
      title: 'Slide 2 - Linen Atelier',
      subtitle: 'Breathable tailoring',
      badge_text: 'SUMMER EDIT',
      cta_text: 'Explore',
      cta_link: '/catalog',
      image_url: '/uploads/products/banner-hero-2.svg',
      is_active: true,
      sort_order: 2,
    },
    {
      id: 3,
      title: 'Slide 3 - Festive Collection',
      subtitle: 'Royal Eid specials',
      badge_text: 'FESTIVE 2026',
      cta_text: 'View Lookbook',
      cta_link: '/catalog',
      image_url: '/uploads/products/banner-hero-1.svg',
      is_active: true,
      sort_order: 3,
    },
  ];

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    catalogService = TestBed.inject(CatalogService);

    vi.spyOn(catalogService, 'getBanners').mockReturnValue(
      of({ success: true, message: 'Banners loaded', data: mockThreeBanners })
    );
    vi.spyOn(catalogService, 'getCategories').mockReturnValue(
      of({ success: true, message: 'Categories loaded', data: [] })
    );
    vi.spyOn(catalogService, 'getProducts').mockReturnValue(
      of({ success: true, message: 'Products loaded', data: [] })
    );

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    component.ngOnDestroy();
    vi.useRealTimers();
  });

  describe('1. Navigation Boundary Wrap-Arounds', () => {
    it('wraps around from index 0 to max index (total - 1) on prevSlide()', () => {
      expect(component.banners().length).toBe(3);
      expect(component.activeSlide()).toBe(0);

      // Boundary step: prevSlide from 0 must wrap to 2 (total - 1)
      component.prevSlide();
      expect(component.activeSlide()).toBe(2);

      // Second step: 2 -> 1
      component.prevSlide();
      expect(component.activeSlide()).toBe(1);

      // Third step: 1 -> 0
      component.prevSlide();
      expect(component.activeSlide()).toBe(0);

      // Again wrap from 0 to 2
      component.prevSlide();
      expect(component.activeSlide()).toBe(2);
    });

    it('wraps around from max index (total - 1) to 0 on nextSlide()', () => {
      expect(component.banners().length).toBe(3);
      expect(component.activeSlide()).toBe(0);

      // Step: 0 -> 1
      component.nextSlide();
      expect(component.activeSlide()).toBe(1);

      // Step: 1 -> 2
      component.nextSlide();
      expect(component.activeSlide()).toBe(2);

      // Boundary step: nextSlide from 2 must wrap to 0
      component.nextSlide();
      expect(component.activeSlide()).toBe(0);
    });

    it('safely handles rapid consecutive navigation calls without boundary overflow or out-of-bounds index', () => {
      // 100 rapid nextSlide invocations
      for (let i = 0; i < 100; i++) {
        component.nextSlide();
        expect(component.activeSlide()).toBeGreaterThanOrEqual(0);
        expect(component.activeSlide()).toBeLessThan(3);
      }

      // 100 rapid prevSlide invocations
      for (let i = 0; i < 100; i++) {
        component.prevSlide();
        expect(component.activeSlide()).toBeGreaterThanOrEqual(0);
        expect(component.activeSlide()).toBeLessThan(3);
      }
    });

    it('no-ops safely when only a single banner is loaded (total <= 1)', () => {
      component.banners.set([mockThreeBanners[0]]);
      expect(component.banners().length).toBe(1);
      component.activeSlide.set(0);

      component.nextSlide();
      expect(component.activeSlide()).toBe(0);

      component.prevSlide();
      expect(component.activeSlide()).toBe(0);
    });

    it('no-ops safely when banners array is empty (total === 0)', () => {
      component.banners.set([]);
      expect(component.banners().length).toBe(0);
      component.activeSlide.set(0);

      component.nextSlide();
      expect(component.activeSlide()).toBe(0);

      component.prevSlide();
      expect(component.activeSlide()).toBe(0);
    });
  });

  describe('2. Timer Cleanup & Dangling Timer Elimination', () => {
    it('rotates slides automatically every 5000ms when active', () => {
      expect(component.activeSlide()).toBe(0);

      // Fast-forward 5000ms
      vi.advanceTimersByTime(5000);
      expect(component.activeSlide()).toBe(1);

      // Fast-forward another 5000ms
      vi.advanceTimersByTime(5000);
      expect(component.activeSlide()).toBe(2);

      // Fast-forward another 5000ms (wraps to 0)
      vi.advanceTimersByTime(5000);
      expect(component.activeSlide()).toBe(0);
    });

    it('cleans up interval timer on ngOnDestroy, preventing any dangling timers or post-destroy callbacks', () => {
      // Confirm timer is set
      // @ts-expect-error inspect private timer
      expect(component.autoSlideTimer).not.toBeNull();

      // Destroy the component
      component.ngOnDestroy();

      // @ts-expect-error inspect private timer
      expect(component.autoSlideTimer).toBeNull();

      const lastSlide = component.activeSlide();

      // Advance time by 30 seconds (6 standard cycles)
      vi.advanceTimersByTime(30000);

      // Slide must NOT change after destruction
      expect(component.activeSlide()).toBe(lastSlide);
    });

    it('suspends slide rotation while paused (hover/focus) and resumes on mouseleave/blur', () => {
      expect(component.activeSlide()).toBe(0);

      // Pause carousel
      component.pauseCarousel();

      // Advance time by 15,000ms (3 ticks)
      vi.advanceTimersByTime(15000);

      // Slide must remain at 0 while paused
      expect(component.activeSlide()).toBe(0);

      // Resume carousel
      component.resumeCarousel();

      // Advance 5000ms
      vi.advanceTimersByTime(5000);

      // Slide should now advance to 1
      expect(component.activeSlide()).toBe(1);
    });
  });
});
