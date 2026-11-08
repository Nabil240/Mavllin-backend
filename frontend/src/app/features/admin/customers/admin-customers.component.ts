import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { User } from '../../../core/models/api.models';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-customers">
      <div class="page-head">
        <div>
          <h1 class="section-heading">CLIENT DIRECTORY &amp; ACCESS</h1>
          <p class="section-subtitle">View registered customer accounts and manage account activation state</p>
        </div>
      </div>

      <div class="filter-bar">
        <input
          type="search"
          class="form-control"
          placeholder="Search by name or email..."
          [(ngModel)]="search"
          (keyup.enter)="loadCustomers()"
        />
        <select class="form-control" [(ngModel)]="roleFilter" (change)="loadCustomers()">
          <option value="">All Roles</option>
          <option value="customer">Customers</option>
          <option value="admin">Admins</option>
        </select>
        <button type="button" class="btn btn-secondary btn-sm" (click)="loadCustomers()">Filter</button>
      </div>

      <div class="table-card">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr>
                <td><strong>{{ u.full_name }}</strong></td>
                <td>{{ u.email }}</td>
                <td>{{ u.phone || '—' }}</td>
                <td><span class="badge badge-dark">{{ u.role }}</span></td>
                <td>
                  <span class="badge" [class]="u.is_active ? 'badge-stock' : 'badge-danger'">
                    {{ u.is_active ? 'Active' : 'Deactivated' }}
                  </span>
                </td>
                <td>{{ u.created_at | date:'mediumDate' }}</td>
                <td>
                  @if (u.role !== 'admin') {
                    <button
                      type="button"
                      class="btn btn-sm"
                      [class.btn-danger]="u.is_active"
                      [class.btn-outline]="!u.is_active"
                      (click)="toggleStatus(u)"
                    >
                      {{ u.is_active ? 'Deactivate' : 'Restore' }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .page-head { margin-bottom: 1.5rem; }
    .filter-bar {
      display: grid;
      grid-template-columns: 1fr 180px auto;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
      max-width: 640px;
    }
    .table-card {
      background: var(--color-white);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      overflow-x: auto;
    }
    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      th, td { padding: 0.8rem 1rem; border-bottom: 1px solid var(--color-border); text-align: left; }
      th { background: var(--color-alabaster); font-size: 0.72rem; text-transform: uppercase; }
    }
  `],
})
export class AdminCustomersComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly users = signal<User[]>([]);
  search = '';
  roleFilter = '';

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.adminService
      .getCustomers({
        limit: 50,
        search: this.search.trim() || undefined,
        role: this.roleFilter || undefined,
      })
      .subscribe((res) => {
        if (res.success && Array.isArray(res.data)) {
          this.users.set(res.data);
        }
      });
  }

  toggleStatus(u: User): void {
    const nextState = u.is_active ? 0 : 1;
    this.adminService.toggleCustomerStatus(u.id, nextState).subscribe({
      next: () => {
        this.toast.success(`Account status updated for ${u.full_name}.`);
        this.loadCustomers();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Unable to change status.'),
    });
  }
}
