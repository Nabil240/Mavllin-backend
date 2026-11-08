import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastService } from '../../../core/services/toast.service';
import { SeoService } from '../../../core/services/seo.service';

@Component({
  selector: 'app-info-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="info-page container">
      @switch (pageType()) {
        @case ('contact') {
          <div class="info-card">
            <span class="kicker">CLIENT ATELIER CONCIERGE</span>
            <h1 class="section-heading">CONTACT &amp; DHAKA ATELIER</h1>
            <p class="lead">
              Visit our flagship atelier in Dhaka or reach our concierge team for bespoke tailoring advice, sizing consultations, and order fulfillment support.
            </p>
            <div class="info-grid-2">
              <div class="studio-box">
                <h3>Flagship Atelier &amp; Head Office</h3>
                <p><strong>MAVLLIN Atelier:</strong> House 48, Road 11, Block F, Banani, Dhaka 1213, Bangladesh</p>
                <p><strong>Trade License:</strong> TRAD/DNCC/048291/2026</p>
                <p><strong>DBID (Digital Business ID):</strong> DBID-884920115</p>
                <p><strong>Concierge Hotline:</strong> +880 1711-000000 (Daily 10:00 AM – 10:00 PM BST)</p>
                <p><strong>Direct Inquiries:</strong> concierge&#64;mavllin.com</p>
                <p><strong>Customer Dispute Hotline:</strong> DNCRP (Directorate of National Consumers' Right Protection) 16121</p>
              </div>
              <form class="contact-form" (ngSubmit)="submitContact()">
                <h3>Direct Atelier Inquiry</h3>
                <div class="form-group">
                  <label class="form-label">Full Name</label>
                  <input type="text" name="name" class="form-control" [(ngModel)]="contactName" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Email Address</label>
                  <input type="email" name="email" class="form-control" [(ngModel)]="contactEmail" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Message / Order Reference</label>
                  <textarea rows="3" name="msg" class="form-control" [(ngModel)]="contactMessage" required></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-sm">Dispatch Message</button>
              </form>
            </div>
          </div>
        }
        @case ('faq') {
          <div class="info-card">
            <span class="kicker">ASSISTANCE &amp; COMMON QUERIES</span>
            <h1 class="section-heading">FREQUENTLY ASKED QUESTIONS</h1>
            <div class="faq-list">
              <div class="faq-item">
                <h4>How does Cash on Delivery (COD) work?</h4>
                <p>All MAVLLIN orders across Bangladesh are fulfilled via verified Cash on Delivery. You inspect the parcel seal upon delivery and pay the exact order amount in Bangladeshi Taka (৳) to the courier personnel.</p>
              </div>
              <div class="faq-item">
                <h4>What are the delivery charges and delivery times?</h4>
                <p>Inside Dhaka metropolitan area delivery is ৳70 (typically 24–48 hours, statutory ceiling 5 days). Outside Dhaka nationwide delivery across all 64 districts is ৳130 (typically 3–5 business days, statutory ceiling 10 days). Orders of ৳2,500 or more enjoy complimentary free shipping.</p>
              </div>
              <div class="faq-item">
                <h4>Can I exchange an apparel item if the size does not fit?</h4>
                <p>Yes. MAVLLIN offers a 7-day doorstep size exchange policy on unworn garments with all tags and original packaging intact.</p>
              </div>
              <div class="faq-item">
                <h4>Are all prices inclusive of VAT/taxes?</h4>
                <p>All prices displayed across the MAVLLIN storefront are denominated in Bangladeshi Taka (৳ / BDT) and are inclusive of applicable statutory taxes.</p>
              </div>
            </div>
          </div>
        }
        @case ('shipping') {
          <div class="info-card">
            <span class="kicker">NATIONAL LOGISTICS &amp; FULFILLMENT</span>
            <h1 class="section-heading">SHIPPING &amp; DELIVERY POLICY</h1>
            <p class="lead">Insured doorstep fulfillment across all 64 administrative districts of Bangladesh under the National Digital Commerce Policy 2021.</p>
            <ul class="policy-list">
              <li><strong>Inside Dhaka Metropolitan:</strong> Flat delivery rate of <strong>৳70</strong>. Delivery timeframe: 24 to 48 hours (Statutory maximum: 5 business days).</li>
              <li><strong>Outside Dhaka (All 64 Districts):</strong> Flat delivery rate of <strong>৳130</strong> via premier national couriers (Pathao, Steadfast, eCourier, RedX). Delivery timeframe: 3 to 5 business days (Statutory maximum: 10 business days).</li>
              <li><strong>Complimentary Nationwide Delivery:</strong> Automatically applied at checkout on all orders with a subtotal of <strong>৳2,500 or more</strong>.</li>
              <li><strong>Doorstep Parcel Inspection:</strong> Customers are entitled to inspect the exterior shipping flyer and parcel seal in the presence of the delivery agent before payment.</li>
              <li><strong>Tracking &amp; SMS Dispatches:</strong> An SMS dispatch notification with consignment tracking number is issued once your order clears atelier dispatch.</li>
            </ul>
          </div>
        }
        @case ('returns') {
          <div class="info-card">
            <span class="kicker">STATUTORY CONSUMER PROTECTION</span>
            <h1 class="section-heading">RETURN, EXCHANGE &amp; REFUND POLICY</h1>
            <p class="lead">Formulated in strict adherence to the Bangladesh Consumer Rights Protection Act 2009 and the Digital Commerce Operation Guidelines 2021.</p>
            <div class="statutory-meta mb-3">
              <p><strong>Entity:</strong> MAVLLIN Atelier &bull; <strong>Trade License:</strong> TRAD/DNCC/048291/2026 &bull; <strong>DBID:</strong> DBID-884920115</p>
            </div>
            <ul class="policy-list">
              <li><strong>7-Day Return Window:</strong> You may request an exchange or return within <strong>7 calendar days</strong> from the date of parcel receipt.</li>
              <li><strong>Condition of Returned Apparel:</strong> Garments must be unworn, unwashed, unaltered, and with all designer labels, swing tags, and original fabric packaging intact.</li>
              <li><strong>Defective, Damaged, or Incorrect Garments:</strong> If you receive an incorrect size, defective stitching, or fabric damage, MAVLLIN provides 100% free reverse pickup and immediate replacement at zero cost to the client.</li>
              <li><strong>Size Exchanges:</strong> One complimentary size exchange is facilitated per order, subject to atelier inventory availability. If the desired size is exhausted, clients may choose an alternate garment or a full refund.</li>
              <li><strong>Refund Modalities (Cash on Delivery):</strong> For returned items paid via Cash on Delivery, refunds are disbursed within <strong>7 to 10 working days</strong> following atelier inspection via bKash, Nagad, or direct bank transfer (BEFTN/NPSB) without deduction.</li>
              <li><strong>Statutory Dispute Redressal:</strong> In the event of unresolved grievances, consumers hold statutory recourse under the Directorate of National Consumers' Right Protection (DNCRP) Hotline: 16121, Web: <a href="https://dncrp.portal.gov.bd" target="_blank" rel="noopener">dncrp.portal.gov.bd</a>.</li>
            </ul>
          </div>
        }
        @case ('privacy') {
          <div class="info-card">
            <span class="kicker">CLIENT DATA PRIVACY</span>
            <h1 class="section-heading">PRIVACY POLICY</h1>
            <p class="lead">MAVLLIN is dedicated to safeguarding customer privacy and personal identifiers under applicable laws of Bangladesh.</p>
            <ul class="policy-list">
              <li><strong>Data Collection:</strong> We collect essential customer coordinates (Full Name, 11-digit Bangladeshi mobile number, delivery address, email) solely for order fulfillment, courier delivery, and status dispatch.</li>
              <li><strong>Strict Confidentiality:</strong> We do not sell, rent, or monetize customer phone numbers or transaction histories to third-party marketing entities.</li>
              <li><strong>Logistics Sharing:</strong> Contact coordinates are transmitted securely only to designated logistics couriers solely for doorstep parcel delivery.</li>
              <li><strong>Data Rights:</strong> Clients may request review or deletion of their account records by contacting concierge&#64;mavllin.com.</li>
            </ul>
          </div>
        }
        @case ('terms') {
          <div class="info-card">
            <span class="kicker">LEGAL TERMS OF SERVICE</span>
            <h1 class="section-heading">TERMS &amp; CONDITIONS</h1>
            <p class="lead">Governing all orders placed on MAVLLIN in accordance with the laws of the People's Republic of Bangladesh.</p>
            <div class="statutory-meta mb-3">
              <p><strong>Operating Entity:</strong> MAVLLIN &bull; <strong>Trade License:</strong> TRAD/DNCC/048291/2026 &bull; <strong>DBID:</strong> DBID-884920115 &bull; <strong>Registered Address:</strong> House 48, Road 11, Block F, Banani, Dhaka 1213</p>
            </div>
            <ul class="policy-list">
              <li><strong>Contract Formation:</strong> Placing an order represents an offer to purchase. Order confirmation via SMS or email creates a binding transaction contract.</li>
              <li><strong>Currency &amp; Pricing:</strong> All prices are displayed and payable exclusively in Bangladeshi Taka (৳ / BDT). Applicable statutory VAT is inclusive.</li>
              <li><strong>Delivery Terms:</strong> Delivery charges (৳70 inside Dhaka, ৳130 outside Dhaka across 64 districts; free on orders over ৳2,500) and timelines (24-48 hrs Dhaka, 3-5 days outside Dhaka, maximum 5 and 10 days respectively) comply with the National Digital Commerce Policy 2021.</li>
              <li><strong>Cash on Delivery (COD):</strong> Customers agree to pay the exact invoice total upon physical delivery by the authorized courier. Cash collections are verified by receipt.</li>
              <li><strong>Inventory Reservation &amp; Cancellation:</strong> Orders can be cancelled from the customer portal prior to courier handover. Out-of-stock items will be promptly notified with immediate cancellation and nil obligation.</li>
              <li><strong>Governing Law &amp; Jurisdiction:</strong> These terms are governed by the laws of Bangladesh. Any dispute arising shall fall within the jurisdiction of the courts of Dhaka, Bangladesh, subject to prior conciliation through the DNCRP.</li>
            </ul>
          </div>
        }
        @default {
          <div class="info-card not-found">
            <span class="kicker">ERROR 404</span>
            <h1 class="section-heading">PAGE NOT FOUND</h1>
            <p class="lead">The atelier archive or legal link you are looking for does not exist.</p>
            <a routerLink="/" class="btn btn-primary">Return to Homepage</a>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .info-page {
      padding-top: 3rem;
      padding-bottom: 4rem;
      max-width: 900px;
    }
    .info-card {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 2.5rem;
      background: var(--color-white);
      &.not-found { text-align: center; }
    }
    .kicker {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: var(--color-text-light);
    }
    .lead {
      font-size: 1rem;
      color: var(--color-text-muted);
      margin: 0.75rem 0 1.75rem;
    }
    .info-grid-2 {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;
      @media (min-width: 768px) {
        grid-template-columns: 1fr 1fr;
      }
    }
    .studio-box {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      font-size: 0.9rem;
    }
    .faq-list {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      margin-top: 1.5rem;
    }
    .faq-item {
      padding: 1.25rem;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      h4 { margin-bottom: 0.4rem; }
      p { font-size: 0.9rem; color: var(--color-text-muted); }
    }
    .policy-list {
      padding-left: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      font-size: 0.92rem;
    }
  `],
})
export class InfoPageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly seoService = inject(SeoService);

  readonly pageType = signal<string>('404');
  contactName = '';
  contactEmail = '';
  contactMessage = '';

  ngOnInit(): void {
    const path = this.router.url.split('?')[0];
    if (path.includes('contact')) this.pageType.set('contact');
    else if (path.includes('faq')) this.pageType.set('faq');
    else if (path.includes('shipping')) this.pageType.set('shipping');
    else if (path.includes('return')) this.pageType.set('returns');
    else if (path.includes('privacy')) this.pageType.set('privacy');
    else if (path.includes('terms')) this.pageType.set('terms');
    else this.pageType.set(this.route.snapshot.data['pageType'] || '404');

    const titles: Record<string, string> = {
      contact: 'Contact & Dhaka Atelier — MAVLLIN',
      faq: 'Frequently Asked Questions — MAVLLIN',
      shipping: 'Shipping & Delivery Policy — MAVLLIN',
      returns: 'Return & Refund Policy — MAVLLIN',
      privacy: 'Privacy Policy — MAVLLIN',
      terms: 'Terms & Conditions — MAVLLIN',
    };
    this.seoService.updateSeo({ title: titles[this.pageType()] || 'Page Not Found — MAVLLIN' });
  }

  submitContact(): void {
    this.toast.success('Thank you! Our Dhaka concierge team will respond shortly.');
    this.contactName = '';
    this.contactEmail = '';
    this.contactMessage = '';
  }
}
