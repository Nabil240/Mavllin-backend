import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Address, Order } from '../../../core/models/api.models';
import { AuthService } from '../../../core/services/auth.service';
import { OrderService } from '../../../core/services/order.service';
import { ToastService } from '../../../core/services/toast.service';
import { BdtCurrencyPipe } from '../../../shared/pipes/bdt.pipe';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BdtCurrencyPipe],
  template: `
    <div class="account-page container">
      <header class="account-header">
        <div>
          <span class="kicker">CLIENT PORTAL</span>
          <h1 class="section-heading">WELCOME, {{ auth.user()?.full_name | uppercase }}</h1>
          <p class="section-subtitle">{{ auth.user()?.email }} &bull; Role: {{ auth.user()?.role }}</p>
        </div>
        <button type="button" class="btn btn-outline btn-sm" (click)="auth.logout()">
          Sign Out
        </button>
      </header>

      <div class="account-tabs">
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'orders'"
          (click)="activeTab.set('orders')"
        >
          Order History ({{ orders().length }})
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'addresses'"
          (click)="activeTab.set('addresses')"
        >
          Address Book ({{ addresses().length }})
        </button>
        <button
          type="button"
          class="tab-btn"
          [class.active]="activeTab() === 'profile'"
          (click)="activeTab.set('profile')"
        >
          Profile &amp; Security
        </button>
      </div>

      <!-- TAB 1: ORDERS -->
      @if (activeTab() === 'orders') {
        <section class="tab-panel">
          @if (orders().length === 0) {
            <div class="empty-box">
              <h3>You haven't placed any orders yet</h3>
              <p>Orders placed with your account will appear here with real-time tracking.</p>
              <a routerLink="/catalog" class="btn btn-primary btn-sm">Explore Collection</a>
            </div>
          } @else {
            <div class="orders-list">
              @for (ord of orders(); track ord.id) {
                <div class="order-card">
                  <div class="order-card-head">
                    <div>
                      <strong>{{ ord.order_number }}</strong>
                      <span class="order-date">Placed {{ ord.created_at | date:'mediumDate' }}</span>
                    </div>
                    <div class="order-badges">
                      <span class="badge" [class]="'badge-' + ord.status">{{ ord.status }}</span>
                      <span class="badge" [class]="'badge-' + ord.payment_status">
                        {{ ord.payment_status }} (COD)
                      </span>
                    </div>
                  </div>

                  <div class="order-card-body">
                    <div class="tabular-price">
                      Total Amount: <strong>{{ ord.total_amount | bdt }}</strong>
                      @if (ord.total_items) {
                        <span>({{ ord.total_items }} item(s))</span>
                      }
                    </div>
                    <div class="order-actions">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="viewOrderDetails(ord.id)">
                        View Details
                      </button>
                      @if (ord.status === 'pending' || ord.status === 'confirmed') {
                        <button type="button" class="btn btn-danger btn-sm" (click)="openCancelModal(ord)">
                          Cancel Order
                        </button>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </section>
      }

      <!-- TAB 2: ADDRESS BOOK -->
      @if (activeTab() === 'addresses') {
        <section class="tab-panel">
          <div class="addresses-layout">
            <div class="addr-list-col">
              <h3>Saved Delivery Addresses</h3>
              @if (addresses().length === 0) {
                <p class="muted">No saved addresses yet. Add one using the form.</p>
              } @else {
                <div class="addr-cards">
                  @for (a of addresses(); track a.id) {
                    <div class="addr-item">
                      <div class="addr-item-top">
                        <strong>{{ a.label || 'Home' }}</strong>
                        @if (a.is_default) {
                          <span class="badge badge-stock">Default</span>
                        }
                      </div>
                      <p><strong>{{ a.recipient_name }}</strong> &bull; {{ a.phone }}</p>
                      <p>{{ a.street_address }}@if (a.area) {, {{ a.area }}}, {{ a.city }} {{ a.postal_code }}</p>
                      <div class="addr-item-actions">
                        @if (!a.is_default) {
                          <button type="button" (click)="setDefaultAddress(a.id)">Set Default</button>
                        }
                        <button type="button" class="danger" (click)="deleteAddress(a.id)">Delete</button>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            <form class="addr-form-col" (ngSubmit)="saveNewAddress()">
              <h3>Add New Address</h3>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Label (Home / Office)</label>
                  <input type="text" name="label" class="form-control" [(ngModel)]="newAddr.label" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Recipient Name *</label>
                  <input type="text" name="recipient_name" class="form-control" [(ngModel)]="newAddr.recipient_name" required />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Mobile Number *</label>
                <input type="tel" name="phone" class="form-control" [(ngModel)]="newAddr.phone" required />
              </div>
              <div class="form-group">
                <label class="form-label">Street Address *</label>
                <input type="text" name="street_address" class="form-control" [(ngModel)]="newAddr.street_address" required />
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">City *</label>
                  <select name="city" class="form-control" [(ngModel)]="newAddr.city">
                    <option value="Dhaka">Dhaka</option>
                    <option value="Chattogram">Chattogram</option>
                    <option value="Sylhet">Sylhet</option>
                    <option value="Rajshahi">Rajshahi</option>
                    <option value="Khulna">Khulna</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Postal Code *</label>
                  <input type="text" name="postal_code" class="form-control" [(ngModel)]="newAddr.postal_code" required />
                </div>
              </div>
              <button type="submit" class="btn btn-primary btn-sm">Save Address</button>
            </form>
          </div>
        </section>
      }

      <!-- TAB 3: PROFILE & PASSWORD -->
      @if (activeTab() === 'profile') {
        <section class="tab-panel">
          <div class="profile-grid">
            <form class="profile-card" (ngSubmit)="saveProfile()">
              <h3>Personal Details</h3>
              <div class="form-group">
                <label class="form-label">Full Name</label>
                <input type="text" name="profileName" class="form-control" [(ngModel)]="profileName" required />
              </div>
              <div class="form-group">
                <label class="form-label">Phone Number</label>
                <input type="tel" name="profilePhone" class="form-control" [(ngModel)]="profilePhone" />
              </div>
              <button type="submit" class="btn btn-primary btn-sm">Update Profile</button>
            </form>

            <form class="profile-card" (ngSubmit)="updatePassword()">
              <h3>Change Password</h3>
              <div class="form-group">
                <label class="form-label">Current Password</label>
                <input type="password" name="currentPassword" class="form-control" [(ngModel)]="currentPassword" required />
              </div>
              <div class="form-group">
                <label class="form-label">New Password</label>
                <input type="password" name="newPassword" class="form-control" [(ngModel)]="newPassword" required />
              </div>
              <button type="submit" class="btn btn-outline btn-sm">Update Password</button>
            </form>
          </div>
        </section>
      }
    </div>

    <!-- Order Detail Modal -->
    @if (selectedOrder()) {
      @let o = selectedOrder()!;
      <div class="modal-backdrop" (click)="selectedOrder.set(null)">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>ORDER {{ o.order_number }}</h3>
            <button type="button" (click)="selectedOrder.set(null)">&times;</button>
          </div>
          <div class="modal-body">
            <p style="margin-bottom: 0.75rem; font-size: 0.85rem;">
              <strong>Status:</strong> {{ o.status | uppercase }} &bull;
              <strong>Payment:</strong> {{ o.payment_status | uppercase }} (Cash on Delivery)
            </p>
            <table class="detail-table">
              <thead>
                <tr>
                  <th>Garment</th>
                  <th>Variant</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                @for (item of o.items || []; track item.id) {
                  <tr>
                    <td>{{ item.product_name }}</td>
                    <td>{{ item.variant_size }} {{ item.variant_color }} ({{ item.variant_sku || 'SKU' }})</td>
                    <td>{{ item.quantity }}</td>
                    <td class="tabular-price">{{ item.line_total | bdt }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" (click)="selectedOrder.set(null)">
              Close
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Cancel Order Modal -->
    @if (cancelTargetOrder()) {
      <div class="modal-backdrop" (click)="cancelTargetOrder.set(null)">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>CANCEL ORDER {{ cancelTargetOrder()!.order_number }}</h3>
            <button type="button" (click)="cancelTargetOrder.set(null)">&times;</button>
          </div>
          <div class="modal-body">
            <p style="font-size: 0.85rem; margin-bottom: 1rem;">
              Cancelling this order will automatically restore reserved variant stock back to the catalog.
            </p>
            <div class="form-group">
              <label class="form-label">Reason for Cancellation *</label>
              <textarea
                rows="3"
                class="form-control"
                [(ngModel)]="cancelReason"
                placeholder="Changed size / ordered by mistake..."
              ></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary btn-sm" (click)="cancelTargetOrder.set(null)">
              Keep Order
            </button>
            <button type="button" class="btn btn-danger btn-sm" (click)="confirmCancelOrder()">
              Confirm Cancellation
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .account-page {
      padding-top: 2.5rem;
      padding-bottom: 4rem;
    }
    .account-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--color-border);
      margin-bottom: 1.5rem;
      .kicker { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.14em; color: var(--color-text-light); }
    }
    .account-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 0.75rem;
    }
    .tab-btn {
      padding: 0.55rem 1.15rem;
      font-family: var(--font-display);
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      border-radius: var(--radius-sm);
      color: var(--color-text-muted);
      &.active {
        background: var(--color-onyx);
        color: var(--color-white);
      }
    }
    .empty-box {
      padding: 3rem;
      text-align: center;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .orders-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .order-card {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 1.25rem;
      background: var(--color-white);
    }
    .order-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 0.85rem;
      border-bottom: 1px solid var(--color-border);
      .order-date { font-size: 0.8rem; color: var(--color-text-muted); margin-left: 0.75rem; }
      .order-badges { display: flex; gap: 0.5rem; }
    }
    .order-card-body {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 0.85rem;
      .order-actions { display: flex; gap: 0.5rem; }
    }

    .addresses-layout,
    .profile-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;
      @media (min-width: 768px) {
        grid-template-columns: 1fr 1fr;
      }
    }
    .addr-cards {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      margin-top: 1rem;
    }
    .addr-item {
      padding: 1rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      .addr-item-top { display: flex; justify-content: space-between; margin-bottom: 0.35rem; }
      .addr-item-actions {
        margin-top: 0.65rem;
        display: flex;
        gap: 1rem;
        button { font-size: 0.76rem; font-weight: 700; text-decoration: underline; }
        .danger { color: var(--color-berry); }
      }
    }
    .addr-form-col,
    .profile-card {
      padding: 1.5rem;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      h3 { font-size: 0.92rem; text-transform: uppercase; margin-bottom: 1rem; }
    }
    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
    }
    .detail-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      th, td { padding: 0.6rem; border-bottom: 1px solid var(--color-border); text-align: left; }
    }
  `],
})
export class AccountComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly orderService = inject(OrderService);
  private readonly toast = inject(ToastService);

  readonly activeTab = signal<'orders' | 'addresses' | 'profile'>('orders');
  readonly orders = signal<Order[]>([]);
  readonly addresses = signal<Address[]>([]);
  readonly selectedOrder = signal<Order | null>(null);
  readonly cancelTargetOrder = signal<Order | null>(null);
  readonly Number = Number;

  cancelReason = 'Changed size / mind';
  profileName = '';
  profilePhone = '';
  currentPassword = '';
  newPassword = '';

  newAddr = {
    label: 'Home',
    recipient_name: '',
    phone: '',
    street_address: '',
    city: 'Dhaka',
    postal_code: '1213',
  };

  ngOnInit(): void {
    const u = this.auth.user();
    if (u) {
      this.profileName = u.full_name;
      this.profilePhone = u.phone || '';
      this.newAddr.recipient_name = u.full_name;
      this.newAddr.phone = u.phone || '';
    }
    this.loadOrders();
    this.loadAddresses();
  }

  loadOrders(): void {
    this.orderService.getMyOrders().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.orders.set(res.data);
        }
      },
    });
  }

  loadAddresses(): void {
    this.orderService.getAddresses().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this.addresses.set(res.data);
        }
      },
    });
  }

  viewOrderDetails(orderId: number): void {
    this.orderService.getOrderById(orderId).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.selectedOrder.set(res.data);
        }
      },
    });
  }

  openCancelModal(order: Order): void {
    this.cancelTargetOrder.set(order);
    this.cancelReason = 'Requested cancellation by customer';
  }

  confirmCancelOrder(): void {
    const target = this.cancelTargetOrder();
    if (!target) return;
    this.orderService.cancelOrder(target.id, this.cancelReason).subscribe({
      next: () => {
        this.toast.success(`Order ${target.order_number} has been cancelled.`);
        this.cancelTargetOrder.set(null);
        this.loadOrders();
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'Unable to cancel order.');
      },
    });
  }

  saveNewAddress(): void {
    this.orderService.createAddress(this.newAddr).subscribe({
      next: () => {
        this.toast.success('Address saved to your address book.');
        this.newAddr.street_address = '';
        this.loadAddresses();
      },
      error: (err) => {
        this.toast.error(err?.error?.message || 'Could not save address.');
      },
    });
  }

  setDefaultAddress(id: number): void {
    this.orderService.setDefaultAddress(id).subscribe({
      next: () => {
        this.toast.success('Default address updated.');
        this.loadAddresses();
      },
    });
  }

  deleteAddress(id: number): void {
    this.orderService.deleteAddress(id).subscribe({
      next: () => {
        this.toast.info('Address removed.');
        this.loadAddresses();
      },
    });
  }

  saveProfile(): void {
    this.auth.updateProfile({ full_name: this.profileName, phone: this.profilePhone }).subscribe({
      next: () => this.toast.success('Profile updated!'),
      error: (err) => this.toast.error(err?.error?.message || 'Could not update profile.'),
    });
  }

  updatePassword(): void {
    this.auth.changePassword({ currentPassword: this.currentPassword, newPassword: this.newPassword }).subscribe({
      next: () => {
        this.toast.success('Password changed successfully.');
        this.currentPassword = '';
        this.newPassword = '';
      },
      error: (err) => this.toast.error(err?.error?.message || 'Current password incorrect.'),
    });
  }
}
