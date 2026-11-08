import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';

export interface SeoConfig {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
}

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  readonly siteName = 'MAVLLIN';
  readonly defaultTitle = 'MAVLLIN — Contemporary Fashion & Heritage Essentials';
  readonly defaultDescription =
    'MAVLLIN — Contemporary Bangladeshi fashion atelier offering heritage panjabis, tailored shirts, minimal essentials, and ready-to-wear garments with nationwide Cash on Delivery.';
  readonly defaultImage = '/uploads/products/banner-hero-1.svg';

  updateSeo(config: SeoConfig = {}): void {
    const fullTitle = config.title
      ? (config.title.includes('MAVLLIN') ? config.title : `${config.title} — ${this.siteName}`)
      : this.defaultTitle;
    const description = config.description || this.defaultDescription;
    const image = config.image || this.defaultImage;
    const type = config.type || 'website';

    this.titleService.setTitle(fullTitle);

    this.metaService.updateTag({ name: 'description', content: description });

    // Open Graph
    this.metaService.updateTag({ property: 'og:site_name', content: this.siteName });
    this.metaService.updateTag({ property: 'og:title', content: fullTitle });
    this.metaService.updateTag({ property: 'og:description', content: description });
    this.metaService.updateTag({ property: 'og:image', content: image });
    this.metaService.updateTag({ property: 'og:type', content: type });
    if (config.url) {
      this.metaService.updateTag({ property: 'og:url', content: config.url });
    }

    // Twitter Card
    this.metaService.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.metaService.updateTag({ name: 'twitter:title', content: fullTitle });
    this.metaService.updateTag({ name: 'twitter:description', content: description });
    this.metaService.updateTag({ name: 'twitter:image', content: image });
  }

  resetDefaultSeo(): void {
    this.updateSeo();
  }
}
