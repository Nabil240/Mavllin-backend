import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

/**
 * NgxBorderBeamComponent
 * Inspired by https://ngxui.com/ (@omnedia/ngx-border-beam)
 * Renders an animated glowing light beam traveling along the container's border.
 */
@Component({
  selector: 'om-border-beam, ngx-border-beam',
  standalone: true,
  imports: [CommonModule],
  host: {
    '[class.is-container]': 'isContainer()',
    '[class.is-paused]': '!isVisible()',
  },
  template: `
    <div
      class="border-beam-mask"
      [class]="styleClass"
      [style.--color-from]="gradientColorStart"
      [style.--color-to]="gradientColorEnd"
      [style.--border-color]="borderColor"
      [style.--border-radius]="borderRadius"
      [style.--border-width]="borderWidth"
      [style.--beam-duration]="animationDuration"
      [class.reverse]="reverse"
      aria-hidden="true"
    >
      <div class="border-beam-track"></div>
    </div>
    <div class="border-beam-content" #contentWrapper>
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      pointer-events: none;
      border-radius: inherit;
      overflow: hidden;
      contain: paint;
      z-index: 1;
    }

    :host.is-container,
    :host(:has(.border-beam-content > *)) {
      position: relative;
      pointer-events: auto;
    }

    :host.is-paused .border-beam-track {
      animation-play-state: paused !important;
    }

    .border-beam-mask {
      position: absolute;
      inset: 0;
      border-radius: inherit;
      padding: var(--border-width, 1.5px);
      -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      -webkit-mask-clip: content-box, border-box;
      -webkit-mask-composite: xor;
      mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
      mask-clip: content-box, border-box;
      mask-composite: exclude;
      pointer-events: none;
      overflow: hidden;
    }

    .border-beam-track {
      display: none;
    }

    @supports (mask-composite: exclude) or (-webkit-mask-composite: xor) {
      .border-beam-track {
        display: block;
        position: absolute;
        top: 50%;
        left: 50%;
        width: 300%;
        min-width: 300%;
        min-height: 300%;
        aspect-ratio: 1 / 1;
        background: conic-gradient(
          from 0deg,
          transparent 0deg,
          transparent 280deg,
          var(--color-from, #d6c5ab) 330deg,
          var(--color-to, #9a6b32) 360deg
        );
        animation: borderBeamSpin var(--beam-duration, 8s) linear infinite;
        will-change: transform;
        pointer-events: none;
        transform: translate(-50%, -50%) rotate(0deg);
      }
    }

    .border-beam-mask.reverse .border-beam-track {
      animation-direction: reverse;
    }

    .border-beam-content {
      position: relative;
      height: 100%;
      width: 100%;
      pointer-events: none;
    }

    .border-beam-content > * {
      pointer-events: auto;
    }

    @keyframes borderBeamSpin {
      from {
        transform: translate(-50%, -50%) rotate(0deg);
      }
      to {
        transform: translate(-50%, -50%) rotate(360deg);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .border-beam-track {
        animation: none !important;
        display: none !important;
      }
    }
  `],
})
export class NgxBorderBeamComponent implements AfterViewInit, OnDestroy {
  @Input() gradientColorStart = '#d6c5ab';
  @Input() gradientColorEnd = '#9a6b32';
  @Input() borderColor = 'transparent';
  @Input() borderRadius = 'inherit';
  @Input() borderWidth = '1.5px';
  @Input() animationDuration = '8s';
  @Input() reverse = false;
  @Input() styleClass = '';
  @Input() containerMode?: boolean;

  @ViewChild('contentWrapper') private contentWrapper?: ElementRef<HTMLDivElement>;

  readonly isContainer = signal(false);
  readonly isVisible = signal(true);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly elementRef = inject(ElementRef);
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    if (this.containerMode !== undefined) {
      this.isContainer.set(this.containerMode);
    } else if (
      this.contentWrapper?.nativeElement &&
      this.contentWrapper.nativeElement.childElementCount > 0
    ) {
      this.isContainer.set(true);
    }

    if (!isPlatformBrowser(this.platformId) || typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries.some((e) => e.isIntersecting);
        this.isVisible.set(isIntersecting);
      },
      { threshold: 0.05 }
    );
    this.observer.observe(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
