import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { Login } from './login/login';
import { TaskList } from './task-list/task-list';
import { Gantt } from './gantt/gantt';
import { Kanban } from './kanban/kanban';
import { Calendar } from './calendar/calendar';
import { ServiceList } from './servicios/service-list/service-list';
import { Informacion } from './paginas/miEmpresa/informacion/informacion';
import { ClientList } from './clientes/client-list/client-list';
import { CalculoImpuestos } from './paginas/contabilidad/calculo-impuestos/calculo-impuestos';
import { CuentasBancarias } from './paginas/contabilidad/cuentas-bancarias/cuentas-bancarias';
import { Pagos } from './paginas/contabilidad/pagos/pagos';
import { Facturas } from './paginas/contabilidad/facturas/facturas';
import { Colaboradores } from './paginas/miEmpresa/colaboradores/colaboradores';
import { Gastos } from './paginas/contabilidad/gastos/gastos';

export const routes: Routes = [
    //Dashboard
    {
        path: '',
        component : Dashboard,
    },

     ///Servicios

    {   
        path: 'servicios/serviceList',
        component: ServiceList,
    },

    //tareas
    {
        path: 'login',
        component: Login
    },
    {
        path: 'taskList',
        component:TaskList
    },
    {
        path: 'gantt',
        component: Gantt,
    },
    {
        path: 'calendar',
        component: Calendar,
    },
    {
        path: 'kanban',
        component: Kanban,
    },
    //Contabilidad
    { path: 'facturas', component: Facturas },
        //pagos
    {
        path: 'contabilidad',
        component: Dashboard,
    },
    {
        path: 'bankAccounts',
        component: CuentasBancarias,
    },
    {
        path: 'pagos',
        component: Pagos,
    },
    {
        path: 'gastos',
        component: Gastos,
    },
    {
        path: 'CalculadoraImpuestos',
        component: CalculoImpuestos,
    },

    // Mi empresa
        //Proveedores
        //Inventario
        //Reportes
    {
        path: 'clientes',
        component: ClientList,
    },
     {
        path: 'colaboradores',
        component: Colaboradores,
    },
    {
        path: 'info-mi-empresa',
        component: Informacion,
    },
    
    

    

    //
    
    //Configuración


    
];
