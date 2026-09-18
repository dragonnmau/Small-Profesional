import { Component, inject, OnInit } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
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
import { Router } from '@angular/router';
import { Db, DbAccountInformation } from '../services/db';
/**
 * @title Autosize sidenav
 */

@Component({
    selector: 'app-sidemenu',
    imports: [
        MatSidenavModule, ButtonModule, InputTextModule, InputIcon, PanelMenu,
        Toolbar, BadgeModule, CommonModule, AvatarModule, IconField, SplitButton,
    ],
    templateUrl: './sidemenu.html',
    styleUrl: './sidemenu.scss'
})


export class Sidemenu implements OnInit {
    items: MenuItem[] | undefined;
    isDarkTheme = false;
    accountInformation: DbAccountInformation | null = null;

    get userInformation(): DbAccountInformation['user'] {
        return this.accountInformation?.user ?? {
            name: '', rfc: '', password: '', email: '', phone: '', extension: '', mobile: '', image: '', userType: 'admin'
        };
    }

    get businessInformation(): DbAccountInformation['business'] {
        return this.accountInformation?.business ?? {
            commercialName: '', personType: 'Fisica', companyRfc: '', address: '', image: ''
        };
    }

    constructor(private router: Router, private readonly dbService: Db) {

    }

    ngOnInit() {

        this.accountInformation = this.dbService.getAccountInformation();

        const savedTheme = localStorage.getItem('app-theme');
        this.isDarkTheme = savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.applyTheme();

        this.items = [
            {
                label: 'Inicio',
                icon: 'pi pi-home',
                items: [
                    {
                        label: 'Dashboard - imp',
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
                        label: 'Dashboard',
                        icon: 'pi pi-cog',
                        badge: 'PROXIMAMENTE',
                        styleClass: 'unavailable-menu-item',
                        disabled: true,
                        shortcut: '⌘+O',
                        command: () => {
                            this.router.navigate(['/services']);
                        }
                    },
                    {
                        label: 'Lista de Servicios',
                        icon: 'pi pi-cog',
                        shortcut: '⌘+O',
                        command: () => {
                            this.router.navigate(['/servicios/serviceList']);
                        }
                    },
                    {
                        label: 'Categorias',
                        icon: 'pi pi-tags',
                        badge: 'No disponible',
                        styleClass: 'unavailable-menu-item',
                        disabled: true,
                        shortcut: '⌘+O',
                        command: () => {
                            this.router.navigate(['/categories']);
                        }
                    }
                ]
            },
            {
                label: 'Tareas/Actividades',
                items: [
                    {
                        label: 'Task List',
                        icon: 'pi pi-list-check',
                        shortcut: '⌘+N',
                        badge: 'No disponible',
                        styleClass: 'unavailable-menu-item',
                        disabled: true,
                        /**
                         * command: () => {
                            this.router.navigate(['/taskList']);
                        }
                         */
                        
                    },
                    {
                        label: 'Planificador',
                        icon: 'pi pi-calendar',
                        shortcut: '⌘+S',
                        badge: 'No disponible',
                        styleClass: 'unavailable-menu-item',
                        disabled: true,
                        /**
                         * command: () => {
                            this.router.navigate(['/calendar']);
                        }
                         * 
                         */
                        
                    },
                    {
                        label: 'Kanban',
                        icon: 'pi pi-receipt',
                        shortcut: '⌘+S',
                        badge: 'No disponible',
                        styleClass: 'unavailable-menu-item',
                        disabled: true,
                        /**
                         * command: () => {
                            this.router.navigate(['/kanban']);
                        }
                         */
                        
                    },
                    {
                        label: 'Gantt',
                        icon: 'pi pi-receipt',
                        shortcut: '⌘+S',
                        badge: 'No disponible',
                        styleClass: 'unavailable-menu-item',
                        disabled: true,
                        /*
                        command: () => {
                            this.router.navigate(['/gantt']);
                        } 
                        */
                    }
                ]
            },
            {
                label: 'Contabilidad',
                items: [
                    {
                        label: 'General',
                        icon: 'pi pi-cog',
                        badge: 'No disponible',
                        styleClass: 'unavailable-menu-item',
                        disabled: true,
                        shortcut: '⌘+O'
                    },
                    {
                        label: 'Cuentas Bancarias',
                        icon: 'pi pi-inbox',
                        command: () => {
                            this.router.navigate(['/bankAccounts']);
                        }
                    },
                    {
                        label: 'Facturas',
                        icon: 'pi pi-inbox',
                        command: () => { this.router.navigate(['/facturas']); }
                    },
                    {
                        label: 'Pagos (Ingresos)',
                        icon: 'pi-money-bil',
                        shortcut: '⌘+Q',
                        command: () => {
                            this.router.navigate(['/pagos']);
                        }
                    },
                    {
                        label: 'Gastos (Egresos)',
                        icon: 'pi pi-file-send',
                        shortcut: '⌘+Q',
                        command: () => {
                            this.router.navigate(['/gastos']);
                        }
                    },
                    {
                        label: 'Reportes',
                        icon: 'pi pi-chart-bar',
                        shortcut: '⌘+Q',
                        badge: 'No disponible',
                        styleClass: 'unavailable-menu-item',
                        disabled: true
                    },
                    {
                        label: 'Calculadora de impuestos',
                        icon: 'pi pi-calculator',
                        shortcut: '⌘+Q',
                        command: () => {
                            this.router.navigate(['/CalculadoraImpuestos']);
                        }
                    }

                ]
            },
            {
                label: 'Inventarios',
                icon: 'pi pi-home',
                items: [
                    {
                        label: 'Productos',
                        icon: 'pi pi-chart-line',
                        shortcut: '⌘+I',
                        badge: 'No disponible',
                        styleClass: 'unavailable-menu-item',
                        disabled: true
                    },
                    {
                        label: 'Cotizador',
                        icon: 'pi pi-chart-line',
                        shortcut: '⌘+I',
                        badge: 'No disponible',
                        styleClass: 'unavailable-menu-item',
                        disabled: true
                    }
                ]
            },
            {
                label: 'Empresa',
                items: [
                    {
                        label: 'Clientes',
                        icon: 'pi pi-hammer',
                        shortcut: '⌘+O',
                        command: () => {
                            this.router.navigate(['/clientes']);
                        }
                    },
                    {
                        label: 'Plantilla trabajadores',
                        icon: 'pi pi-users',
                        shortcut: '⌘+O',
                        command: () => {
                            this.router.navigate(['/colaboradores']);
                        }
                    },
                    {
                        label: 'Mi informacion',
                        icon: 'pi pi-warehouse',
                        shortcut: '⌘+Q',
                        command: () => {
                            this.router.navigate(['/info-mi-empresa']);
                        }
                    }
                ]
            },
        ];

    }

    lockApp(): void {
        this.router.navigate(['/login']);
    }

    logout(): void {
        this.router.navigate(['/login']);
    }

    toggleTheme(): void {
        this.isDarkTheme = !this.isDarkTheme;
        this.applyTheme();
    }

    private applyTheme(): void {
        document.documentElement.classList.toggle('app-dark', this.isDarkTheme);
        localStorage.setItem('app-theme', this.isDarkTheme ? 'dark' : 'light');
    }
}

/// npm run ng g c paginas/miEmpresa/colaboradores
