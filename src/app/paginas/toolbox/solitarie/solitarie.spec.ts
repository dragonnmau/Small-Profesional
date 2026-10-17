import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Solitarie } from './solitarie';
import { PlayingCard, SolitaireGame, SUITS, Suit, validSnapshot } from './solitaire-game';

const card = (suit: Suit, rank: number, faceUp = true): PlayingCard => ({ suit, rank, faceUp });
const nearlyWon = (): SolitaireGame => {
  const game = new SolitaireGame();
  game.foundations = SUITS.map(suit => Array.from({ length: 12 }, (_, index) => card(suit, index + 1)));
  game.tableau = [...SUITS.map(suit => [card(suit, 13)]), [], [], []];
  return game;
};

describe('Solitarie', () => {
  let component: Solitarie;
  let fixture: ComponentFixture<Solitarie>;
  let saved: Map<string, string>;
  let write: jasmine.Spy;

  beforeEach(async () => {
    saved = new Map();
    spyOn(Storage.prototype, 'getItem').and.callFake((key: string) => saved.get(key) ?? null);
    write = spyOn(Storage.prototype, 'setItem').and.callFake((key: string, value: string) => { saved.set(key, value); });
    await TestBed.configureTestingModule({
      imports: [Solitarie]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Solitarie);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.cash).toBe(100);
  });

  it('charges 5 Cash once on starting and resumes a saved deal for free', () => {
    component.requestNewGame();
    expect(component.cash).toBe(95);
    component.draw();
    const snapshot = component.game!.snapshot();
    const resumed = TestBed.createComponent(Solitarie); resumed.detectChanges();
    expect(resumed.componentInstance.cash).toBe(95);
    expect(resumed.componentInstance.game!.snapshot()).toEqual(snapshot);
    resumed.destroy();
  });

  it('confirms replacing an active game and prevents play with insufficient Cash', () => {
    component.requestNewGame(); component.requestNewGame();
    expect(component.confirmNewGame).toBeTrue(); expect(component.cash).toBe(95);
    component.confirmNewGame = false;
    expect(component.cash).toBe(95);
    component.requestNewGame(); component.startGame(); expect(component.cash).toBe(90);
    component.cash = 4; const snapshot = component.game!.snapshot(); component.startGame();
    expect(component.cash).toBe(4); expect(component.game!.snapshot()).toEqual(snapshot);
  });

  it('awards 25 Cash once and preserves the exact victory text on reload', () => {
    component.startGame(); component.game = nearlyWon(); component.finish(); fixture.detectChanges();
    expect(component.cash).toBe(120); expect(component.game!.state).toBe('won');
    expect(fixture.nativeElement.querySelector('.win-screen h2').textContent).toBe('Ya Ponte a Chambear!!');
    component.finish(); component.undo(); expect(component.cash).toBe(120);
    const resumed = TestBed.createComponent(Solitarie); resumed.detectChanges();
    expect(resumed.componentInstance.cash).toBe(120); expect(resumed.componentInstance.game!.state).toBe('won');
    resumed.componentInstance.finish(); expect(resumed.componentInstance.cash).toBe(120); resumed.destroy();
  });

  it('does not charge or award Cash if storage fails', () => {
    write.and.throwError('Storage full'); component.startGame();
    expect(component.cash).toBe(100); expect(component.game).toBeNull(); expect(component.storageError).toBeTruthy();
    write.and.callFake((key: string, value: string) => { saved.set(key, value); }); component.retryStorage(); component.startGame();
    component.game = nearlyWon(); write.and.throwError('Storage full'); component.finish();
    expect(component.cash).toBe(95); expect(component.game!.state).toBe('playing');
  });

  it('rejects invalid moves without changing Cash or the saved deal', () => {
    component.startGame(); component.game = nearlyWon();
    const before = component.game.snapshot();
    component.select({ pile: 'tableau', index: 0, cardIndex: 0 }); component.moveTo('foundation', 1);
    expect(component.game.snapshot()).toEqual(before); expect(component.cash).toBe(95);
    expect(component.notice).toContain('no válido');
  });

  it('loads a newer save instead of overwriting Cash from another window', () => {
    component.startGame();
    saved.set(component.storageKey, JSON.stringify({ version: 1, cash: 80, game: SolitaireGame.deal(() => .5).snapshot() }));
    component.draw();
    expect(component.cash).toBe(80); expect(component.game!.waste.length).toBe(0);
    expect(component.notice).toContain('otra ventana');
  });
});

describe('SolitaireGame rules', () => {
  it('deals all 52 unique cards into seven columns and a 24-card stock', () => {
    const game = SolitaireGame.deal(() => .5);
    expect(game.stock.length).toBe(24);
    expect(game.tableau.map(pile => pile.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(game.tableau.every(pile => pile.at(-1)!.faceUp && pile.slice(0, -1).every(card => !card.faceUp))).toBeTrue();
    expect(validSnapshot(game.snapshot())).toBeTrue();
    expect(SolitaireGame.restore(game.snapshot()).snapshot()).toEqual(game.snapshot());
  });

  it('draws one card, recycles waste in order and allows undo', () => {
    const game = new SolitaireGame(); game.stock = [card('clubs', 1, false), card('hearts', 2, false)];
    game.draw(); expect(game.waste.at(-1)?.rank).toBe(2);
    game.draw(); expect(game.waste.at(-1)?.rank).toBe(1);
    game.draw(); expect(game.stock.map(card => card.rank)).toEqual([1, 2]);
    expect(game.stock.every(card => !card.faceUp)).toBeTrue();
    game.undo(); expect(game.waste.map(card => card.rank)).toEqual([2, 1]);
    game.undo(); expect(game.stock.length).toBe(1);
  });

  it('moves descending alternating-color stacks and reveals the next hidden card', () => {
    const game = new SolitaireGame(); game.tableau[0] = [card('spades', 3, false), card('hearts', 7), card('clubs', 6)];
    game.tableau[1] = [card('spades', 8)];
    expect(game.move({ pile: 'tableau', index: 0, cardIndex: 1 }, 'tableau', 1)).toBeTrue();
    expect(game.tableau[1].map(card => card.rank)).toEqual([8, 7, 6]); expect(game.tableau[0][0].faceUp).toBeTrue();
    game.undo(); expect(game.tableau[0][0].faceUp).toBeFalse(); expect(game.tableau[0].length).toBe(3);
  });

  it('rejects same-color stacks, hidden cards and non-kings on empty columns', () => {
    const game = new SolitaireGame(); game.tableau[0] = [card('hearts', 7)]; game.tableau[1] = [card('diamonds', 8)];
    expect(game.move({ pile: 'tableau', index: 0, cardIndex: 0 }, 'tableau', 1)).toBeFalse();
    expect(game.move({ pile: 'tableau', index: 0, cardIndex: 0 }, 'tableau', 2)).toBeFalse();
    game.tableau[0] = [card('hearts', 13, false)]; expect(game.cardsAt({ pile: 'tableau', index: 0, cardIndex: 0 })).toEqual([]);
    game.tableau[0][0].faceUp = true;
    expect(game.move({ pile: 'tableau', index: 0, cardIndex: 0 }, 'tableau', 2)).toBeTrue();
  });

  it('builds foundations in suit order starting at ace and only takes the waste top', () => {
    const game = new SolitaireGame(); game.waste = [card('clubs', 2), card('clubs', 1)];
    expect(game.move({ pile: 'waste', index: 0, cardIndex: 0 }, 'foundation', 0)).toBeFalse();
    expect(game.move({ pile: 'waste', index: 0, cardIndex: 1 }, 'foundation', 1)).toBeFalse();
    expect(game.move({ pile: 'waste', index: 0, cardIndex: 1 }, 'foundation', 0)).toBeTrue();
    expect(game.move({ pile: 'waste', index: 0, cardIndex: 0 }, 'foundation', 0)).toBeTrue();
  });

  it('finishes only after all four suits reach king and prevents undoing a victory', () => {
    const game = nearlyWon(); expect(validSnapshot(game.snapshot())).toBeTrue();
    expect(game.canFinish).toBeTrue(); expect(game.finish()).toBeTrue();
    expect(game.state).toBe('won'); expect(validSnapshot(game.snapshot())).toBeTrue();
    expect(game.undo()).toBeFalse(); expect(game.draw()).toBeFalse();
  });

  it('rejects duplicate or malformed saved cards', () => {
    const game = SolitaireGame.deal(() => .3); const snapshot = game.snapshot();
    snapshot.stock[0] = { ...snapshot.stock[1] }; expect(validSnapshot(snapshot)).toBeFalse();
    expect(validSnapshot({ tableau: [] })).toBeFalse(); expect(validSnapshot(null)).toBeFalse();
  });
});
