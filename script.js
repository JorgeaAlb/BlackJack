/**
 * BLACKJACK PREMIUM - Game Engine
 */

class BlackjackGame {
    constructor() {
        // Game State
        this.deck = [];
        this.playerHand = [];
        this.dealerHand = [];
        this.balance = parseInt(localStorage.getItem('blackjack_balance')) || 1000;
        this.currentBet = 0;
        this.lastBet = 0;
        this.wins = 0;
        this.losses = 0;
        this.pushes = 0;
        this.isGameOver = true;
        this.canDoubleDown = false;
        this.isDealing = false;
        
        // Constants
        this.SUITS = [
            { name: 'hearts', symbol: '♥', color: 'card-red' },
            { name: 'diamonds', symbol: '♦', color: 'card-red' },
            { name: 'clubs', symbol: '♣', color: 'card-black' },
            { name: 'spades', symbol: '♠', color: 'card-black' }
        ];
        this.VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        
        // DOM Elements
        this.elements = {
            balance: document.getElementById('balance'),
            bet: document.getElementById('bet'),
            wins: document.getElementById('wins'),
            losses: document.getElementById('losses'),
            pushes: document.getElementById('pushes'),
            dealerCards: document.getElementById('dealer-cards'),
            playerCards: document.getElementById('player-cards'),
            dealerScore: document.getElementById('dealer-score'),
            playerScore: document.getElementById('player-score'),
            message: document.getElementById('status-message'),
            hitBtn: document.getElementById('hit-btn'),
            standBtn: document.getElementById('stand-btn'),
            doubleBtn: document.getElementById('double-btn'),
            repeatBtn: document.getElementById('repeat-btn'),
            newGameBtn: document.getElementById('new-game-btn'),
            sounds: {
                card: document.getElementById('cardSound'),
                win: document.getElementById('winSound'),
                lose: document.getElementById('loseSound'),
                chips: document.getElementById('chipsSound')
            }
        };

        this.init();
    }

    init() {
        this.updateStats();
        this.createDeck();
        this.attachEventListeners();
        this.showMessage('Coloca tu apuesta para empezar');
    }

    attachEventListeners() {
        this.elements.hitBtn.addEventListener('click', () => this.hit());
        this.elements.standBtn.addEventListener('click', () => this.stand());
        this.elements.doubleBtn.addEventListener('click', () => this.doubleDown());
        this.elements.repeatBtn.addEventListener('click', () => this.repeatLastBet());
        this.elements.newGameBtn.addEventListener('click', () => this.startNewRound());
        
        // Bet reset on logo click or similar (or just adding a listener to the bet card)
        this.elements.bet.parentElement.addEventListener('click', () => this.resetBet());
        
        // Chips
        document.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const amount = parseInt(chip.dataset.amount);
                this.placeBet(amount);
            });
        });
    }

    // --- Core Logic ---

    createDeck() {
        this.deck = [];
        for (let suit of this.SUITS) {
            for (let value of this.VALUES) {
                this.deck.push({
                    suit: suit,
                    value: value,
                    weight: this.getCardWeight(value)
                });
            }
        }
        this.shuffle();
    }

    shuffle() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    getCardWeight(value) {
        if (['J', 'Q', 'K'].includes(value)) return 10;
        if (value === 'A') return 11;
        return parseInt(value);
    }

    calculateScore(hand) {
        let score = hand.reduce((sum, card) => sum + card.weight, 0);
        let aces = hand.filter(card => card.value === 'A').length;

        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }
        return score;
    }

    // --- Actions ---

    placeBet(amount) {
        if (!this.isGameOver || this.isDealing) return;
        if (this.balance >= amount) {
            this.currentBet += amount;
            this.balance -= amount;
            this.lastBet = this.currentBet;
            this.playSound('card');
            this.updateStats();
            this.updateButtons();
        } else {
            this.showMessage('No tienes suficiente saldo', 'lose');
        }
    }

    resetBet() {
        if (!this.isGameOver || this.isDealing || this.currentBet === 0) return;
        this.balance += this.currentBet;
        this.currentBet = 0;
        this.updateStats();
        this.updateButtons();
        this.showMessage('Apuesta reiniciada');
    }

    repeatLastBet() {
        if (!this.isGameOver || this.isDealing || this.lastBet === 0) return;
        
        // If there's a current bet, return it to balance first
        if (this.currentBet > 0) {
            this.balance += this.currentBet;
        }

        if (this.balance >= this.lastBet) {
            this.currentBet = this.lastBet;
            this.balance -= this.lastBet;
            this.updateStats();
            this.startNewRound();
        } else {
            this.showMessage('No tienes suficiente saldo', 'lose');
            this.updateStats();
        }
    }

    async startNewRound() {
        if (this.currentBet === 0 || this.isDealing) {
            if (this.currentBet === 0) this.showMessage('Haz una apuesta primero');
            return;
        }

        this.isDealing = true;
        this.isGameOver = false;
        this.playerHand = [];
        this.dealerHand = [];
        this.canDoubleDown = true;
        
        this.elements.dealerCards.innerHTML = '';
        this.elements.playerCards.innerHTML = '';
        this.elements.dealerScore.textContent = '0';
        this.elements.playerScore.textContent = '0';
        
        if (this.deck.length < 10) this.createDeck();

        this.showMessage('Repartiendo...');
        this.updateButtons();

        // Initial Deal
        await this.dealCard('player');
        await this.dealCard('dealer');
        await this.dealCard('player');
        await this.dealCard('dealer', true); // Hidden

        this.isDealing = false;
        this.checkBlackjack();
        this.updateButtons();
    }

    async dealCard(target, isHidden = false) {
        const card = this.deck.pop();
        const hand = target === 'player' ? this.playerHand : this.dealerHand;
        hand.push(card);
        
        this.renderCard(card, target, isHidden);
        this.playSound('card');
        this.updateScores();
        
        await new Promise(r => setTimeout(r, 400));
    }

    async hit() {
        if (this.isGameOver) return;
        this.canDoubleDown = false;
        await this.dealCard('player');
        
        if (this.calculateScore(this.playerHand) > 21) {
            this.endGame('Bust! Te pasaste.', 'lose');
        }
        this.updateButtons();
    }

    async stand() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.updateButtons();
        
        await this.revealDealerCard();
        
        let dealerScore = this.calculateScore(this.dealerHand);
        while (dealerScore < 17) {
            await this.dealCard('dealer');
            dealerScore = this.calculateScore(this.dealerHand);
        }
        
        this.determineWinner();
    }

    async doubleDown() {
        if (!this.canDoubleDown || this.balance < this.currentBet) return;
        
        this.balance -= this.currentBet;
        this.currentBet *= 2;
        this.updateStats();
        
        await this.dealCard('player');
        if (this.calculateScore(this.playerHand) > 21) {
            this.endGame('Bust! Te pasaste al doblar.', 'lose');
        } else {
            this.stand();
        }
    }

    // --- Game End Logic ---

    checkBlackjack() {
        const pScore = this.calculateScore(this.playerHand);
        const dScore = this.calculateScore(this.dealerHand);
        
        if (pScore === 21 && dScore === 21) {
            this.endGame('¡Empate de Blackjacks!', 'push');
        } else if (pScore === 21) {
            this.endGame('¡BLACKJACK! Pagamos 3 a 2', 'win', 2.5);
        } else if (dScore === 21) {
            this.revealDealerCard();
            this.endGame('Dealer tiene Blackjack', 'lose');
        }
    }

    determineWinner() {
        const pScore = this.calculateScore(this.playerHand);
        const dScore = this.calculateScore(this.dealerHand);
        
        if (dScore > 21) {
            this.endGame('¡Dealer se pasó! Ganas.', 'win');
        } else if (pScore > dScore) {
            this.endGame('¡Ganaste la mano!', 'win');
        } else if (dScore > pScore) {
            this.endGame('Dealer gana.', 'lose');
        } else {
            this.endGame('Empate.', 'push');
        }
    }

    endGame(msg, result, multiplier = 2) {
        this.isGameOver = true;
        this.showMessage(msg, result);
        
        if (result === 'win') {
            this.balance += Math.floor(this.currentBet * multiplier);
            this.wins++;
            this.playSound('win');
        } else if (result === 'lose') {
            this.losses++;
            this.playSound('lose');
        } else {
            this.balance += this.currentBet;
            this.pushes++;
        }
        
        this.currentBet = 0;
        this.updateStats();
        this.updateButtons();
        this.updateScores(true);
    }

    // --- UI Helpers ---

    renderCard(card, target, isHidden) {
        const container = target === 'player' ? this.elements.playerCards : this.elements.dealerCards;
        const cardEl = document.createElement('div');
        cardEl.className = `playing-card dealing ${isHidden ? 'hidden-card' : ''}`;
        
        cardEl.innerHTML = `
            <div class="card-face card-front ${card.suit.color}">
                <div class="card-top">
                    <span class="card-rank">${card.value}</span>
                    <span class="card-suit-sm">${card.suit.symbol}</span>
                </div>
                <div class="card-center-suit">${card.suit.symbol}</div>
                <div class="card-bottom">
                    <span class="card-rank">${card.value}</span>
                    <span class="card-suit-sm">${card.suit.symbol}</span>
                </div>
            </div>
            <div class="card-face card-back"></div>
        `;
        
        container.appendChild(cardEl);
    }

    async revealDealerCard() {
        const hidden = this.elements.dealerCards.querySelector('.hidden-card');
        if (hidden) {
            hidden.classList.remove('hidden-card');
            this.playSound('card');
            await new Promise(r => setTimeout(r, 600));
        }
    }

    updateStats() {
        this.elements.balance.textContent = this.balance;
        this.elements.bet.textContent = this.currentBet;
        this.elements.wins.textContent = this.wins;
        this.elements.losses.textContent = this.losses;
        this.elements.pushes.textContent = this.pushes;
        localStorage.setItem('blackjack_balance', this.balance);
    }

    updateScores(revealAll = false) {
        this.elements.playerScore.textContent = this.calculateScore(this.playerHand);
        
        if (revealAll || this.isGameOver) {
            this.elements.dealerScore.textContent = this.calculateScore(this.dealerHand);
        } else if (this.dealerHand.length > 0) {
            // Only show weight of the first visible card
            this.elements.dealerScore.textContent = this.dealerHand[0].weight;
        }
    }

    updateButtons() {
        const canPlay = !this.isGameOver && !this.isDealing;
        this.elements.hitBtn.disabled = !canPlay;
        this.elements.standBtn.disabled = !canPlay;
        this.elements.doubleBtn.disabled = !this.canDoubleDown || !canPlay || this.balance < this.currentBet;
        this.elements.newGameBtn.disabled = !this.isGameOver || this.currentBet === 0 || this.isDealing;
        this.elements.repeatBtn.disabled = !this.isGameOver || this.lastBet === 0 || this.balance < this.lastBet || this.isDealing;
    }

    showMessage(msg, type = '') {
        this.elements.message.textContent = msg;
        this.elements.message.className = `status-message ${type}`;
    }

    playSound(key) {
        const sound = this.elements.sounds[key];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => {}); // Ignore auto-play restrictions
        }
    }
}

// Start Game
window.addEventListener('load', () => {
    new BlackjackGame();
});
