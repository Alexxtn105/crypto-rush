package game

import (
	"crypto-rush/internal/config"
	"crypto-rush/internal/models"
	"math"
	"math/rand"
	"time"
)

type Engine struct {
	config *config.Config
	rand   *rand.Rand
}

func NewEngine(cfg *config.Config) *Engine {
	return &Engine{
		config: cfg,
		rand:   rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (e *Engine) GeneratePriceHistory(asset config.Asset, duration int) []models.PricePoint {
	points := make([]models.PricePoint, duration)
	currentPrice := asset.StartPrice
	startTime := time.Now().Unix()

	for i := 0; i < duration; i++ {
		// Random walk с событиями
		change := e.rand.NormFloat64() * asset.Volatility * currentPrice

		// Случайные события (5% шанс каждую секунду)
		if e.rand.Float64() < 0.05 {
			eventMultiplier := 1.0 + (e.rand.Float64()*0.4 - 0.2) // ±20%
			change *= eventMultiplier * 3
		}

		currentPrice += change

		// Предотвращаем отрицательные цены
		if currentPrice < asset.StartPrice*0.1 {
			currentPrice = asset.StartPrice * 0.1
		}

		points[i] = models.PricePoint{
			Timestamp: startTime + int64(i),
			Price:     math.Round(currentPrice*100) / 100,
		}
	}

	return points
}

func (e *Engine) CalculateScore(finalBalance, startBalance float64, trades int) float64 {
	profit := finalBalance - startBalance
	profitPercent := (profit / startBalance) * 100

	// Базовый счет: процент прибыли
	score := profitPercent * 100

	// Бонус за активность (до +50%)
	tradeBonus := math.Min(float64(trades)*2, 50)

	return math.Round((score+tradeBonus)*10) / 10
}
