package model_probe_setting

import (
	"fmt"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const Prefix = "model_probe_setting."

type Target struct {
	Group   string   `json:"group"`
	Model   string   `json:"model"`
	Effort  string   `json:"effort"`
	TokenID int      `json:"token_id"`
	Kinds   []string `json:"kinds"`
	Enabled bool     `json:"enabled"`
}

type ModelProbeSetting struct {
	Enabled         bool     `json:"enabled"`
	PublicAccess    bool     `json:"public_access"`
	IntervalMinutes int      `json:"interval_minutes"`
	TimeoutSeconds  int      `json:"timeout_seconds"`
	MaxAttempts     int      `json:"max_attempts"`
	RetentionDays   int      `json:"retention_days"`
	ProbeUserID     int      `json:"probe_user_id"`
	UserAgent       string   `json:"user_agent"`
	MathPrompt      string   `json:"math_prompt"`
	MathAnswer      string   `json:"math_answer"`
	DrawingPrompt   string   `json:"drawing_prompt"`
	Instructions    string   `json:"instructions"`
	Targets         []Target `json:"targets"`
}

var modelProbeSetting = ModelProbeSetting{
	IntervalMinutes: 30,
	TimeoutSeconds:  300,
	MaxAttempts:     2,
	RetentionDays:   30,
	MathAnswer:      "21",
	Targets:         []Target{},
}

func init() {
	config.GlobalConfig.Register("model_probe_setting", &modelProbeSetting)
}

// GetSetting returns an independent snapshot under the option writer's lock.
func GetSetting() ModelProbeSetting {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	value := modelProbeSetting
	value.Targets = slices.Clone(value.Targets)
	for i := range value.Targets {
		value.Targets[i].Kinds = slices.Clone(value.Targets[i].Kinds)
	}
	return value
}

func Validate(value ModelProbeSetting) error {
	for _, field := range []struct {
		name     string
		value    int
		min, max int
	}{
		{"interval_minutes", value.IntervalMinutes, 5, 1440},
		{"timeout_seconds", value.TimeoutSeconds, 30, 1800},
		{"max_attempts", value.MaxAttempts, 1, 5},
		{"retention_days", value.RetentionDays, 0, 365},
	} {
		if field.value < field.min || field.value > field.max {
			return fmt.Errorf("%s must be between %d and %d", field.name, field.min, field.max)
		}
	}
	if value.ProbeUserID < 0 {
		return fmt.Errorf("probe_user_id must not be negative")
	}
	for _, field := range []struct {
		name, value string
		max         int
	}{
		{"user_agent", value.UserAgent, 200},
		{"math_prompt", value.MathPrompt, 4000},
		{"math_answer", value.MathAnswer, 16},
		{"drawing_prompt", value.DrawingPrompt, 4000},
		{"instructions", value.Instructions, 20000},
	} {
		if utf8.RuneCountInString(field.value) > field.max || strings.ContainsRune(field.value, '\x00') {
			return fmt.Errorf("%s is too long or contains a null character", field.name)
		}
	}
	if strings.TrimSpace(value.MathAnswer) == "" {
		return fmt.Errorf("math_answer must not be empty")
	}
	if strings.ContainsAny(value.UserAgent, "\r\n") {
		return fmt.Errorf("user_agent must not contain newlines")
	}
	if len(value.Targets) > 100 {
		return fmt.Errorf("at most 100 probe targets are allowed")
	}
	seen := make(map[string]bool)
	enabledTargets := 0
	for i, target := range value.Targets {
		if target.TokenID < 0 || (value.Enabled && target.Enabled && target.TokenID == 0) {
			return fmt.Errorf("target %d requires an existing token ID when enabled", i+1)
		}
		if strings.TrimSpace(target.Group) == "" || utf8.RuneCountInString(target.Group) > 64 || strings.ContainsRune(target.Group, '\x00') {
			return fmt.Errorf("target %d must have a group of 1 to 64 characters", i+1)
		}
		if strings.TrimSpace(target.Model) == "" || utf8.RuneCountInString(target.Model) > 128 || strings.ContainsRune(target.Model, '\x00') {
			return fmt.Errorf("target %d must have a model of 1 to 128 characters", i+1)
		}
		if target.Group != strings.TrimSpace(target.Group) || target.Model != strings.TrimSpace(target.Model) {
			return fmt.Errorf("target %d group and model must not have surrounding whitespace", i+1)
		}
		if !slices.Contains([]string{"low", "medium", "high", "xhigh"}, target.Effort) {
			return fmt.Errorf("target %d has an invalid effort", i+1)
		}
		if len(target.Kinds) == 0 || len(target.Kinds) > 2 {
			return fmt.Errorf("target %d must select math or drawing", i+1)
		}
		kinds := make(map[string]bool)
		for _, kind := range target.Kinds {
			if (kind != "math" && kind != "drawing") || kinds[kind] {
				return fmt.Errorf("target %d has an invalid or repeated kind", i+1)
			}
			kinds[kind] = true
		}
		key := target.Group + "\x00" + target.Model + "\x00" + target.Effort
		if seen[key] {
			return fmt.Errorf("target %d duplicates another group, model and effort", i+1)
		}
		seen[key] = true
		if target.Enabled {
			enabledTargets++
		}
	}
	if value.Enabled && (value.ProbeUserID == 0 || enabledTargets == 0) {
		return fmt.Errorf("enabled probes require a probe user and at least one enabled target")
	}
	return nil
}

// ValidateOption checks a single field without rejecting a valid bulk update
// merely because its related fields have not been applied yet.
func ValidateOption(key, value string) error {
	_, ok := strings.CutPrefix(key, Prefix)
	if !ok {
		return nil
	}
	candidate := GetSetting()
	candidate.Enabled = false
	if err := ApplyOptions(&candidate, map[string]string{key: value}); err != nil {
		return err
	}
	// Cross-field enabling requirements are checked by ValidateOptions.
	candidate.Enabled = false
	return Validate(candidate)
}

// ValidateOptions validates the proposed snapshot before any database writes.
func ValidateOptions(values map[string]string) error {
	candidate := GetSetting()
	found := false
	for key := range values {
		if strings.HasPrefix(key, Prefix) {
			found = true
			break
		}
	}
	if !found {
		return nil
	}
	if err := ApplyOptions(&candidate, values); err != nil {
		return err
	}
	return Validate(candidate)
}

// ApplyOptions parses known prefixed options strictly; malformed JSON and
// fractional integer values must not silently leave stale settings in place.
func ApplyOptions(candidate *ModelProbeSetting, values map[string]string) error {
	for key, value := range values {
		field, ok := strings.CutPrefix(key, Prefix)
		if !ok {
			continue
		}
		var err error
		switch field {
		case "enabled":
			candidate.Enabled, err = strconv.ParseBool(value)
		case "public_access":
			candidate.PublicAccess, err = strconv.ParseBool(value)
		case "interval_minutes":
			candidate.IntervalMinutes, err = strconv.Atoi(value)
		case "timeout_seconds":
			candidate.TimeoutSeconds, err = strconv.Atoi(value)
		case "max_attempts":
			candidate.MaxAttempts, err = strconv.Atoi(value)
		case "retention_days":
			candidate.RetentionDays, err = strconv.Atoi(value)
		case "probe_user_id":
			candidate.ProbeUserID, err = strconv.Atoi(value)
		case "user_agent":
			candidate.UserAgent = value
		case "math_prompt":
			candidate.MathPrompt = value
		case "math_answer":
			candidate.MathAnswer = value
		case "drawing_prompt":
			candidate.DrawingPrompt = value
		case "instructions":
			candidate.Instructions = value
		case "targets":
			err = common.UnmarshalJsonStr(value, &candidate.Targets)
		default:
			return fmt.Errorf("unknown model probe option %q", field)
		}
		if err != nil {
			return fmt.Errorf("invalid %s", key)
		}
	}
	return nil
}
