
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-calendar',
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss'
})
export class Calendar implements OnInit {
  currentDate: Date = new Date();
  viewMonth: Date = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
  weekDayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  weeks: { date: Date; inMonth: boolean; isToday: boolean }[][] = [];

  events: { title: string; date: string; time: string; description: string; client: string; site: string }[] = [];

  newEventTitle = '';
  newEventTime = '';
  newEventDescription = '';
  newEventClient = '';
  newEventSite = '';
  selectedDate: Date | null = null;
  selectedDateStr = '';

  ngOnInit(): void {
    this.selectedDate = this.currentDate;
    this.selectedDateStr = this.formatDate(this.currentDate);
    this.buildCalendar();
  }

  formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  buildCalendar() {
    const year = this.viewMonth.getFullYear();
    const month = this.viewMonth.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const start = new Date(firstOfMonth);
    start.setDate(firstOfMonth.getDate() - firstOfMonth.getDay());

    const weeks: any[] = [];
    let cur = new Date(start);
    for (let w = 0; w < 6; w++) {
      const week: any[] = [];
      for (let d = 0; d < 7; d++) {
        const inMonth = cur.getMonth() === month;
        const isToday = this.isSameDay(cur, this.currentDate);
        week.push({ date: new Date(cur), inMonth, isToday });
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(week);
    }
    this.weeks = weeks;
  }

  prevMonth() {
    this.viewMonth = new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth() - 1, 1);
    this.buildCalendar();
  }

  nextMonth() {
    this.viewMonth = new Date(this.viewMonth.getFullYear(), this.viewMonth.getMonth() + 1, 1);
    this.buildCalendar();
  }

  selectDate(d: Date) {
    this.selectedDate = new Date(d);
    this.selectedDateStr = this.formatDate(this.selectedDate);
  }

  getEventsForDate(d: Date) {
    const key = this.formatDate(d);
    return this.events.filter(e => e.date === key);
  }

  addEvent() {
    if (!this.newEventTitle || !this.selectedDateStr) return;
    this.events.push({ title: this.newEventTitle, date: this.selectedDateStr, time: this.newEventTime, description: this.newEventDescription, client: this.newEventClient, site: this.newEventSite });
    this.newEventTitle = '';
    this.newEventTime = '';
    this.newEventDescription = '';
    this.newEventClient = '';
    this.newEventSite = '';
    this.buildCalendar();
  }

  isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

}
