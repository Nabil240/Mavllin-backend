import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Category } from '../../../core/models/api.models';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-admin-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="admin-categories">
      <div class="page-head">
        <div>
          <h1 class="section-heading">CATEGORY HIERARCHY</h1>
          <p class="section-subtitle">Organize storefront departments and nested subcategories</p>
        </div>
      </div>

      <div class="cat-layout">
        <div class="table-card">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Slug</th>
                <th>Parent ID</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (c of categories(); track c.id) {
                <tr>
                  <td><strong>{{ c.name }}</strong></td>
                  <td><code>/{{ c.slug }}</code></td>
                  <td>{{ c.parent_id || 'Root' }}</td>
                  <td>
                    <span class="badge" [class]="c.is_active ? 'badge-stock' : 'badge-danger'">
                      {{ c.is_active ? 'Active' : 'Hidden' }}
                    </span>
                  </td>
                  <td>
                    <div class="row-actions">
                      <button type="button" class="btn btn-secondary btn-sm" (click)="editCategory(c)">Edit</button>
                      <button type="button" class="btn btn-danger btn-sm" (click)="deleteCategory(c)">Delete</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <form class="form-card" (ngSubmit)="saveCategory()">
          <h3>{{ editingId() ? 'Edit Category' : 'Create Category' }}</h3>
          <div class="form-group">
            <label class="form-label">Category Name *</label>
            <input type="text" name="name" class="form-control" [(ngModel)]="form.name" required />
          </div>
          <div class="form-group">
            <label class="form-label">URL Slug (Optional / Auto-generated)</label>
            <input type="text" name="slug" class="form-control" [(ngModel)]="form.slug" placeholder="e.g. heritage-panjabi" />
          </div>
          <div class="form-group">
            <label class="form-label">Parent Category (Optional)</label>
            <select name="parent_id" class="form-control" [(ngModel)]="form.parent_id">
              <option [ngValue]="null">None (Top-Level Department)</option>
              @for (c of categories(); track c.id) {
                @if (c.id !== editingId()) {
                  <option [ngValue]="c.id">{{ c.name }}</option>
                }
              }
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea rows="2" name="description" class="form-control" [(ngModel)]="form.description"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Category Tile Artwork</label>
            <select name="image_url" class="form-control" [(ngModel)]="form.image_url">
              <option value="/uploads/products/cat-mens.svg">Menswear Artwork</option>
              <option value="/uploads/products/cat-womens.svg">Womenswear Artwork</option>
              <option value="/uploads/products/cat-unisex.svg">Unisex / Heritage Artwork</option>
            </select>
          </div>
          <div class="btn-row">
            <button type="submit" class="btn btn-primary btn-sm">
              {{ editingId() ? 'Update Category' : 'Create Category' }}
            </button>
            @if (editingId()) {
              <button type="button" class="btn btn-secondary btn-sm" (click)="resetForm()">Cancel</button>
            }
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .page-head { margin-bottom: 1.5rem; }
    .cat-layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.75rem;
      @media (min-width: 992px) {
        grid-template-columns: 1.3fr 0.7fr;
      }
    }
    .table-card, .form-card {
      background: var(--color-white);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 1.25rem;
      height: fit-content;
    }
    .form-card h3 { font-size: 0.9rem; text-transform: uppercase; margin-bottom: 1rem; }
    .admin-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.85rem;
      th, td { padding: 0.75rem; border-bottom: 1px solid var(--color-border); text-align: left; }
      th { font-size: 0.73rem; text-transform: uppercase; background: var(--color-alabaster); }
    }
    .row-actions, .btn-row { display: flex; gap: 0.5rem; }
  `],
})
export class AdminCategoriesComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly categories = signal<Category[]>([]);
  readonly editingId = signal<number | null>(null);

  form = {
    name: '',
    slug: '',
    parent_id: null as number | null,
    description: '',
    image_url: '/uploads/products/cat-mens.svg',
    is_active: 1,
  };

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.adminService.getCategories().subscribe((res) => {
      if (res.success && Array.isArray(res.data)) {
        this.categories.set(res.data);
      }
    });
  }

  editCategory(c: Category): void {
    this.editingId.set(c.id);
    this.form = {
      name: c.name,
      slug: c.slug || '',
      parent_id: c.parent_id || null,
      description: c.description || '',
      image_url: c.image_url || '/uploads/products/cat-mens.svg',
      is_active: c.is_active ? 1 : 0,
    };
  }

  resetForm(): void {
    this.editingId.set(null);
    this.form = {
      name: '',
      slug: '',
      parent_id: null,
      description: '',
      image_url: '/uploads/products/cat-mens.svg',
      is_active: 1,
    };
  }

  saveCategory(): void {
    if (!this.form.name.trim()) return;
    const id = this.editingId();
    if (id) {
      this.adminService.updateCategory(id, this.form).subscribe({
        next: () => {
          this.toast.success('Category updated.');
          this.resetForm();
          this.loadCategories();
        },
        error: (err) => this.toast.error(err?.error?.message || 'Update failed.'),
      });
    } else {
      this.adminService.createCategory(this.form).subscribe({
        next: () => {
          this.toast.success('Category created.');
          this.resetForm();
          this.loadCategories();
        },
        error: (err) => this.toast.error(err?.error?.message || 'Creation failed.'),
      });
    }
  }

  deleteCategory(c: Category): void {
    if (!confirm(`Are you sure you want to delete category "${c.name}"?`)) return;
    this.adminService.deleteCategory(c.id).subscribe({
      next: () => {
        this.toast.info(`Deleted category "${c.name}".`);
        this.loadCategories();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Cannot delete category.'),
    });
  }
}
