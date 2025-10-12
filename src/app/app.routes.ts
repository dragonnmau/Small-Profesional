import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { Login } from './login/login';
import { TaskList } from './task-list/task-list';
import { Gantt } from './gantt/gantt';
import { Kanban } from './kanban/kanban';
import { Calendar } from './calendar/calendar';

export const routes: Routes = [
    {
        path: '',
        component : Dashboard,
    },
    //Servicios
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
    }
    //Contabilidad
    
];
