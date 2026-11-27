import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'fn-empty-state',
  template: `
    <svg viewBox="0 0 200 130" aria-hidden="true">
      <ellipse cx="100" cy="118" rx="80" ry="8" fill="#ECEEF6" />
      <rect x="52" y="22" width="86" height="92" rx="12" fill="#DCE1FF" />
      <rect x="62" y="12" width="86" height="92" rx="12" fill="#fff" stroke="#DCE1FF" stroke-width="2" />
      <rect x="76" y="32" width="44" height="7" rx="3.5" fill="#BCC2D8" />
      <rect x="76" y="48" width="58" height="6" rx="3" fill="#ECEEF6" />
      <rect x="76" y="62" width="50" height="6" rx="3" fill="#ECEEF6" />
      <path d="M137 98a13 13 0 0 1-1.8-25.9 17 17 0 0 1 32.6-2A14 14 0 0 1 166 98Z" fill="#6B7CF5" />
    </svg>
    <h2>{{ titulo() }}</h2>
    <ng-content />
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
      gap: 10px;
      padding: 32px 20px;
      text-align: center;
    }

    svg {
      width: 180px;
    }

    h2 {
      font-size: 16px;
      font-weight: 800;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'vacio' },
})
export class EmptyState {
  readonly titulo = input.required<string>();
}
