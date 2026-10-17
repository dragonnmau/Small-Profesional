export interface HockeyBody { x: number; y: number; vx: number; vy: number; }
export type HockeyState = 'ready' | 'playing' | 'paused' | 'finished';

export class AirHockeyGame {
  readonly width = 480;
  readonly height = 640;
  readonly paddleRadius = 28;
  readonly puckRadius = 12;
  readonly goalWidth = 180;
  readonly winningScore = 3;
  playerScore = 0;
  machineScore = 0;
  state: HockeyState = 'ready';
  message = 'Mueve el mouse para controlar tu paleta.';
  serveRemaining = 0;
  puck: HockeyBody = { x: 240, y: 320, vx: 0, vy: 0 };
  player: HockeyBody = { x: 240, y: 530, vx: 0, vy: 0 };
  machine: HockeyBody = { x: 240, y: 110, vx: 0, vy: 0 };
  target = { x: 240, y: 530 };
  private serveDirection = 1;

  start(): void {
    this.playerScore = 0; this.machineScore = 0;
    this.state = 'playing'; this.message = '¡Vamos! Marca en la portería de arriba.';
    this.resetRound(1);
  }
  pause(): void {
    if (this.state === 'playing') this.state = 'paused';
  }
  resume(): void { if (this.state === 'paused') this.state = 'playing'; }
  setTarget(x: number, y: number): void {
    this.target.x = this.clamp(x, this.paddleRadius, this.width - this.paddleRadius);
    this.target.y = this.clamp(y, this.height / 2 + this.paddleRadius, this.height - this.paddleRadius);
  }

  /** The component advances physics in fixed 1/120-second steps to avoid missed collisions. */
  step(dt: number): void {
    if (this.state !== 'playing' || dt <= 0) return;
    this.move(this.player, this.target.x, this.target.y, 1150, dt);
    if (this.serveRemaining > 0) {
      this.serveRemaining = Math.max(0, this.serveRemaining - dt);
      if (this.serveRemaining === 0) { this.puck.vx = 130; this.puck.vy = 290 * this.serveDirection; }
      return;
    }
    const attack = this.puck.y < this.height / 2;
    const aiX = this.clamp(this.puck.x + this.puck.vx * .12, this.paddleRadius, this.width - this.paddleRadius);
    const aiY = attack ? this.clamp(this.puck.y - 38, this.paddleRadius, this.height / 2 - this.paddleRadius) : 110;
    this.move(this.machine, aiX, aiY, attack ? 340 : 240, dt);
    this.puck.x += this.puck.vx * dt; this.puck.y += this.puck.vy * dt;
    const radius = this.puckRadius;
    if (this.puck.x < radius) { this.puck.x = radius; this.puck.vx = Math.abs(this.puck.vx); }
    if (this.puck.x > this.width - radius) { this.puck.x = this.width - radius; this.puck.vx = -Math.abs(this.puck.vx); }
    const inGoal = Math.abs(this.puck.x - this.width / 2) < this.goalWidth / 2 - radius;
    if (inGoal && this.puck.y < -radius) { this.score('player'); return; }
    if (inGoal && this.puck.y > this.height + radius) { this.score('machine'); return; }
    if (!inGoal && this.puck.y < radius) { this.puck.y = radius; this.puck.vy = Math.abs(this.puck.vy); }
    if (!inGoal && this.puck.y > this.height - radius) { this.puck.y = this.height - radius; this.puck.vy = -Math.abs(this.puck.vy); }
    this.collide(this.player); this.collide(this.machine);
    const speed = Math.hypot(this.puck.vx, this.puck.vy);
    if (speed > 850) { this.puck.vx *= 850 / speed; this.puck.vy *= 850 / speed; }
    // Keep rallies moving even after a slow, glancing hit.
    if (speed > 0 && speed < 210) { this.puck.vx *= 210 / speed; this.puck.vy *= 210 / speed; }
  }

  private score(who: 'player' | 'machine'): void {
    if (who === 'player') this.playerScore++; else this.machineScore++;
    if (this.playerScore === this.winningScore || this.machineScore === this.winningScore) {
      this.state = 'finished'; this.puck.vx = 0; this.puck.vy = 0;
      this.message = this.playerScore === this.winningScore ? '¡Ganaste la partida!' : 'La máquina ganó esta partida.';
      return;
    }
    this.message = who === 'player' ? '¡Punto para ti!' : 'Punto para la máquina.';
    this.resetRound(who === 'player' ? -1 : 1);
  }
  private resetRound(direction: number): void {
    this.player = { x: 240, y: 530, vx: 0, vy: 0 };
    this.machine = { x: 240, y: 110, vx: 0, vy: 0 };
    this.puck = { x: 240, y: 320, vx: 0, vy: 0 };
    this.target = { x: 240, y: 530 };
    this.serveDirection = direction; this.serveRemaining = 1;
  }
  private move(body: HockeyBody, x: number, y: number, speed: number, dt: number): void {
    const dx = x - body.x; const dy = y - body.y;
    const distance = Math.hypot(dx, dy);
    const ratio = distance > 0 ? Math.min(1, speed * dt / distance) : 0;
    body.vx = dx * ratio / dt; body.vy = dy * ratio / dt;
    body.x += dx * ratio; body.y += dy * ratio;
  }
  private collide(paddle: HockeyBody): void {
    const dx = this.puck.x - paddle.x; const dy = this.puck.y - paddle.y;
    const distance = Math.hypot(dx, dy);
    const contact = this.paddleRadius + this.puckRadius;
    if (distance >= contact) return;
    const nx = distance ? dx / distance : 0;
    const ny = distance ? dy / distance : (paddle === this.player ? -1 : 1);
    this.puck.x = paddle.x + nx * (contact + .1); this.puck.y = paddle.y + ny * (contact + .1);
    const relativeVelocity = (this.puck.vx - paddle.vx) * nx + (this.puck.vy - paddle.vy) * ny;
    if (relativeVelocity < 0) {
      this.puck.vx -= 1.9 * relativeVelocity * nx;
      this.puck.vy -= 1.9 * relativeVelocity * ny;
    }
  }
  private clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
}
