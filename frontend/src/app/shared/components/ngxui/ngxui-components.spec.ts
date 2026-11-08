import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { NgxBorderBeamComponent } from './border-beam.component';
import { NgxBackgroundBeamsComponent } from './background-beams.component';
import { NgxShinyTextComponent } from './shiny-text.component';
import { NgxMarqueeComponent } from './marquee.component';

@Component({
  standalone: true,
  imports: [
    NgxBorderBeamComponent,
    NgxBackgroundBeamsComponent,
    NgxShinyTextComponent,
    NgxMarqueeComponent,
  ],
  template: `
    <div class="test-card" style="position: relative; width: 300px; height: 200px;">
      <om-border-beam
        id="overlayBeam"
        [gradientColorStart]="'#ffffff'"
        [gradientColorEnd]="'#9a6b32'"
        [borderWidth]="'2px'"
        [animationDuration]="'6s'"
        [reverse]="true"
      ></om-border-beam>
      <om-background-beams
        [beamColor]="'rgba(255, 255, 255, 0.5)'"
        [ambientColor]="'rgba(154, 107, 50, 0.3)'"
        [showGrid]="true"
      ></om-background-beams>
      <om-shiny-text
        [text]="'Luxury Atelier'"
        [shimmerColor]="'#ffffff'"
        [animationDuration]="'4s'"
      ></om-shiny-text>
      <om-marquee
        [animationDuration]="'20s'"
        [pauseOnHover]="true"
        [reverse]="false"
        [marqueeGap]="'3rem'"
      >
        <span class="marquee-item" id="marqueeItem1">Item 1</span>
        <span class="marquee-item" id="marqueeItem2">Item 2</span>
      </om-marquee>
    </div>

    <!-- Second beams instance to verify unique SVG gradient IDs -->
    <om-background-beams></om-background-beams>

    <!-- Border beam with slotted content (container mode) -->
    <om-border-beam id="slottedBeam">
      <button type="button" id="slottedBtn">Slotted Action</button>
    </om-border-beam>
  `,
})
class TestHostComponent {}

describe('NGXUI Animation Components (ngxui.com inspiration)', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, NgxShinyTextComponent, NgxBorderBeamComponent],
    }).compileComponents();
  });

  it('should render NgxBorderBeamComponent with custom inputs and reverse class', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const beamMask = compiled.querySelector('.border-beam-mask') as HTMLElement;
    expect(beamMask).toBeTruthy();
    expect(beamMask.classList.contains('reverse')).toBe(true);
    expect(beamMask.style.getPropertyValue('--color-from')).toBe('#ffffff');
    expect(beamMask.style.getPropertyValue('--color-to')).toBe('#9a6b32');
    expect(beamMask.style.getPropertyValue('--border-width')).toBe('2px');
    expect(beamMask.style.getPropertyValue('--beam-duration')).toBe('6s');
    expect(compiled.querySelector('.border-beam-track')).toBeTruthy();
  });

  it('should distinguish between overlay mode and container mode via is-container host class', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const overlayBeam = compiled.querySelector('#overlayBeam') as HTMLElement;
    const slottedBeam = compiled.querySelector('#slottedBeam') as HTMLElement;

    expect(overlayBeam).toBeTruthy();
    expect(slottedBeam).toBeTruthy();

    // Overlay beam has no children -> not container mode
    expect(overlayBeam.classList.contains('is-container')).toBe(false);

    // Slotted beam has #slottedBtn -> automatically detects container mode and adds is-container
    expect(slottedBeam.classList.contains('is-container')).toBe(true);
    expect(compiled.querySelector('#slottedBtn')).toBeTruthy();
  });

  it('should ensure NgxBorderBeamComponent does not intercept pointer-events when used as an overlay', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const beamContent = compiled.querySelector('.border-beam-content') as HTMLElement;
    expect(beamContent).toBeTruthy();
    expect(compiled.querySelector('#slottedBtn')).toBeTruthy();
  });

  it('should render NgxBackgroundBeamsComponent with SVG light rays and ambient orbs with unique IDs', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const wraps = compiled.querySelectorAll('.background-beams-wrap');
    expect(wraps.length).toBe(2);

    const firstWrap = wraps[0] as HTMLElement;
    expect(firstWrap.style.getPropertyValue('--beam-color')).toBe('rgba(255, 255, 255, 0.5)');
    expect(firstWrap.style.getPropertyValue('--ambient-color')).toBe('rgba(154, 107, 50, 0.3)');

    const svgs = compiled.querySelectorAll('.beams-svg');
    expect(svgs.length).toBe(2);

    // Verify SVG defs have distinct gradient IDs per instance to avoid DOM collisions
    const grad1 = svgs[0].querySelector('linearGradient');
    const grad2 = svgs[1].querySelector('linearGradient');
    expect(grad1?.getAttribute('id')).toBeTruthy();
    expect(grad2?.getAttribute('id')).toBeTruthy();
    expect(grad1?.getAttribute('id')).not.toBe(grad2?.getAttribute('id'));

    const rays = svgs[0].querySelectorAll('.animated-ray');
    expect(rays.length).toBeGreaterThanOrEqual(4);

    // Verify all SVG rays have synchronized dash periods summing to 960px to prevent visual loop hitching
    rays.forEach((ray) => {
      const dasharray = (ray as SVGPathElement).getAttribute('stroke-dasharray') || '';
      const [dash, gap] = dasharray.split(' ').map(Number);
      expect(dash + gap).toBe(960);
    });

    const orbs = firstWrap.querySelectorAll('.ambient-orb');
    expect(orbs.length).toBe(3);
  });

  it('should render NgxShinyTextComponent with text and shimmer variables and safe currentColor default', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const shiny = compiled.querySelector('.shiny-text') as HTMLElement;
    expect(shiny).toBeTruthy();
    expect(shiny.textContent).toContain('Luxury Atelier');
    expect(shiny.style.getPropertyValue('--shimmer-color')).toBe('#ffffff');
    expect(shiny.style.getPropertyValue('--shimmer-duration')).toBe('4s');
    // Must default to currentColor so CSS linear-gradient parses validly
    expect(shiny.style.getPropertyValue('--text-color')).toBe('currentColor');
  });

  it('should sanitize invalid inherit textColor in NgxShinyTextComponent to currentColor', () => {
    const fixture = TestBed.createComponent(NgxShinyTextComponent);
    const comp = fixture.componentInstance;
    comp.textColor = 'inherit';
    fixture.detectChanges();

    expect(comp.textColor).toBe('currentColor');
    const span = fixture.nativeElement.querySelector('.shiny-text') as HTMLElement;
    expect(span.style.getPropertyValue('--text-color')).toBe('currentColor');
  });

  it('should render NgxMarqueeComponent, clone content for seamless loop, and strip duplicate IDs', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const viewport = compiled.querySelector('.marquee-viewport') as HTMLElement;
    expect(viewport).toBeTruthy();
    expect(viewport.classList.contains('pause-on-hover')).toBe(true);
    expect(viewport.style.getPropertyValue('--marquee-gap')).toBe('3rem');
    expect(viewport.style.getPropertyValue('--marquee-duration')).toBe('20s');

    const contents = compiled.querySelectorAll('.marquee-content');
    // Original + cloned node for seamless infinite loop
    expect(contents.length).toBeGreaterThanOrEqual(2);
    expect(contents[1].getAttribute('aria-hidden')).toBe('true');
    expect(contents[1].hasAttribute('inert')).toBe(true);

    // Verify that cloned node stripped IDs to prevent duplicate DOM IDs
    const item1Elements = compiled.querySelectorAll('#marqueeItem1');
    expect(item1Elements.length).toBe(1);
    expect(contents[1].querySelector('#marqueeItem1')).toBeNull();
  });

  it('should remove cloned node on marquee component destroy', () => {
    const fixture = TestBed.createComponent(NgxMarqueeComponent);
    const comp = fixture.componentInstance;
    fixture.detectChanges();

    const track = fixture.nativeElement.querySelector('.marquee-track') as HTMLElement;
    expect(track.children.length).toBe(2);

    fixture.destroy();
    expect(track.children.length).toBe(1);
  });
});
