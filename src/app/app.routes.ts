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
        //facturas
        //pagos
    {
        path: 'contabilidad',
        component: Dashboard,
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
        path: 'info-mi-empresa',
        component: Informacion,
    },
    
    

    

    //
    
    //Configuración


    
];
