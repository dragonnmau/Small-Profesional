import { ChangeDetectorRef, Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
        Toolbar, BadgeModule, CommonModule, AvatarModule, IconField, SplitButton, FormsModule,
    ],
    templateUrl: './sidemenu.html',
    styleUrl: './sidemenu.scss'
})


export class Sidemenu implements OnInit {
    @ViewChild('databaseDialog') databaseDialog?: ElementRef<HTMLDialogElement>;
    databaseBusy = false;
    deleteChallenge = '';
    deleteText = '';
    databaseError = '';
    databaseMessage = '';
    get canDeleteDatabase(): boolean { return !this.databaseBusy && !!this.deleteChallenge && this.deleteText === this.deleteChallenge; }

    async openDatabase(): Promise<void> {
        if (this.databaseBusy) return;
        this.deleteText = ''; this.deleteChallenge = ''; this.databaseError = ''; this.databaseMessage = '';
        this.databaseDialog?.nativeElement.showModal();
        this.databaseBusy = true;
        try { this.deleteChallenge = await this.dbService.databaseChallenge(); }
        catch (error) { this.databaseError = error instanceof Error ? error.message : 'No se pudo preparar la administración de la base de datos.'; }
        finally { this.databaseBusy = false; this.changeDetector.detectChanges(); }
    }

    async manageDatabase(action: 'export' | 'import' | 'delete'): Promise<void> {
        if (this.databaseBusy || (action === 'delete' && !this.canDeleteDatabase)) return;
        this.databaseBusy = true; this.databaseError = ''; this.databaseMessage = '';
        try {
            if (action === 'export') {
                const file = await this.dbService.exportDatabase();
                if (file) this.databaseMessage = `Base de datos exportada en: ${file}`;
            } else {
                const changed = action === 'import' ? await this.dbService.importDatabase() : await this.dbService.deleteDatabase(this.deleteText);
                if (changed) window.location.reload();
            }
        } catch (error) { this.databaseError = error instanceof Error ? error.message : 'No se pudo completar la operación.'; }
        finally { this.databaseBusy = false; this.changeDetector.detectChanges(); }
    }
    items: MenuItem[] | undefined;
    ultis = [
        {
            label: 'Cambiar Tema',
            icon: 'pi pi-sun',
            command: () => {
                this.toggleTheme();
            }
        },
        {
            label: 'Cerrar Sesión',
            icon: 'pi pi-sign-out',
            command: () => {
                this.logout();
            }
        },
        {
            label: 'Juegos',
            icon: 'pi pi-gamepad',
            items: [
                {
                    label: 'Air Hockey',
                    icon: 'pi pi-gamepad',
                    command: () => {
                        this.router.navigate(['/toolbox/airhockey']);

                    }
                },
                {
                    label: 'Solitarie',
                    icon: 'pi pi-gamepad',
                    command: () => {
                        this.router.navigate(['/toolbox/solitarie']);

                    }
                },
            ]
        }
    ]
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

    constructor(private router: Router, private readonly dbService: Db, private readonly changeDetector: ChangeDetectorRef) {

    }

    ngOnInit() {

        this.accountInformation = this.dbService.getAccountInformation();

        const savedTheme = localStorage.getItem('app-theme');
        this.isDarkTheme = savedTheme ? savedTheme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
        this.applyTheme();

        this.items = [
            {
                label: 'Inicio',
                icon: 'pi pi-desktop',
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
                icon: 'pi pi-briefcase',
                items: [
                    {
                        label: 'Dashboard',
                        icon: 'pi pi-cog',
                        shortcut: '⌘+O',
                        command: () => {
                            this.router.navigate(['/servicios/dashboard']);
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
                        label: 'Desglose Costos de Servicios',
                        icon: 'pi pi-cog',
                        shortcut: '⌘+O',
                        command: () => {
                            this.router.navigate(['/servicios/desglose']);
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
                icon: 'pi pi-money-bill',
                items: [
                    {
                        label: 'General',
                        icon: 'pi pi-cog',
                        command: () => {
                            this.router.navigate(['/DashboardConta']);
                        }
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
                        label: 'Año Fiscal',
                        icon: 'pi pi-chart-bar',
                        shortcut: '⌘+Q',
                        command: () => { this.router.navigate(['/ano-fiscal']); }
                    },
                    {
                        label: 'Calculadora de IVA',
                        icon: 'pi pi-calculator',
                        shortcut: '⌘+Q',
                        command: () => {
                            this.router.navigate(['/CalculadoraImpuestos']);
                        }
                    }

                ]
            },
            {
                label: 'Ventas',
                icon: 'pi pi-receipt',
                items: [
                    {
                        label: 'Productos & Servicios',
                        icon: 'pi pi-chart-line',
                        shortcut: '⌘+I',
                        command: () => {
                            this.router.navigate(['/productosyServicios']);
                        }
                    },
                    {
                        label: 'Inventarios',
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
                        command: () => {
                            this.router.navigate(['/cotizador']);
                        }
                    },
                    {
                        label: 'Punto de Venta',
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
                icon: 'pi pi-building',
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
