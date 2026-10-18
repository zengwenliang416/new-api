package model

import (
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/model_probe_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ValidateModelProbeIdentity binds the scheduled job to explicitly selected
// ordinary-user credentials. Disabling remains possible after their expiry.
func ValidateModelProbeIdentity(value model_probe_setting.ModelProbeSetting) error {
	if !value.Enabled {
		return nil
	}
	var user User
	if err := DB.Select("id", "status", "role").First(&user, value.ProbeUserID).Error; err != nil || user.Status != common.UserStatusEnabled || user.Role != common.RoleCommonUser {
		return fmt.Errorf("select an active ordinary user for model probes")
	}
	for _, target := range value.Targets {
		if !target.Enabled {
			continue
		}
		if target.Group == "auto" || !ratio_setting.ContainsGroupRatio(target.Group) {
			return fmt.Errorf("probe targets require a configured explicit group")
		}
		var token Token
		if err := DB.Select("id", "user_id", "status", "expired_time", commonGroupCol).First(&token, target.TokenID).Error; err != nil || token.UserId != value.ProbeUserID || token.Group != target.Group || token.Status != common.TokenStatusEnabled || (token.ExpiredTime != -1 && token.ExpiredTime <= common.GetTimestamp()) {
			return fmt.Errorf("each enabled target requires an active token belonging to the selected user and group")
		}
	}
	return nil
}

type ModelProbeUserCandidate struct {
	ID          int    `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

type ModelProbeTokenCandidate struct {
	ID     int    `json:"id"`
	UserID int    `json:"user_id"`
	Name   string `json:"name"`
	Group  string `json:"group"`
}

// Read only non-secret columns; a credential selector must never load keys.
func ModelProbeCredentialCandidates() ([]ModelProbeUserCandidate, []ModelProbeTokenCandidate, error) {
	users := []ModelProbeUserCandidate{}
	tokens := []ModelProbeTokenCandidate{}
	if err := DB.Model(&User{}).Select("id", "username", "display_name").
		Where("status = ? AND role = ?", common.UserStatusEnabled, common.RoleCommonUser).
		Order("id ASC").Find(&users).Error; err != nil {
		return nil, nil, err
	}
	if len(users) == 0 {
		return users, tokens, nil
	}
	// Subquery avoids a driver-dependent parameter limit for larger accounts.
	activeUsers := DB.Model(&User{}).Select("id").Where("status = ? AND role = ?", common.UserStatusEnabled, common.RoleCommonUser)
	err := DB.Model(&Token{}).Select("id", "user_id", "name", commonGroupCol).
		Where("user_id IN (?) AND status = ? AND (expired_time = ? OR expired_time > ?)", activeUsers, common.TokenStatusEnabled, -1, common.GetTimestamp()).
		Where(commonGroupCol+" <> ? AND "+commonGroupCol+" <> ?", "", "auto").
		Order("id ASC").Find(&tokens).Error
	return users, tokens, err
}

const (
	ModelProbeStatusRunning = "running"
	ModelProbeStatusPass    = "pass"
	ModelProbeStatusFail    = "fail"
	ModelProbeStatusError   = "error"
)

// ModelProbeRun contains the immutable request snapshot and the latest verdict.
// Original* retains the first verdict when a historical run is re-evaluated.
// RunKey is a SHA-256-sized idempotency key chosen by the scheduler; a unique
// database constraint, rather than an in-process mutex, owns the execution slot.
type ModelProbeRun struct {
	ID                     int64  `json:"id" gorm:"primaryKey"`
	RunKey                 string `json:"-" gorm:"size:64;not null;uniqueIndex:idx_probe_run_key"`
	TargetKey              string `json:"target_key" gorm:"size:64;not null;index:idx_probe_target_started,priority:1"`
	Group                  string `json:"group" gorm:"column:probe_group;size:64;not null"`
	Model                  string `json:"model" gorm:"size:128;not null"`
	Effort                 string `json:"effort" gorm:"size:16;not null"`
	ProbeUserID            int    `json:"-"`
	TokenID                int    `json:"-"`
	Kind                   string `json:"kind" gorm:"size:16;not null"`
	Status                 string `json:"status" gorm:"size:16;not null;index:idx_probe_status_started,priority:1"`
	StartedAt              int64  `json:"started_at" gorm:"not null;index:idx_probe_target_started,priority:2;index:idx_probe_status_started,priority:2;index:idx_probe_started"`
	FinishedAt             int64  `json:"finished_at"`
	TimeoutSeconds         int    `json:"-"`
	LatencyMs              int64  `json:"latency_ms"`
	FirstTokenMs           int64  `json:"first_token_ms"`
	PromptTokens           int64  `json:"prompt_tokens"`
	CompletionTokens       int64  `json:"completion_tokens"`
	Attempts               int    `json:"attempts"`
	Answer                 string `json:"answer" gorm:"size:128"`
	Prompt                 string `json:"prompt" gorm:"size:2097152"`
	Instructions           string `json:"-" gorm:"size:2097152"`
	OutputText             string `json:"output_text" gorm:"size:2097152"`
	ArtifactHTML           string `json:"-" gorm:"size:2097152"`
	ArtifactBytes          int    `json:"artifact_bytes"`
	Vehicle                string `json:"vehicle" gorm:"size:64"`
	Scene                  string `json:"scene" gorm:"size:64"`
	ErrorKind              string `json:"error_kind" gorm:"size:64"`
	ErrorDetail            string `json:"-" gorm:"type:text"`
	Trigger                string `json:"trigger" gorm:"column:trigger_kind;size:16"`
	ExpectedAnswer         string `json:"expected_answer" gorm:"size:16"`
	JudgeVersion           string `json:"judge_version" gorm:"size:64"`
	OriginalStatus         string `json:"original_status" gorm:"size:16"`
	OriginalAnswer         string `json:"original_answer" gorm:"size:128"`
	OriginalExpectedAnswer string `json:"original_expected_answer" gorm:"size:16"`
	OriginalJudgeVersion   string `json:"original_judge_version" gorm:"size:64"`
	Revision               int    `json:"revision"`
}

type ModelProbeRunFilter struct {
	StartTs        int64
	EndTs          int64
	TargetKey      string
	Groups         []string // nil: unrestricted; empty slice: no visible groups
	Kind           string
	Status         string
	BeforeID       int64
	Limit          int
	IncludeContent bool // Raw prompts, output and artifacts are omitted for dashboards.
}

func ClaimModelProbeRun(run *ModelProbeRun) (bool, error) {
	if run == nil || run.ID != 0 || len(run.RunKey) == 0 || len(run.RunKey) > 64 || len(run.TargetKey) == 0 || len(run.TargetKey) > 64 {
		return false, fmt.Errorf("a new probe run requires valid run and target keys")
	}
	if run.Kind != "math" && run.Kind != "drawing" {
		return false, fmt.Errorf("invalid probe kind")
	}
	if run.StartedAt <= 0 || run.TimeoutSeconds < 1 || run.TimeoutSeconds > 9000 {
		return false, fmt.Errorf("invalid probe start time or execution timeout")
	}
	run.Status = ModelProbeStatusRunning
	run.Revision = 0
	// Duplicate slots are expected after a worker handoff. Do not log the
	// failed INSERT with its complete prompt and instructions attached.
	if err := DB.Session(&gorm.Session{Logger: DB.Logger.LogMode(logger.Silent)}).Create(run).Error; err != nil {
		// Checking the unique slot after a failed insert works with all drivers
		// without INSERT IGNORE hiding data errors or CLIENT_FOUND_ROWS changing
		// the meaning of an upsert's RowsAffected on MySQL.
		var existing ModelProbeRun
		if lookupErr := DB.Select("id").Where("run_key = ?", run.RunKey).First(&existing).Error; lookupErr == nil {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// FinishModelProbeRun only updates a claimed running row. A delayed executor
// cannot overwrite an expired run or an administrator's later re-evaluation.
func FinishModelProbeRun(run *ModelProbeRun) (bool, error) {
	if run == nil || run.ID <= 0 || !slices.Contains([]string{ModelProbeStatusPass, ModelProbeStatusFail, ModelProbeStatusError}, run.Status) {
		return false, fmt.Errorf("invalid terminal probe run")
	}
	if run.FinishedAt < run.StartedAt || run.LatencyMs < 0 || run.FirstTokenMs < 0 || run.PromptTokens < 0 || run.CompletionTokens < 0 || run.Attempts < 0 {
		return false, fmt.Errorf("invalid probe result metrics")
	}
	if len(run.OutputText) > 2*1024*1024 || len(run.ArtifactHTML) > 2*1024*1024 || len(run.Answer) > 128 {
		return false, fmt.Errorf("probe result exceeds its storage limit")
	}
	result := DB.Model(&ModelProbeRun{}).
		Where("id = ? AND run_key = ? AND status = ?", run.ID, run.RunKey, ModelProbeStatusRunning).
		Updates(map[string]any{
			"status": run.Status, "finished_at": run.FinishedAt,
			"latency_ms": run.LatencyMs, "first_token_ms": run.FirstTokenMs,
			"prompt_tokens": run.PromptTokens, "completion_tokens": run.CompletionTokens,
			"attempts": run.Attempts, "answer": run.Answer, "output_text": run.OutputText,
			"artifact_html": run.ArtifactHTML, "artifact_bytes": len(run.ArtifactHTML),
			"error_kind": run.ErrorKind, "error_detail": run.ErrorDetail,
			"expected_answer": run.ExpectedAnswer, "judge_version": run.JudgeVersion,
			"original_status": run.Status, "original_answer": run.Answer,
			"original_expected_answer": run.ExpectedAnswer, "original_judge_version": run.JudgeVersion,
		})
	return result.RowsAffected == 1, result.Error
}

func GetModelProbeRun(id int64) (*ModelProbeRun, error) {
	var run ModelProbeRun
	if err := DB.First(&run, id).Error; err != nil {
		return nil, err
	}
	return &run, nil
}

func ListModelProbeRuns(filter ModelProbeRunFilter) ([]ModelProbeRun, error) {
	runs := []ModelProbeRun{}
	query := DB.Model(&ModelProbeRun{})
	if !filter.IncludeContent {
		query = query.Omit("prompt", "instructions", "output_text", "artifact_html", "error_detail")
	}
	if filter.StartTs > 0 {
		query = query.Where("started_at >= ?", filter.StartTs)
	}
	if filter.EndTs > 0 {
		query = query.Where("started_at <= ?", filter.EndTs)
	}
	if filter.TargetKey != "" {
		query = query.Where("target_key = ?", filter.TargetKey)
	}
	if filter.Groups != nil {
		if len(filter.Groups) == 0 {
			return runs, nil
		}
		query = query.Where("probe_group IN ?", filter.Groups)
	}
	if filter.Kind != "" {
		query = query.Where("kind = ?", filter.Kind)
	}
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.BeforeID > 0 {
		query = query.Where("id < ?", filter.BeforeID)
	}
	limit := filter.Limit
	if limit <= 0 {
		limit = 1000
	}
	err := query.Order("id DESC").Limit(min(limit, 50000)).Find(&runs).Error
	return runs, err
}

// RejudgeModelProbeRun is an optimistic update: only the revision read by the
// evaluator can be replaced, and network errors are never turned into verdicts.
func RejudgeModelProbeRun(id int64, expectedRevision int, status, answer, expectedAnswer, judgeVersion string) (bool, error) {
	if id <= 0 || expectedRevision < 0 || (status != ModelProbeStatusPass && status != ModelProbeStatusFail) || len(answer) > 128 || len(expectedAnswer) > 16 || strings.TrimSpace(expectedAnswer) == "" || len(judgeVersion) > 64 {
		return false, fmt.Errorf("invalid probe re-evaluation")
	}
	result := DB.Model(&ModelProbeRun{}).
		Where("id = ? AND kind = ? AND revision = ? AND status IN ?", id, "math", expectedRevision, []string{ModelProbeStatusPass, ModelProbeStatusFail}).
		Updates(map[string]any{
			"status": status, "answer": answer, "expected_answer": expectedAnswer,
			"judge_version": judgeVersion, "revision": expectedRevision + 1,
		})
	return result.RowsAffected == 1, result.Error
}

// ExpireModelProbeRuns closes runs abandoned by a crashed process. The timeout
// stored with the run is the entire execution budget, including all attempts.
func ExpireModelProbeRuns(now int64) (int64, error) {
	if now <= 0 {
		return 0, errors.New("invalid probe expiry time")
	}
	result := DB.Model(&ModelProbeRun{}).
		Where("status = ? AND started_at + timeout_seconds < ?", ModelProbeStatusRunning, now).
		Updates(map[string]any{
			"status": ModelProbeStatusError, "original_status": ModelProbeStatusError,
			"finished_at": now, "error_kind": "interrupted",
			"error_detail": "Probe execution did not finish within its recorded deadline",
		})
	return result.RowsAffected, result.Error
}

func DeleteModelProbeRunsBefore(cutoff int64) error {
	if cutoff <= 0 {
		return nil
	}
	return DB.Where("started_at < ? AND status <> ?", cutoff, ModelProbeStatusRunning).Delete(&ModelProbeRun{}).Error
}
