import { Component, HostListener, OnInit } from '@angular/core';
import { CardSource, isRed, PlayingCard, SolitaireGame, SolitaireSnapshot, SUITS, Suit, validSnapshot } from './solitaire-game';

interface SavedSolitaire { version: 1; cash: number; game: SolitaireSnapshot | null; }

@Component({
  selector: 'app-solitarie',
  imports: [],
  templateUrl: './solitarie.html',
  styleUrl: './solitarie.scss'
})
export class Solitarie implements OnInit {
  readonly storageKey = 'small-profesional-solitaire-v1';
  readonly entryCost = 5;
  readonly winReward = 25;
  readonly suits = SUITS;
  cash = 100;
  game: SolitaireGame | null = null;
  selected: CardSource | null = null;
  notice = '';
  storageError = '';
  confirmNewGame = false;
  private savedValue: string | null = null;

  ngOnInit(): void { this.load(); }
  @HostListener('window:storage', ['$event'])
  onStorage(event: StorageEvent): void { if (event.key === this.storageKey || event.key === null) this.load(); }
  private load(): void {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw === null) {
        const initial: SavedSolitaire = { version: 1, cash: 100, game: null };
        localStorage.setItem(this.storageKey, JSON.stringify(initial));
        this.cash = 100; this.game = null; this.savedValue = JSON.stringify(initial);
      } else {
        const saved: SavedSolitaire = JSON.parse(raw);
        if (saved?.version !== 1 || !Number.isSafeInteger(saved.cash) || saved.cash < 0 || (saved.game !== null && !validSnapshot(saved.game))) throw new Error('Invalid save');
        this.cash = saved.cash; this.game = saved.game ? SolitaireGame.restore(saved.game) : null; this.savedValue = raw;
      }
      this.selected = null; this.storageError = ''; this.confirmNewGame = false;
    } catch { this.storageError = 'No se pudo recuperar o guardar tu Cash. Revisa el almacenamiento local y vuelve a intentar.'; }
  }
  retryStorage(): void { this.load(); }
  requestNewGame(): void {
    if (this.storageError || this.cash < this.entryCost) return;
    if (this.game?.state === 'playing') this.confirmNewGame = true;
    else this.startGame();
  }
  startGame(): void {
    if (this.storageError || this.cash < this.entryCost) return;
    const game = SolitaireGame.deal();
    if (this.save(game, this.cash - this.entryCost)) {
      this.game = game; this.cash -= this.entryCost; this.confirmNewGame = false; this.selected = null;
      this.notice = 'Partida iniciada: −5 Cash. Selecciona una carta y después su destino.';
    }
  }
  draw(): void { this.mutate(game => game.draw()); }
  undo(): void { this.mutate(game => game.undo()); }
  finish(): void { this.mutate(game => game.finish()); }
  select(source: CardSource): void {
    if (this.game?.state !== 'playing' || this.storageError) return;
    if (!this.game.cardsAt(source).length) return;
    this.selected = this.isSelected(source) ? null : source;
    this.notice = this.selected ? 'Selecciona una columna o una base como destino.' : '';
  }
  clickCard(source: CardSource): void {
    if (this.selected && source.pile === 'tableau' && source.index !== this.selected.index) this.moveTo('tableau', source.index);
    else if (this.selected && source.pile === 'tableau' && this.selected.pile !== 'tableau') this.moveTo('tableau', source.index);
    else this.select(source);
  }
  moveTo(pile: 'tableau' | 'foundation', index: number): void {
    const source = this.selected;
    if (!source) return;
    this.mutate(game => game.move(source, pile, index));
  }
  autoMove(source: CardSource): void {
    const card = this.game?.cardsAt(source)[0];
    if (card) this.mutate(game => game.move(source, 'foundation', SUITS.indexOf(card.suit)));
  }
  dragStart(event: DragEvent, source: CardSource): void {
    if (!this.game?.cardsAt(source).length || this.game.state !== 'playing' || this.storageError) { event.preventDefault(); return; }
    this.selected = source;
    event.dataTransfer?.setData('text/plain', 'solitaire-card');
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }
  drop(event: DragEvent, pile: 'tableau' | 'foundation', index: number): void { event.preventDefault(); this.moveTo(pile, index); }
  isSelected(source: CardSource): boolean { return this.selected?.pile === source.pile && this.selected.index === source.index && source.cardIndex >= this.selected.cardIndex; }
  label(card: PlayingCard): string { return ({ 1: 'A', 11: 'J', 12: 'Q', 13: 'K' } as Record<number, string>)[card.rank] ?? String(card.rank); }
  symbol(suit: Suit): string { return { clubs: '♣', diamonds: '♦', spades: '♠', hearts: '♥' }[suit]; }
  cardName(card: PlayingCard): string { return card.faceUp ? `${this.label(card)} de ${{ clubs: 'tréboles', diamonds: 'diamantes', spades: 'picas', hearts: 'corazones' }[card.suit]}` : 'Carta boca abajo'; }
  red(card: PlayingCard): boolean { return isRed(card); }
  columnHeight(length: number): number { return 140 + Math.max(0, length - 1) * 30; }

  private mutate(action: (game: SolitaireGame) => boolean): void {
    if (!this.game || this.game.state !== 'playing' || this.storageError) return;
    const before = this.game.snapshot();
    if (!action(this.game)) { this.notice = 'Movimiento no válido. Alterna colores en orden descendente; en las bases, sube del As al Rey.'; return; }
    const reward = this.game.snapshot().state === 'won' ? this.winReward : 0;
    if (!this.save(this.game, this.cash + reward)) { if (this.storageError) this.game = SolitaireGame.restore(before); return; }
    this.cash += reward; this.selected = null;
    this.notice = reward ? '¡Partida ganada! +25 Cash.' : 'Movimiento guardado.';
  }
  private save(game: SolitaireGame, cash: number): boolean {
    try {
      if (localStorage.getItem(this.storageKey) !== this.savedValue) { this.load(); this.notice = 'La partida cambió en otra ventana. Se cargó el estado más reciente.'; return false; }
      const raw = JSON.stringify({ version: 1, cash, game: game.snapshot() } satisfies SavedSolitaire);
      localStorage.setItem(this.storageKey, raw); this.savedValue = raw; return true;
    } catch { this.storageError = 'No se pudo guardar la partida. No se ha descontado Cash ni acreditado la recompensa. Vuelve a intentar.'; return false; }
  }

}
