package support_setting

import (
	"strconv"
	"strings"
)

const (
	DefaultSessionTTLMinutes = 30
	MinSessionTTLMinutes     = 5
	MaxSessionTTLMinutes     = 240
	MaxSiteIDLength          = 120
	MinSecretLength          = 32
)

var (
	WorkerUrl          = ""
	JwtSecret          = ""
	CallbackSecret     = ""
	SiteID             = "default"
	SessionTTLMinutes  = DefaultSessionTTLMinutes
	TranslationEnabled = false
)

func IsWorkerConfigured() bool {
	return strings.TrimSpace(WorkerUrl) != ""
}

func IsTranslationEnabled() bool {
	return TranslationEnabled
}

func NormalizeSiteID(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "default"
	}
	return value
}

func NormalizeSessionTTLMinutes(value string) int {
	minutes, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || minutes < MinSessionTTLMinutes || minutes > MaxSessionTTLMinutes {
		return DefaultSessionTTLMinutes
	}
	return minutes
}
