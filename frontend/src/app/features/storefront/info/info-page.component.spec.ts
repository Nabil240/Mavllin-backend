import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { InfoPageComponent } from './info-page.component';

describe('InfoPageComponent Statutory Legal Pages', () => {
  let fixture: any;
  let component: InfoPageComponent;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoPageComponent],
      providers: [provideHttpClient(), provideRouter([])],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  it('should display statutory disclosures on Terms & Conditions page (/terms)', () => {
    vi.spyOn(router, 'url', 'get').mockReturnValue('/terms');
    fixture = TestBed.createComponent(InfoPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.pageType()).toBe('terms');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('TERMS & CONDITIONS');
    expect(compiled.textContent).toContain('TRAD/DNCC/048291/2026');
    expect(compiled.textContent).toContain('DBID-884920115');
    expect(compiled.textContent).toContain('Banani');
    expect(compiled.textContent).toContain('৳70');
  });

  it('should display statutory consumer protection on Return & Refund Policy (/return-policy)', () => {
    vi.spyOn(router, 'url', 'get').mockReturnValue('/return-policy');
    fixture = TestBed.createComponent(InfoPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.pageType()).toBe('returns');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('RETURN, EXCHANGE & REFUND POLICY');
    expect(compiled.textContent).toContain('7 calendar days');
    expect(compiled.textContent).toContain('bKash');
    expect(compiled.textContent).toContain('Nagad');
    expect(compiled.textContent).toContain('16121');
  });

  it('should display statutory shipping ceilings on Shipping Policy (/shipping-policy)', () => {
    vi.spyOn(router, 'url', 'get').mockReturnValue('/shipping-policy');
    fixture = TestBed.createComponent(InfoPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.pageType()).toBe('shipping');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('SHIPPING & DELIVERY POLICY');
    expect(compiled.textContent).toContain('৳70');
    expect(compiled.textContent).toContain('৳130');
    expect(compiled.textContent).toContain('৳2,500');
    expect(compiled.textContent).toContain('64 Districts');
  });

  it('should display Banani atelier details on Contact page (/contact)', () => {
    vi.spyOn(router, 'url', 'get').mockReturnValue('/contact');
    fixture = TestBed.createComponent(InfoPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.pageType()).toBe('contact');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('House 48, Road 11, Block F, Banani, Dhaka');
    expect(compiled.textContent).toContain('concierge@mavllin.com');
  });
});
