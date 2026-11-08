import {
  Component,
  Input,
  ElementRef,
  ViewChild,
  AfterViewInit,
  inject,
  PLATFORM_ID,
  OnDestroy,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

/**
 * NgxMarqueeComponent
 * Inspired by https://ngxui.com/ (@omnedia/ngx-marquee)
 * Provides a continuous, smoothly scrolling infinite horizontal marquee container.
 */
@Component({
  selector: 'om-marquee, ngx-marquee',
  standalone: true,
  imports: [CommonModule],
  host: {
    '[class.is-paused]': '!isVisible()',
  },
  template: `
    <div
      class="marquee-viewport"
      [class]="styleClass"
      [class.pause-on-hover]="pauseOnHover"
      [style.--marquee-gap]="marqueeGap"
      [style.--marquee-duration]="animationDuration"
    >
      <div class="marquee-track" [class.reverse]="reverse" #trackRef>
        <div class="marquee-content" #contentRef>
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      overflow: hidden;
    }

    :host.is-paused .marquee-track {
      animation-play-state: paused !important;
    }

    .marquee-viewport {
      position: relative;
      width: 100%;
      overflow: hidden;
      display: flex;
      user-select: none;
      mask-image: linear-gradient(
        to right,
        transparent 0%,
        black 4%,
        black 96%,
        transparent 100%
      );
      -webkit-mask-image: linear-gradient(
        to right,
        transparent 0%,
        black 4%,
        black 96%,
        transparent 100%
      );
    }

    .marquee-track {
      display: flex;
      width: max-content;
      gap: var(--marquee-gap, 2.5rem);
      animation: marqueeScroll var(--marquee-duration, 28s) linear infinite;
      will-change: transform;
    }

    .marquee-track.reverse {
      animation-direction: reverse;
    }

    .marquee-content {
      display: flex;
      align-items: center;
      gap: var(--marquee-gap, 2.5rem);
      flex-shrink: 0;
    }

    @media (hover: hover) {
      .marquee-viewport.pause-on-hover:hover .marquee-track {
        animation-play-state: paused;
      }
    }

    @keyframes marqueeScroll {
      from {
        transform: translateX(0);
      }
      to {
        transform: translateX(calc(-50% - var(--marquee-gap, 2.5rem) / 2));
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .marquee-track {
        animation: none !important;
        transform: none !important;
      }
      .marquee-viewport {
        mask-image: none !important;
        -webkit-mask-image: none !important;
        overflow-x: auto;
        user-select: auto;
      }
      .marquee-track > [aria-hidden="true"] {
        display: none !important;
      }
    }
  `],
})
export class NgxMarqueeComponent implements AfterViewInit, OnDestroy {
  @Input() animationDuration = '28s';
  @Input() reverse = false;
  @Input() pauseOnHover = true;
  @Input() marqueeGap = '2.5rem';
  @Input() styleClass = '';

  @ViewChild('trackRef') private trackRef?: ElementRef<HTMLDivElement>;
  @ViewChild('contentRef') private contentRef?: ElementRef<HTMLDivElement>;

  readonly isVisible = signal(true);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly elementRef = inject(ElementRef);
  private cloneNode?: HTMLElement;
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Clone content once to create a seamless infinite loop
    if (this.trackRef?.nativeElement && this.contentRef?.nativeElement) {
      this.cloneNode = this.contentRef.nativeElement.cloneNode(true) as HTMLElement;
      this.cloneNode.setAttribute('aria-hidden', 'true');
      this.cloneNode.setAttribute('inert', '');
      this.cloneNode.removeAttribute('id');
      this.cloneNode.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
      this.trackRef.nativeElement.appendChild(this.cloneNode);
    }

    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver(
        (entries) => {
          const isIntersecting = entries.some((e) => e.isIntersecting);
          this.isVisible.set(isIntersecting);
        },
        { threshold: 0.05 }
      );
      this.observer.observe(this.elementRef.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.cloneNode && this.cloneNode.parentNode) {
      this.cloneNode.parentNode.removeChild(this.cloneNode);
    }
  }
}
