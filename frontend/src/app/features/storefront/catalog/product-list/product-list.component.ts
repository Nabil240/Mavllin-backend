import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { Category, PaginationMeta, Product } from '../../../../core/models/api.models';
import { CatalogService } from '../../../../core/services/catalog.service';
import { ProductCardComponent } from '../../../../shared/components/product-card/product-card.component';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProductCardComponent],
  template: `
    <div class="catalog-page container">
      <!-- Breadcrumb & Title Header -->
      <header class="catalog-header">
        <div class="breadcrumb">
          <a routerLink="/">Home</a>
          <span>/</span>
          <span>{{ pageHeading() }}</span>
        </div>
        <div class="header-row">
          <div>
            <h1 class="section-heading">{{ pageHeading() }}</h1>
            <p class="section-subtitle">
              Showing {{ products().length }} of {{ meta()?.total || products().length }} pieces
            </p>
          </div>

          <div class="toolbar-controls">
            <button
              type="button"
              class="btn btn-secondary btn-sm mobile-filter-btn"
              (click)="mobileFiltersOpen.update(v => !v)"
            >
              Filters
            </button>

            <div class="sort-box">
              <label for="sortSelect">Sort by:</label>
              <select
                id="sortSelect"
                class="form-control sort-select"
                [ngModel]="selectedSort()"
                (ngModelChange)="updateFilter({ sort: $event, page: 1 })"
              >
                <option value="newest">Newest Arrivals</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Top Rated</option>
                <option value="name_asc">Alphabetical (A–Z)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Active Filter Chips -->
        @if (hasActiveFilters()) {
          <div class="active-chips">
            @if (selectedCategorySlug()) {
              <button type="button" class="chip" (click)="updateFilter({ categorySlug: null, page: 1 })">
                Department: {{ selectedCategorySlug() }} &times;
              </button>
            }
            @if (searchQuery()) {
              <button type="button" class="chip" (click)="updateFilter({ search: null, page: 1 })">
                Search: "{{ searchQuery() }}" &times;
              </button>
            }
            @if (selectedSize()) {
              <button type="button" class="chip" (click)="updateFilter({ size: null, page: 1 })">
                Size: {{ selectedSize() }} &times;
              </button>
            }
            @if (selectedColor()) {
              <button type="button" class="chip" (click)="updateFilter({ color: null, page: 1 })">
                Color: {{ selectedColor() }} &times;
              </button>
            }
            @if (inStockOnly()) {
              <button type="button" class="chip" (click)="updateFilter({ inStock: null, page: 1 })">
                In Stock Only &times;
              </button>
            }
            @if (minPrice() || maxPrice()) {
              <button type="button" class="chip" (click)="updateFilter({ minPrice: null, maxPrice: null, page: 1 })">
                Price: ৳{{ minPrice() || '0' }} – ৳{{ maxPrice() || 'Any' }} &times;
              </button>
            }
            <button type="button" class="reset-link" (click)="resetAllFilters()">
              Reset All Filters
            </button>
          </div>
        }
      </header>

      <div class="catalog-layout">
        <!-- Sidebar Filters -->
        <aside class="filter-sidebar" [class.open]="mobileFiltersOpen()">
          <div class="filter-group">
            <h4>Search Keyword / SKU</h4>
            <div class="search-inline">
              <input
                type="search"
                class="form-control"
                placeholder="Linen, Panjabi, SKU..."
                [ngModel]="searchInput()"
                (ngModelChange)="searchInput.set($event)"
                (keyup.enter)="updateFilter({ search: searchInput() || null, page: 1 })"
              />
              <button
                type="button"
                class="btn btn-primary btn-sm"
                (click)="updateFilter({ search: searchInput() || null, page: 1 })"
              >
                Go
              </button>
            </div>
          </div>

          <div class="filter-group">
            <h4>Departments</h4>
            <ul class="category-filter-list">
              <li>
                <button
                  type="button"
                  [class.active]="!selectedCategorySlug()"
                  (click)="updateFilter({ categorySlug: null, page: 1 })"
                >
                  All Collections
                </button>
              </li>
              @for (cat of categories(); track cat.id) {
                <li>
                  <button
                    type="button"
                    [class.active]="selectedCategorySlug() === cat.slug"
                    (click)="updateFilter({ categorySlug: cat.slug, page: 1 })"
                  >
                    {{ cat.name }}
                  </button>
                </li>
              }
            </ul>
          </div>

          <div class="filter-group">
            <h4>Size</h4>
            <div class="size-grid">
              @for (sz of sizeOptions; track sz) {
                <button
                  type="button"
                  class="size-chip"
                  [class.active]="selectedSize() === sz"
                  (click)="updateFilter({ size: selectedSize() === sz ? null : sz, page: 1 })"
                >
                  {{ sz }}
                </button>
              }
            </div>
          </div>

          <div class="filter-group">
            <h4>Color Palette</h4>
            <div class="color-list">
              @for (clr of colorOptions; track clr) {
                <button
                  type="button"
                  class="color-chip"
                  [class.active]="selectedColor() === clr"
                  (click)="updateFilter({ color: selectedColor() === clr ? null : clr, page: 1 })"
                >
                  {{ clr }}
                </button>
              }
            </div>
          </div>

          <div class="filter-group">
            <h4>Price Range (৳)</h4>
            <div class="price-inputs">
              <input
                type="number"
                class="form-control"
                placeholder="Min"
                [ngModel]="minPriceInput()"
                (ngModelChange)="minPriceInput.set($event)"
              />
              <span>&ndash;</span>
              <input
                type="number"
                class="form-control"
                placeholder="Max"
                [ngModel]="maxPriceInput()"
                (ngModelChange)="maxPriceInput.set($event)"
              />
              <button
                type="button"
                class="btn btn-outline btn-sm"
                (click)="updateFilter({ minPrice: minPriceInput() || null, maxPrice: maxPriceInput() || null, page: 1 })"
              >
                Apply
              </button>
            </div>
          </div>

          <div class="filter-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                [checked]="inStockOnly()"
                (change)="updateFilter({ inStock: !inStockOnly() ? 'true' : null, page: 1 })"
              />
              <span>In-Stock Ready to Ship Only</span>
            </label>
          </div>
        </aside>

        <!-- Product Grid Area -->
        <div class="catalog-results">
          @if (loading()) {
            <div class="products-grid">
              @for (i of [1,2,3,4,5,6]; track i) {
                <div class="skeleton-box"></div>
              }
            </div>
          } @else if (products().length === 0) {
            <div class="no-results">
              <h3>No matching pieces found</h3>
              <p>Try clearing some filters or searching for another style or SKU.</p>
              <button type="button" class="btn btn-primary" (click)="resetAllFilters()">
                Reset All Filters
              </button>
            </div>
          } @else {
            <div class="products-grid">
              @for (product of products(); track product.id) {
                <app-product-card [product]="product" />
              }
            </div>

            @if (meta() && meta()!.totalPages > 1) {
              <nav class="pagination-bar" aria-label="Catalog pagination">
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  [disabled]="!meta()!.hasPrev"
                  (click)="updateFilter({ page: currentPage() - 1 })"
                >
                  &larr; Previous
                </button>
                <span class="page-indicator tabular-price">
                  Page {{ meta()!.page }} of {{ meta()!.totalPages }}
                </span>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  [disabled]="!meta()!.hasNext"
                  (click)="updateFilter({ page: currentPage() + 1 })"
                >
                  Next &rarr;
                </button>
              </nav>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .catalog-page {
      padding-top: 2rem;
      padding-bottom: 3rem;
    }
    .catalog-header {
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 1.25rem;
      margin-bottom: 2rem;
    }
    .breadcrumb {
      display: flex;
      gap: 0.45rem;
      font-size: 0.76rem;
      color: var(--color-text-muted);
      margin-bottom: 0.65rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .header-row {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-end;
      gap: 1rem;
    }
    .toolbar-controls {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .mobile-filter-btn {
      @media (min-width: 992px) {
        display: none;
      }
    }
    .sort-box {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      label {
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--color-text-muted);
        white-space: nowrap;
      }
    }
    .sort-select {
      width: auto;
      padding: 0.45rem 0.75rem;
      font-size: 0.82rem;
    }
    .active-chips {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      margin-top: 1rem;
    }
    .chip {
      padding: 0.3rem 0.7rem;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: 99px;
      font-size: 0.76rem;
      font-weight: 600;
      color: var(--color-onyx);
      &:hover {
        border-color: var(--color-onyx);
      }
    }
    .reset-link {
      font-size: 0.76rem;
      font-weight: 700;
      color: var(--color-berry);
      text-decoration: underline;
      margin-left: 0.35rem;
    }

    .catalog-layout {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2.25rem;
      @media (min-width: 992px) {
        grid-template-columns: 260px 1fr;
      }
    }
    .filter-sidebar {
      display: none;
      flex-direction: column;
      gap: 1.5rem;

      &.open {
        display: flex;
        padding: 1.25rem;
        background: var(--color-alabaster);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
      }
      @media (min-width: 992px) {
        display: flex;
      }
    }
    .filter-group {
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 1.25rem;

      h4 {
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 0.75rem;
      }
    }
    .search-inline {
      display: flex;
      gap: 0.4rem;
    }
    .category-filter-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;

      button {
        font-size: 0.85rem;
        color: var(--color-text-muted);
        text-align: left;
        width: 100%;
        padding: 0.2rem 0;
        &.active {
          color: var(--color-onyx);
          font-weight: 700;
        }
      }
    }
    .size-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.4rem;
    }
    .size-chip,
    .color-chip {
      padding: 0.4rem 0.6rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      font-size: 0.76rem;
      font-weight: 600;
      background: var(--color-white);
      color: var(--color-onyx);

      &.active {
        background: var(--color-onyx);
        color: var(--color-white);
        border-color: var(--color-onyx);
      }
    }
    .color-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }
    .price-inputs {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      input {
        padding: 0.45rem;
        font-size: 0.8rem;
      }
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      font-size: 0.84rem;
      font-weight: 500;
      cursor: pointer;
    }

    .products-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem;
      @media (min-width: 768px) {
        grid-template-columns: repeat(3, 1fr);
        gap: 1.5rem;
      }
    }
    .skeleton-box {
      aspect-ratio: 3 / 4;
      background: var(--color-alabaster);
      border-radius: var(--radius-sm);
    }
    .no-results {
      text-align: center;
      padding: 4rem 1.5rem;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }
    .pagination-bar {
      margin-top: 2.5rem;
      padding-top: 1.5rem;
      border-top: 1px solid var(--color-border);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.25rem;
    }
    .page-indicator {
      font-size: 0.85rem;
      font-weight: 600;
    }
  `],
})
export class ProductListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogService);

  readonly categories = signal<Category[]>([]);
  readonly products = signal<Product[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly loading = signal<boolean>(true);
  readonly mobileFiltersOpen = signal<boolean>(false);

  // Synced filter state
  readonly selectedCategorySlug = signal<string | null>(null);
  readonly searchQuery = signal<string | null>(null);
  readonly selectedSize = signal<string | null>(null);
  readonly selectedColor = signal<string | null>(null);
  readonly minPrice = signal<string | null>(null);
  readonly maxPrice = signal<string | null>(null);
  readonly inStockOnly = signal<boolean>(false);
  readonly selectedSort = signal<string>('newest');
  readonly currentPage = signal<number>(1);

  // Form buffer signals
  readonly searchInput = signal<string>('');
  readonly minPriceInput = signal<string>('');
  readonly maxPriceInput = signal<string>('');

  readonly sizeOptions = ['S', 'M', 'L', 'XL', 'XXL', '30', '32', '34', '36'];
  readonly colorOptions = ['Onyx Black', 'Ivory', 'Olive', 'Sand', 'Navy', 'Charcoal', 'Burgundy', 'Indigo'];

  readonly pageHeading = computed(() => {
    const slug = this.selectedCategorySlug();
    if (slug) {
      const cat = this.categories().find((c) => c.slug === slug);
      return cat ? cat.name : slug.replace(/-/g, ' ').toUpperCase();
    }
    if (this.searchQuery()) {
      return `SEARCH: "${this.searchQuery()}"`;
    }
    return 'ALL SEASONAL DROPS';
  });

  readonly hasActiveFilters = computed(
    () =>
      !!this.selectedCategorySlug() ||
      !!this.searchQuery() ||
      !!this.selectedSize() ||
      !!this.selectedColor() ||
      !!this.minPrice() ||
      !!this.maxPrice() ||
      this.inStockOnly()
  );

  ngOnInit(): void {
    this.catalog.getCategories(true).subscribe((res) => {
      if (res.success && Array.isArray(res.data)) {
        this.categories.set(res.data);
      }
    });

    combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([params, query]) => {
      const routeSlug = params.get('slug');
      const querySlug = query.get('categorySlug') || query.get('category');
      const catSlug = routeSlug || querySlug || null;

      const search = query.get('search') || query.get('q') || null;
      const size = query.get('size') || null;
      const color = query.get('color') || null;
      const minP = query.get('minPrice') || null;
      const maxP = query.get('maxPrice') || null;
      const inStock = query.get('inStock') === 'true' || query.get('inStock') === '1';
      const sort = query.get('sort') || 'newest';
      const page = Math.max(1, Number(query.get('page') || 1));

      this.selectedCategorySlug.set(catSlug);
      this.searchQuery.set(search);
      this.searchInput.set(search || '');
      this.selectedSize.set(size);
      this.selectedColor.set(color);
      this.minPrice.set(minP);
      this.maxPrice.set(maxP);
      this.minPriceInput.set(minP || '');
      this.maxPriceInput.set(maxP || '');
      this.inStockOnly.set(inStock);
      this.selectedSort.set(sort);
      this.currentPage.set(page);

      this.fetchCatalog();
    });
  }

  private fetchCatalog(): void {
    this.loading.set(true);
    this.catalog
      .getProducts({
        page: this.currentPage(),
        limit: 12,
        categorySlug: this.selectedCategorySlug(),
        search: this.searchQuery(),
        size: this.selectedSize(),
        color: this.selectedColor(),
        minPrice: this.minPrice(),
        maxPrice: this.maxPrice(),
        inStock: this.inStockOnly() ? 'true' : null,
        sort: this.selectedSort(),
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          if (res.success && Array.isArray(res.data)) {
            this.products.set(res.data);
            this.meta.set(res.meta || null);
          }
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  updateFilter(changes: Record<string, string | number | null>): void {
    const nextParams: Record<string, string | number | null> = {
      categorySlug: this.selectedCategorySlug(),
      search: this.searchQuery(),
      size: this.selectedSize(),
      color: this.selectedColor(),
      minPrice: this.minPrice(),
      maxPrice: this.maxPrice(),
      inStock: this.inStockOnly() ? 'true' : null,
      sort: this.selectedSort() !== 'newest' ? this.selectedSort() : null,
      page: this.currentPage() > 1 ? this.currentPage() : null,
      ...changes,
    };

    this.router.navigate(['/catalog'], {
      queryParams: nextParams,
    });
  }

  resetAllFilters(): void {
    this.searchInput.set('');
    this.minPriceInput.set('');
    this.maxPriceInput.set('');
    this.router.navigate(['/catalog']);
  }
}
