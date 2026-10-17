import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Airhockey } from './airhockey';
import { AirHockeyGame } from './airhockey-game';

describe('Airhockey', () => {
  let component: Airhockey;
  let fixture: ComponentFixture<Airhockey>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Airhockey]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Airhockey);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts, pauses, resumes and resets a match', () => {
    spyOn(window, 'requestAnimationFrame').and.returnValue(99);
    const cancel = spyOn(window, 'cancelAnimationFrame');
    fixture.nativeElement.querySelector('.game-overlay button').click(); fixture.detectChanges();
    expect(component.game.state).toBe('playing');
    component.togglePause(); fixture.detectChanges();
    expect(component.game.state).toBe('paused');
    expect(fixture.nativeElement.querySelector('.game-overlay').textContent).toContain('Partida en pausa');
    component.togglePause(); expect(component.game.state).toBe('playing');
    component.game.playerScore = 2; component.start();
    expect(component.game.playerScore).toBe(0);
    fixture.destroy();
    expect(cancel).toHaveBeenCalledWith(99);
  });

  it('maps the mouse to the scaled rink and confines the player to their half', () => {
    spyOn(component.rink.nativeElement, 'getBoundingClientRect').and.returnValue({ left: 10, top: 20, width: 240, height: 320 } as DOMRect);
    component.movePointer(new PointerEvent('pointermove', { clientX: 130, clientY: 280 }));
    expect(component.game.target.x).toBe(240);
    expect(component.game.target.y).toBe(520);
    component.movePointer(new PointerEvent('pointermove', { clientX: -100, clientY: -100 }));
    expect(component.game.target.x).toBe(28);
    expect(component.game.target.y).toBe(348);
  });

  it('pauses automatically when the window loses focus', () => {
    spyOn(window, 'requestAnimationFrame').and.returnValue(99);
    component.start(); component.pause();
    expect(component.game.state).toBe('paused');
  });
});

describe('AirHockeyGame physics', () => {
  let game: AirHockeyGame;
  const point = (who: 'player' | 'machine') => {
    game.serveRemaining = 0;
    game.puck = { x: 240, y: who === 'player' ? -15 : 655, vx: 0, vy: who === 'player' ? -300 : 300 };
    game.step(1 / 120);
  };
  beforeEach(() => { game = new AirHockeyGame(); game.start(); game.serveRemaining = 0; });

  it('finishes at three points, including a five-point match, and ignores later goals', () => {
    point('player'); point('machine'); point('player'); point('machine');
    expect(game.state).toBe('playing');
    point('player');
    expect(game.playerScore).toBe(3); expect(game.machineScore).toBe(2);
    expect(game.state).toBe('finished'); expect(game.message).toContain('Ganaste');
    point('machine'); expect(game.machineScore).toBe(2);
    game.start(); expect(game.playerScore + game.machineScore).toBe(0);
  });

  it('allows the machine to win and resets the puck between goals', () => {
    point('machine');
    expect(game.puck.x).toBe(240); expect(game.puck.y).toBe(320);
    expect(game.serveRemaining).toBe(1);
    point('machine'); point('machine');
    expect(game.state).toBe('finished'); expect(game.message).toContain('máquina ganó');
  });

  it('bounces on walls and does not award goals outside the goal opening', () => {
    game.puck = { x: 11, y: 400, vx: -300, vy: 20 }; game.step(1 / 120);
    expect(game.puck.x).toBe(12); expect(game.puck.vx).toBeGreaterThan(0);
    game.puck = { x: 60, y: 11, vx: 20, vy: -300 }; game.step(1 / 120);
    expect(game.puck.y).toBe(12); expect(game.puck.vy).toBeGreaterThan(0);
    expect(game.playerScore).toBe(0);
    game.puck = { x: 60, y: 630, vx: 20, vy: 300 }; game.step(1 / 120);
    expect(game.puck.vy).toBeLessThan(0); expect(game.machineScore).toBe(0);
  });

  it('reflects the puck off the player paddle', () => {
    game.puck = { x: 240, y: 491, vx: 0, vy: 300 }; game.step(1 / 120);
    expect(game.puck.vy).toBeLessThan(0);
    expect(Math.hypot(game.puck.x - game.player.x, game.puck.y - game.player.y)).toBeGreaterThanOrEqual(40);
  });

  it('moves the machine toward the puck with limited speed and confines both paddles', () => {
    game.puck = { x: 400, y: 200, vx: 0, vy: 300 };
    game.setTarget(-100, -100); game.step(1 / 120);
    expect(game.machine.x).toBeGreaterThan(240);
    expect(Math.hypot(game.machine.vx, game.machine.vy)).toBeLessThanOrEqual(340.001);
    for (let step = 0; step < 180; step++) game.step(1 / 120);
    expect(game.player.y).toBeGreaterThanOrEqual(348);
    expect(game.player.x).toBeGreaterThanOrEqual(28);
    expect(game.machine.y).toBeLessThanOrEqual(292);
  });

  it('freezes physics when paused and waits before serving', () => {
    game.start(); const before = { ...game.puck };
    game.step(1 / 120); expect(game.puck).toEqual(before);
    game.pause(); const timer = game.serveRemaining;
    game.step(1 / 120); expect(game.serveRemaining).toBe(timer);
    game.resume(); for (let step = 0; step < 125; step++) game.step(1 / 120);
    expect(game.serveRemaining).toBe(0); expect(game.puck.vy).not.toBe(0);
  });
});
