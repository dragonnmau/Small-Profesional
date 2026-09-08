import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Task { id: number; parentId: number | null; title: string; progress: number; priority: 'Baja' | 'Media' | 'Alta'; assignee: string; createdBy: string; status: 'Pendiente' | 'En proceso' | 'Completada'; tags: string[]; cost: number; }
interface TaskForm extends Omit<Task, 'id' | 'tags'> { tagsText: string; }

@Component({ selector: 'app-task-list', imports: [CommonModule, FormsModule], templateUrl: './task-list.html', styleUrl: './task-list.scss' })
export class TaskList {
  tasks: Task[] = [
    { id: 1, parentId: null, title: 'Proyecto de renovación', progress: 55, priority: 'Alta', assignee: 'Ana López', createdBy: 'Admin', status: 'En proceso', tags: ['Proyecto', 'Cliente'], cost: 18500 },
    { id: 2, parentId: 1, title: 'Levantamiento en sitio', progress: 100, priority: 'Alta', assignee: 'Carlos Ruiz', createdBy: 'Ana López', status: 'Completada', tags: ['Visita'], cost: 2500 },
    { id: 3, parentId: 1, title: 'Preparar presupuesto', progress: 40, priority: 'Media', assignee: 'Ana López', createdBy: 'Ana López', status: 'En proceso', tags: ['Presupuesto'], cost: 6000 },
    { id: 4, parentId: null, title: 'Seguimiento mensual', progress: 0, priority: 'Baja', assignee: 'María Torres', createdBy: 'Admin', status: 'Pendiente', tags: ['Administrativo'], cost: 1200 }
  ];
  modalOpen = false;
  editingTaskId: number | null = null;
  taskForm: TaskForm = this.emptyTaskForm();
  private nextTaskId = 5;

  children(parentId: number | null): Task[] { return this.tasks.filter(task => task.parentId === parentId); }
  hasChildren(task: Task): boolean { return this.tasks.some(item => item.parentId === task.id); }
  openNewTask(parentId: number | null = null): void { this.editingTaskId = null; this.taskForm = { ...this.emptyTaskForm(), parentId }; this.modalOpen = true; }
  openEditTask(task: Task): void { this.editingTaskId = task.id; this.taskForm = { ...task, tagsText: task.tags.join(', ') }; this.modalOpen = true; }
  closeModal(): void { this.modalOpen = false; }
  saveTask(): void {
    if (!this.taskForm.title.trim()) return;
    const { tagsText, ...values } = this.taskForm;
    const task = { ...values, title: values.title.trim(), progress: Math.max(0, Math.min(100, Number(values.progress))), cost: Number(values.cost) || 0, tags: tagsText.split(',').map(tag => tag.trim()).filter(Boolean) };
    if (this.editingTaskId === null) this.tasks.push({ ...task, id: this.nextTaskId++ });
    else this.tasks = this.tasks.map(item => item.id === this.editingTaskId ? { ...task, id: item.id } : item);
    this.closeModal();
  }
  parentCandidates(): Task[] { return this.tasks.filter(task => task.id !== this.editingTaskId && !this.isDescendant(task.id, this.editingTaskId)); }
  private isDescendant(candidateId: number, ancestorId: number | null): boolean { if (ancestorId === null) return false; let current = this.tasks.find(task => task.id === candidateId); while (current) { const parentId = current.parentId; if (parentId === ancestorId) return true; if (parentId === null) break; current = this.tasks.find(task => task.id === parentId); } return false; }
  private emptyTaskForm(): TaskForm { return { parentId: null, title: '', progress: 0, priority: 'Media', assignee: '', createdBy: 'Admin', status: 'Pendiente', tagsText: '', cost: 0 }; }
}
