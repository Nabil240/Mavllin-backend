import {
  Component,
  Input,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

/**
 * NgxBackgroundBeamsComponent
 * Inspired by https://ngxui.com/ (@omnedia/ngx-background-beams)
 * Creates dynamic glowing light paths, ambient orbs, and grid lines for hero/landing areas.
 */
@Component({
  selector: 'om-background-beams, ngx-background-beams',
  standalone: true,
  imports: [CommonModule],
  host: {
    '[class.is-paused]': '!isVisible()',
  },
  template: `
    <div
      class="background-beams-wrap"
      [style.--beam-color]="beamColor"
      [style.--ambient-color]="ambientColor"
      [style.--grid-color]="gridColor"
      aria-hidden="true"
    >
      @if (showGrid) {
        <div class="beams-grid"></div>
      }

      <div class="ambient-orb orb-1"></div>
      <div class="ambient-orb orb-2"></div>
      <div class="ambient-orb orb-3"></div>

      <svg
        class="beams-svg"
        viewBox="0 0 1440 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient [id]="gradId1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" [style.stop-color]="beamColor" style="stop-color: var(--beam-color);" stop-opacity="0" />
            <stop offset="50%" [style.stop-color]="beamColor" style="stop-color: var(--beam-color);" stop-opacity="0.8" />
            <stop offset="100%" [style.stop-color]="beamColor" style="stop-color: var(--beam-color);" stop-opacity="0" />
          </linearGradient>

          <linearGradient [id]="gradId2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#fff" stop-opacity="0" />
            <stop offset="50%" stop-color="#ffffff" stop-opacity="0.5" />
            <stop offset="100%" stop-color="#fff" stop-opacity="0" />
          </linearGradient>
        </defs>

        <!-- Ray 1 -->
        <path
          d="M-200,100 C300,200 600,-50 1600,300"
          [attr.stroke]="'url(#' + gradId1 + ')'"
          stroke-width="1.8"
          stroke-dasharray="160 800"
          class="animated-ray ray-fast"
        />

        <!-- Ray 2 -->
        <path
          d="M-100,500 C400,350 800,650 1700,200"
          [attr.stroke]="'url(#' + gradId2 + ')'"
          stroke-width="1.4"
          stroke-dasharray="180 780"
          class="animated-ray ray-medium"
        />

        <!-- Ray 3 -->
        <path
          d="M100,0 C500,400 900,100 1500,700"
          [attr.stroke]="'url(#' + gradId1 + ')'"
          stroke-width="2"
          stroke-dasharray="200 760"
          class="animated-ray ray-slow"
        />

        <!-- Ray 4 -->
        <path
          d="M-150,750 C200,450 1000,500 1600,150"
          [attr.stroke]="'url(#' + gradId2 + ')'"
          stroke-width="1.2"
          stroke-dasharray="140 820"
          class="animated-ray ray-alt"
        />
      </svg>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      contain: paint;
      z-index: 1;
    }

    :host.is-paused .animated-ray,
    :host.is-paused .ambient-orb {
      animation-play-state: paused !important;
    }

    .background-beams-wrap {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }

    .beams-grid {
      position: absolute;
      inset: 0;
      background-size: 40px 40px;
      background-image:
        linear-gradient(to right, var(--grid-color, rgba(255, 255, 255, 0.05)) 1px, transparent 1px),
        linear-gradient(to bottom, var(--grid-color, rgba(255, 255, 255, 0.05)) 1px, transparent 1px);
      mask-image: radial-gradient(ellipse at 50% 50%, black 20%, transparent 75%);
      -webkit-mask-image: radial-gradient(ellipse at 50% 50%, black 20%, transparent 75%);
      opacity: 0.65;
    }

    .ambient-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
      opacity: 0.6;
      will-change: transform;
      animation: orbFloat 14s ease-in-out infinite alternate;
    }

    .orb-1 {
      top: 15%;
      left: 10%;
      width: 320px;
      height: 320px;
      background: radial-gradient(circle, var(--ambient-color, rgba(154, 107, 50, 0.25)) 0%, transparent 70%);
      animation-duration: 12s;
    }

    .orb-2 {
      top: 45%;
      right: 12%;
      width: 380px;
      height: 380px;
      background: radial-gradient(circle, rgba(214, 197, 171, 0.22) 0%, transparent 70%);
      animation-duration: 16s;
      animation-delay: -4s;
    }

    .orb-3 {
      bottom: 5%;
      left: 40%;
      width: 260px;
      height: 260px;
      background: radial-gradient(circle, var(--beam-color, rgba(232, 222, 203, 0.2)) 0%, transparent 70%);
      animation-duration: 18s;
      animation-delay: -8s;
    }

    .beams-svg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      opacity: 0.75;
    }

    .animated-ray {
      will-change: stroke-dashoffset;
      animation: rayTravel linear infinite;
    }

    .ray-fast {
      animation-duration: 7s;
    }

    .ray-medium {
      animation-duration: 10s;
      animation-delay: -2s;
    }

    .ray-slow {
      animation-duration: 14s;
      animation-delay: -5s;
    }

    .ray-alt {
      animation-duration: 11s;
      animation-delay: -7s;
    }

    @keyframes rayTravel {
      from {
        stroke-dashoffset: 960;
      }
      to {
        stroke-dashoffset: 0;
      }
    }

    @keyframes orbFloat {
      0% {
        transform: translate(0, 0) scale(1);
      }
      50% {
        transform: translate(25px, -20px) scale(1.08);
      }
      100% {
        transform: translate(-20px, 20px) scale(0.95);
      }
    }

    @media (max-width: 768px) {
      .ambient-orb {
        filter: blur(40px);
        opacity: 0.45;
      }
      .orb-1 {
        width: 180px;
        height: 180px;
      }
      .orb-2 {
        width: 210px;
        height: 210px;
      }
      .orb-3 {
        width: 150px;
        height: 150px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .animated-ray,
      .ambient-orb {
        animation: none !important;
      }
    }
  `],
})
export class NgxBackgroundBeamsComponent implements AfterViewInit, OnDestroy {
  private static instanceCounter = 0;
  readonly uniqueId = ++NgxBackgroundBeamsComponent.instanceCounter;
  readonly gradId1 = `beamGrad1_${this.uniqueId}`;
  readonly gradId2 = `beamGrad2_${this.uniqueId}`;

  @Input() beamColor = 'rgba(214, 197, 171, 0.45)';
  @Input() ambientColor = 'rgba(154, 107, 50, 0.2)';
  @Input() gridColor = 'rgba(255, 255, 255, 0.06)';
  @Input() showGrid = true;

  readonly isVisible = signal(true);

  private readonly platformId = inject(PLATFORM_ID);
  private readonly elementRef = inject(ElementRef);
  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
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
