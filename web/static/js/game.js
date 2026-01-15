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
        this.intervals = []; // Для хранения всех интервалов
        this.maxChartPoints = 60; // Максимум точек на графике
    }

    async init() {
        await this.loadGameData();
        this.setupUI();
        this.startGame();
        this.loadLeaderboard();
    }

    async loadGameData() {
        try {
            const response = await fetch('/api/game/start');
            if (!response.ok) throw new Error('Network response was not ok');
            this.gameData = await response.json();
            this.balance = this.gameData.startBalance;

            // Инициализация текущих цен
            this.gameData.assets.forEach(asset => {
                this.currentPrices[asset.symbol] = asset.prices[0].price;
            });
        } catch (error) {
            console.error('Failed to load game data:', error);
            alert('Failed to load game data. Please refresh the page.');
        }
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
                        fill: true,
                        borderWidth: 2,
                        pointRadius: 0, // Убираем точки для производительности
                        pointHoverRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 0 // Отключаем анимацию для производительности
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            grid: {
                                display: false
                            },
                            ticks: {
                                maxTicksLimit: 10
                            }
                        },
                        y: {
                            beginAtZero: false,
                            grid: {
                                color: 'rgba(0,0,0,0.05)'
                            }
                        }
                    },
                    interaction: {
                        intersect: false,
                        mode: 'nearest'
                    }
                }
            });

            // Инициализируем график начальными данными
            this.updateChartData(asset.symbol, asset.prices[0].price, 0);
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

        // Запускаем таймер
        const timerInterval = setInterval(() => this.updateTimer(), 1000);
        this.intervals.push(timerInterval);

        // Запускаем обновление цен
        const priceInterval = setInterval(() => this.updatePrices(), 1000);
        this.intervals.push(priceInterval);

        // Генерация событий
        const eventInterval = setInterval(() => this.generateEvent(), 25000);
        this.intervals.push(eventInterval);
    }

    updateTimer() {
        if (this.timeLeft <= 0) {
            this.endGame();
            return;
        }

        this.timeLeft--;
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        document.getElementById('timer').textContent =
            `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    updatePrices() {
        if (!this.isRunning || this.priceIndex >= this.gameData.duration) {
            return;
        }

        this.gameData.assets.forEach(asset => {
            const price = asset.prices[this.priceIndex]?.price;
            if (price === undefined) return;

            this.currentPrices[asset.symbol] = price;

            // Обновление UI цены
            const priceElement = document.getElementById(`price-${asset.symbol}`);
            priceElement.textContent = `$${price.toFixed(2)}`;

            // Добавляем CSS класс для анимации изменения цены
            priceElement.classList.remove('price-up', 'price-down');
            const prevPrice = this.charts[asset.symbol]?.data?.datasets[0]?.data?.slice(-1)[0] || price;
            if (price > prevPrice) {
                priceElement.classList.add('price-up');
            } else if (price < prevPrice) {
                priceElement.classList.add('price-down');
            }

            // Обновление графика
            this.updateChartData(asset.symbol, price, this.priceIndex);
        });

        this.priceIndex++;
        this.updatePortfolio();
    }

    updateChartData(symbol, price, index) {
        const chart = this.charts[symbol];
        if (!chart) return;

        chart.data.labels.push(index);
        chart.data.datasets[0].data.push(price);

        // Ограничиваем количество точек на графике
        if (chart.data.labels.length > this.maxChartPoints) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }

        // Обновляем график только если виден
        chart.update('none');
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
                const price = this.currentPrices[symbol] || 0;
                const value = amount * price;
                totalValue += value;

                const item = document.createElement('div');
                item.className = 'portfolio-item';
                item.innerHTML = `
                    <span>${symbol}: ${amount}</span>
                    <span>$${value.toFixed(2)}</span>
                `;
                portfolioList.appendChild(item);

                // Активация кнопки продажи
                const sellBtn = document.querySelector(`button[onclick="game.sell('${symbol}')"]`);
                if (sellBtn) sellBtn.disabled = false;
            } else {
                const sellBtn = document.querySelector(`button[onclick="game.sell('${symbol}')"]`);
                if (sellBtn) sellBtn.disabled = true;
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

        // Очищаем все интервалы
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];

        // Продажа всех активов
        let finalBalance = this.balance;
        Object.entries(this.portfolio).forEach(([symbol, amount]) => {
            finalBalance += amount * (this.currentPrices[symbol] || 0);
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
        document.getElementById('play-again-btn').onclick = () => this.restartGame();
    }

    restartGame() {
        // Полная очистка перед перезапуском
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];

        // Уничтожаем графики
        Object.values(this.charts).forEach(chart => chart.destroy());
        this.charts = {};

        // Сбрасываем состояние
        this.gameData = null;
        this.balance = 10000;
        this.portfolio = {};
        this.timeLeft = 180;
        this.isRunning = false;
        this.trades = 0;
        this.currentPrices = {};
        this.priceIndex = 0;

        // Очищаем UI
        document.getElementById('charts-container').innerHTML = '';
        document.getElementById('assets-container').innerHTML = '';
        document.getElementById('portfolio-list').innerHTML = '';
        document.getElementById('events-feed').innerHTML = '';
        document.getElementById('result-modal').classList.add('hidden');

        // Перезапускаем игру
        this.init();
    }

    async submitScore(finalBalance) {
        const username = document.getElementById('username-input').value.trim();
        if (!username) {
            alert('Please enter your name');
            return;
        }

        try {
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

            if (!response.ok) throw new Error('Failed to submit score');

            alert('Score submitted!');
            this.loadLeaderboard();
            document.getElementById('submit-score-btn').disabled = true;
        } catch (error) {
            console.error('Failed to submit score:', error);
            alert('Failed to submit score. Please try again.');
        }
    }

    async loadLeaderboard() {
        try {
            const response = await fetch('/api/leaderboard?limit=10');
            if (!response.ok) throw new Error('Network response was not ok');
            const scores = await response.json();

            const leaderboardList = document.getElementById('leaderboard-list');
            leaderboardList.innerHTML = '';

            scores.forEach((score, index) => {
                const item = document.createElement('div');
                item.className = 'leaderboard-item';
                item.innerHTML = `
                    <span class="rank">#${index + 1}</span>
                    <span>${score.username}</span>
                    <span>${score.score?.toFixed(1) || '0'} pts</span>
                `;
                leaderboardList.appendChild(item);
            });
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
        }
    }

    // Метод для очистки ресурсов
    cleanup() {
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
        Object.values(this.charts).forEach(chart => chart.destroy());
    }
}

// Инициализация игры с обработкой ошибок
let game;

function initializeGame() {
    try {
        game = new CryptoRushGame();
        game.init();
    } catch (error) {
        console.error('Failed to initialize game:', error);
        alert('Failed to initialize game. Please refresh the page.');
    }
}

// Очистка при закрытии страницы
window.addEventListener('beforeunload', () => {
    if (game) {
        game.cleanup();
    }
});

window.addEventListener('DOMContentLoaded', initializeGame);