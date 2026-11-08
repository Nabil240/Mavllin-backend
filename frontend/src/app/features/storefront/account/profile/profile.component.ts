import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Address, User } from '../../../../core/models/api.models';
import { AuthService } from '../../../../core/services/auth.service';
import { OrderService } from '../../../../core/services/order.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="profile-page container">
      <header class="page-head">
        <div class="head-meta">
          <nav class="breadcrumb">
            <a routerLink="/">Home</a>
            <span class="sep">/</span>
            <span class="current">Client Profile</span>
          </nav>
          <span class="kicker">CLIENT ATELIER PROFILE</span>
          <h1 class="section-heading">PROFILE &amp; ADDRESS BOOK</h1>
          <p class="section-subtitle">
            Manage your personal profile details, account credentials, and saved delivery addresses for rapid Cash on Delivery checkout.
          </p>
        </div>

        <div class="nav-pills">
          <a routerLink="/account/orders" class="pill">Order History</a>
          <a routerLink="/account/profile" class="pill active">Profile &amp; Addresses</a>
          <a routerLink="/account/wishlist" class="pill">Wishlist</a>
          <button type="button" class="pill pill-logout" (click)="auth.logout()">Sign Out</button>
        </div>
      </header>

      <div class="profile-layout">
        <!-- LEFT COLUMN: Profile Info & Security -->
        <div class="profile-column">
          <!-- Profile Card -->
          <section class="card-section">
            <div class="section-header">
              <h2>Personal Information</h2>
              <span class="role-badge">{{ auth.user()?.role | uppercase }}</span>
            </div>

            <form (ngSubmit)="saveProfile()">
              <div class="form-group">
                <label class="form-label" for="profileFullName">Full Name *</label>
                <input
                  id="profileFullName"
                  type="text"
                  name="fullName"
                  class="form-control"
                  [(ngModel)]="profileName"
                  placeholder="Your full name"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="profileEmail">Email Address (Read-Only)</label>
                <input
                  id="profileEmail"
                  type="email"
                  class="form-control readonly"
                  [value]="auth.user()?.email || ''"
                  readonly
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="profilePhone">Phone Number</label>
                <input
                  id="profilePhone"
                  type="tel"
                  name="phone"
                  class="form-control"
                  [(ngModel)]="profilePhone"
                  placeholder="+880 1711-000000"
                />
              </div>

              <button
                type="submit"
                class="btn btn-primary btn-sm"
                [disabled]="savingProfile() || !profileName.trim()"
              >
                {{ savingProfile() ? 'Saving Changes...' : 'Save Profile Details' }}
              </button>
            </form>
          </section>

          <!-- Password Security -->
          <section class="card-section">
            <div class="section-header">
              <h2>Change Password</h2>
            </div>

            <form (ngSubmit)="changePassword()">
              <div class="form-group">
                <label class="form-label" for="currentPass">Current Password *</label>
                <input
                  id="currentPass"
                  type="password"
                  name="currentPassword"
                  class="form-control"
                  [(ngModel)]="currentPassword"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="newPass">New Password *</label>
                <input
                  id="newPass"
                  type="password"
                  name="newPassword"
                  class="form-control"
                  [(ngModel)]="newPassword"
                  placeholder="Min 8 characters, 1 uppercase & 1 number"
                  required
                />
              </div>

              <button
                type="submit"
                class="btn btn-secondary btn-sm"
                [disabled]="savingPassword() || !currentPassword || !newPassword"
              >
                {{ savingPassword() ? 'Updating Password...' : 'Update Password' }}
              </button>
            </form>
          </section>
        </div>

        <!-- RIGHT COLUMN: Saved Addresses -->
        <div class="addresses-column">
          <section class="card-section">
            <div class="section-header">
              <div>
                <h2>Delivery Addresses ({{ addresses().length }})</h2>
                <p class="section-subtitle" style="margin: 0;">
                  Addresses used for 1-click Cash on Delivery dispatch across Dhaka and nationwide.
                </p>
              </div>
              <button type="button" class="btn btn-primary btn-sm" (click)="openAddressModal()">
                + Add New Address
              </button>
            </div>

            @if (loadingAddresses()) {
              <div class="loading-state">Loading saved addresses...</div>
            } @else if (addresses().length === 0) {
              <div class="empty-addresses">
                <p>No saved delivery addresses yet.</p>
                <button type="button" class="btn btn-outline btn-sm" (click)="openAddressModal()">
                  Add Your First Delivery Address
                </button>
              </div>
            } @else {
              <div class="addresses-grid">
                @for (addr of addresses(); track addr.id) {
                  <article class="address-card" [class.is-default]="Boolean(addr.is_default)">
                    <div class="addr-head">
                      <div class="label-with-default">
                        <strong class="addr-label">{{ addr.label || 'Delivery Address' }}</strong>
                        @if (Boolean(addr.is_default)) {
                          <span class="default-badge">DEFAULT</span>
                        }
                      </div>
                      <div class="addr-actions">
                        <button type="button" class="btn-text" (click)="openAddressModal(addr)">Edit</button>
                        <button type="button" class="btn-text text-danger" (click)="deleteAddress(addr.id)">Delete</button>
                      </div>
                    </div>

                    <div class="addr-body">
                      <p class="recipient"><strong>{{ addr.recipient_name }}</strong></p>
                      <p class="phone">{{ addr.phone }}</p>
                      <p class="street">{{ addr.street_address }}</p>
                      <p class="city-post">
                        {{ addr.city }}
                        @if (addr.postal_code) {
                          — {{ addr.postal_code }}
                        }
                      </p>
                    </div>

                    @if (!Boolean(addr.is_default)) {
                      <div class="addr-footer">
                        <button
                          type="button"
                          class="btn btn-link-default btn-xs"
                          (click)="setDefault(addr.id)"
                        >
                          Set as Default Address
                        </button>
                      </div>
                    }
                  </article>
                }
              </div>
            }
          </section>
        </div>
      </div>
    </div>

    <!-- Address Add/Edit Modal -->
    @if (editingAddress()) {
      <div class="modal-backdrop" (click)="editingAddress.set(null)">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <h3>{{ modalAddressForm.id ? 'EDIT ADDRESS' : 'ADD NEW DELIVERY ADDRESS' }}</h3>
            <button type="button" class="close-btn" (click)="editingAddress.set(null)">&times;</button>
          </div>
          <form (ngSubmit)="saveAddress()">
            <div class="modal-body">
              <div class="form-group">
                <label class="form-label" for="addrLabel">Address Label *</label>
                <input
                  id="addrLabel"
                  type="text"
                  name="label"
                  class="form-control"
                  [(ngModel)]="modalAddressForm.label"
                  placeholder="e.g. Home, Atelier Studio, Office"
                  required
                />
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label" for="addrName">Recipient Full Name *</label>
                  <input
                    id="addrName"
                    type="text"
                    name="recipient_name"
                    class="form-control"
                    [(ngModel)]="modalAddressForm.recipient_name"
                    placeholder="Recipient Name"
                    required
                  />
                </div>
                <div class="form-group">
                  <label class="form-label" for="addrPhone">Mobile Phone *</label>
                  <input
                    id="addrPhone"
                    type="tel"
                    name="phone"
                    class="form-control"
                    [(ngModel)]="modalAddressForm.phone"
                    placeholder="+880 1711-000000"
                    required
                  />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="addrStreet">Street Address / House / Flat *</label>
                <textarea
                  id="addrStreet"
                  name="street_address"
                  class="form-control"
                  rows="2"
                  [(ngModel)]="modalAddressForm.street_address"
                  placeholder="House 12, Road 4, Sector 3, Uttara"
                  required
                ></textarea>
              </div>

              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label" for="addrCity">City *</label>
                  <input
                    id="addrCity"
                    type="text"
                    name="city"
                    class="form-control"
                    [(ngModel)]="modalAddressForm.city"
                    placeholder="Dhaka"
                    required
                  />
                </div>
                <div class="form-group">
                  <label class="form-label" for="addrPostal">Postal Code</label>
                  <input
                    id="addrPostal"
                    type="text"
                    name="postal_code"
                    class="form-control"
                    [(ngModel)]="modalAddressForm.postal_code"
                    placeholder="1230"
                  />
                </div>
              </div>

              <div class="form-check">
                <input
                  type="checkbox"
                  id="defaultCheck"
                  name="is_default"
                  [(ngModel)]="modalAddressForm.is_default"
                />
                <label for="defaultCheck">Set as primary default shipping address</label>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" (click)="editingAddress.set(null)">Cancel</button>
              <button
                type="submit"
                class="btn btn-primary btn-sm"
                [disabled]="savingAddress() || !modalAddressForm.recipient_name || !modalAddressForm.street_address || !modalAddressForm.city"
              >
                {{ savingAddress() ? 'Saving Address...' : 'Save Address' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .profile-page {
      padding-top: 2.5rem;
      padding-bottom: 5rem;
    }

    .page-head {
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;

      @media (min-width: 768px) {
        flex-direction: row;
        justify-content: space-between;
        align-items: flex-end;
      }
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.75rem;
      color: var(--color-text-muted);

      a {
        color: var(--color-text-muted);
        text-decoration: none;
        &:hover { color: var(--color-onyx); }
      }
      .current {
        color: var(--color-onyx);
        font-weight: 600;
      }
    }

    .kicker {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.16em;
      color: var(--color-gold, #996515);
      display: block;
      margin-bottom: 0.25rem;
    }

    .nav-pills {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;

      .pill {
        padding: 0.5rem 1rem;
        border-radius: var(--radius-sm, 2px);
        font-size: 0.8rem;
        font-weight: 600;
        text-decoration: none;
        background: var(--color-alabaster, #f9f9f9);
        border: 1px solid var(--color-border, #e5e5e5);
        color: var(--color-text, #333);
        transition: all 0.2s ease;

        &.active, &:hover {
          background: var(--color-onyx, #121212);
          color: var(--color-white, #fff);
          border-color: var(--color-onyx, #121212);
        }

        &.pill-logout {
          color: var(--color-berry, #be123c);
          border-color: rgba(190, 18, 60, 0.3);
          background: #fff1f2;
          cursor: pointer;

          &:hover {
            background: var(--color-berry, #be123c);
            color: var(--color-white, #fff);
            border-color: var(--color-berry, #be123c);
          }
        }
      }
    }

    .profile-layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2rem;

      @media (min-width: 992px) {
        grid-template-columns: 420px 1fr;
      }
    }

    .card-section {
      background: var(--color-white, #fff);
      border: 1px solid var(--color-border, #e5e5e5);
      border-radius: 2px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--color-border, #f0f0f0);

      h2 {
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin: 0;
      }
    }

    .role-badge {
      display: inline-block;
      padding: 0.2rem 0.5rem;
      background: #eef2ff;
      color: #3730a3;
      border-radius: 2px;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.06em;
    }

    .form-group {
      margin-bottom: 1.15rem;

      .form-label {
        display: block;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 0.4rem;
        color: var(--color-text-muted, #555);
      }

      .form-control {
        width: 100%;
        padding: 0.65rem 0.85rem;
        font-size: 0.85rem;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 2px;
        background: #fff;
        box-sizing: border-box;

        &.readonly {
          background: #f8fafc;
          color: #64748b;
          cursor: not-allowed;
        }
      }
    }

    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .form-check {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.82rem;
      margin-top: 0.5rem;
      margin-bottom: 1rem;
    }

    .addresses-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1rem;

      @media (min-width: 640px) {
        grid-template-columns: 1fr 1fr;
      }
    }

    .address-card {
      background: var(--color-alabaster, #fcfcfc);
      border: 1px solid var(--color-border, #e5e5e5);
      border-radius: 2px;
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;

      &.is-default {
        border-color: var(--color-onyx, #121212);
        background: #fff;
      }
    }

    .addr-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--color-border, #f0f0f0);
    }

    .label-with-default {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .addr-label {
      font-size: 0.85rem;
      letter-spacing: 0.04em;
    }

    .default-badge {
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.15rem 0.4rem;
      background: var(--color-onyx, #121212);
      color: #fff;
      border-radius: 2px;
    }

    .addr-actions {
      display: flex;
      gap: 0.5rem;
    }

    .btn-text {
      background: none;
      border: none;
      padding: 0;
      font-size: 0.75rem;
      cursor: pointer;
      text-decoration: underline;
      color: var(--color-text-muted, #666);

      &.text-danger { color: #dc2626; }
      &:hover { color: var(--color-onyx, #000); }
    }

    .addr-body {
      font-size: 0.82rem;
      line-height: 1.45;
      margin-bottom: 0.75rem;

      p { margin: 0 0 0.25rem 0; }
      .recipient { font-weight: 600; }
      .phone, .street, .city-post { color: #555; }
    }

    .addr-footer {
      border-top: 1px dashed var(--color-border, #e5e5e5);
      padding-top: 0.5rem;
    }

    .btn-link-default {
      background: none;
      border: none;
      font-size: 0.72rem;
      color: var(--color-gold, #996515);
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
      padding: 0;
      &:hover { color: var(--color-onyx, #121212); }
    }

    .empty-addresses {
      text-align: center;
      padding: 2.5rem 1rem;
      background: #fafafa;
      border: 1px dashed #ddd;
      border-radius: 2px;
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 1050;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }

    .modal-card {
      background: var(--color-white, #fff);
      width: 100%;
      max-width: 520px;
      border-radius: 2px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      overflow: hidden;
    }

    .modal-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--color-border, #e5e5e5);

      h3 { font-size: 0.9rem; margin: 0; letter-spacing: 0.06em; }
      .close-btn {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        line-height: 1;
      }
    }

    .modal-body {
      padding: 1.25rem;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      border-top: 1px solid var(--color-border, #e5e5e5);
      background: var(--color-alabaster, #f9f9f9);
    }
  `],
})
export class ProfileComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly orderService = inject(OrderService);
  private readonly toast = inject(ToastService);

  // Profile Form
  profileName = '';
  profilePhone = '';
  savingProfile = signal<boolean>(false);

  // Password Form
  currentPassword = '';
  newPassword = '';
  savingPassword = signal<boolean>(false);

  // Addresses
  addresses = signal<Address[]>([]);
  loadingAddresses = signal<boolean>(true);

  // Address Modal Form
  editingAddress = signal<Address | null>(null);
  savingAddress = signal<boolean>(false);
  modalAddressForm: {
    id?: number;
    label: string;
    recipient_name: string;
    phone: string;
    street_address: string;
    city: string;
    postal_code: string;
    is_default: boolean;
  } = {
    label: 'Home',
    recipient_name: '',
    phone: '',
    street_address: '',
    city: 'Dhaka',
    postal_code: '',
    is_default: false,
  };

  readonly Boolean = Boolean;

  ngOnInit(): void {
    const u = this.auth.user();
    if (u) {
      this.profileName = u.full_name || '';
      this.profilePhone = u.phone || '';
    }
    this.loadAddresses();
  }

  loadAddresses(): void {
    this.loadingAddresses.set(true);
    this.orderService.getAddresses().subscribe({
      next: (res) => {
        this.loadingAddresses.set(false);
        if (res.success && res.data) {
          this.addresses.set(res.data);
        }
      },
      error: () => this.loadingAddresses.set(false),
    });
  }

  saveProfile(): void {
    if (!this.profileName.trim()) return;

    this.savingProfile.set(true);
    this.auth.updateProfile({
      full_name: this.profileName.trim(),
      phone: this.profilePhone.trim() || undefined,
    }).subscribe({
      next: (res) => {
        this.savingProfile.set(false);
        if (res.success) {
          this.toast.success('Your profile has been updated.');
        }
      },
      error: (err) => {
        this.savingProfile.set(false);
        this.toast.error(err?.error?.message || 'Failed to update profile.');
      },
    });
  }

  changePassword(): void {
    if (!this.currentPassword || !this.newPassword) return;

    this.savingPassword.set(true);
    this.auth.changePassword({
      currentPassword: this.currentPassword,
      newPassword: this.newPassword,
    }).subscribe({
      next: (res) => {
        this.savingPassword.set(false);
        if (res.success) {
          this.toast.success('Your password has been successfully updated.');
          this.currentPassword = '';
          this.newPassword = '';
        }
      },
      error: (err) => {
        this.savingPassword.set(false);
        this.toast.error(err?.error?.message || 'Unable to change password.');
      },
    });
  }

  openAddressModal(existing?: Address): void {
    if (existing) {
      this.editingAddress.set(existing);
      this.modalAddressForm = {
        id: existing.id,
        label: existing.label || 'Home',
        recipient_name: existing.recipient_name,
        phone: existing.phone,
        street_address: existing.street_address,
        city: existing.city,
        postal_code: existing.postal_code || '',
        is_default: Boolean(existing.is_default),
      };
    } else {
      const u = this.auth.user();
      this.editingAddress.set({} as Address);
      this.modalAddressForm = {
        label: 'Home',
        recipient_name: u?.full_name || '',
        phone: u?.phone || '',
        street_address: '',
        city: 'Dhaka',
        postal_code: '',
        is_default: this.addresses().length === 0,
      };
    }
  }

  saveAddress(): void {
    if (
      !this.modalAddressForm.recipient_name.trim() ||
      !this.modalAddressForm.street_address.trim() ||
      !this.modalAddressForm.city.trim()
    ) {
      return;
    }

    this.savingAddress.set(true);
    const payload = {
      label: this.modalAddressForm.label.trim() || 'Delivery Address',
      recipient_name: this.modalAddressForm.recipient_name.trim(),
      phone: this.modalAddressForm.phone.trim(),
      street_address: this.modalAddressForm.street_address.trim(),
      city: this.modalAddressForm.city.trim(),
      postal_code: this.modalAddressForm.postal_code.trim(),
      country: 'Bangladesh',
      is_default: this.modalAddressForm.is_default ? 1 : 0,
    };

    if (this.modalAddressForm.id) {
      this.orderService.updateAddress(this.modalAddressForm.id, payload).subscribe({
        next: (res) => {
          this.savingAddress.set(false);
          this.editingAddress.set(null);
          if (res.success) {
            this.toast.success('Address updated.');
            this.loadAddresses();
          }
        },
        error: (err) => {
          this.savingAddress.set(false);
          this.toast.error(err?.error?.message || 'Failed to update address.');
        },
      });
    } else {
      this.orderService.createAddress(payload).subscribe({
        next: (res) => {
          this.savingAddress.set(false);
          this.editingAddress.set(null);
          if (res.success) {
            this.toast.success('New delivery address saved.');
            this.loadAddresses();
          }
        },
        error: (err) => {
          this.savingAddress.set(false);
          this.toast.error(err?.error?.message || 'Failed to add address.');
        },
      });
    }
  }

  setDefault(id: number): void {
    this.orderService.setDefaultAddress(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('Default address updated.');
          this.loadAddresses();
        }
      },
      error: () => this.toast.error('Failed to set default address.'),
    });
  }

  deleteAddress(id: number): void {
    if (!confirm('Are you sure you want to delete this delivery address?')) return;

    this.orderService.deleteAddress(id).subscribe({
      next: (res) => {
        if (res.success) {
          this.toast.success('Address removed.');
          this.loadAddresses();
        }
      },
      error: (err) => this.toast.error(err?.error?.message || 'Unable to delete address.'),
    });
  }
}
