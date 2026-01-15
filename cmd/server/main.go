package main

import (
	"crypto-rush/internal/config"
	"crypto-rush/internal/database"
	"crypto-rush/internal/game"
	"crypto-rush/internal/handlers"
	"net/http"
	"os"
	"path/filepath"

	"go.uber.org/zap"
)

func main() {
	// Загрузка конфига
	cfg, err := config.Load("config.yml")
	if err != nil {
		panic("Failed to load config: " + err.Error())
	}

	// Инициализация логгера
	var logger *zap.Logger
	if cfg.LogLevel == "debug" {
		logger, _ = zap.NewDevelopment()
	} else {
		logger, _ = zap.NewProduction()
	}
	defer logger.Sync()

	// Инициализация БД
	db, err := database.New(cfg.Database.Path, logger)
	if err != nil {
		logger.Fatal("Failed to initialize database", zap.Error(err))
	}
	defer db.Close()

	// Игровой движок
	engine := game.NewEngine(cfg)

	// Handlers
	h := handlers.New(db, engine, cfg, logger)

	// Роутинг
	mux := http.NewServeMux()

	// API endpoints
	mux.HandleFunc("/api/game/start", h.GetGameData)
	mux.HandleFunc("/api/game/submit", h.SubmitScore)
	mux.HandleFunc("/api/leaderboard", h.GetLeaderboard)

	// Статические файлы - ищем папку web относительно текущей директории
	// Сначала попробуем найти config.yml, чтобы определить корень проекта
	configPath := "config.yml"
	if _, err := os.Stat(configPath); err != nil {
		// Если config.yml не найден в текущей директории, попробуем подняться на уровень выше
		configPath = "../config.yml"
	}

	// Определяем абсолютный путь к конфигу
	absConfigPath, err := filepath.Abs(configPath)
	if err != nil {
		logger.Fatal("Failed to get absolute config path", zap.Error(err))
	}

	// Корень проекта - директория, содержащая config.yml
	projectRoot := filepath.Dir(absConfigPath)
	webDir := filepath.Join(projectRoot, "web")

	// Проверяем, существует ли папка web
	if _, err := os.Stat(webDir); err != nil {
		logger.Warn("Web directory not found, serving basic response",
			zap.String("path", webDir),
			zap.Error(err))

		// Если папка web не найдена, показываем простое сообщение
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/" {
				w.Write([]byte("Crypto Rush API Server is running\nAPI endpoints:\n- POST /api/game/start\n- POST /api/game/submit\n- GET /api/leaderboard"))
				return
			}
			http.NotFound(w, r)
		})
	} else {
		logger.Info("Serving static files from", zap.String("path", webDir))
		mux.Handle("/", http.FileServer(http.Dir(webDir)))
	}

	addr := cfg.Server.Host + ":" + cfg.Server.Port
	logger.Info("Server starting", zap.String("address", addr))

	if err := http.ListenAndServe(addr, mux); err != nil {
		logger.Fatal("Server failed", zap.Error(err))
	}
}
