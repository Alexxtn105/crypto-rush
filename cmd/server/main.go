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

// CORS middleware
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// В разработке разрешаем все origin, в продакшене нужно указать конкретные
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Max-Age", "3600")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

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

	// API endpoints с CORS middleware
	mux.HandleFunc("/api/game/start", corsMiddleware(h.GetGameData))
	mux.HandleFunc("/api/game/submit", corsMiddleware(h.SubmitScore))
	mux.HandleFunc("/api/leaderboard", corsMiddleware(h.GetLeaderboard))

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

		// Оборачиваем file server в CORS middleware
		staticHandler := corsMiddleware(func(w http.ResponseWriter, r *http.Request) {
			http.FileServer(http.Dir(webDir)).ServeHTTP(w, r)
		})
		mux.HandleFunc("/", staticHandler)
	}

	addr := cfg.Server.Host + ":" + cfg.Server.Port
	logger.Info("Server starting", zap.String("address", addr))

	if err := http.ListenAndServe(addr, mux); err != nil {
		logger.Fatal("Server failed", zap.Error(err))
	}
}
