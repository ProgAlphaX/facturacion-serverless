import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterOutlet } from '@angular/router';

import { BottomNav } from '../bottom-nav/bottom-nav';
import { coincidePantalla } from '../pantalla';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'fn-app-shell',
  imports: [MatSidenavModule, RouterOutlet, Sidebar, Topbar, BottomNav],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  protected readonly esMovil = coincidePantalla('(max-width: 639.98px)');
  protected readonly esTablet = coincidePantalla('(min-width: 640px) and (max-width: 1023.98px)');
}
