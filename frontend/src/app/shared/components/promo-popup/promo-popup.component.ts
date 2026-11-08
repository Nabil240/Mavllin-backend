import { Component, ElementRef, HostListener, OnDestroy, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject, catchError, of, takeUntil } from 'rxjs';
import { NgxBorderBeamComponent, NgxShinyTextComponent } from '../ngxui';

export const PROMO_DISMISSED_KEY = 'mavllin_promo_popup_dismissed_at';
export const PROMO_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

let sessionDismissedMemory = false;

export function resetPromoSessionMemory(): void {
  sessionDismissedMemory = false;
}

export function parseValidTimestamp(raw: string | null): number | null {
  if (!raw) return null;
  const num = Number(raw);
  if (!Number.isSafeInteger(num) || num <= 0) return null;
  // Discard extreme future drift beyond cooldown window (corrupted/tampered clock)
  if (num > Date.now() + PROMO_COOLDOWN_MS) return null;
  return num;
}

export interface PromoPopupConfig {
  enabled: boolean;
  badge: string;
  title: string;
  subtitle: string;
  cta_text: string;
  target_link: string;
  discount_code: string;
}

@Component({
  selector: 'app-promo-popup',
  standalone: true,
  imports: [CommonModule, NgxBorderBeamComponent, NgxShinyTextComponent],
  template: `
    @if (isOpen()) {
      <div
        class="promo-overlay"
        (click)="onOverlayClick($event)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="promoPopupTitle"
        aria-describedby="promoPopupSubtitle"
      >
        <div class="promo-modal" (click)="$event.stopPropagation()">
          <om-border-beam [gradientColorStart]="'#c9a96e'" [gradientColorEnd]="'#2c241d'" [borderWidth]="'1.5px'" [animationDuration]="'8s'"></om-border-beam>
          <button
            type="button"
            class="promo-close-btn"
            (click)="closePopup()"
            aria-label="Close promotional popup"
          >
            <span aria-hidden="true">&times;</span>
          </button>

          <div
            class="promo-clickable-card"
            (click)="navigateToProductSection()"
            (keydown.enter)="navigateToProductSection()"
            (keydown.space)="navigateToProductSection(); $event.preventDefault()"
            role="button"
            tabindex="0"
            aria-label="View promotional offer"
          >
            <span class="promo-badge">
              <om-shiny-text [text]="badge()" [shimmerColor]="'#ffffff'"></om-shiny-text>
            </span>
            <h2 id="promoPopupTitle" class="promo-title">{{ title() }}</h2>
            <p id="promoPopupSubtitle" class="promo-subtitle">{{ subtitle() }}</p>

            @if (discountCode()) {
              <div class="promo-code-box">
                <span class="code-label">USE PROMO CODE AT CHECKOUT</span>
                <strong class="code-value">{{ discountCode() }}</strong>
              </div>
            }

            <button
              type="button"
              class="btn btn-primary promo-cta-btn btn-shimmer"
              (click)="navigateToProductSection(); $event.stopPropagation()"
              (keydown)="$event.stopPropagation()"
            >
              {{ ctaText() }} &rarr;
            </button>
          </div>

          <button type="button" class="promo-dismiss-link" (click)="closePopup()">
            No thanks, continue browsing
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
    }
    .promo-overlay {
      position: fixed;
      inset: 0;
      z-index: 2500;
      background: rgba(15, 18, 22, 0.76);
      -webkit-transform: translate3d(0, 0, 0);
      transform: translate3d(0, 0, 0);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      cursor: pointer;
      touch-action: none;
      overscroll-behavior: contain;
      -webkit-tap-highlight-color: transparent;
      animation: promoFadeIn 220ms ease-out;
    }
    @supports ((-webkit-backdrop-filter: blur(4px)) or (backdrop-filter: blur(4px))) {
      .promo-overlay {
        background: rgba(15, 18, 22, 0.62);
        -webkit-backdrop-filter: blur(4px);
        backdrop-filter: blur(4px);
      }
    }
    .promo-modal {
      position: relative;
      overflow: hidden;
      width: 100%;
      max-width: 480px;
      background: var(--color-white, #ffffff);
      border: 1px solid var(--color-onyx, #1e232a);
      border-radius: var(--radius-sm, 4px);
      padding: 2.25rem 2rem 1.75rem;
      text-align: center;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.22);
      cursor: default;
      touch-action: manipulation;
      animation: promoScaleIn 220ms cubic-bezier(0.16, 1, 0.3, 1);
    }
    .promo-close-btn {
      position: absolute;
      top: 0.75rem;
      right: 0.9rem;
      z-index: 3;
      width: 36px;
      height: 36px;
      min-width: 36px;
      min-height: 36px;
      border: 1px solid var(--color-border, #e5e7eb);
      border-radius: 50%;
      background: var(--color-white, #ffffff);
      color: var(--color-onyx, #1e232a);
      font-size: 1.35rem;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
      transition: background 150ms ease, color 150ms ease;
      &:hover {
        background: var(--color-onyx, #1e232a);
        color: var(--color-white, #ffffff);
      }
      &::after {
        content: '';
        position: absolute;
        top: -6px;
        right: -6px;
        bottom: -6px;
        left: -6px;
      }
    }
    .promo-clickable-card {
      position: relative;
      z-index: 2;
      cursor: pointer;
      outline: none;
    }
    .promo-clickable-card:focus-visible {
      outline: 2px solid #c9a96e;
      outline-offset: 4px;
      border-radius: 2px;
    }
    .promo-close-btn:focus-visible,
    .promo-dismiss-link:focus-visible {
      outline: 2px solid #c9a96e;
      outline-offset: 2px;
    }
    .promo-badge {
      display: inline-block;
      padding: 0.28rem 0.75rem;
      background: #1e232a;
      color: #ffffff;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      margin-bottom: 1rem;
    }
    .promo-title {
      font-family: var(--font-display, 'Inter', sans-serif);
      font-size: 1.45rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-onyx, #1e232a);
      margin: 0 0 0.75rem;
      line-height: 1.25;
    }
    .promo-subtitle {
      font-size: 0.88rem;
      color: var(--color-text-muted, #52525b);
      line-height: 1.6;
      margin: 0 0 1.25rem;
    }
    .promo-code-box {
      background: var(--color-alabaster, #f8f7f4);
      border: 1px dashed var(--color-onyx, #1e232a);
      padding: 0.75rem 1rem;
      margin-bottom: 1.35rem;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .code-label {
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: var(--color-text-muted, #71717a);
    }
    .code-value {
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: 0.18em;
      color: var(--color-onyx, #1e232a);
      user-select: all;
      -webkit-user-select: all;
    }
    .promo-cta-btn {
      width: 100%;
      padding: 0.85rem 1.25rem;
      font-size: 0.82rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      background: var(--color-onyx, #1e232a);
      color: var(--color-white, #ffffff);
      border: none;
      cursor: pointer;
      touch-action: manipulation;
    }
    .promo-dismiss-link {
      position: relative;
      z-index: 2;
      margin-top: 0.9rem;
      padding: 0.5rem 1rem;
      background: transparent;
      border: none;
      font-size: 0.76rem;
      color: var(--color-text-muted, #71717a);
      text-decoration: underline;
      cursor: pointer;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    @keyframes promoFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes promoScaleIn {
      from {
        opacity: 0;
        transform: scale(0.96) translateY(6px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .promo-overlay,
      .promo-modal {
        animation: none;
      }
    }
  `],
})
export class PromoPopupComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly elRef = inject(ElementRef);
  private readonly destroy$ = new Subject<void>();

  private isNavigating = false;
  private previousActiveElement: HTMLElement | null = null;
  private promoChannel: BroadcastChannel | null = null;

  readonly isOpen = signal<boolean>(false);
  readonly badge = signal<string>('LIMITED SEASONAL PRIVILEGE');
  readonly title = signal<string>('FESTIVE ARCHIVE DROP — UP TO 20% OFF');
  readonly subtitle = signal<string>(
    'Discover artisanal Heritage Panjabi, Heavyweight Fleece & Tailored Linen. Use code WELCOME10 at checkout for 10% off your order.'
  );
  readonly ctaText = signal<string>('Explore Featured Collection');
  readonly targetLink = signal<string>('/catalog?categorySlug=mens-panjabi');
  readonly discountCode = signal<string>('WELCOME10');

  static resetSessionSuppression(): void {
    sessionDismissedMemory = false;
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId) && typeof BroadcastChannel !== 'undefined') {
      try {
        this.promoChannel = new BroadcastChannel('mavllin_promo_sync');
        this.promoChannel.onmessage = (event) => {
          if (event?.data?.type === 'PROMO_DISMISSED') {
            sessionDismissedMemory = true;
            if (this.isOpen()) {
              this.isOpen.set(false);
              this.restoreBodyScroll();
            }
          }
        };
      } catch {
        this.promoChannel = null;
      }
    }

    if (!this.isRecentlyDismissed()) {
      this.isOpen.set(true);
      this.lockBodyScroll();
    }
    this.loadPromoSettings();
  }

  ngOnDestroy(): void {
    this.restoreBodyScroll();
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      try {
        this.previousActiveElement.focus();
      } catch {
        // ignore
      }
      this.previousActiveElement = null;
    }
    if (this.promoChannel) {
      try {
        this.promoChannel.close();
      } catch {
        // ignore
      }
      this.promoChannel = null;
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) return;

    if (event.key === 'Escape') {
      this.closePopup();
      return;
    }

    if (event.key === 'Tab') {
      this.handleTabTrap(event);
    }
  }

  onOverlayClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closePopup();
    }
  }

  private handleTabTrap(event: KeyboardEvent): void {
    if (!isPlatformBrowser(this.platformId) || typeof document === 'undefined') return;
    const modalEl =
      (this.elRef?.nativeElement?.querySelector('.promo-modal') as HTMLElement | null) ||
      (document.querySelector('.promo-modal') as HTMLElement | null);
    if (!modalEl) return;

    const focusable = modalEl.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex="0"]:not([disabled])'
    );
    if (!focusable || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first || !modalEl.contains(document.activeElement)) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || !modalEl.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  private lockBodyScroll(): void {
    if (isPlatformBrowser(this.platformId) && typeof document !== 'undefined' && document.body) {
      if (!this.previousActiveElement && document.activeElement) {
        this.previousActiveElement = document.activeElement as HTMLElement;
      }
      document.body.style.overflow = 'hidden';
    }
  }

  private restoreBodyScroll(): void {
    if (isPlatformBrowser(this.platformId) && typeof document !== 'undefined' && document.body) {
      document.body.style.overflow = '';
    }
  }

  private getLatestDismissalTimestamp(): number | null {
    let localTs: number | null = null;
    let sessionTs: number | null = null;

    try {
      const rawLocal = localStorage.getItem(PROMO_DISMISSED_KEY);
      localTs = parseValidTimestamp(rawLocal);
      if (rawLocal && localTs === null) {
        // Auto-heal corrupted entry
        localStorage.removeItem(PROMO_DISMISSED_KEY);
      }
    } catch {
      // ignore localStorage read error
    }

    try {
      const rawSession = sessionStorage.getItem(PROMO_DISMISSED_KEY);
      sessionTs = parseValidTimestamp(rawSession);
      if (rawSession && sessionTs === null) {
        sessionStorage.removeItem(PROMO_DISMISSED_KEY);
      }
    } catch {
      // ignore sessionStorage read error
    }

    if (localTs !== null && sessionTs !== null) {
      return Math.max(localTs, sessionTs);
    }
    return localTs ?? sessionTs;
  }

  private isRecentlyDismissed(): boolean {
    if (sessionDismissedMemory) {
      return true;
    }
    if (!isPlatformBrowser(this.platformId)) return false;

    const ts = this.getLatestDismissalTimestamp();
    if (ts === null) return false;

    const timeDiff = Math.abs(Date.now() - ts);
    return timeDiff < PROMO_COOLDOWN_MS;
  }

  loadPromoSettings(): void {
    this.http
      .get<{ success: boolean; data?: { promo_popup?: Partial<PromoPopupConfig> } }>('/api/v1/delivery-charges')
      .pipe(
        takeUntil(this.destroy$),
        catchError(() => of(null))
      )
      .subscribe((res) => {
        const promo = res?.data?.promo_popup;
        if (!promo) return;
        const isExplicitlyDisabled =
          promo.enabled === false ||
          String(promo.enabled).toLowerCase() === 'false' ||
          (promo.enabled as unknown) === 0;

        if (isExplicitlyDisabled) {
          this.isOpen.set(false);
          this.restoreBodyScroll();
          return;
        }

        if (promo.badge && promo.badge.trim()) this.badge.set(promo.badge.trim());
        if (promo.title && promo.title.trim()) this.title.set(promo.title.trim());
        if (promo.subtitle && promo.subtitle.trim()) this.subtitle.set(promo.subtitle.trim());
        if (promo.cta_text && promo.cta_text.trim()) this.ctaText.set(promo.cta_text.trim());
        if (promo.target_link && promo.target_link.trim()) this.targetLink.set(promo.target_link.trim());
        if (promo.discount_code !== undefined && promo.discount_code !== null) {
          this.discountCode.set(String(promo.discount_code).trim());
        }

        if (!this.isRecentlyDismissed() && !sessionDismissedMemory) {
          this.isOpen.set(true);
          this.lockBodyScroll();
        }
      });
  }

  navigateToProductSection(): void {
    if (this.isNavigating) return;
    this.isNavigating = true;

    let destination = (this.targetLink() || '').trim();
    if (!destination) {
      destination = '/catalog';
    } else if (/^(javascript|data|vbscript|file|blob|about):/i.test(destination)) {
      destination = '/catalog';
    } else if (destination.startsWith('//')) {
      const protocol =
        isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && window.location
          ? window.location.protocol
          : 'https:';
      destination = protocol + destination;
    } else if (!destination.startsWith('/') && !/^[a-z0-9+.-]+:/i.test(destination)) {
      destination = '/' + destination;
    }

    this.closePopup();

    if (/^(https?|mailto|tel|sms):/i.test(destination)) {
      this.redirectToExternalUrl(destination);
      this.isNavigating = false;
    } else {
      this.router
        .navigateByUrl(destination)
        .then(() => {
          this.isNavigating = false;
        })
        .catch(() => {
          this.isNavigating = false;
        });
    }
  }

  redirectToExternalUrl(url: string): void {
    if (isPlatformBrowser(this.platformId) && typeof window !== 'undefined' && window.location) {
      window.location.href = url;
    }
  }

  closePopup(): void {
    this.isOpen.set(false);
    sessionDismissedMemory = true;
    this.restoreBodyScroll();

    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      try {
        this.previousActiveElement.focus();
      } catch {
        // ignore detached elements
      }
      this.previousActiveElement = null;
    }

    if (this.promoChannel) {
      try {
        this.promoChannel.postMessage({ type: 'PROMO_DISMISSED', timestamp: Date.now() });
      } catch {
        // ignore
      }
    }

    if (isPlatformBrowser(this.platformId)) {
      const nowStr = String(Date.now());
      try {
        localStorage.setItem(PROMO_DISMISSED_KEY, nowStr);
      } catch {
        // ignore localStorage write failure
      }
      try {
        sessionStorage.setItem(PROMO_DISMISSED_KEY, nowStr);
      } catch {
        // ignore sessionStorage write failure
      }
    }
  }
}
