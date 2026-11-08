import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Category, Product, ProductVariant } from '../../../../core/models/api.models';
import { AdminService } from '../../../../core/services/admin.service';
import { ToastService } from '../../../../core/services/toast.service';

interface FormVariantRow {
  id?: number;
  sku: string;
  size: string;
  color: string;
  price: number;
  compare_at_price?: number | null;
  stock_quantity: number;
  is_active: boolean;
}

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="product-form-page">
      <div class="page-head">
        <div>
          <nav class="breadcrumb">
            <a routerLink="/admin/products">Products</a>
            <span class="sep">/</span>
            <span class="current">{{ isEditMode() ? 'Edit Garment & Variants' : 'Create New Garment' }}</span>
          </nav>
          <span class="head-kicker">GARMENT SPECIFICATIONS</span>
          <h1 class="section-heading">
            {{ isEditMode() ? 'EDIT GARMENT: ' + form.name : 'NEW ATELIER PRODUCT &amp; MULTI-VARIANT SKU BUILDER' }}
          </h1>
          <p class="section-subtitle">
            Configure garment details, media assets, pricing, and variant matrix (sizes, colors, and stock quantities).
          </p>
        </div>
        <div class="head-actions">
          <a routerLink="/admin/products" class="btn btn-outline btn-sm">Cancel</a>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            [disabled]="saving() || !form.name.trim() || variants.length === 0"
            (click)="saveProduct()"
          >
            {{ saving() ? 'Saving Product...' : (isEditMode() ? 'Update Garment' : 'Publish Product') }}
          </button>
        </div>
      </div>

      <div class="form-grid">
        <!-- LEFT: General Information -->
        <div class="form-main">
          <section class="card-section">
            <h2 class="section-title">Core Garment Information</h2>

            <div class="form-group">
              <label class="form-label" for="prodName">Garment Name *</label>
              <input
                id="prodName"
                type="text"
                class="form-control"
                name="name"
                [(ngModel)]="form.name"
                (ngModelChange)="onNameChange($event)"
                placeholder="e.g. Signature Cotton Panjabi — Midnight Navy"
                required
              />
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label" for="prodSlug">URL Slug *</label>
                <input
                  id="prodSlug"
                  type="text"
                  class="form-control"
                  name="slug"
                  [(ngModel)]="form.slug"
                  placeholder="e.g. signature-cotton-panjabi-navy"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="prodCat">Department / Category *</label>
                <select id="prodCat" class="form-control" name="category_id" [(ngModel)]="form.category_id" required>
                  <option [ngValue]="null">Select Category</option>
                  @for (c of categories(); track c.id) {
                    <option [ngValue]="c.id">{{ c.name }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label" for="prodBasePrice">Base Price (৳) *</label>
                <input
                  id="prodBasePrice"
                  type="number"
                  step="0.01"
                  class="form-control"
                  name="base_price"
                  [(ngModel)]="form.base_price"
                  placeholder="1250"
                  required
                />
              </div>

              <div class="form-group">
                <label class="form-label" for="prodCompPrice">Compare At Price (৳) (Optional)</label>
                <input
                  id="prodCompPrice"
                  type="number"
                  step="0.01"
                  class="form-control"
                  name="compare_at_price"
                  [(ngModel)]="form.compare_at_price"
                  placeholder="1500"
                />
              </div>
            </div>

            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label" for="prodDiscountType">Promotional Discount Type</label>
                <select id="prodDiscountType" class="form-control" name="discount_type" [(ngModel)]="form.discount_type">
                  <option value="none">No Discount</option>
                  <option value="percentage">Percentage Discount (%)</option>
                  <option value="fixed">Fixed BDT Discount (৳)</option>
                </select>
              </div>

              @if (form.discount_type !== 'none') {
                <div class="form-group">
                  <label class="form-label" for="prodDiscountVal">
                    Discount Value {{ form.discount_type === 'percentage' ? '(%)' : '(৳)' }} *
                  </label>
                  <input
                    id="prodDiscountVal"
                    type="number"
                    step="0.01"
                    min="0"
                    class="form-control"
                    name="discount_value"
                    [(ngModel)]="form.discount_value"
                    placeholder="e.g. 15"
                  />
                </div>
              }
            </div>

            @if (form.discount_type !== 'none') {
              <div class="discount-preview-card">
                <div class="dp-header">Live Discount Preview</div>
                <div class="dp-row">
                  <span>Base Price: <strong>৳{{ form.base_price }}</strong></span>
                  <span>Effective Discounted Price: <strong class="text-emerald">৳{{ calculatedDiscountPrice }}</strong></span>
                  <span>Savings: <strong>৳{{ (form.base_price - calculatedDiscountPrice) | number:'1.2-2' }}</strong></span>
                </div>
              </div>
            }

            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" for="prodAdvanceType">Advance Payment Requirement Policy</label>
              <select id="prodAdvanceType" class="form-control" name="advance_payment_type" [(ngModel)]="form.advance_payment_type">
                <option value="none">Standard / No Advance (Full COD Allowed)</option>
                <option value="thirty_percent">30% Advance Required</option>
                <option value="fifty_percent">50% Advance Required</option>
                <option value="full">100% Full Payment Required (No COD)</option>
                <option value="delivery_charge">Delivery Charge in Advance</option>
              </select>
              <small class="form-text-hint">
                When an advance is mandated, storefront checkout will require customer to pay via Bank / MFS and enter a TrxID.
              </small>
            </div>

            <div class="form-group">
              <label class="form-label" for="prodShortDesc">Short Summary</label>
              <input
                id="prodShortDesc"
                type="text"
                class="form-control"
                name="short_description"
                [(ngModel)]="form.short_description"
                placeholder="Fine Egyptian cotton tailored for contemporary silhouette"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="prodFullDesc">Full Garment Craftsmanship Description</label>
              <textarea
                id="prodFullDesc"
                class="form-control"
                rows="4"
                name="description"
                [(ngModel)]="form.description"
                placeholder="Detailed garment fabric, weave, origin, sizing recommendations, and care instructions..."
              ></textarea>
            </div>
          </section>

          <!-- MULTI-VARIANT MATRIX BUILDER -->
          <section class="card-section">
            <div class="section-header-split">
              <div>
                <h2 class="section-title">Variant Matrix (Sizes, Colors, SKUs, Stock)</h2>
                <p class="section-desc">At least 1 sellable variant with unique SKU and stock quantity is required.</p>
              </div>
              <div class="split-actions">
                <button type="button" class="btn btn-secondary btn-xs" (click)="addVariantRow()">
                  + Add Variant Row
                </button>
                <button type="button" class="btn btn-outline btn-xs" (click)="showGenerator.set(!showGenerator())">
                  {{ showGenerator() ? 'Hide Generator' : 'Matrix Generator' }}
                </button>
              </div>
            </div>

            <!-- Quick Matrix Generator Tool -->
            @if (showGenerator()) {
              <div class="generator-box">
                <div class="gen-head">
                  <strong>Batch Combination Generator</strong>
                  <span>Select sizes and colors to generate rows automatically</span>
                </div>
                <div class="gen-grid">
                  <div>
                    <label class="gen-lbl">Sizes (comma-separated):</label>
                    <input type="text" class="form-control" [(ngModel)]="genSizes" placeholder="S, M, L, XL" />
                  </div>
                  <div>
                    <label class="gen-lbl">Colors (comma-separated):</label>
                    <input type="text" class="form-control" [(ngModel)]="genColors" placeholder="Black, Navy, White" />
                  </div>
                  <div>
                    <label class="gen-lbl">Default Stock per Variant:</label>
                    <input type="number" class="form-control" [(ngModel)]="genDefaultStock" placeholder="20" />
                  </div>
                </div>
                <button type="button" class="btn btn-primary btn-xs" style="margin-top: 0.75rem;" (click)="generateMatrix()">
                  Generate Combinations
                </button>
              </div>
            }

            <div class="variants-table-responsive">
              <table class="variants-table">
                <thead>
                  <tr>
                    <th>SKU *</th>
                    <th>Size *</th>
                    <th>Color *</th>
                    <th>Price (৳) *</th>
                    <th>Compare (৳)</th>
                    <th>Stock Qty *</th>
                    <th>Active</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (v of variants; track $index) {
                    <tr>
                      <td>
                        <input
                          type="text"
                          class="table-input sku-input"
                          [(ngModel)]="v.sku"
                          placeholder="MAV-SHIRT-BLK-M"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          class="table-input"
                          [(ngModel)]="v.size"
                          placeholder="M"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          class="table-input"
                          [(ngModel)]="v.color"
                          placeholder="Black"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          class="table-input num-input"
                          [(ngModel)]="v.price"
                          required
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          class="table-input num-input"
                          [(ngModel)]="v.compare_at_price"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          class="table-input num-input"
                          [(ngModel)]="v.stock_quantity"
                          min="0"
                          required
                        />
                      </td>
                      <td class="text-center">
                        <input type="checkbox" [(ngModel)]="v.is_active" />
                      </td>
                      <td>
                        <button
                          type="button"
                          class="btn-del"
                          (click)="removeVariantRow($index)"
                          [disabled]="variants.length <= 1"
                          title="Remove variant"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <!-- RIGHT: Media & Publishing Controls -->
        <div class="form-side">
          <!-- Publishing Status -->
          <section class="card-section">
            <h2 class="section-title">Publishing &amp; Visibility</h2>
            <div class="toggle-row">
              <label class="toggle-label" for="pubActive">Active in Storefront</label>
              <input type="checkbox" id="pubActive" [(ngModel)]="form.is_active" />
            </div>
            <div class="toggle-row">
              <label class="toggle-label" for="pubFeatured">Featured on Homepage</label>
              <input type="checkbox" id="pubFeatured" [(ngModel)]="form.is_featured" />
            </div>
          </section>

          <!-- Media Assets -->
          <section class="card-section">
            <h2 class="section-title">Imagery &amp; Media Assets</h2>

            <div class="form-group">
              <label class="form-label" for="prodThumb">Primary Thumbnail URL</label>
              <input
                id="prodThumb"
                type="text"
                class="form-control"
                [(ngModel)]="form.thumbnail_url"
                placeholder="/uploads/products/panjabi-01.webp"
              />
              @if (form.thumbnail_url) {
                <div class="img-preview">
                  <img [src]="form.thumbnail_url" alt="Primary Thumbnail Preview" />
                </div>
              }
            </div>

            <div class="form-group">
              <label class="form-label" for="prodSecImg">Secondary Hover Image URL</label>
              <input
                id="prodSecImg"
                type="text"
                class="form-control"
                [(ngModel)]="form.secondary_image_url"
                placeholder="/uploads/products/panjabi-02.webp"
              />
              @if (form.secondary_image_url) {
                <div class="img-preview">
                  <img [src]="form.secondary_image_url" alt="Secondary Hover Preview" />
                </div>
              }
            </div>
          </section>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .product-form-page {
      padding: 1.5rem 0 4rem;
    }

    .page-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-bottom: 1.5rem;
      border-bottom: 1px solid var(--color-border, #e5e5e5);
      padding-bottom: 1.25rem;
    }

    .head-kicker {
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.14em;
      color: var(--color-gold, #996515);
      text-transform: uppercase;
      display: block;
      margin-bottom: 0.25rem;
    }

    .breadcrumb {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.5rem;
      color: var(--color-text-muted);

      a { color: var(--color-text-muted); text-decoration: none; &:hover { color: #000; } }
      .current { color: #000; font-weight: 600; }
    }

    .head-actions {
      display: flex;
      gap: 0.5rem;
    }

    .form-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;

      @media (min-width: 992px) {
        grid-template-columns: 1fr 340px;
      }
    }

    .card-section {
      background: #fff;
      border: 1px solid var(--color-border, #e5e5e5);
      border-radius: 2px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .section-title {
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-top: 0;
      margin-bottom: 1.25rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #f0f0f0;
    }

    .section-header-split {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid #f0f0f0;

      .section-title { margin-bottom: 0.25rem; border: none; padding: 0; }
      .section-desc { font-size: 0.78rem; color: #666; margin: 0; }
      .split-actions { display: flex; gap: 0.5rem; }
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
        color: #555;
      }

      .form-control {
        width: 100%;
        padding: 0.65rem 0.85rem;
        font-size: 0.85rem;
        border: 1px solid var(--color-border, #ccc);
        border-radius: 2px;
        background: #fff;
        box-sizing: border-box;
      }
    }

    .form-row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .generator-box {
      background: var(--color-alabaster, #f9f9f9);
      border: 1px dashed var(--color-border, #ccc);
      padding: 1rem;
      margin-bottom: 1.25rem;
      border-radius: 2px;

      .gen-head {
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;
        margin-bottom: 0.75rem;
        span { color: #666; }
      }
      .gen-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 0.75rem;
      }
      .gen-lbl {
        display: block;
        font-size: 0.72rem;
        font-weight: 600;
        margin-bottom: 0.25rem;
      }
    }

    .variants-table-responsive {
      overflow-x: auto;
    }

    .variants-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;

      th {
        text-align: left;
        padding: 0.5rem 0.6rem;
        background: #fafafa;
        border-bottom: 1px solid #e5e5e5;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #666;
      }

      td {
        padding: 0.4rem 0.5rem;
        border-bottom: 1px solid #f0f0f0;
      }

      .table-input {
        width: 100%;
        padding: 0.4rem 0.5rem;
        font-size: 0.82rem;
        border: 1px solid #ccc;
        border-radius: 2px;
        box-sizing: border-box;

        &.num-input { max-width: 90px; }
        &.sku-input { font-family: monospace; font-size: 0.78rem; }
      }

      .btn-del {
        background: none;
        border: none;
        font-size: 1.25rem;
        color: #ef4444;
        cursor: pointer;
        padding: 0.2rem 0.4rem;
        line-height: 1;
        &:disabled { color: #ccc; cursor: not-allowed; }
      }
    }

    .toggle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 0;
      border-bottom: 1px solid #f0f0f0;

      .toggle-label { font-size: 0.85rem; font-weight: 600; }
    }

    .img-preview {
      margin-top: 0.5rem;
      border: 1px solid #e5e5e5;
      padding: 0.25rem;
      background: #fafafa;
      text-align: center;

      img {
        max-width: 100%;
        max-height: 160px;
        object-fit: contain;
      }
    }

    .btn-xs {
      padding: 0.25rem 0.6rem;
      font-size: 0.72rem;
      border-radius: 2px;
    }

    .discount-preview-card {
      background: var(--color-gold-bg, #f9f3e8);
      border: 1px dashed var(--color-gold, #9a6b32);
      border-radius: var(--radius-sm, 4px);
      padding: 0.75rem 1rem;
      margin-bottom: 1rem;
      .dp-header {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--color-gold, #9a6b32);
        margin-bottom: 0.35rem;
      }
      .dp-row {
        display: flex;
        flex-wrap: wrap;
        gap: 1.25rem;
        font-size: 0.85rem;
      }
      .text-emerald {
        color: var(--color-emerald, #047857);
      }
    }

    .form-text-hint {
      display: block;
      font-size: 0.75rem;
      color: var(--color-text-muted, #6e6256);
      margin-top: 0.25rem;
    }
  `],
})
export class ProductFormComponent implements OnInit {
  private readonly adminService = inject(AdminService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly isEditMode = signal<boolean>(false);
  readonly editingId = signal<number | null>(null);
  readonly saving = signal<boolean>(false);
  readonly categories = signal<Category[]>([]);
  readonly showGenerator = signal<boolean>(false);

  // Form State
  form: {
    name: string;
    slug: string;
    category_id: number | null;
    base_price: number;
    compare_at_price: number | null;
    discount_type: 'none' | 'percentage' | 'fixed';
    discount_value: number;
    advance_payment_type: 'none' | 'thirty_percent' | 'fifty_percent' | 'full' | 'delivery_charge';
    short_description: string;
    description: string;
    thumbnail_url: string;
    secondary_image_url: string;
    is_active: boolean;
    is_featured: boolean;
  } = {
    name: '',
    slug: '',
    category_id: null,
    base_price: 80,
    compare_at_price: null,
    discount_type: 'none',
    discount_value: 0,
    advance_payment_type: 'none',
    short_description: '',
    description: '',
    thumbnail_url: '',
    secondary_image_url: '',
    is_active: true,
    is_featured: false,
  };

  get calculatedDiscountPrice(): number {
    const base = Number(this.form.base_price) || 0;
    const type = this.form.discount_type;
    const val = Number(this.form.discount_value) || 0;
    if (type === 'percentage') {
      const clamped = Math.max(0, Math.min(100, val));
      return Math.max(0, Math.round(base * (1 - clamped / 100) * 100) / 100);
    }
    if (type === 'fixed') {
      return Math.max(0, Math.round((base - val) * 100) / 100);
    }
    return base;
  }

  variants: FormVariantRow[] = [
    {
      sku: '',
      size: 'M',
      color: 'Black',
      price: 80,
      compare_at_price: null,
      stock_quantity: 25,
      is_active: true,
    },
  ];

  // Generator inputs
  genSizes = 'S, M, L, XL';
  genColors = 'Black, White';
  genDefaultStock = 20;

  ngOnInit(): void {
    this.loadCategories();

    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode.set(true);
      this.editingId.set(Number(idParam));
      this.loadProductForEdit(Number(idParam));
    }
  }

  loadCategories(): void {
    this.adminService.getCategories().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.categories.set(res.data);
        }
      },
    });
  }

  loadProductForEdit(id: number): void {
    this.adminService.getProducts({ id }).subscribe({
      next: (res) => {
        if (res.success && res.data && res.data.length > 0) {
          const p = res.data[0];
          this.form = {
            name: p.name,
            slug: p.slug,
            category_id: p.category_id || null,
            base_price: Number(p.base_price || p.price),
            compare_at_price: p.compare_at_price ? Number(p.compare_at_price) : null,
            discount_type: p.discount_type || 'none',
            discount_value: p.discount_value != null ? Number(p.discount_value) : 0,
            advance_payment_type: (p.advance_payment_type as any) || 'none',
            short_description: p.short_description || '',
            description: p.description || '',
            thumbnail_url: p.thumbnail_url || '',
            secondary_image_url: p.secondary_image_url || '',
            is_active: Boolean(p.is_active),
            is_featured: Boolean(p.is_featured),
          };

          if (p.variants && p.variants.length > 0) {
            this.variants = p.variants.map((v) => ({
              id: v.id,
              sku: v.sku,
              size: v.size,
              color: v.color,
              price: Number(v.price),
              compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
              stock_quantity: Number(v.stock_quantity),
              is_active: Boolean(v.is_active),
            }));
          }
        }
      },
      error: () => this.toast.error('Unable to load product for editing.'),
    });
  }

  onNameChange(name: string): void {
    if (!this.isEditMode() || !this.form.slug) {
      this.form.slug = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    }
    // Update default SKU if empty
    if (this.variants.length === 1 && !this.variants[0].sku) {
      const prefix = name
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .slice(0, 10);
      this.variants[0].sku = `ECO-${prefix || 'STYLE'}-BLK-M`;
    }
  }

  addVariantRow(): void {
    const slugBase = this.form.slug ? this.form.slug.toUpperCase().slice(0, 8) : 'GARMENT';
    this.variants.push({
      sku: `ECO-${slugBase}-L-${this.variants.length + 1}`,
      size: 'L',
      color: 'Navy',
      price: this.form.base_price,
      compare_at_price: this.form.compare_at_price,
      stock_quantity: 15,
      is_active: true,
    });
  }

  removeVariantRow(index: number): void {
    if (this.variants.length > 1) {
      this.variants.splice(index, 1);
    }
  }

  generateMatrix(): void {
    const sizes = this.genSizes
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    const colors = this.genColors
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    if (sizes.length === 0 || colors.length === 0) {
      this.toast.error('Please enter at least one size and one color.');
      return;
    }

    const slugBase = this.form.slug ? this.form.slug.toUpperCase().slice(0, 8) : 'GARMENT';
    const newRows: FormVariantRow[] = [];

    for (const c of colors) {
      for (const s of sizes) {
        const colorCode = c.toUpperCase().slice(0, 3);
        newRows.push({
          sku: `ECO-${slugBase}-${colorCode}-${s}`,
          size: s,
          color: c,
          price: this.form.base_price,
          compare_at_price: this.form.compare_at_price,
          stock_quantity: Number(this.genDefaultStock) || 20,
          is_active: true,
        });
      }
    }

    this.variants = newRows;
    this.showGenerator.set(false);
    this.toast.success(`Generated ${newRows.length} variant combinations.`);
  }

  saveProduct(): void {
    if (!this.form.name.trim() || !this.form.slug.trim()) {
      this.toast.error('Product name and slug are required.');
      return;
    }

    if (this.variants.length === 0) {
      this.toast.error('At least 1 product variant is required.');
      return;
    }

    // Validate unique SKUs
    const skus = new Set<string>();
    for (const v of this.variants) {
      if (!v.sku.trim()) {
        this.toast.error('All variants must have a non-empty SKU.');
        return;
      }
      if (skus.has(v.sku.trim().toUpperCase())) {
        this.toast.error(`Duplicate SKU detected: ${v.sku}`);
        return;
      }
      skus.add(v.sku.trim().toUpperCase());
    }

    if (this.form.discount_type === 'percentage') {
      const val = Number(this.form.discount_value);
      if (isNaN(val) || val < 0 || val > 100) {
        this.toast.error('Percentage discount must be between 0% and 100%.');
        return;
      }
    } else if (this.form.discount_type === 'fixed') {
      const val = Number(this.form.discount_value);
      if (isNaN(val) || val < 0 || val > Number(this.form.base_price)) {
        this.toast.error('Fixed discount amount cannot exceed base price.');
        return;
      }
    }

    this.saving.set(true);
    const payload = {
      name: this.form.name.trim(),
      slug: this.form.slug.trim(),
      category_id: this.form.category_id,
      base_price: Number(this.form.base_price),
      price: Number(this.form.base_price),
      compare_at_price: this.form.compare_at_price ? Number(this.form.compare_at_price) : null,
      discount_type: this.form.discount_type,
      discount_value: this.form.discount_type !== 'none' ? Number(this.form.discount_value) : 0,
      discount_price: this.form.discount_type !== 'none' ? this.calculatedDiscountPrice : null,
      advance_payment_type: this.form.advance_payment_type,
      short_description: this.form.short_description.trim() || null,
      description: this.form.description.trim() || null,
      thumbnail_url: this.form.thumbnail_url.trim() || null,
      secondary_image_url: this.form.secondary_image_url.trim() || null,
      is_active: this.form.is_active ? 1 : 0,
      is_featured: this.form.is_featured ? 1 : 0,
      variants: this.variants.map((v) => ({
        id: v.id,
        sku: v.sku.trim(),
        size: v.size.trim(),
        color: v.color.trim(),
        price: Number(v.price),
        compare_at_price: v.compare_at_price ? Number(v.compare_at_price) : null,
        stock_quantity: Number(v.stock_quantity),
        is_active: v.is_active ? 1 : 0,
      })),
    };

    if (this.isEditMode() && this.editingId()) {
      this.adminService.updateProduct(this.editingId()!, payload).subscribe({
        next: (res) => {
          this.saving.set(false);
          if (res.success) {
            this.toast.success(`Garment "${payload.name}" updated successfully.`);
            this.router.navigate(['/admin/products']);
          }
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(err?.error?.message || 'Failed to update product.');
        },
      });
    } else {
      this.adminService.createProduct(payload).subscribe({
        next: (res) => {
          this.saving.set(false);
          if (res.success) {
            this.toast.success(`Garment "${payload.name}" published with ${payload.variants.length} variants.`);
            this.router.navigate(['/admin/products']);
          }
        },
        error: (err) => {
          this.saving.set(false);
          this.toast.error(err?.error?.message || 'Failed to create product.');
        },
      });
    }
  }
}
