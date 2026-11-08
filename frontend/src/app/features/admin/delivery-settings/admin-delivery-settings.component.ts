import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { BdtCurrencyPipe } from '../../../shared/pipes/bdt.pipe';

@Component({
  selector: 'app-admin-delivery-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, BdtCurrencyPipe],
  template: `
    <div class="delivery-settings-page">
      <div class="page-head">
        <div>
          <span class="head-kicker">COMMERCE OPERATIONS</span>
          <h1 class="section-heading">REGIONAL DELIVERY CHARGES &amp; POLICIES</h1>
          <p class="section-subtitle">
            Configure regional courier rates, free shipping thresholds, and statutory delivery windows across all 64 districts of Bangladesh.
          </p>
        </div>
      </div>

      <div class="settings-grid">
        <form class="settings-card" (ngSubmit)="saveSettings()">
          <h3>Delivery Rates &amp; Thresholds (BDT / ৳)</h3>

          <div class="form-group">
            <label class="form-label">
              Inside Dhaka Delivery Fee (৳) *
              <span class="hint">Applied to all addresses within Dhaka Metropolitan area</span>
            </label>
            <input
              type="number"
              step="1"
              min="0"
              name="insideDhaka"
              class="form-control"
              [(ngModel)]="insideDhaka"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">
              Outside Dhaka Delivery Fee (৳) *
              <span class="hint">Applied across all other 63 administrative districts nationwide</span>
            </label>
            <input
              type="number"
              step="1"
              min="0"
              name="outsideDhaka"
              class="form-control"
              [(ngModel)]="outsideDhaka"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">
              Free Shipping Threshold (৳) *
              <span class="hint">Orders with subtotal at or above this amount qualify for ৳0 delivery</span>
            </label>
            <input
              type="number"
              step="100"
              min="0"
              name="freeThreshold"
              class="form-control"
              [(ngModel)]="freeThreshold"
              required
            />
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Inside Dhaka Delivery Time</label>
              <input
                type="text"
                name="daysInside"
                class="form-control"
                [(ngModel)]="daysInside"
                placeholder="24–48 hours"
              />
            </div>

            <div class="form-group">
              <label class="form-label">Outside Dhaka Delivery Time</label>
              <input
                type="text"
                name="daysOutside"
                class="form-control"
                [(ngModel)]="daysOutside"
                placeholder="3–5 business days"
              />
            </div>
          </div>

          <div class="btn-row">
            <button type="submit" class="btn btn-primary" [disabled]="saving()">
              {{ saving() ? 'Saving Changes...' : 'Save Delivery Settings' }}
            </button>
            <button type="button" class="btn btn-outline" (click)="loadSettings()">
              Reset Form
            </button>
          </div>
        </form>

        <form class="settings-card" (ngSubmit)="savePromoPopupSettings()" data-testid="promo-popup-settings-form">
          <h3>Website Promotional Popup (R9)</h3>

          <div class="form-group">
            <label class="form-label">
              Enable Promotional Popup
              <span class="hint">Show promotional discount modal when visitors arrive on the storefront</span>
            </label>
            <select
              name="promoPopupEnabled"
              class="form-control"
              [(ngModel)]="promoPopupEnabled"
              data-testid="promo-popup-enabled-select"
            >
              <option [ngValue]="true">Enabled (Active on Storefront)</option>
              <option [ngValue]="false">Disabled (Hidden)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Popup Headline *</label>
            <input
              type="text"
              name="promoPopupTitle"
              class="form-control"
              [(ngModel)]="promoPopupTitle"
              placeholder="EID & SEASONAL ATELIER OFFER"
              data-testid="promo-popup-title-input"
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Popup Subtitle / Description *</label>
            <input
              type="text"
              name="promoPopupSubtitle"
              class="form-control"
              [(ngModel)]="promoPopupSubtitle"
              placeholder="Enjoy up to 20% off signature heritage panjabis and luxury timepieces."
              data-testid="promo-popup-subtitle-input"
              required
            />
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label class="form-label">Discount Badge / Code</label>
              <input
                type="text"
                name="promoPopupDiscountCode"
                class="form-control"
                [(ngModel)]="promoPopupDiscountCode"
                placeholder="MAVLLIN20"
                data-testid="promo-popup-code-input"
              />
            </div>

            <div class="form-group">
              <label class="form-label">
                Target Product Section Link *
                <span class="hint">Destination route when visitor clicks the popup</span>
              </label>
              <input
                type="text"
                name="promoPopupTargetLink"
                class="form-control"
                [(ngModel)]="promoPopupTargetLink"
                placeholder="/products?category=panjabi"
                data-testid="promo-popup-link-input"
                required
              />
            </div>
          </div>

          <div class="btn-row">
            <button type="submit" class="btn btn-primary" [disabled]="savingPromo()" data-testid="save-promo-popup-btn">
              {{ savingPromo() ? 'Saving Popup...' : 'Save Promotional Popup' }}
            </button>
          </div>
        </form>

        <div class="info-sidebar">
          <div class="info-card">
            <h4>Live Checkout Reflection</h4>
            <p>
              When modified, these delivery charges are served live to customer checkout via
              <code>GET /api/v1/delivery-charges</code> and dynamically recalculate order totals in real-time.
            </p>
            <ul class="preview-list">
              <li>
                <span>Inside Dhaka:</span>
                <strong>{{ insideDhaka | bdt }}</strong>
              </li>
              <li>
                <span>Outside Dhaka (63 Districts):</span>
                <strong>{{ outsideDhaka | bdt }}</strong>
              </li>
              <li>
                <span>Complimentary Delivery On:</span>
                <strong>{{ freeThreshold | bdt }}+</strong>
              </li>
            </ul>
          </div>

          <div class="info-card statutory-card">
            <h4>Statutory Guidelines (Bangladesh)</h4>
            <p>
              Under Clause 3.5 of the <em>Digital Commerce Operation Guidelines 2021</em>, maximum fulfillment timelines are:
            </p>
            <ul>
              <li><strong>Within City / Dhaka:</strong> Max 5 calendar days</li>
              <li><strong>Inter-District Nationwide:</strong> Max 10 calendar days</li>
              <li><strong>Cash on Delivery:</strong> Primary fulfillment method</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .delivery-settings-page {
      padding: 0;
    }
    .page-head {
      margin-bottom: 2rem;
    }
    .head-kicker {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--color-emerald);
      margin-bottom: 0.4rem;
      display: inline-block;
    }
    .settings-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;
      @media (min-width: 992px) {
        grid-template-columns: 1.4fr 0.9fr;
      }
    }
    .settings-card, .info-card {
      background: var(--color-white);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 1.75rem;
    }
    .settings-card h3 {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--color-border);
    }
    .form-group {
      margin-bottom: 1.35rem;
    }
    .hint {
      display: block;
      font-size: 0.75rem;
      color: var(--color-text-muted);
      font-weight: normal;
      margin-top: 0.2rem;
    }
    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    .btn-row {
      display: flex;
      gap: 1rem;
      margin-top: 1.5rem;
    }
    .info-sidebar {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .info-card h4 {
      font-size: 0.88rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.75rem;
    }
    .preview-list {
      list-style: none;
      padding: 0;
      margin: 1rem 0 0;
      border-top: 1px solid var(--color-border);
      padding-top: 0.75rem;
    }
    .preview-list li {
      display: flex;
      justify-content: space-between;
      padding: 0.4rem 0;
      font-size: 0.85rem;
    }
    .statutory-card {
      background: #fafaf9;
      border-left: 3px solid var(--color-onyx);
    }
    .statutory-card ul {
      margin-top: 0.5rem;
      padding-left: 1.25rem;
      font-size: 0.82rem;
      color: var(--color-text-muted);
    }
    .statutory-card li {
      margin-bottom: 0.35rem;
    }
  `],
})
export class AdminDeliverySettingsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  insideDhaka = 70;
  outsideDhaka = 130;
  freeThreshold = 2500;
  daysInside = '24–48 hours';
  daysOutside = '3–5 business days';

  promoPopupEnabled = true;
  promoPopupTitle = 'EID & SEASONAL ATELIER OFFER';
  promoPopupSubtitle = 'Enjoy up to 20% off signature heritage panjabis and luxury timepieces.';
  promoPopupDiscountCode = 'MAVLLIN20';
  promoPopupTargetLink = '/products?category=panjabi';

  readonly saving = signal<boolean>(false);
  readonly savingPromo = signal<boolean>(false);

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.adminService.getDeliverySettings().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const d = res.data;
          this.insideDhaka = Number(d['delivery_charge_inside_dhaka'] ?? 70);
          this.outsideDhaka = Number(d['delivery_charge_outside_dhaka'] ?? 130);
          this.freeThreshold = Number(d['free_shipping_threshold'] ?? 2500);
          if (d['estimated_days_inside_dhaka']) this.daysInside = String(d['estimated_days_inside_dhaka']);
          if (d['estimated_days_outside_dhaka']) this.daysOutside = String(d['estimated_days_outside_dhaka']);
          if (d['promo_popup_enabled'] !== undefined) {
            this.promoPopupEnabled = d['promo_popup_enabled'] === true || String(d['promo_popup_enabled']).toLowerCase() === 'true' || d['promo_popup_enabled'] === 1;
          }
          if (d['promo_popup_title']) this.promoPopupTitle = String(d['promo_popup_title']);
          if (d['promo_popup_subtitle']) this.promoPopupSubtitle = String(d['promo_popup_subtitle']);
          if (d['promo_popup_discount_code']) this.promoPopupDiscountCode = String(d['promo_popup_discount_code']);
          if (d['promo_popup_target_link']) this.promoPopupTargetLink = String(d['promo_popup_target_link']);
        }
      },
      error: () => {
        // Fallback to default BDT rates if backend unavailable
        this.insideDhaka = 70;
        this.outsideDhaka = 130;
        this.freeThreshold = 2500;
      },
    });
  }

  savePromoPopupSettings(): void {
    this.savingPromo.set(true);
    const payload = {
      promo_popup_enabled: this.promoPopupEnabled,
      promo_popup_title: this.promoPopupTitle,
      promo_popup_subtitle: this.promoPopupSubtitle,
      promo_popup_discount_code: this.promoPopupDiscountCode,
      promo_popup_target_link: this.promoPopupTargetLink || '/products',
    };

    this.adminService.updateDeliverySettings(payload).subscribe({
      next: () => {
        this.savingPromo.set(false);
        this.toast.success('Website promotional popup updated successfully.');
      },
      error: (err) => {
        this.savingPromo.set(false);
        this.toast.error(err?.error?.message || 'Failed to update promotional popup settings.');
      },
    });
  }

  saveSettings(): void {
    if (this.insideDhaka < 0 || this.outsideDhaka < 0 || this.freeThreshold < 0) {
      this.toast.error('Delivery charges and thresholds cannot be negative.');
      return;
    }

    this.saving.set(true);
    const payload = {
      delivery_charge_inside_dhaka: this.insideDhaka,
      delivery_charge_outside_dhaka: this.outsideDhaka,
      free_shipping_threshold: this.freeThreshold,
      estimated_days_inside_dhaka: this.daysInside,
      estimated_days_outside_dhaka: this.daysOutside,
    };

    this.adminService.updateDeliverySettings(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Regional delivery settings updated successfully.');
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.message || 'Failed to update delivery settings.');
      },
    });
  }
}
