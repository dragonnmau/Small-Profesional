import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

interface Task { id: number; title: string; description: string; assignee: string; dueDate: string; priority: 'Baja' | 'Media' | 'Alta'; }
interface KanbanColumn { id: number; title: string; tasks: Task[]; }

@Component({ selector: 'app-kanban', imports: [CommonModule, FormsModule, CdkDrag, CdkDropList], templateUrl: './kanban.html', styleUrl: './kanban.scss' })
export class Kanban {
  columns: KanbanColumn[] = [
    { id: 1, title: 'Por hacer', tasks: [{ id: 1, title: 'Revisar propuesta', description: 'Validar alcance y presupuesto con el cliente.', assignee: 'Ana', dueDate: '', priority: 'Alta' }] },
    { id: 2, title: 'En proceso', tasks: [{ id: 2, title: 'Preparar visita', description: 'Confirmar materiales y horario de la visita.', assignee: 'Carlos', dueDate: '', priority: 'Media' }] },
    { id: 3, title: 'Completado', tasks: [] }
  ];
  modalMode: 'column' | 'task' | 'details' | null = null;
  activeColumn: KanbanColumn | null = null;
  selectedTask: Task | null = null;
  columnName = '';
  taskForm = this.emptyTaskForm();
  private nextColumnId = 4;
  private nextTaskId = 3;

  get taskListIds(): string[] { return this.columns.map(column => this.taskListId(column)); }
  taskListId(column: KanbanColumn): string { return `task-list-${column.id}`; }
  dropColumn(event: CdkDragDrop<KanbanColumn[]>): void { if (event.previousIndex !== event.currentIndex) moveItemInArray(this.columns, event.previousIndex, event.currentIndex); }
  dropTask(event: CdkDragDrop<Task[]>): void { event.previousContainer === event.container ? moveItemInArray(event.container.data, event.previousIndex, event.currentIndex) : transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex); }
  openColumnModal(): void { this.columnName = ''; this.modalMode = 'column'; }
  openTaskModal(column: KanbanColumn): void { this.activeColumn = column; this.taskForm = this.emptyTaskForm(); this.modalMode = 'task'; }
  openTaskDetails(task: Task): void { this.selectedTask = task; this.modalMode = 'details'; }
  saveModal(): void {
    if (this.modalMode === 'column' && this.columnName.trim()) this.columns.push({ id: this.nextColumnId++, title: this.columnName.trim(), tasks: [] });
    if (this.modalMode === 'task' && this.activeColumn && this.taskForm.title.trim()) this.activeColumn.tasks.push({ ...this.taskForm, id: this.nextTaskId++, title: this.taskForm.title.trim() });
    this.closeModal();
  }
  deleteColumn(column: KanbanColumn): void { this.columns = this.columns.filter(item => item.id !== column.id); }
  closeModal(): void { this.modalMode = null; this.activeColumn = null; this.selectedTask = null; }
  private emptyTaskForm(): Omit<Task, 'id'> { return { title: '', description: '', assignee: '', dueDate: '', priority: 'Media' }; }
}
