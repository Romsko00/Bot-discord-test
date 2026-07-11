


const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck(decks = 1) {
  const deck = [];
  for (let d = 0; d < decks; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) {
        deck.push({ rank: r, suit: s });
      }
    }
  }
  return shuffle(deck);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function draw(deck, count = 1) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    const card = deck.shift();
    if (!card) break;
    drawn.push(card);
  }
  return drawn;
}

function cardValue(card) {
  if (card.rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(card.rank)) return 10;
  return parseInt(card.rank, 10);
}

function handValue(hand) {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    total += cardValue(c);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isBlackjack(hand) {
  return hand.length === 2 && handValue(hand) === 21;
}

function toText(hand, hideFirst = false) {
  if (hideFirst && hand.length > 0) {
    const [, ...rest] = hand;
    return `🂠, ${rest.map((c) => `${c.rank}${c.suit}`).join(', ')}`;
  }
  return hand.map((c) => `${c.rank}${c.suit}`).join(', ');
}

module.exports = {
  SUITS,
  RANKS,
  createDeck,
  shuffle,
  draw,
  handValue,
  isBlackjack,
  toText
};
