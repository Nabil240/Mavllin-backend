import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <footer class="site-footer">
      <div class="container footer-grid">
        <div class="footer-col brand-col">
          <div class="footer-logo">MAVLLIN</div>
          <p class="brand-desc">
            Contemporary fashion house &amp; heritage atelier based in Dhaka. Crafted in small batches using
            breathable organic cotton, linen, and sustainable weaves.
          </p>
          <div class="contact-list">
            <div><strong>Hotline:</strong> +880 1711-000000 (10 AM – 10 PM)</div>
            <div><strong>Banani Flagship:</strong> House 48, Road 11, Block F, Banani, Dhaka</div>
            <div><strong>Dhanmondi Studio:</strong> Road 27 (Old), Dhanmondi, Dhaka</div>
          </div>
        </div>

        <div class="footer-col">
          <h4>Collections</h4>
          <ul>
            <li><a routerLink="/catalog">All Seasonal Drops</a></li>
            <li><a [routerLink]="['/category', 'heritage-panjabi']">Heritage Panjabi</a></li>
            <li><a [routerLink]="['/category', 'menswear']">Menswear Essentials</a></li>
            <li><a [routerLink]="['/category', 'womenswear']">Womenswear Edit</a></li>
            <li><a [routerLink]="['/category', 'outerwear']">Outerwear &amp; Shackets</a></li>
            <li><a [routerLink]="['/category', 'bottoms-trousers']">Bottoms &amp; Chinos</a></li>
          </ul>
        </div>

        <div class="footer-col">
          <h4>Client Services</h4>
          <ul>
            <li><a routerLink="/track-order">Track Your Order</a></li>
            <li><a routerLink="/shipping-policy">Delivery &amp; Shipping Policy</a></li>
            <li><a routerLink="/return-policy">Return &amp; Refund Policy</a></li>
            <li><a routerLink="/faq">Frequently Asked Questions</a></li>
            <li><a routerLink="/contact">Store Locator &amp; Contact</a></li>
            <li><a routerLink="/privacy">Privacy Policy</a></li>
            <li><a routerLink="/terms">Terms &amp; Conditions</a></li>
          </ul>
        </div>

        <div class="footer-col newsletter-col">
          <h4>The Atelier Dispatch</h4>
          <p>Receive early access to seasonal lookbooks, limited panjabi drops, and private studio invitations.</p>
          <form class="newsletter-form" (ngSubmit)="onSubscribe()">
            <input
              type="email"
              name="newsletterEmail"
              [(ngModel)]="email"
              placeholder="Enter your email address"
              required
            />
            <button type="submit" class="btn btn-primary btn-sm">Join</button>
          </form>

          <div class="payment-trust">
            <span class="trust-label">Official Payment Method</span>
            <div class="cod-pill">
              <span class="dot"></span>
              CASH ON DELIVERY (COD) NATIONWIDE
            </div>
          </div>
        </div>
      </div>

      <div class="footer-bottom">
        <div class="container bottom-inner">
          <p>&copy; {{ currentYear }} MAVLLIN. All rights reserved.</p>
          <div class="bottom-links">
            <a routerLink="/privacy">Privacy</a>
            <a routerLink="/terms">Terms</a>
            <a routerLink="/return-policy">Returns</a>
            <a routerLink="/shipping-policy">Shipping</a>
          </div>
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .site-footer {
      background: linear-gradient(180deg, #efe7da 0%, #e7dccb 100%);
      color: var(--color-text);
      border-top: 1px solid var(--color-border-dark);
      padding-top: 4rem;
      margin-top: 4rem;
      padding-bottom: 60px;

      @media (min-width: 992px) {
        padding-bottom: 0;
      }
    }
    .footer-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2.5rem;
      padding-bottom: 3rem;

      @media (min-width: 768px) {
        grid-template-columns: repeat(2, 1fr);
      }
      @media (min-width: 1024px) {
        grid-template-columns: 1.5fr 1fr 1fr 1.4fr;
      }
    }
    .footer-logo {
      font-family: var(--font-display);
      font-size: 1.4rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      color: var(--color-onyx);
      margin-bottom: 0.85rem;
    }
    .brand-desc {
      font-size: 0.85rem;
      line-height: 1.65;
      color: var(--color-text-muted);
      margin-bottom: 1.15rem;
    }
    .contact-list {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      font-size: 0.8rem;
      color: var(--color-text);
    }
    .footer-col h4 {
      color: var(--color-onyx);
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 1.1rem;
    }
    .footer-col ul {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;

      a {
        font-size: 0.85rem;
        color: var(--color-text-muted);
        transition: color var(--transition), transform var(--transition);
        display: inline-block;
        &:hover {
          color: var(--color-onyx);
          transform: translateX(3px);
        }
      }
    }
    .newsletter-col p {
      font-size: 0.83rem;
      color: var(--color-text-muted);
      margin-bottom: 1rem;
    }
    .newsletter-form {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.5rem;

      input {
        flex: 1;
        padding: 0.65rem 0.85rem;
        background: var(--color-white);
        border: 1px solid var(--color-border-dark);
        color: var(--color-onyx);
        border-radius: var(--radius-sm);
        font-size: 0.85rem;
      }
      .btn-primary {
        background: var(--color-onyx);
        color: var(--color-white);
        border-color: var(--color-onyx);
      }
    }
    .payment-trust {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }
    .trust-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-text-muted);
    }
    .cod-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.45rem 0.8rem;
      background: var(--color-white);
      border: 1px solid var(--color-border-dark);
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--color-onyx);
      width: fit-content;

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--color-emerald);
      }
    }
    .footer-bottom {
      border-top: 1px solid var(--color-border-dark);
      padding: 1.25rem 0;
      font-size: 0.78rem;
      color: var(--color-text-muted);
    }
    .bottom-inner {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
    }
    .bottom-links {
      display: flex;
      gap: 1.25rem;
      a:hover { color: var(--color-onyx); }
    }
  `],
})
export class FooterComponent {
  private readonly toast = inject(ToastService);
  email = '';
  readonly currentYear = new Date().getFullYear();

  onSubscribe(): void {
    if (!this.email.trim()) return;
    this.toast.success('Thank you for subscribing to The Atelier Dispatch.');
    this.email = '';
  }
}
