import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WishlistService } from '../../../../core/services/wishlist.service';
import { ProductCardComponent } from '../../../../shared/components/product-card/product-card.component';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductCardComponent],
  template: `
    <div class="wishlist-page container">
      <header class="page-head">
        <h1 class="section-heading">SAVED WISHLIST ({{ wishlist.count() }})</h1>
        <p class="section-subtitle">Pieces you have bookmarked for your wardrobe</p>
      </header>

      @if (wishlist.items().length === 0) {
        <div class="empty-wishlist">
          <h3>Your wishlist is empty</h3>
          <p>Tap the heart icon on any garment card to save it here for later.</p>
          <a routerLink="/catalog" class="btn btn-primary">Explore Collection</a>
        </div>
      } @else {
        <div class="wishlist-grid">
          @for (product of wishlist.items(); track product.id) {
            <app-product-card [product]="product" />
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .wishlist-page {
      padding-top: 2.5rem;
      padding-bottom: 4rem;
    }
    .page-head {
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 1.25rem;
      margin-bottom: 2rem;
    }
    .empty-wishlist {
      text-align: center;
      padding: 4rem 1.5rem;
      background: var(--color-alabaster);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.85rem;
    }
    .wishlist-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.25rem;
      @media (min-width: 768px) {
        grid-template-columns: repeat(4, 1fr);
        gap: 1.5rem;
      }
    }
  `],
})
export class WishlistComponent {
  readonly wishlist = inject(WishlistService);
}
