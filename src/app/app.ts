import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidemenu } from './sidemenu/sidemenu';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatToolbarModule} from '@angular/material/toolbar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,Sidemenu, MatIconModule, MatButtonModule, MatToolbarModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('sm-pro');
}
