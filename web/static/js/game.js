class CryptoRushGame {
    constructor() {
        this.gameData = null;
        this.balance = 10000;
        this.portfolio = {};
        this.charts = {};
        this.timeLeft = 180;
        this.isRunning = false;
        this.trades = 0;
        this.currentPrices = {};
        this.priceIndex = 0;
    }

    async init() {
        await this.loadGameData();
        this.setupUI();
        this.startGame();
        this.loadLeaderboard();
    }

    async loadGameData() {
        const response = await fetch('/api/game/start');
        this.gameData = await response.json();
        this.balance = this.gameData.startBalance;

        // Инициализация текущих цен
        this.gameData.assets.forEach(asset => {
            this.currentPrices[asset.symbol] = asset.prices[0].price;
        });
    }

    setupUI() {
        // Создание графиков
        const chartsContainer = document.getElementById('charts-container');
        this.gameData.assets.forEach(asset => {
            const chartDiv = document.createElement('div');
            chartDiv.className = 'chart-container';
            chartDiv.innerHTML = `
                <h3>${asset.name} (${asset.symbol})</h3>
                <canvas id="chart-${asset.symbol}"></canvas>
            `;
            chartsContainer.appendChild(chartDiv);

            const ctx = document.getElementById(`chart-${asset.symbol}`).getContext('2d');
            this.charts[asset.symbol] = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Price',
                        data: [],
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: {
                            beginAtZero: false
                        }
                    }
                }
            });
        });

        // Создание карточек активов
        const assetsContainer = document.getElementById('assets-container');
        this.gameData.assets.forEach(asset => {
            const assetCard = document.createElement('div');
            assetCard.className = 'asset-card';
            assetCard.innerHTML = `
                <div class="asset-header">
                    <span class="asset-name">${asset.symbol}</span>
                    <span class="asset-price" id="price-${asset.symbol}">$${asset.prices[0].price.toFixed(2)}</span>
                </div>
                <div class="asset-actions">
                    <button class="btn btn-buy" onclick="game.buy('${asset.symbol}')">Buy</button>
                    <button class="btn btn-sell" onclick="game.sell('${asset.symbol}')" disabled>Sell</button>
                </div>
            `;
            assetsContainer.appendChild(assetCard);
        });
    }

    startGame() {
        this.isRunning = true;
        this.updateTimer();
        this.updatePrices();

        // Генерация событий
        setInterval(() => this.generateEvent(), 25000);
    }

    updateTimer() {
        const timerInterval = setInterval(() => {
            if (this.timeLeft <= 0) {
                clearInterval(timerInterval);
                this.endGame();
                return;
            }

            this.timeLeft--;
            const minutes = Math.floor(this.timeLeft / 60);
            const seconds = this.timeLeft % 60;
            document.getElementById('timer').textContent =
                `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    updatePrices() {
        const priceInterval = setInterval(() => {
            if (!this.isRunning || this.priceIndex >= this.gameData.duration) {
                clearInterval(priceInterval);
                return;
            }

            this.gameData.assets.forEach(asset => {
                const price = asset.prices[this.priceIndex].price;
                this.currentPrices[asset.symbol] = price;

                // Обновление UI
                const priceElement = document.getElementById(`price-${asset.symbol}`);
                priceElement.textContent = `$${price.toFixed(2)}`;

                // Обновление графика
                const chart = this.charts[asset.symbol];
                chart.data.labels.push(this.priceIndex);
                chart.data.datasets[0].data.push(price);

                if (chart.data.labels.length > 60) {
                    chart.data.labels.shift();
                    chart.data.datasets[0].data.shift();
                }

                chart.update('none');
            });

            this.priceIndex++;
            this.updatePortfolio();
        }, 1000);
    }

    buy(symbol) {
        const price = this.currentPrices[symbol];
        if (this.balance >= price) {
            this.balance -= price;
            this.portfolio[symbol] = (this.portfolio[symbol] || 0) + 1;
            this.trades++;
            this.updateBalance();
            this.updatePortfolio();
            this.addEvent(`Bought 1 ${symbol} @ $${price.toFixed(2)}`, 'neutral');
        }
    }

    sell(symbol) {
        if (this.portfolio[symbol] && this.portfolio[symbol] > 0) {
            const price = this.currentPrices[symbol];
            this.balance += price;
            this.portfolio[symbol]--;
            this.trades++;
            this.updateBalance();
            this.updatePortfolio();
            this.addEvent(`Sold 1 ${symbol} @ $${price.toFixed(2)}`, 'neutral');
        }
    }

    updateBalance() {
        document.getElementById('balance').textContent =
            `$${this.balance.toFixed(2)}`;
    }

    updatePortfolio() {
        const portfolioList = document.getElementById('portfolio-list');
        portfolioList.innerHTML = '';

        let totalValue = this.balance;

        Object.entries(this.portfolio).forEach(([symbol, amount]) => {
            if (amount > 0) {
                const value = amount * this.currentPrices[symbol];
                totalValue += value;

                const item = document.createElement('div');
                item.className = 'portfolio-item';
                item.innerHTML = `
                    <span>${symbol}: ${amount}</span>
                    <span>$${value.toFixed(2)}</span>
                `;
                portfolioList.appendChild(item);

                // Активация кнопки продажи
                document.querySelector(`button[onclick="game.sell('${symbol}')"]`).disabled = false;
            } else {
                document.querySelector(`button[onclick="game.sell('${symbol}')"]`).disabled = true;
            }
        });

        // Обновление общего баланса
        document.getElementById('balance').textContent = `$${totalValue.toFixed(2)}`;
    }

    generateEvent() {
        if (!this.isRunning) return;

        const events = [
            { text: '📰 Market rally! All prices surge!', type: 'pump' },
            { text: '💥 Market crash! Panic selling!', type: 'dump' },
            { text: '🐋 Whale spotted in the market', type: 'neutral' },
            { text: '📊 Trading volume spike detected', type: 'neutral' }
        ];

        const event = events[Math.floor(Math.random() * events.length)];
        this.addEvent(event.text, event.type);
    }

    addEvent(text, type) {
        const eventsFeed = document.getElementById('events-feed');
        const eventDiv = document.createElement('div');
        eventDiv.className = `event event-${type}`;
        eventDiv.textContent = text;
        eventsFeed.insertBefore(eventDiv, eventsFeed.firstChild);

        // Удаление старых событий
        while (eventsFeed.children.length > 5) {
            eventsFeed.removeChild(eventsFeed.lastChild);
        }
    }

    endGame() {
        this.isRunning = false;

        // Продажа всех активов
        let finalBalance = this.balance;
        Object.entries(this.portfolio).forEach(([symbol, amount]) => {
            finalBalance += amount * this.currentPrices[symbol];
        });

        const profit = finalBalance - this.gameData.startBalance;
        const profitPercent = ((profit / this.gameData.startBalance) * 100).toFixed(2);

        document.getElementById('result-stats').innerHTML = `
            <p><strong>Final Balance:</strong> $${finalBalance.toFixed(2)}</p>
            <p><strong>Profit:</strong> $${profit.toFixed(2)} (${profitPercent}%)</p>
            <p><strong>Trades:</strong> ${this.trades}</p>
        `;

        document.getElementById('result-modal').classList.remove('hidden');

        // Сохранение результата
        document.getElementById('submit-score-btn').onclick = () => this.submitScore(finalBalance);
        document.getElementById('play-again-btn').onclick = () => location.reload();
    }

    async submitScore(finalBalance) {
        const username = document.getElementById('username-input').value.trim();
        if (!username) {
            alert('Please enter your name');
            return;
        }

        const result = {
            username: username,
            final_balance: finalBalance,
            trades_count: this.trades
        };

        const response = await fetch('/api/game/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result)
        });

        if (response.ok) {
            alert('Score submitted!');
            this.loadLeaderboard();
            document.getElementById('submit-score-btn').disabled = true;
        }
    }

    async loadLeaderboard() {
        const response = await fetch('/api/leaderboard?limit=10');
        const scores = await response.json();

        const leaderboardList = document.getElementById('leaderboard-list');
        leaderboardList.innerHTML = '';

        scores.forEach((score, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.innerHTML = `
                <span class="rank">#${index + 1}</span>
                <span>${score.username}</span>
                <span>${score.score.toFixed(1)} pts</span>
            `;
            leaderboardList.appendChild(item);
        });
    }
}

// Инициализация игры
let game;
window.addEventListener('DOMContentLoaded', () => {
    game = new CryptoRushGame();
    game.init();
});