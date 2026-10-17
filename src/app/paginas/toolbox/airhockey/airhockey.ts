import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { AirHockeyGame } from './airhockey-game';

@Component({
  selector: 'app-airhockey',
  imports: [],
  templateUrl: './airhockey.html',
  styleUrl: './airhockey.scss'
})
export class Airhockey implements AfterViewInit, OnDestroy {
  @ViewChild('rink', { static: true }) rink!: ElementRef<HTMLCanvasElement>;
  readonly game = new AirHockeyGame();
  private context: CanvasRenderingContext2D | null = null;
  private frameId: number | null = null;
  private lastFrame = 0;
  private accumulator = 0;
  private destroyed = false;
  private uiKey = '';

  constructor(private readonly zone: NgZone, private readonly changeDetector: ChangeDetectorRef) {}
  ngAfterViewInit(): void {
    this.context = this.rink.nativeElement.getContext('2d');
    this.draw();
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
  }
  start(): void {
    this.game.start(); this.draw(); this.beginLoop();
  }
  togglePause(): void {
    if (this.game.state === 'playing') { this.game.pause(); this.stopLoop(); }
    else if (this.game.state === 'paused') { this.game.resume(); this.beginLoop(); }
  }
  @HostListener('document:visibilitychange')
  onVisibilityChange(): void { if (document.hidden) this.pause(); }
  @HostListener('window:blur')
  pause(): void { if (this.game.state === 'playing') { this.game.pause(); this.stopLoop(); } }

  movePointer(event: PointerEvent): void {
    const bounds = this.rink.nativeElement.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    this.game.setTarget((event.clientX - bounds.left) / bounds.width * this.game.width,
      (event.clientY - bounds.top) / bounds.height * this.game.height);
  }
  private beginLoop(): void {
    this.stopLoop(); this.lastFrame = 0; this.accumulator = 0;
    this.zone.runOutsideAngular(() => { this.frameId = requestAnimationFrame(time => this.frame(time)); });
  }
  private stopLoop(): void {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }
  private frame(time: number): void {
    if (this.destroyed || this.game.state !== 'playing') return;
    if (this.lastFrame) this.accumulator += Math.min((time - this.lastFrame) / 1000, .05);
    this.lastFrame = time;
    const step = 1 / 120;
    while (this.accumulator >= step) { this.game.step(step); this.accumulator -= step; }
    this.draw();
    const key = `${this.game.playerScore}:${this.game.machineScore}:${this.game.state}:${this.game.serveRemaining > 0}`;
    if (key !== this.uiKey) { this.uiKey = key; this.zone.run(() => this.changeDetector.markForCheck()); }
    this.frameId = this.game.state === 'playing' ? requestAnimationFrame(next => this.frame(next)) : null;
  }
  private draw(): void {
    const ctx = this.context;
    if (!ctx) return;
    const { width, height, goalWidth } = this.game;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0c192d'; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#14263d';
    for (let x = 20; x < width; x += 24) for (let y = 20; y < height; y += 24) { ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = '#29405e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
    this.circle(width / 2, height / 2, 68, undefined, '#29405e');
    this.circle(width / 2, height / 2, 5, '#29405e');
    const goalLeft = (width - goalWidth) / 2;
    ctx.strokeStyle = '#4b6381'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(goalLeft, 3); ctx.lineTo(3, 3); ctx.lineTo(3, height - 3); ctx.lineTo(goalLeft, height - 3);
    ctx.moveTo(width - goalLeft, 3); ctx.lineTo(width - 3, 3); ctx.lineTo(width - 3, height - 3); ctx.lineTo(width - goalLeft, height - 3); ctx.stroke();
    ctx.fillStyle = '#fb7185'; ctx.fillRect(goalLeft, 0, goalWidth, 5);
    ctx.fillStyle = '#38bdf8'; ctx.fillRect(goalLeft, height - 5, goalWidth, 5);
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#7389a6';
    ctx.fillText('MÁQUINA', width / 2, 35); ctx.fillText('TU LADO', width / 2, height - 25);
    this.paddle(this.game.machine.x, this.game.machine.y, '#fb7185', '#9f2445');
    this.paddle(this.game.player.x, this.game.player.y, '#38bdf8', '#075985');
    ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
    this.circle(this.game.puck.x, this.game.puck.y, this.game.puckRadius, '#f1f5f9', '#94a3b8');
    ctx.shadowBlur = 0;
  }
  private paddle(x: number, y: number, color: string, inner: string): void {
    const ctx = this.context!;
    ctx.shadowColor = color; ctx.shadowBlur = 15;
    this.circle(x, y, this.game.paddleRadius, color);
    ctx.shadowBlur = 0; this.circle(x, y, 18, inner); this.circle(x, y, 10, color);
  }
  private circle(x: number, y: number, radius: number, fill?: string, stroke?: string): void {
    const ctx = this.context!;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

}
