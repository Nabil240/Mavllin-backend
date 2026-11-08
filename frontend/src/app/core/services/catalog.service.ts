import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';
import {
  ApiResponse,
  Banner,
  Category,
  Product,
  Review,
  ReviewSummary,
} from '../models/api.models';

export interface ProductFilterQuery {
  page?: number;
  limit?: number;
  categoryId?: number | string | null;
  categorySlug?: string | null;
  search?: string | null;
  minPrice?: number | string | null;
  maxPrice?: number | string | null;
  size?: string | null;
  color?: string | null;
  inStock?: boolean | string | null;
  isFeatured?: boolean | string | null;
  sort?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  getBanners(): Observable<ApiResponse<Banner[]>> {
    return this.http.get<ApiResponse<Banner[]>>('/api/v1/banners').pipe(
      catchError(() =>
        of({
          success: true,
          message: 'Fallback banners',
          data: [
            {
              id: 1,
              title: 'AUTUMN / WINTER ARCHIVE 26',
              subtitle: 'Architectural silhouettes crafted from breathable organic cotton, linen, and heritage weaves.',
              badge_text: 'NEW COLLECTION',
              cta_text: 'Explore Collection',
              cta_link: '/catalog',
              image_url: '/uploads/products/banner-hero-1.svg',
              sort_order: 1,
              is_active: 1,
            },
            {
              id: 2,
              title: 'THE HERITAGE PANJABI EDIT',
              subtitle: 'Refined artisanal embroidery and contemporary tailoring for festive occasions.',
              badge_text: 'ARTISAN SERIES',
              cta_text: 'Shop Panjabi',
              cta_link: '/category/heritage-panjabi',
              image_url: '/uploads/products/banner-hero-2.svg',
              sort_order: 2,
              is_active: 1,
            },
            {
              id: 3,
              title: 'ELEVATED EVERYDAY ESSENTIALS',
              subtitle: 'Minimalist overshirts, relaxed chinos, and heavyweight fleece engineered for longevity.',
              badge_text: 'CORE WARDROBE',
              cta_text: 'Shop Menswear',
              cta_link: '/category/menswear',
              image_url: '/uploads/products/banner-hero-3.svg',
              sort_order: 3,
              is_active: 1,
            },
          ],
        })
      )
    );
  }

  getCategories(activeOnly = true): Observable<ApiResponse<Category[]>> {
    const params = new HttpParams().set('activeOnly', String(activeOnly));
    return this.http.get<ApiResponse<Category[]>>('/api/v1/categories', { params });
  }

  getProducts(filters: ProductFilterQuery = {}): Observable<ApiResponse<Product[]>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return this.http.get<ApiResponse<Product[]>>('/api/v1/products', { params });
  }

  getFeaturedProducts(limit = 8): Observable<ApiResponse<Product[]>> {
    const params = new HttpParams().set('limit', String(limit));
    return this.http.get<ApiResponse<Product[]>>('/api/v1/products/featured', { params });
  }

  getProductBySlugOrId(slugOrId: string | number): Observable<ApiResponse<Product>> {
    return this.http.get<ApiResponse<Product>>(`/api/v1/products/${slugOrId}`);
  }

  getProductReviews(
    productId: number,
    page = 1,
    limit = 10
  ): Observable<ApiResponse<{ reviews: Review[]; summary: ReviewSummary }>> {
    const params = new HttpParams().set('page', String(page)).set('limit', String(limit));
    return this.http.get<ApiResponse<{ reviews: Review[]; summary: ReviewSummary }>>(
      `/api/v1/reviews/product/${productId}`,
      { params }
    );
  }

  submitReview(payload: {
    product_id: number;
    rating: number;
    comment: string;
  }): Observable<ApiResponse<Review>> {
    return this.http.post<ApiResponse<Review>>('/api/v1/reviews', payload);
  }
}
