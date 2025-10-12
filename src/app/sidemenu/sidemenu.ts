import { Component, inject, OnInit } from '@angular/core';
import {MatSidenavModule} from '@angular/material/sidenav';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { CommonModule } from '@angular/common';
import { AvatarModule } from 'primeng/avatar';
import { InputTextModule } from 'primeng/inputtext';
import { Toolbar } from 'primeng/toolbar';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { SplitButton } from 'primeng/splitbutton';
import { PanelMenu } from 'primeng/panelmenu';
import { Ripple } from 'primeng/ripple';
import { MenuModule } from 'primeng/menu';
import { Router } from '@angular/router';
/**
 * @title Autosize sidenav
 */

@Component({
  selector: 'app-sidemenu',
  imports: [
    MatSidenavModule, ButtonModule,InputTextModule,InputIcon,PanelMenu, Ripple,
    Toolbar, BadgeModule,CommonModule,AvatarModule,IconField,SplitButton,MenuModule,
],
  templateUrl: './sidemenu.html',
  styleUrl: './sidemenu.scss'
})


export class Sidemenu implements OnInit {
  items: MenuItem[] | undefined;

  constructor(private router: Router) {

  }

  ngOnInit(){ 

    this.items = [
            {
                separator: true
            },
            {
              label: 'Inicio',
              icon: 'pi pi-home', 
              items:[
                {
                  label: 'Dashboard',
                  icon: 'pi pi-chart-line',
                  shortcut: '⌘+D',
                  command: () => {
                    this.router.navigate(['/']);
                  }
                }
              ]
            },
            {
                label: 'Servicios',
                items: [
                    {
                        label: 'Task List',
                        icon: 'pi pi-list-check',
                        shortcut: '⌘+N',
                        command: () => {
                            this.router.navigate(['/taskList']);
                        }
                    },
                    {
                        label: 'Planificador',
                        icon: 'pi pi-calendar',
                        shortcut: '⌘+S',
                        command: () => {
                            this.router.navigate(['/calendar']);
                        }
                    },
                    {
                        label: 'Kanban',
                        icon: 'pi pi-receipt',
                        shortcut: '⌘+S',
                        command: () => {
                            this.router.navigate(['/kanban']);
                        }
                    },
                     {
                        label: 'Gantt',
                        icon: 'pi pi-receipt',
                        shortcut: '⌘+S',
                        command: () => {
                            this.router.navigate(['/gantt']);
                        }
                    }
                ]
            },
            {
                label: 'Contabilidad',
                items: [
                    {
                        label: 'General',
                        icon: 'pi pi-cog',
                        shortcut: '⌘+O'
                    },
                    {
                        label: 'Facturas',
                        icon: 'pi pi-inbox',
                        badge: 'Ejemplo'
                    },
                    {
                        label: 'Pagos',
                        icon: 'pi pi-sign-out',
                        shortcut: '⌘+Q'
                    }
                ]
            },
            {
                separator: true
            }
        ];

  }
}
