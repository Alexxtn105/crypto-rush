package handlers

import (
	"crypto-rush/internal/config"
	"crypto-rush/internal/database"
	"crypto-rush/internal/game"
	"crypto-rush/internal/models"
	"encoding/json"
	"net/http"
	"strconv"

	"go.uber.org/zap"
)

type Handler struct {
	db     *database.Database
	engine *game.Engine
	config *config.Config
	logger *zap.Logger
}

func New(db *database.Database, engine *game.Engine, cfg *config.Config, logger *zap.Logger) *Handler {
	return &Handler{
		db:     db,
		engine: engine,
		config: cfg,
		logger: logger,
	}
}

func (h *Handler) GetGameData(w http.ResponseWriter, r *http.Request) {
	duration := h.config.Game.RoundDuration

	var assetsData []models.AssetData
	for _, asset := range h.config.Game.Assets {
		prices := h.engine.GeneratePriceHistory(asset, duration)
		assetsData = append(assetsData, models.AssetData{
			Symbol: asset.Symbol,
			Name:   asset.Name,
			Prices: prices,
		})
	}

	response := map[string]interface{}{
		"assets":       assetsData,
		"startBalance": h.config.Game.StartBalance,
		"duration":     duration,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *Handler) SubmitScore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var result models.GameResult
	if err := json.NewDecoder(r.Body).Decode(&result); err != nil {
		h.logger.Error("Failed to decode request", zap.Error(err))
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Валидация
	if result.Username == "" || len(result.Username) > 20 {
		http.Error(w, "Invalid username", http.StatusBadRequest)
		return
	}

	// Расчет финального счета
	result.Score = h.engine.CalculateScore(
		result.FinalBalance,
		h.config.Game.StartBalance,
		result.TradesCount,
	)

	if err := h.db.SaveScore(result); err != nil {
		http.Error(w, "Failed to save score", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"score":   result.Score,
	})
}

func (h *Handler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	limitStr := r.URL.Query().Get("limit")
	limit := 10
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	scores, err := h.db.GetTopScores(limit)
	if err != nil {
		h.logger.Error("Failed to get leaderboard", zap.Error(err))
		http.Error(w, "Failed to get leaderboard", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(scores)
}
