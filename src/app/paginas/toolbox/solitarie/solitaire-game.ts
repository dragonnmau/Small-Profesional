export type Suit = 'clubs' | 'diamonds' | 'spades' | 'hearts';
export interface PlayingCard { suit: Suit; rank: number; faceUp: boolean; }
export interface CardSource { pile: 'waste' | 'tableau' | 'foundation'; index: number; cardIndex: number; }
export interface SolitaireSnapshot {
  stock: PlayingCard[]; waste: PlayingCard[]; tableau: PlayingCard[][]; foundations: PlayingCard[][];
  state: 'playing' | 'won'; moves: number;
}
export const SUITS: Suit[] = ['clubs', 'diamonds', 'spades', 'hearts'];
export const isRed = (card: PlayingCard): boolean => card.suit === 'diamonds' || card.suit === 'hearts';

export class SolitaireGame {
  stock: PlayingCard[] = [];
  waste: PlayingCard[] = [];
  tableau: PlayingCard[][] = Array.from({ length: 7 }, () => []);
  foundations: PlayingCard[][] = Array.from({ length: 4 }, () => []);
  state: 'playing' | 'won' = 'playing';
  moves = 0;
  private history: SolitaireSnapshot[] = [];

  static deal(random: () => number = Math.random): SolitaireGame {
    const game = new SolitaireGame();
    const deck = SUITS.flatMap(suit => Array.from({ length: 13 }, (_, index) => ({ suit, rank: index + 1, faceUp: false })));
    for (let index = deck.length - 1; index > 0; index--) {
      const other = Math.floor(random() * (index + 1));
      [deck[index], deck[other]] = [deck[other], deck[index]];
    }
    for (let column = 0; column < 7; column++) {
      for (let row = 0; row <= column; row++) game.tableau[column].push(deck.pop()!);
      game.tableau[column][column].faceUp = true;
    }
    game.stock = deck;
    return game;
  }
  static restore(snapshot: SolitaireSnapshot): SolitaireGame {
    const game = new SolitaireGame();
    Object.assign(game, structuredClone(snapshot));
    return game;
  }
  snapshot(): SolitaireSnapshot {
    return structuredClone({ stock: this.stock, waste: this.waste, tableau: this.tableau, foundations: this.foundations, state: this.state, moves: this.moves });
  }
  get canUndo(): boolean { return this.state === 'playing' && this.history.length > 0; }
  get canFinish(): boolean { return this.state === 'playing' && !this.stock.length && !this.waste.length && this.tableau.every(column => column.every(card => card.faceUp)); }
  draw(): boolean {
    if (this.state !== 'playing' || (!this.stock.length && !this.waste.length)) return false;
    this.remember();
    if (this.stock.length) { const card = this.stock.pop()!; card.faceUp = true; this.waste.push(card); }
    else { this.stock = this.waste.reverse().map(card => ({ ...card, faceUp: false })); this.waste = []; }
    this.moves++;
    return true;
  }
  cardsAt(source: CardSource): PlayingCard[] {
    const pile = source.pile === 'waste' ? this.waste : source.pile === 'tableau' ? this.tableau[source.index] : this.foundations[source.index];
    if (!pile || source.cardIndex < 0 || source.cardIndex >= pile.length) return [];
    if (source.pile !== 'tableau' && source.cardIndex !== pile.length - 1) return [];
    const cards = pile.slice(source.cardIndex);
    if (!cards.every(card => card.faceUp)) return [];
    if (!cards.every((card, index) => index === 0 || (cards[index - 1].rank === card.rank + 1 && isRed(cards[index - 1]) !== isRed(card)))) return [];
    return cards;
  }
  move(source: CardSource, destination: 'tableau' | 'foundation', index: number): boolean {
    if (this.state !== 'playing' || (source.pile === destination && source.index === index)) return false;
    const cards = this.cardsAt(source);
    const target = destination === 'tableau' ? this.tableau[index] : this.foundations[index];
    if (!cards.length || !target) return false;
    const top = target.at(-1); const first = cards[0];
    if (destination === 'foundation') {
      if (cards.length !== 1 || first.suit !== SUITS[index] || first.rank !== (top?.rank ?? 0) + 1) return false;
    } else if (top ? !top.faceUp || top.rank !== first.rank + 1 || isRed(top) === isRed(first) : first.rank !== 13) return false;
    this.remember();
    const origin = source.pile === 'waste' ? this.waste : source.pile === 'tableau' ? this.tableau[source.index] : this.foundations[source.index];
    origin.splice(source.cardIndex); target.push(...cards);
    if (source.pile === 'tableau' && origin.length) origin[origin.length - 1].faceUp = true;
    this.moves++;
    if (this.foundations.every(pile => pile.length === 13)) this.state = 'won';
    return true;
  }
  undo(): boolean {
    if (!this.canUndo) return false;
    Object.assign(this, this.history.pop()!);
    return true;
  }
  finish(): boolean {
    if (!this.canFinish) return false;
    let moved: boolean;
    do {
      moved = false;
      for (let index = 0; index < 7; index++) {
        const top = this.tableau[index].at(-1);
        if (top && this.move({ pile: 'tableau', index, cardIndex: this.tableau[index].length - 1 }, 'foundation', SUITS.indexOf(top.suit))) moved = true;
      }
    } while (moved && this.state !== 'won');
    return this.state === 'won';
  }
  private remember(): void { this.history.push(this.snapshot()); if (this.history.length > 100) this.history.shift(); }
}

export function validSnapshot(value: unknown): value is SolitaireSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as SolitaireSnapshot;
  if (!Array.isArray(snapshot.stock) || !Array.isArray(snapshot.waste) || !Array.isArray(snapshot.tableau) || snapshot.tableau.length !== 7
    || !Array.isArray(snapshot.foundations) || snapshot.foundations.length !== 4 || ![...snapshot.tableau, ...snapshot.foundations].every(Array.isArray)
    || !['playing', 'won'].includes(snapshot.state) || !Number.isSafeInteger(snapshot.moves) || snapshot.moves < 0) return false;
  const cards = [...snapshot.stock, ...snapshot.waste, ...snapshot.tableau.flat(), ...snapshot.foundations.flat()];
  if (cards.length !== 52 || !cards.every(card => card && SUITS.includes(card.suit) && Number.isInteger(card.rank) && card.rank >= 1 && card.rank <= 13 && typeof card.faceUp === 'boolean')
    || new Set(cards.map(card => `${card.suit}-${card.rank}`)).size !== 52) return false;
  if (snapshot.stock.some(card => card.faceUp) || snapshot.waste.some(card => !card.faceUp)) return false;
  if (!snapshot.foundations.every((pile, index) => pile.every((card, rank) => card.faceUp && card.suit === SUITS[index] && card.rank === rank + 1))) return false;
  if (!snapshot.tableau.every(pile => pile.every((card, index) => !index || (!pile[index - 1].faceUp || (card.faceUp && pile[index - 1].rank === card.rank + 1 && isRed(pile[index - 1]) !== isRed(card)))) && (!pile.length || pile.at(-1)!.faceUp))) return false;
  return (snapshot.state === 'won') === snapshot.foundations.every(pile => pile.length === 13);
}
