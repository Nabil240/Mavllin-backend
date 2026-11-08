import { TestBed } from '@angular/core/testing';
import { Title, Meta } from '@angular/platform-browser';
import { SeoService } from './seo.service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('SeoService', () => {
  let service: SeoService;
  let titleService: Title;
  let metaService: Meta;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SeoService, Title, Meta],
    });
    service = TestBed.inject(SeoService);
    titleService = TestBed.inject(Title);
    metaService = TestBed.inject(Meta);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set default title and MAVLLIN meta tags', () => {
    service.resetDefaultSeo();
    expect(titleService.getTitle()).toContain('MAVLLIN');
    const desc = metaService.getTag('name="description"');
    expect(desc?.content).toContain('MAVLLIN');
    const ogTitle = metaService.getTag('property="og:title"');
    expect(ogTitle?.content).toContain('MAVLLIN');
  });

  it('should format custom title with MAVLLIN suffix if not present', () => {
    service.updateSeo({ title: 'Heritage Panjabi Collection' });
    expect(titleService.getTitle()).toBe('Heritage Panjabi Collection — MAVLLIN');
  });

  it('should not duplicate MAVLLIN suffix if already present', () => {
    service.updateSeo({ title: 'Terms & Conditions — MAVLLIN' });
    expect(titleService.getTitle()).toBe('Terms & Conditions — MAVLLIN');
  });
});
