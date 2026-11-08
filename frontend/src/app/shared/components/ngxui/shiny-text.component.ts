import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * NgxShinyTextComponent
 * Inspired by https://ngxui.com/ (@omnedia/ngx-shiny-text)
 * Provides a radiant, light-sweep shimmering animation across typography.
 */
@Component({
  selector: 'om-shiny-text, ngx-shiny-text',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="shiny-text"
      [class]="styleClass"
      [style.--shimmer-color]="shimmerColor"
      [style.--text-color]="textColor"
      [style.--shimmer-duration]="animationDuration"
    >
      <ng-content></ng-content>{{ text }}
    </span>
  `,
  styles: [`
    :host {
      display: inline-block;
      max-width: 100%;
      vertical-align: baseline;
    }

    .shiny-text {
      display: inline-block;
      max-width: 100%;
      vertical-align: baseline;
      color: var(--text-color, currentColor);
      background: linear-gradient(
        110deg,
        var(--text-color, currentColor) 0%,
        var(--text-color, currentColor) 35%,
        var(--shimmer-color, rgba(255, 255, 255, 0.95)) 50%,
        var(--text-color, currentColor) 65%,
        var(--text-color, currentColor) 100%
      );
      background-size: 200% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
      -webkit-text-fill-color: transparent;
      animation: shinySweep var(--shimmer-duration, 3.5s) ease-in-out infinite;
    }

    @keyframes shinySweep {
      0% {
        background-position: 100% 0;
      }
      100% {
        background-position: -100% 0;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .shiny-text {
        animation: none !important;
        background: none !important;
        -webkit-text-fill-color: var(--text-color, currentColor) !important;
        color: var(--text-color, currentColor) !important;
      }
    }

    @supports not ((-webkit-background-clip: text) or (background-clip: text)) {
      .shiny-text {
        background: none !important;
        -webkit-text-fill-color: var(--text-color, currentColor) !important;
        color: var(--text-color, currentColor) !important;
      }
    }
  `],
})
export class NgxShinyTextComponent {
  private _textColor = 'currentColor';

  @Input() text = '';
  @Input() shimmerColor = 'rgba(255, 255, 255, 0.95)';
  @Input()
  set textColor(val: string) {
    this._textColor = (!val || val === 'inherit') ? 'currentColor' : val;
  }
  get textColor(): string {
    return this._textColor;
  }
  @Input() animationDuration = '3.5s';
  @Input() styleClass = '';
}
