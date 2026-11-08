import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Category, Product } from '../../../core/models/api.models';
import { AdminService } from '../../../core/services/admin.service';
import { ToastService } from '../../../core/services/toast.service';
import { BdtCurrencyPipe } from '../../../shared/pipes/bdt.pipe';

interface VariantDraft {
  id?: number;
  sku: string;
  size: string;
  color: string;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
}

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, BdtCurrencyPipe],
  template: `
    <div class="admin-products">
      <div class="page-head">
        <div>
          <h1 class="section-heading">PRODUCTS &amp; MULTI-VARIANT SKUs</h1>
          <p class="section-subtitle">Manage catalog garments, pricing, sizes, colors, and SKU stock</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" (click)="openCreateModal()">
          + Create Product &amp; Variants
        </button>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar">
        <input
          type="search"
          class="form-control"
          placeholder="Search product name or SKU..."
          [(ngModel)]="searchTerm"
          (keyup.enter)="loadProducts()"
        />
        <select class="form-control" [(ngModel)]="selectedCategoryId" (change)="loadProducts()">
          <option value="">All Categories</option>
          @for (c of categories(); track c.id) {
            <option [value]="c.id">{{ c.name }}</option>
          }
        </select>
        <button type="button" class="btn btn-secondary btn-sm" (click)="loadProducts()">Filter</button>
      </div>

      <!-- Products Table -->
      <div class="table-card">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Garment</th>
              <th>Department</th>
              <th>Base Price</th>
              <th>Variants (SKU / Size / Color)</th>
              <th>Total Stock</th>
              <th>Featured</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (p of products(); track p.id) {
              <tr>
                <td>
                  <div class="prod-cell">
                    <img [src]="p.thumbnail_url || '/uploads/products/prod-overshirt-1.svg'" [alt]="p.name" />
                    <div>
                      <strong>{{ p.name }}</strong>
                      <div class="slug-sub">/{{ p.slug }}</div>
                    </div>
                  </div>
                </td>
                <td>{{ p.category_name || 'Uncategorized' }}</td>
                <td class="tabular-price font-bold">{{ Number(p.base_price || p.price) | bdt }}</td>
                <td>
                  <div class="variant-pills">
                    @for (v of (p.variants || []).slice(0, 4); track v.id) {
                      <span class="v-pill">{{ v.sku }} ({{ v.size }}/{{ v.color }}: {{ v.stock_quantity }})</span>
                    }
                    @if ((p.variants?.length || 0) > 4) {
                      <span class="v-pill">+{{ (p.variants?.length || 0) - 4 }} more</span>
                    }
                  </div>
                </td>
                <td>
                  <span class="badge" [class]="Number(p.total_stock) > 0 ? 'badge-stock' : 'badge-danger'">
                    {{ p.total_stock ?? 0 }} units
                  </span>
                </td>
                <td>{{ p.is_featured ? 'Yes' : 'No' }}</td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="openEditModal(p)">Edit</button>
                    <button type="button" class="btn btn-danger btn-sm" (click)="deleteProduct(p)">Delete</button>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Create / Edit Product Modal -->
    @if (modalOpen()) {
      <div class="modal-backdrop" (click)="modalOpen.set(false)">
        <div class="modal-card wide-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>{{ editingProductId() ? 'EDIT PRODUCT & VARIANTS' : 'CREATE NEW PRODUCT & VARIANTS' }}</h3>
            <button type="button" (click)="modalOpen.set(false)">&times;</button>
          </div>
          <form (ngSubmit)="saveProduct()">
            <div class="modal-body">
              <div class="form-grid-2">
                <div class="form-group">
                  <label class="form-label">Product Name *</label>
                  <input type="text" name="name" class="form-control" [(ngModel)]="form.name" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Category *</label>
                  <select name="category_id" class="form-control" [(ngModel)]="form.category_id">
                    <option [ngValue]="null">Select Category</option>
                    @for (c of categories(); track c.id) {
                      <option [ngValue]="c.id">{{ c.name }}</option>
                    }
                  </select>
                </div>
              </div>

              <div class="form-grid-3">
                <div class="form-group">
                  <label class="form-label">Base Price (৳) *</label>
                  <input type="number" step="0.01" name="base_price" class="form-control" [(ngModel)]="form.base_price" required />
                </div>
                <div class="form-group">
                  <label class="form-label">Preset Studio Artwork (SVG)</label>
                  <select name="thumbnail_url" class="form-control" [(ngModel)]="form.thumbnail_url">
                    @for (svg of presetImages; track svg.url) {
                      <option [value]="svg.url">{{ svg.label }}</option>
                    }
                  </select>
                </div>
                <div class="form-group checkbox-group">
                  <label>
                    <input type="checkbox" name="is_featured" [(ngModel)]="form.is_featured" />
                    <span>Featured on Homepage</span>
                  </label>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Short Description</label>
                <input type="text" name="short_description" class="form-control" [(ngModel)]="form.short_description" />
              </div>

              <div class="form-group">
                <label class="form-label">Full Description &amp; Fabric Notes</label>
                <textarea rows="2" name="description" class="form-control" [(ngModel)]="form.description"></textarea>
              </div>

              <!-- Multi-Variant Row Builder -->
              <div class="variants-builder">
                <div class="vb-head">
                  <h4>Sellable SKU Variants (Size / Color / Price / Stock)</h4>
                  <button type="button" class="btn btn-outline btn-sm" (click)="addVariantRow()">
                    + Add Variant Row
                  </button>
                </div>

                <table class="vb-table">
                  <thead>
                    <tr>
                      <th>SKU *</th>
                      <th>Size *</th>
                      <th>Color *</th>
                      <th>Price (৳) *</th>
                      <th>Compare (৳)</th>
                      <th>Initial Stock *</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (v of variantRows(); track $index; let idx = $index) {
                      <tr>
                        <td><input type="text" class="form-control" [ngModel]="v.sku" (ngModelChange)="v.sku = $event" [ngModelOptions]="{standalone: true}" required /></td>
                        <td><input type="text" class="form-control" [ngModel]="v.size" (ngModelChange)="v.size = $event" [ngModelOptions]="{standalone: true}" placeholder="M / L / XL" required /></td>
                        <td><input type="text" class="form-control" [ngModel]="v.color" (ngModelChange)="v.color = $event" [ngModelOptions]="{standalone: true}" placeholder="Onyx Black" required /></td>
                        <td><input type="number" step="0.01" class="form-control" [ngModel]="v.price" (ngModelChange)="v.price = Number($event)" [ngModelOptions]="{standalone: true}" required /></td>
                        <td><input type="number" step="0.01" class="form-control" [ngModel]="v.compare_at_price" (ngModelChange)="v.compare_at_price = $event ? Number($event) : null" [ngModelOptions]="{standalone: true}" /></td>
                        <td><input type="number" class="form-control" [ngModel]="v.stock_quantity" (ngModelChange)="v.stock_quantity = Number($event)" [ngModelOptions]="{standalone: true}" required /></td>
                        <td>
                          @if (variantRows().length > 1) {
                            <button type="button" class="remove-row-btn" (click)="removeVariantRow(idx)">&times;</button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-secondary btn-sm" (click)="modalOpen.set(false)">Cancel</button>
              <button type="submit" class="btn btn-primary btn-sm">
                {{ editingProductId() ? 'Save Changes' : 'Create Product' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
  styles: [`
    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 1.5rem;
    }
    .filter-bar {
      display: grid;
      grid-template-columns: 1fr 220px auto;
      gap: 0.75rem;
      margin-bottom: 1.25rem;
      max-width: 720px;
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
      th, td {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid var(--color-border);
        text-align: left;
        vertical-align: middle;
      }
      th { background: var(--color-alabaster); font-size: 0.73rem; text-transform: uppercase; letter-spacing: 0.06em; }
    }
    .prod-cell {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      img { width: 42px; height: 54px; object-fit: cover; border-radius: 3px; border: 1px solid var(--color-border); }
      .slug-sub { font-size: 0.74rem; color: var(--color-text-light); }
    }
    .variant-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      max-width: 340px;
    }
    .v-pill {
      font-size: 0.7rem;
      padding: 0.15rem 0.45rem;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: 3px;
    }
    .row-actions { display: flex; gap: 0.4rem; }
    .wide-modal { max-width: 880px; }
    .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .form-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; align-items: center; }
    .checkbox-group { padding-top: 1rem; label { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.85rem; } }
    .variants-builder {
      margin-top: 1.25rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      padding: 1rem;
      background: var(--color-alabaster);
    }
    .vb-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.85rem;
      h4 { font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.06em; }
    }
    .vb-table {
      width: 100%;
      border-collapse: collapse;
      th, td { padding: 0.35rem; font-size: 0.76rem; text-align: left; }
      input { padding: 0.45rem 0.6rem; font-size: 0.8rem; }
    }
    .remove-row-btn { color: var(--color-berry); font-size: 1.25rem; font-weight: 700; }
  `],
})
export class AdminProductsComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly toast = inject(ToastService);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly modalOpen = signal<boolean>(false);
  readonly editingProductId = signal<number | null>(null);
  readonly variantRows = signal<VariantDraft[]>([]);
  readonly Number = Number;

  searchTerm = '';
  selectedCategoryId = '';

  readonly presetImages = [
    { label: 'Embroidered Heritage Panjabi', url: '/uploads/products/prod-panjabi-1.svg' },
    { label: 'Structured Cotton Overshirt', url: '/uploads/products/prod-overshirt-1.svg' },
    { label: 'Relaxed Linen Camp Shirt', url: '/uploads/products/prod-linen-1.svg' },
    { label: 'Heavyweight Fleece Hoodie', url: '/uploads/products/prod-hoodie-1.svg' },
    { label: 'Organic Crewneck Tee', url: '/uploads/products/prod-crewneck-1.svg' },
    { label: 'Tailored Pleated Chino', url: '/uploads/products/prod-chino-1.svg' },
    { label: 'Selvedge Straight Denim', url: '/uploads/products/prod-jeans-1.svg' },
    { label: 'Utility Cargo Trouser', url: '/uploads/products/prod-cargo-1.svg' },
    { label: 'Merino Knit Polo', url: '/uploads/products/prod-polo-1.svg' },
    { label: 'Ribbed Mockneck Knit', url: '/uploads/products/prod-ribbed-1.svg' },
  ];

  form = {
    name: '',
    category_id: null as number | null,
    base_price: 55,
    thumbnail_url: '/uploads/products/prod-panjabi-1.svg',
    short_description: '',
    description: '',
    is_featured: true,
  };

  ngOnInit(): void {
    this.adminService.getCategories().subscribe((res) => {
      if (res.success && Array.isArray(res.data)) {
        this.categories.set(res.data);
      }
    });
    this.loadProducts();
  }

  loadProducts(): void {
    this.adminService
      .getProducts({
        limit: 50,
        search: this.searchTerm.trim() || undefined,
        categoryId: this.selectedCategoryId || undefined,
      })
      .subscribe((res) => {
        if (res.success && Array.isArray(res.data)) {
          this.products.set(res.data);
        }
      });
  }

  openCreateModal(): void {
    this.editingProductId.set(null);
    const rand = Math.floor(100 + Math.random() * 899);
    this.form = {
      name: '',
      category_id: this.categories()[0]?.id || null,
      base_price: 58,
      thumbnail_url: '/uploads/products/prod-panjabi-1.svg',
      short_description: 'Small-batch artisanal garment crafted in Dhaka.',
      description: 'Tailored from 100% breathable organic cotton with reinforced seams.',
      is_featured: true,
    };
    this.variantRows.set([
      { sku: `ECO-NEW-${rand}-M`, size: 'M', color: 'Onyx Black', price: 58, compare_at_price: 68, stock_quantity: 15 },
      { sku: `ECO-NEW-${rand}-L`, size: 'L', color: 'Onyx Black', price: 58, compare_at_price: 68, stock_quantity: 20 },
    ]);
    this.modalOpen.set(true);
  }

  openEditModal(p: Product): void {
    this.editingProductId.set(p.id);
    this.form = {
      name: p.name,
      category_id: p.category_id || null,
      base_price: Number(p.base_price || p.price || 50),
      thumbnail_url: p.thumbnail_url || '/uploads/products/prod-overshirt-1.svg',
      short_description: p.short_description || '',
      description: p.description || '',
      is_featured: Boolean(p.is_featured),
    };
    const existingVars = (p.variants || []).map((v) => ({
      id: v.id,
      sku: v.sku,
      size: v.size,
      color: v.color,
      price: Number(v.price),
      compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
      stock_quantity: Number(v.stock_quantity),
    }));
    this.variantRows.set(
      existingVars.length > 0
        ? existingVars
        : [{ sku: `ECO-${p.id}-M`, size: 'M', color: 'Default', price: Number(p.base_price), compare_at_price: null, stock_quantity: 10 }]
    );
    this.modalOpen.set(true);
  }

  addVariantRow(): void {
    const idx = this.variantRows().length + 1;
    this.variantRows.update((rows) => [
      ...rows,
      {
        sku: `ECO-SKU-${Date.now().toString().slice(-4)}-${idx}`,
        size: 'XL',
        color: 'Ivory',
        price: Number(this.form.base_price || 58),
        compare_at_price: null,
        stock_quantity: 12,
      },
    ]);
  }

  removeVariantRow(index: number): void {
    this.variantRows.update((rows) => rows.filter((_, i) => i !== index));
  }

  saveProduct(): void {
    const payload = {
      ...this.form,
      variants: this.variantRows(),
    };

    const editId = this.editingProductId();
    if (editId) {
      this.adminService.updateProduct(editId, payload).subscribe({
        next: () => {
          this.toast.success('Product updated successfully.');
          this.modalOpen.set(false);
          this.loadProducts();
        },
        error: (err) => this.toast.error(err?.error?.message || 'Failed to update product.'),
      });
    } else {
      this.adminService.createProduct(payload).subscribe({
        next: () => {
          this.toast.success('Product & SKU variants created.');
          this.modalOpen.set(false);
          this.loadProducts();
        },
        error: (err) => this.toast.error(err?.error?.message || 'Failed to create product.'),
      });
    }
  }

  deleteProduct(p: Product): void {
    this.adminService.deleteProduct(p.id).subscribe({
      next: () => {
        this.toast.info(`Deleted "${p.name}".`);
        this.loadProducts();
      },
      error: (err) => this.toast.error(err?.error?.message || 'Could not delete product.'),
    });
  }
}
