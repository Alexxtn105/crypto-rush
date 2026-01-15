package config

import (
	"github.com/ilyakaznacheev/cleanenv"
)

type Config struct {
	Server struct {
		Port string `yaml:"port" env:"PORT" env-default:"8080"`
		Host string `yaml:"host" env:"HOST" env-default:"0.0.0.0"`
	} `yaml:"server"`

	Database struct {
		Path string `yaml:"path" env:"DB_PATH" env-default:"./data.db"`
	} `yaml:"database"`

	Game struct {
		RoundDuration int     `yaml:"round_duration" env-default:"180"`
		StartBalance  float64 `yaml:"start_balance" env-default:"10000"`
		Assets        []Asset `yaml:"assets"`
	} `yaml:"game"`

	LogLevel string `yaml:"log_level" env:"LOG_LEVEL" env-default:"info"`
}

type Asset struct {
	Name       string  `yaml:"name"`
	Symbol     string  `yaml:"symbol"`
	StartPrice float64 `yaml:"start_price"`
	Volatility float64 `yaml:"volatility"`
}

func Load(path string) (*Config, error) {
	var cfg Config
	err := cleanenv.ReadConfig(path, &cfg)
	if err != nil {
		return nil, err
	}
	return &cfg, nil
}
