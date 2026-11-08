import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'bdt',
  standalone: true,
})
export class BdtCurrencyPipe implements PipeTransform {
  /**
   * Formats a numeric value into Bangladeshi Taka (৳).
   * Usage:
   *   {{ product.price | bdt }} -> ৳1,250
   *   {{ product.price | bdt:true }} -> ৳1,250.00
   */
  transform(value: number | string | null | undefined, showDecimals = false): string {
    if (value === null || value === undefined || value === '') {
      return showDecimals ? '৳0.00' : '৳0';
    }

    const num = typeof value === 'number' ? value : Number(value);
    if (isNaN(num)) {
      return showDecimals ? '৳0.00' : '৳0';
    }

    const formatted = showDecimals
      ? num.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : num.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    return `৳${formatted}`;
  }
}
