/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

package supportworker

import (
	"errors"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Config is independent of the gateway process and contains no browser-supplied
// callback or storage locations. Each Worker instance serves exactly one site.
type Config struct {
	SiteID         string
	GatewayURL     string
	JWTSecret      string
	CallbackSecret string
	AllowedOrigins []string
	UploadDir      string
	HTTPClient     *http.Client
	Now            func() time.Time
	Translation    TranslationConfig
}

type TranslationConfig struct {
	URL    string
	APIKey string
	Model  string
}

// ConfigFromEnv does not read or change the gateway's in-process settings.
func ConfigFromEnv() Config {
	return Config{
		SiteID: os.Getenv("SUPPORT_SITE_ID"), GatewayURL: os.Getenv("SUPPORT_GATEWAY_URL"),
		JWTSecret: os.Getenv("SUPPORT_JWT_SECRET"), CallbackSecret: os.Getenv("SUPPORT_CALLBACK_SECRET"),
		AllowedOrigins: strings.Split(os.Getenv("SUPPORT_ALLOWED_ORIGINS"), ","),
		UploadDir:      os.Getenv("SUPPORT_UPLOAD_DIR"),
		Translation: TranslationConfig{URL: os.Getenv("SUPPORT_TRANSLATION_URL"),
			APIKey: os.Getenv("SUPPORT_TRANSLATION_API_KEY"), Model: os.Getenv("SUPPORT_TRANSLATION_MODEL")},
	}
}

func (c *Config) validate() error {
	c.SiteID = strings.TrimSpace(c.SiteID)
	if c.SiteID == "" || utf8.RuneCountInString(c.SiteID) > 120 {
		return errors.New("SUPPORT_SITE_ID must contain 1 to 120 characters")
	}
	if len(c.JWTSecret) < 32 || len(c.CallbackSecret) < 32 {
		return errors.New("support JWT and callback secrets must each contain at least 32 bytes")
	}
	if c.JWTSecret == c.CallbackSecret {
		return errors.New("support JWT and callback secrets must be different")
	}
	c.GatewayURL = strings.TrimRight(strings.TrimSpace(c.GatewayURL), "/")
	if !trustedEndpoint(c.GatewayURL) {
		return errors.New("SUPPORT_GATEWAY_URL must use HTTPS (HTTP is only allowed on loopback)")
	}
	if len(c.AllowedOrigins) == 0 {
		return errors.New("SUPPORT_ALLOWED_ORIGINS is required")
	}
	for i, origin := range c.AllowedOrigins {
		origin = strings.TrimSpace(origin)
		u, err := url.Parse(origin)
		if err != nil || !trustedEndpoint(origin) || u.Path != "" {
			return errors.New("SUPPORT_ALLOWED_ORIGINS must contain exact origins without paths")
		}
		c.AllowedOrigins[i] = origin
	}
	if c.UploadDir == "" {
		return errors.New("SUPPORT_UPLOAD_DIR is required")
	}
	abs, err := filepath.Abs(c.UploadDir)
	if err != nil {
		return errors.New("invalid support upload directory")
	}
	c.UploadDir = abs
	if err = os.MkdirAll(abs, 0700); err != nil {
		return errors.New("cannot create support upload directory")
	}
	info, err := os.Lstat(abs)
	if err != nil || !info.IsDir() || info.Mode()&os.ModeSymlink != 0 {
		return errors.New("support upload directory must be a real directory")
	}
	if c.Now == nil {
		c.Now = time.Now
	}
	client := http.Client{Timeout: 15 * time.Second}
	if c.HTTPClient != nil {
		client = *c.HTTPClient
		if client.Timeout <= 0 || client.Timeout > 30*time.Second {
			client.Timeout = 15 * time.Second
		}
	}
	client.CheckRedirect = func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }
	c.HTTPClient = &client
	if c.Translation.URL != "" || c.Translation.APIKey != "" || c.Translation.Model != "" {
		if !trustedEndpoint(c.Translation.URL) || c.Translation.APIKey == "" || c.Translation.Model == "" {
			return errors.New("translation requires an HTTPS endpoint, API key and model")
		}
	}
	return nil
}

func trustedEndpoint(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return false
	}
	if u.Scheme == "https" {
		return true
	}
	ip := net.ParseIP(u.Hostname())
	return u.Scheme == "http" && (u.Hostname() == "localhost" || ip != nil && ip.IsLoopback())
}

// OpenDatabase opens only the Worker's database. No root model initialization,
// primary/log database globals or gateway migrations are involved.
func OpenDatabase(driver, dsn string) (*gorm.DB, error) {
	if strings.TrimSpace(dsn) == "" {
		return nil, errors.New("SUPPORT_DATABASE_DSN is required")
	}
	var dialector gorm.Dialector
	switch driver {
	case "sqlite":
		dialector = sqlite.Open(dsn)
	case "mysql":
		dialector = mysql.Open(dsn)
	case "postgres":
		dialector = postgres.Open(dsn)
	default:
		return nil, errors.New("SUPPORT_DATABASE_DRIVER must be sqlite, mysql or postgres")
	}
	db, err := gorm.Open(dialector, &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return nil, errors.New("cannot connect to support database")
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, err
	}
	if driver == "sqlite" {
		sqlDB.SetMaxOpenConns(1)
	} else {
		sqlDB.SetMaxOpenConns(10)
		sqlDB.SetMaxIdleConns(5)
	}
	sqlDB.SetConnMaxLifetime(5 * time.Minute)
	return db, nil
}
