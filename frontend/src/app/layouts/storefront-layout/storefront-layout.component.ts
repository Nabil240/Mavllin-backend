import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { CartDrawerComponent } from '../../shared/components/cart-drawer/cart-drawer.component';
import { PromoPopupComponent } from '../../shared/components/promo-popup/promo-popup.component';

@Component({
  selector: 'app-storefront-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, CartDrawerComponent, PromoPopupComponent],
  template: `
    <div class="storefront-shell">
      <app-navbar />
      <app-cart-drawer />
      <app-promo-popup />
      <main class="storefront-main">
        <router-outlet />
      </main>
      <app-footer />
    </div>
  `,
  styles: [`
    .storefront-shell {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .storefront-main {
      flex: 1;
    }
  `],
})
export class StorefrontLayoutComponent {}
