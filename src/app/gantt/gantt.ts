import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragEnd } from '@angular/cdk/drag-drop';

interface GanttTask { id: number; title: string; start: string; duration: number; assignee: string; color: string; }

@Component({ selector: 'app-gantt', imports: [CommonModule, FormsModule, CdkDrag], templateUrl: './gantt.html', styleUrl: './gantt.scss' })
export class Gantt {
  readonly dayWidth = 58;
  readonly totalDays = 21;
  readonly timelineStart = this.startOfDay(new Date());
  readonly days = Array.from({ length: this.totalDays }, (_, index) => this.addDays(this.timelineStart, index));
  tasks: GanttTask[] = [
    { id: 1, title: 'Levantamiento de información', start: this.dateKey(this.addDays(this.timelineStart, 1)), duration: 3, assignee: 'Ana', color: 'blue' },
    { id: 2, title: 'Propuesta para cliente', start: this.dateKey(this.addDays(this.timelineStart, 5)), duration: 4, assignee: 'Carlos', color: 'purple' },
    { id: 3, title: 'Visita de seguimiento', start: this.dateKey(this.addDays(this.timelineStart, 11)), duration: 2, assignee: 'María', color: 'green' }
  ];
  modalOpen = false;
  editingTaskId: number | null = null;
  taskForm = this.emptyTaskForm();
  private nextTaskId = 4;

  get timelineWidth(): number { return this.dayWidth * this.totalDays; }
  dayOffset(task: GanttTask): number { return this.daysBetween(this.timelineStart, this.fromDateKey(task.start)); }
  taskLeft(task: GanttTask): number { return Math.max(0, this.dayOffset(task)) * this.dayWidth; }
  taskWidth(task: GanttTask): number { return Math.max(this.dayWidth - 6, task.duration * this.dayWidth - 6); }
  dayLabel(day: Date): string { return day.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', ''); }
  dateLabel(day: Date): string { return String(day.getDate()); }

  openNewTask(): void { this.editingTaskId = null; this.taskForm = this.emptyTaskForm(); this.modalOpen = true; }
  openEditTask(task: GanttTask): void { this.editingTaskId = task.id; this.taskForm = { ...task }; this.modalOpen = true; }
  closeModal(): void { this.modalOpen = false; }
  saveTask(): void {
    if (!this.taskForm.title.trim() || !this.taskForm.start || this.taskForm.duration < 1) return;
    const task = { ...this.taskForm, title: this.taskForm.title.trim(), duration: Number(this.taskForm.duration) };
    if (this.editingTaskId === null) this.tasks.push({ ...task, id: this.nextTaskId++ });
    else this.tasks = this.tasks.map(item => item.id === this.editingTaskId ? { ...task, id: item.id } : item);
    this.closeModal();
  }
  deleteTask(): void { if (this.editingTaskId !== null) this.tasks = this.tasks.filter(task => task.id !== this.editingTaskId); this.closeModal(); }
  moveTask(task: GanttTask, event: CdkDragEnd): void {
    const movementDays = Math.round(event.source.getFreeDragPosition().x / this.dayWidth);
    if (movementDays) {
      const maxOffset = this.totalDays - task.duration;
      const offset = Math.max(0, Math.min(maxOffset, this.dayOffset(task) + movementDays));
      task.start = this.dateKey(this.addDays(this.timelineStart, offset));
    }
    event.source.reset();
  }
  private emptyTaskForm(): Omit<GanttTask, 'id'> { return { title: '', start: this.dateKey(this.timelineStart), duration: 1, assignee: '', color: 'blue' }; }
  private startOfDay(date: Date): Date { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
  private addDays(date: Date, days: number): Date { const value = new Date(date); value.setDate(value.getDate() + days); return value; }
  private dateKey(date: Date): string { const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${date.getFullYear()}-${month}-${day}`; }
  private fromDateKey(value: string): Date { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day); }
  private daysBetween(first: Date, second: Date): number { return Math.round((this.startOfDay(second).getTime() - this.startOfDay(first).getTime()) / 86400000); }
}
