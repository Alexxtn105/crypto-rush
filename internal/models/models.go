package models

import "time"

type Leaderboard struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Score     float64   `json:"score"`
	Trades    int       `json:"trades"`
	CreatedAt time.Time `json:"created_at"`
}

type GameResult struct {
	Username     string  `json:"username"`
	FinalBalance float64 `json:"final_balance"`
	TradesCount  int     `json:"trades_count"`
	Score        float64 `json:"score"`
}

type PricePoint struct {
	Timestamp int64   `json:"timestamp"`
	Price     float64 `json:"price"`
}

type AssetData struct {
	Symbol string       `json:"symbol"`
	Name   string       `json:"name"`
	Prices []PricePoint `json:"prices"`
}
