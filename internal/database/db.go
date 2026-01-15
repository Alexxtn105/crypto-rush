package database

import (
	"crypto-rush/internal/models"
	"database/sql"

	_ "github.com/mattn/go-sqlite3"
	"go.uber.org/zap"
)

type Database struct {
	db     *sql.DB
	logger *zap.Logger
}

func New(dbPath string, logger *zap.Logger) (*Database, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		return nil, err
	}

	d := &Database{
		db:     db,
		logger: logger,
	}

	if err := d.createTables(); err != nil {
		return nil, err
	}

	return d, nil
}

func (d *Database) createTables() error {
	query := `
    CREATE TABLE IF NOT EXISTS leaderboard (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        score REAL NOT NULL,
        trades INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_score ON leaderboard(score DESC);
    `
	_, err := d.db.Exec(query)
	return err
}

func (d *Database) SaveScore(result models.GameResult) error {
	query := `INSERT INTO leaderboard (username, score, trades) VALUES (?, ?, ?)`
	_, err := d.db.Exec(query, result.Username, result.Score, result.TradesCount)

	if err != nil {
		d.logger.Error("Failed to save score", zap.Error(err))
		return err
	}

	d.logger.Info("Score saved",
		zap.String("username", result.Username),
		zap.Float64("score", result.Score),
	)

	return nil
}

func (d *Database) GetTopScores(limit int) ([]models.Leaderboard, error) {
	query := `
        SELECT id, username, score, trades, created_at 
        FROM leaderboard 
        ORDER BY score DESC 
        LIMIT ?
    `

	rows, err := d.db.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []models.Leaderboard
	for rows.Next() {
		var lb models.Leaderboard
		err := rows.Scan(&lb.ID, &lb.Username, &lb.Score, &lb.Trades, &lb.CreatedAt)
		if err != nil {
			d.logger.Error("Failed to scan row", zap.Error(err))
			continue
		}
		results = append(results, lb)
	}

	return results, nil
}

func (d *Database) Close() error {
	return d.db.Close()
}
