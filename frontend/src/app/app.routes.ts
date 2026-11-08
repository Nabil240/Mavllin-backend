import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/guards/auth.guard';
import { StorefrontLayoutComponent } from './layouts/storefront-layout/storefront-layout.component';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';

// Storefront Components
import { HomeComponent } from './features/storefront/home/home.component';
import { ProductListComponent } from './features/storefront/catalog/product-list/product-list.component';
import { ProductDetailComponent } from './features/storefront/catalog/product-detail/product-detail.component';
import { CartComponent } from './features/storefront/cart/cart.component';
import { CheckoutComponent } from './features/storefront/checkout/checkout.component';
import { TrackOrderComponent } from './features/storefront/track-order/track-order.component';
import { OrderHistoryComponent } from './features/storefront/account/order-history/order-history.component';
import { ProfileComponent } from './features/storefront/account/profile/profile.component';
import { WishlistComponent } from './features/storefront/account/wishlist/wishlist.component';
import { OrderConfirmationComponent } from './features/storefront/orders/order-confirmation.component';
import { InfoPageComponent } from './features/storefront/info/info-page.component';

// Auth Components
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';

// Admin Backoffice Components
import { AdminDashboardComponent } from './features/admin/dashboard/admin-dashboard.component';
import { AdminCategoriesComponent } from './features/admin/categories/admin-categories.component';
import { ProductManageListComponent } from './features/admin/products/product-manage-list/product-manage-list.component';
import { ProductFormComponent } from './features/admin/products/product-form/product-form.component';
import { AdminInventoryComponent } from './features/admin/inventory/admin-inventory.component';
import { AdminOrdersComponent } from './features/admin/orders/admin-orders.component';
import { AdminCustomersComponent } from './features/admin/customers/admin-customers.component';
import { AdminCouponsComponent } from './features/admin/coupons/admin-coupons.component';
import { AdminReportsComponent } from './features/admin/reports/admin-reports.component';
import { AdminDeliverySettingsComponent } from './features/admin/delivery-settings/admin-delivery-settings.component';
import { AdminMessagesComponent } from './features/admin/messages/admin-messages.component';

export const routes: Routes = [
  // Admin Login (Standalone)
  {
    path: 'admin/login',
    component: LoginComponent,
    title: 'Admin Sign In — MAVLLIN',
  },

  // Protected Admin Console Routes
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent, title: 'Executive Dashboard — MAVLLIN Backoffice' },
      { path: 'messages', component: AdminMessagesComponent, title: 'Unified Omnichannel Messages — MAVLLIN Backoffice' },
      { path: 'categories', component: AdminCategoriesComponent, title: 'Categories Hierarchy — MAVLLIN Backoffice' },
      { path: 'products', component: ProductManageListComponent, title: 'Manage Products — MAVLLIN Backoffice' },
      { path: 'products/new', component: ProductFormComponent, title: 'Add New Garment — MAVLLIN Backoffice' },
      { path: 'products/:id/edit', component: ProductFormComponent, title: 'Edit Garment & Variants — MAVLLIN Backoffice' },
      { path: 'products/edit/:id', component: ProductFormComponent, title: 'Edit Garment & Variants — MAVLLIN Backoffice' },
      { path: 'inventory', component: AdminInventoryComponent, title: 'Inventory & Stock Audit — MAVLLIN Backoffice' },
      { path: 'orders', component: AdminOrdersComponent, title: 'Orders & COD Fulfillment — MAVLLIN Backoffice' },
      { path: 'delivery-settings', component: AdminDeliverySettingsComponent, title: 'Regional Delivery Settings — MAVLLIN Backoffice' },
      { path: 'customers', component: AdminCustomersComponent, title: 'Customer Accounts — MAVLLIN Backoffice' },
      { path: 'coupons', component: AdminCouponsComponent, title: 'Promo Coupons — MAVLLIN Backoffice' },
      { path: 'reports', component: AdminReportsComponent, title: 'Sales Reports — MAVLLIN Backoffice' },
    ],
  },

  // Route Aliases
  { path: 'categories/:slug', redirectTo: 'category/:slug', pathMatch: 'full' },
  { path: 'product/:slug', redirectTo: 'products/:slug', pathMatch: 'full' },

  // Storefront Public & Customer Routes
  {
    path: '',
    component: StorefrontLayoutComponent,
    children: [
      { path: '', component: HomeComponent, title: 'MAVLLIN — Contemporary Fashion & Heritage Essentials' },
      { path: 'products', component: ProductListComponent, title: 'Seasonal Collection — MAVLLIN' },
      { path: 'catalog', component: ProductListComponent, title: 'All Drops — MAVLLIN' },
      { path: 'category/:slug', component: ProductListComponent, title: 'Department — MAVLLIN' },
      { path: 'search', component: ProductListComponent, title: 'Search Collection — MAVLLIN' },
      { path: 'products/:slug', component: ProductDetailComponent, title: 'Garment Atelier — MAVLLIN' },
      { path: 'cart', component: CartComponent, title: 'Your Shopping Bag — MAVLLIN' },
      { path: 'checkout', component: CheckoutComponent, title: 'Cash on Delivery Checkout — MAVLLIN' },
      { path: 'track-order', component: TrackOrderComponent, title: 'Live Order Tracker — MAVLLIN' },

      // Protected Customer Account Routes
      {
        path: 'account/orders',
        component: OrderHistoryComponent,
        canActivate: [authGuard],
        title: 'Order History — MAVLLIN',
      },
      {
        path: 'account/profile',
        component: ProfileComponent,
        canActivate: [authGuard],
        title: 'Client Profile & Addresses — MAVLLIN',
      },
      {
        path: 'account/wishlist',
        component: WishlistComponent,
        canActivate: [authGuard],
        title: 'Atelier Wishlist — MAVLLIN',
      },
      {
        path: 'account',
        redirectTo: 'account/orders',
        pathMatch: 'full',
      },
      {
        path: 'wishlist',
        component: WishlistComponent,
        title: 'Atelier Wishlist — MAVLLIN',
      },

      // Auth Routes
      { path: 'auth/login', component: LoginComponent, title: 'Sign In — MAVLLIN' },
      { path: 'auth/register', component: RegisterComponent, title: 'Create Client Account — MAVLLIN' },
      { path: 'auth/forgot-password', component: ForgotPasswordComponent, title: 'Forgot Password — MAVLLIN' },
      { path: 'auth/reset-password', component: ForgotPasswordComponent, title: 'Reset Password — MAVLLIN' },

      // Order confirmation
      {
        path: 'order-confirmation/:orderNumber',
        component: OrderConfirmationComponent,
        title: 'Order Confirmed — MAVLLIN',
      },

      // Atelier Information & Statutory Legal Pages
      { path: 'contact', component: InfoPageComponent, data: { pageType: 'contact' }, title: 'Contact Atelier — MAVLLIN' },
      { path: 'faq', component: InfoPageComponent, data: { pageType: 'faq' }, title: 'FAQ — MAVLLIN' },
      { path: 'shipping-policy', component: InfoPageComponent, data: { pageType: 'shipping' }, title: 'Shipping & Delivery Policy — MAVLLIN' },
      { path: 'returns-policy', component: InfoPageComponent, data: { pageType: 'returns' }, title: 'Return & Refund Policy — MAVLLIN' },
      { path: 'return-policy', component: InfoPageComponent, data: { pageType: 'returns' }, title: 'Return & Refund Policy — MAVLLIN' },
      { path: 'returns', component: InfoPageComponent, data: { pageType: 'returns' }, title: 'Return & Refund Policy — MAVLLIN' },
      { path: 'privacy', component: InfoPageComponent, data: { pageType: 'privacy' }, title: 'Privacy Policy — MAVLLIN' },
      { path: 'terms', component: InfoPageComponent, data: { pageType: 'terms' }, title: 'Terms & Conditions — MAVLLIN' },
    ],
  },

  // Global Wildcard Route
  {
    path: '**',
    redirectTo: '',
  },
];
