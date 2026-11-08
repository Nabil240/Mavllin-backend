import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  PromoPopupComponent,
  PROMO_DISMISSED_KEY,
  PROMO_COOLDOWN_MS,
  resetPromoSessionMemory,
  parseValidTimestamp,
} from './promo-popup.component';

describe('PromoPopupComponent (R9 Website Promotional Popup)', () => {
  let router: Router;
  let http: HttpClient;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    resetPromoSessionMemory();
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = '';
    }
    await TestBed.configureTestingModule({
      imports: [PromoPopupComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    router = TestBed.inject(Router);
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetPromoSessionMemory();
    if (typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = '';
    }
  });

  it('should display the promotional popup on initial visit with discount details', () => {
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.promo-overlay')).toBeTruthy();
    expect(compiled.textContent).toContain('FESTIVE ARCHIVE DROP');
    expect(compiled.textContent).toContain('WELCOME10');
  });

  it('should navigate to the chosen product section and close when visitor clicks the popup CTA', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    component.targetLink.set('/catalog?categorySlug=mens-panjabi');
    fixture.detectChanges();

    const ctaBtn = fixture.nativeElement.querySelector('.promo-cta-btn') as HTMLButtonElement;
    expect(ctaBtn).toBeTruthy();
    ctaBtn.click();
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith('/catalog?categorySlug=mens-panjabi');
    expect(component.isOpen()).toBe(false);
    expect(localStorage.getItem(PROMO_DISMISSED_KEY)).toBeTruthy();
  });

  it('should close the popup when visitor clicks the close button and persist dismissal', () => {
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.isOpen()).toBe(true);

    const closeBtn = fixture.nativeElement.querySelector('.promo-close-btn') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('.promo-overlay')).toBeNull();
    expect(localStorage.getItem(PROMO_DISMISSED_KEY)).toBeTruthy();
  });

  it('should not show the popup if visitor already dismissed it within the cooldown window', () => {
    localStorage.setItem(PROMO_DISMISSED_KEY, String(Date.now()));
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
  });

  it('should navigate to destination and close when visitor clicks the card body', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    component.targetLink.set('/catalog?category=linen-shirts');
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.promo-clickable-card') as HTMLElement;
    expect(card).toBeTruthy();
    card.click();
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith('/catalog?category=linen-shirts');
    expect(component.isOpen()).toBe(false);
    expect(localStorage.getItem(PROMO_DISMISSED_KEY)).toBeTruthy();
  });

  it('should close the popup when clicking the dismissal link ("No thanks, continue browsing")', () => {
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.isOpen()).toBe(true);

    const dismissLink = fixture.nativeElement.querySelector('.promo-dismiss-link') as HTMLButtonElement;
    expect(dismissLink).toBeTruthy();
    dismissLink.click();
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('.promo-overlay')).toBeNull();
    expect(localStorage.getItem(PROMO_DISMISSED_KEY)).toBeTruthy();
  });

  it('should close the popup when clicking the modal backdrop', () => {
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.isOpen()).toBe(true);

    const backdrop = fixture.nativeElement.querySelector('.promo-overlay') as HTMLElement;
    expect(backdrop).toBeTruthy();
    backdrop.click();
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('.promo-overlay')).toBeNull();
    expect(localStorage.getItem(PROMO_DISMISSED_KEY)).toBeTruthy();
  });

  it('should not close the popup when clicking inside the modal container', () => {
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.isOpen()).toBe(true);

    const modal = fixture.nativeElement.querySelector('.promo-modal') as HTMLElement;
    expect(modal).toBeTruthy();
    modal.click();
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('.promo-overlay')).toBeTruthy();
  });

  it('should dismiss the popup when pressing the Escape key', () => {
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.isOpen()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
    expect(localStorage.getItem(PROMO_DISMISSED_KEY)).toBeTruthy();
  });

  it('should load and render dynamic admin promotional settings from delivery-charges API', () => {
    vi.spyOn(http, 'get').mockReturnValue(
      of({
        success: true,
        message: 'Active delivery charges retrieved successfully',
        data: {
          promo_popup: {
            enabled: true,
            badge: 'RAMADAN EXCLUSIVE',
            title: 'EXCLUSIVE ATELIER DROP — 25% OFF',
            subtitle: 'Curated Heritage Panjabis and accessories.',
            cta_text: 'Claim Privilege',
            target_link: '/catalog?categorySlug=festive-panjabi',
            discount_code: 'EID25',
          },
        },
      })
    );

    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    expect(component.badge()).toBe('RAMADAN EXCLUSIVE');
    expect(component.title()).toBe('EXCLUSIVE ATELIER DROP — 25% OFF');
    expect(component.subtitle()).toBe('Curated Heritage Panjabis and accessories.');
    expect(component.ctaText()).toBe('Claim Privilege');
    expect(component.targetLink()).toBe('/catalog?categorySlug=festive-panjabi');
    expect(component.discountCode()).toBe('EID25');

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('EXCLUSIVE ATELIER DROP — 25% OFF');
    expect(compiled.textContent).toContain('EID25');
    expect(compiled.textContent).toContain('Claim Privilege');
  });

  it('should hide the popup when admin settings explicitly disable it', () => {
    vi.spyOn(http, 'get').mockReturnValue(
      of({
        success: true,
        data: {
          promo_popup: {
            enabled: false,
          },
        },
      })
    );

    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('.promo-overlay')).toBeNull();
  });

  it('should gracefully fall back to default promotional values when API request errors', () => {
    vi.spyOn(http, 'get').mockReturnValue(throwError(() => new Error('Network error')));

    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    expect(component.title()).toBe('FESTIVE ARCHIVE DROP — UP TO 20% OFF');
    expect(component.discountCode()).toBe('WELCOME10');
    expect(component.targetLink()).toBe('/catalog?categorySlug=mens-panjabi');
  });

  it('should show popup again if dismissal timestamp has exceeded cooldown period', () => {
    // 25 hours ago (beyond 24h cooldown)
    const expiredTs = Date.now() - (PROMO_COOLDOWN_MS + 60 * 60 * 1000);
    localStorage.setItem(PROMO_DISMISSED_KEY, String(expiredTs));

    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('.promo-overlay')).toBeTruthy();
  });

  it('should maintain cooldown suppression even if client clock synchronizes backward by several minutes (NTP time skew)', () => {
    // Dismissed with timestamp 5 minutes into the "future" due to client NTP skew
    const skewTs = Date.now() + 5 * 60 * 1000;
    localStorage.setItem(PROMO_DISMISSED_KEY, String(skewTs));

    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('.promo-overlay')).toBeNull();
  });

  it('should remain closed and not resurrect popup if user dismisses while settings request is pending, even if localStorage throws SecurityError', () => {
    // Simulate partitioned storage / iframe where localStorage throws SecurityError
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: Failed to read localStorage');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: Failed to write localStorage');
    });

    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    // User closes popup
    component.closePopup();
    expect(component.isOpen()).toBe(false);

    // Later, API response arrives
    component.loadPromoSettings();
    expect(component.isOpen()).toBe(false);
  });

  it('should support fallback to sessionStorage when localStorage throws on close', () => {
    sessionStorage.clear();
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (this === localStorage) {
        throw new Error('QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    });

    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.closePopup();
    expect(component.isOpen()).toBe(false);
    expect(sessionStorage.getItem(PROMO_DISMISSED_KEY)).toBeTruthy();
  });

  it('should trigger navigation via Enter key on .promo-clickable-card for keyboard accessibility', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    component.targetLink.set('/catalog?collection=heritage');
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.promo-clickable-card') as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.getAttribute('role')).toBe('button');
    expect(card.getAttribute('tabindex')).toBe('0');

    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();

    expect(navigateSpy).toHaveBeenCalledWith('/catalog?collection=heritage');
    expect(component.isOpen()).toBe(false);
  });

  it('should safely handle external http or https links without calling router.navigateByUrl', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    const redirectSpy = vi.spyOn(component, 'redirectToExternalUrl').mockImplementation(() => {});

    component.targetLink.set('https://external-store.example.com/festive');
    fixture.detectChanges();

    component.navigateToProductSection();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(redirectSpy).toHaveBeenCalledWith('https://external-store.example.com/festive');
    expect(component.isOpen()).toBe(false);
  });

  // --- Adversarial Reviewer Round 2 Defenses & Edge Probes ---

  it('should fall back to reading sessionStorage if localStorage.getItem throws SecurityError', () => {
    sessionStorage.setItem(PROMO_DISMISSED_KEY, String(Date.now()));
    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (this: Storage, key: string) {
      if (this === localStorage) {
        throw new Error('SecurityError: Access denied to localStorage in sandbox');
      }
      return originalGetItem.call(this, key);
    });

    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('.promo-overlay')).toBeNull();
  });

  it('should pick fresh sessionStorage timestamp when localStorage holds an expired timestamp', () => {
    const expiredTs = Date.now() - (PROMO_COOLDOWN_MS + 24 * 60 * 60 * 1000); // 48h ago
    const freshTs = Date.now() - 5 * 60 * 1000; // 5 min ago
    localStorage.setItem(PROMO_DISMISSED_KEY, String(expiredTs));
    sessionStorage.setItem(PROMO_DISMISSED_KEY, String(freshTs));

    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOpen()).toBe(false);
  });

  it('should retain dismissal suppression across component re-creation in memory even when both web storages throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const fixture1 = TestBed.createComponent(PromoPopupComponent);
    const component1 = fixture1.componentInstance;
    fixture1.detectChanges();
    expect(component1.isOpen()).toBe(true);

    component1.closePopup();
    expect(component1.isOpen()).toBe(false);
    fixture1.destroy();

    // Re-create component as in SPA route navigation
    const fixture2 = TestBed.createComponent(PromoPopupComponent);
    const component2 = fixture2.componentInstance;
    fixture2.detectChanges();

    expect(component2.isOpen()).toBe(false);
  });

  it('should correctly handle uppercase external protocol (e.g. HTTPS://) without prepending slash or calling router.navigateByUrl', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    const redirectSpy = vi.spyOn(component, 'redirectToExternalUrl').mockImplementation(() => {});

    component.targetLink.set('HTTPS://MAVLLIN.COM/SUMMER-COLLECTION');
    fixture.detectChanges();

    component.navigateToProductSection();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(redirectSpy).toHaveBeenCalledWith('HTTPS://MAVLLIN.COM/SUMMER-COLLECTION');
    expect(component.isOpen()).toBe(false);
  });

  it('should handle protocol-relative links (//external-store.example.com) by prefixing protocol and delegating to redirectToExternalUrl', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    const redirectSpy = vi.spyOn(component, 'redirectToExternalUrl').mockImplementation(() => {});

    component.targetLink.set('//external-store.example.com/capsule');
    fixture.detectChanges();

    component.navigateToProductSection();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(redirectSpy).toHaveBeenCalled();
    const calledUrl = redirectSpy.mock.calls[0][0];
    expect(calledUrl).toContain('//external-store.example.com/capsule');
    expect(calledUrl.startsWith('http://') || calledUrl.startsWith('https://')).toBe(true);
  });

  it('should sanitize unsafe schemes like javascript: to safe catalog fallback', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;

    component.targetLink.set('javascript:alert(document.domain)');
    fixture.detectChanges();

    component.navigateToProductSection();

    expect(navigateSpy).toHaveBeenCalledWith('/catalog');
    expect(component.isOpen()).toBe(false);
  });

  it('should preserve deep query parameters and URL fragment hashes during internal routing', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;

    component.targetLink.set('/catalog?categorySlug=mens-panjabi&minPrice=1500&maxPrice=8000&sort=newest#products-section');
    fixture.detectChanges();

    component.navigateToProductSection();

    expect(navigateSpy).toHaveBeenCalledWith(
      '/catalog?categorySlug=mens-panjabi&minPrice=1500&maxPrice=8000&sort=newest#products-section'
    );
  });

  it('should prevent duplicate navigation execution on rapid double activation of navigateToProductSection', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    component.targetLink.set('/catalog?category=fleece');
    fixture.detectChanges();

    component.navigateToProductSection();
    component.navigateToProductSection(); // rapid concurrent activation

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('/catalog?category=fleece');
  });

  it('should lock document.body scroll when open and restore scroll on close and on destroy', () => {
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    component.closePopup();
    expect(document.body.style.overflow).toBe('');

    // Reopen and test destruction cleanup
    component.isOpen.set(true);
    (component as unknown as { lockBodyScroll: () => void }).lockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.destroy();
    expect(document.body.style.overflow).toBe('');
  });

  it('should trap Tab and Shift+Tab key navigation inside modal dialog for WCAG accessibility', () => {
    const fixture = TestBed.createComponent(PromoPopupComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const closeBtn = compiled.querySelector('.promo-close-btn') as HTMLElement;
    const dismissLink = compiled.querySelector('.promo-dismiss-link') as HTMLElement;
    expect(closeBtn).toBeTruthy();
    expect(dismissLink).toBeTruthy();

    // Forward Tab from dismissLink wraps around to closeBtn
    dismissLink.focus();
    expect(document.activeElement).toBe(dismissLink);

    const tabEvt = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: false, cancelable: true });
    document.dispatchEvent(tabEvt);
    expect(tabEvt.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(closeBtn);

    // Shift+Tab from closeBtn wraps backward to dismissLink
    const shiftTabEvt = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
    document.dispatchEvent(shiftTabEvt);
    expect(shiftTabEvt.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(dismissLink);
  });

  it('should stop keydown propagation on CTA button to prevent parent card duplicate activation', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    component.targetLink.set('/catalog?category=panjabi');
    fixture.detectChanges();

    const ctaBtn = fixture.nativeElement.querySelector('.promo-cta-btn') as HTMLButtonElement;
    expect(ctaBtn).toBeTruthy();

    const keyEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const stopPropagationSpy = vi.spyOn(keyEvent, 'stopPropagation');
    ctaBtn.dispatchEvent(keyEvent);

    expect(stopPropagationSpy).toHaveBeenCalled();
  });

  it('should not set empty string when admin settings deliver whitespace-only title', () => {
    vi.spyOn(http, 'get').mockReturnValue(
      of({
        success: true,
        data: {
          promo_popup: {
            enabled: true,
            title: '    ',
          },
        },
      })
    );

    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.isOpen()).toBe(true);
    expect(component.title()).toBe('FESTIVE ARCHIVE DROP — UP TO 20% OFF');
  });

  // --- Adversarial Reviewer Round 3 Defenses & Edge Probes ---

  it('should safely parse timestamps and reject non-safe integers, negative, and extreme future drift', () => {
    expect(parseValidTimestamp(null)).toBeNull();
    expect(parseValidTimestamp('')).toBeNull();
    expect(parseValidTimestamp('   ')).toBeNull();
    expect(parseValidTimestamp('not-a-number')).toBeNull();
    expect(parseValidTimestamp('-5000')).toBeNull();
    expect(parseValidTimestamp('0')).toBeNull();
    expect(parseValidTimestamp('1.5')).toBeNull();
    expect(parseValidTimestamp('1e25')).toBeNull();
    expect(parseValidTimestamp(String(Number.MAX_SAFE_INTEGER + 100))).toBeNull();

    // Extreme future drift beyond 24h cooldown
    const tenDaysFuture = Date.now() + 10 * 24 * 60 * 60 * 1000;
    expect(parseValidTimestamp(String(tenDaysFuture))).toBeNull();

    // Tolerated NTP clock skew within 24h cooldown window
    const fiveMinFuture = Date.now() + 5 * 60 * 1000;
    expect(parseValidTimestamp(String(fiveMinFuture))).toBe(fiveMinFuture);

    // Valid past timestamp
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    expect(parseValidTimestamp(String(oneHourAgo))).toBe(oneHourAgo);
  });

  it('should auto-heal corrupted timestamps from localStorage and sessionStorage on initialization', () => {
    localStorage.setItem(PROMO_DISMISSED_KEY, '9999999999999999999999999999');
    sessionStorage.setItem(PROMO_DISMISSED_KEY, 'corrupted-timestamp');

    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    // Popup should open cleanly without being poisoned by corrupted future/overflow timestamp
    expect(component.isOpen()).toBe(true);

    // Poisoned entries must be purged
    expect(localStorage.getItem(PROMO_DISMISSED_KEY)).toBeNull();
    expect(sessionStorage.getItem(PROMO_DISMISSED_KEY)).toBeNull();
  });

  it('should delegate mailto: and tel: links to external redirection without route corruption', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    const redirectSpy = vi.spyOn(component, 'redirectToExternalUrl').mockImplementation(() => {});

    component.targetLink.set('mailto:concierge@mavllin.com');
    fixture.detectChanges();
    component.navigateToProductSection();

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(redirectSpy).toHaveBeenCalledWith('mailto:concierge@mavllin.com');

    // Test tel scheme
    component.targetLink.set('tel:+8801711000000');
    component.navigateToProductSection();
    expect(redirectSpy).toHaveBeenCalledWith('tel:+8801711000000');
  });

  it('should sanitize disallowed schemes like file:, blob:, about: to safe catalog fallback', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;

    component.targetLink.set('file:///etc/passwd');
    fixture.detectChanges();
    component.navigateToProductSection();
    expect(navigateSpy).toHaveBeenCalledWith('/catalog');

    component.targetLink.set('blob:https://mavllin.com/sensitive-data');
    component.navigateToProductSection();
    expect(navigateSpy).toHaveBeenCalledWith('/catalog');

    component.targetLink.set('about:blank');
    component.navigateToProductSection();
    expect(navigateSpy).toHaveBeenCalledWith('/catalog');
  });

  it('should restore keyboard focus to previously active element upon popup dismissal', () => {
    const testButton = document.createElement('button');
    testButton.id = 'external-trigger-btn';
    document.body.appendChild(testButton);
    testButton.focus();
    expect(document.activeElement).toBe(testButton);

    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.isOpen()).toBe(true);

    component.closePopup();
    expect(component.isOpen()).toBe(false);
    expect(document.activeElement).toBe(testButton);

    document.body.removeChild(testButton);
  });

  it('should synchronize dismissal across tabs when receiving BroadcastChannel notification', async () => {
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.isOpen()).toBe(true);

    const channel = new BroadcastChannel('mavllin_promo_sync');
    channel.postMessage({ type: 'PROMO_DISMISSED', timestamp: Date.now() });

    await new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(component.isOpen()).toBe(false);
        channel.close();
        resolve();
      }, 50);
    });
  });

  it('should only close popup on backdrop click when event.target equals event.currentTarget', () => {
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    expect(component.isOpen()).toBe(true);

    const overlay = fixture.nativeElement.querySelector('.promo-overlay') as HTMLElement;
    const modal = fixture.nativeElement.querySelector('.promo-modal') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(modal).toBeTruthy();

    // Simulated click on child element bubbling to overlay
    const childClickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(childClickEvent, 'target', { value: modal });
    Object.defineProperty(childClickEvent, 'currentTarget', { value: overlay });
    component.onOverlayClick(childClickEvent);
    expect(component.isOpen()).toBe(true);

    // Direct click on overlay
    const backdropClickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    Object.defineProperty(backdropClickEvent, 'target', { value: overlay });
    Object.defineProperty(backdropClickEvent, 'currentTarget', { value: overlay });
    component.onOverlayClick(backdropClickEvent);
    expect(component.isOpen()).toBe(false);
  });

  it('should release navigation lock after router navigation completes to allow subsequent navigation', async () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PromoPopupComponent);
    const component = fixture.componentInstance;
    component.targetLink.set('/catalog?category=fleece');
    fixture.detectChanges();

    component.navigateToProductSection();
    expect(navigateSpy).toHaveBeenCalledTimes(1);

    // Await navigation promise resolution
    await Promise.resolve();

    // Reopen and navigate again
    component.isOpen.set(true);
    component.navigateToProductSection();
    expect(navigateSpy).toHaveBeenCalledTimes(2);
  });
});
