package model_probe

import (
	"fmt"
	"slices"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/model_probe_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

type Slot struct {
	Ts          int64  `json:"ts"`
	RunID       int64  `json:"run_id"`
	Status      string `json:"status"`
	StartedAt   int64  `json:"started_at"`
	LatencyMs   int64  `json:"latency_ms"`
	HasArtifact bool   `json:"has_artifact"`
	Answer      string `json:"answer"`
	Vehicle     string `json:"vehicle"`
	Scene       string `json:"scene"`
	ErrorKind   string `json:"error_kind"`
}

type KindStats struct {
	Pass           int     `json:"pass"`
	Fail           int     `json:"fail"`
	Total          int     `json:"total"`
	Error          int     `json:"error"`
	Running        int     `json:"running"`
	PassRate       float64 `json:"pass_rate"`
	AvgLatencyMs   int64   `json:"avg_latency_ms"`
	Latest         *Slot   `json:"latest"`
	LatestPass     *Slot   `json:"latest_pass"`
	Slots          []Slot  `json:"slots"`
	SlotsTruncated bool    `json:"slots_truncated"`
	latencySum     int64
}

type TargetOverview struct {
	Group            string    `json:"group"`
	GroupName        string    `json:"group_name"`
	GroupDescription string    `json:"group_description"`
	GroupRatio       float64   `json:"group_ratio"`
	Model            string    `json:"model"`
	Effort           string    `json:"effort"`
	Kinds            []string  `json:"kinds"`
	Math             KindStats `json:"math"`
	Drawing          KindStats `json:"drawing"`
}

type ExecutionStatus struct {
	Status         model.SystemTaskStatus `json:"status"`
	UpdatedAt      int64                  `json:"updated_at"`
	Summary        *RunSummary            `json:"summary,omitempty"`
	ReadinessError string                 `json:"readiness_error,omitempty"`
}

type OverviewData struct {
	Execution       *ExecutionStatus `json:"execution,omitempty"`
	Enabled         bool             `json:"enabled"`
	ServerNow       int64            `json:"server_now"`
	NextRunTs       int64            `json:"next_run_ts"`
	IntervalSeconds int64            `json:"interval_seconds"`
	MathAnswer      string           `json:"math_answer"`
	DrawingCatalog  DrawingCatalog   `json:"drawing_catalog"`
	Targets         []TargetOverview `json:"targets"`
}

func Overview(hours int, groups []string) (*OverviewData, error) {
	if hours != 24 && hours != 72 {
		return nil, fmt.Errorf("hours must be 24 or 72")
	}
	config := model_probe_setting.GetSetting()
	now := time.Now().Unix()
	data := &OverviewData{
		Enabled: config.Enabled, ServerNow: now, IntervalSeconds: int64(config.IntervalMinutes) * 60,
		MathAnswer: config.MathAnswer, DrawingCatalog: Defaults().DrawingCatalog, Targets: []TargetOverview{},
	}
	indices := make(map[string]int)
	for _, target := range config.Targets {
		if !target.Enabled || (groups != nil && !slices.Contains(groups, target.Group)) {
			continue
		}
		indices[targetKey(target)] = len(data.Targets)
		data.Targets = append(data.Targets, TargetOverview{
			Group: target.Group, GroupName: target.Group, GroupDescription: setting.GetUsableGroupDescription(target.Group),
			GroupRatio: ratio_setting.GetGroupRatio(target.Group), Model: target.Model, Effort: target.Effort,
			Kinds: slices.Clone(target.Kinds), Math: KindStats{Slots: []Slot{}}, Drawing: KindStats{Slots: []Slot{}},
		})
	}
	if len(data.Targets) == 0 {
		return data, nil
	}
	filter := model.ModelProbeRunFilter{StartTs: now - int64(hours)*3600, EndTs: now, Groups: groups, Limit: 1000}
	for {
		runs, err := model.ListModelProbeRuns(filter)
		if err != nil {
			return nil, err
		}
		for _, run := range runs {
			filter.BeforeID = run.ID
			index, ok := indices[run.TargetKey]
			if !ok {
				continue
			}
			target := &data.Targets[index]
			if !slices.Contains(target.Kinds, run.Kind) {
				continue
			}
			stats := &target.Math
			if run.Kind == "drawing" {
				stats = &target.Drawing
			}
			slot := Slot{Ts: run.StartedAt, RunID: run.ID, Status: run.Status, StartedAt: run.StartedAt,
				LatencyMs: run.LatencyMs, HasArtifact: run.ArtifactBytes > 0, Answer: run.Answer,
				Vehicle: run.Vehicle, Scene: run.Scene, ErrorKind: run.ErrorKind}
			// Read-time display of abandoned runs does not mutate data in GET.
			// The leased scheduled handler performs their persistent cleanup.
			if run.Status == model.ModelProbeStatusRunning && run.StartedAt+int64(run.TimeoutSeconds) < now {
				slot.Status, slot.ErrorKind = model.ModelProbeStatusError, "interrupted"
			}
			if stats.Latest == nil {
				latest := slot
				stats.Latest = &latest
			}
			if slot.Status == model.ModelProbeStatusPass && stats.LatestPass == nil {
				latest := slot
				stats.LatestPass = &latest
			}
			switch slot.Status {
			case model.ModelProbeStatusPass:
				stats.Pass++
				stats.latencySum += run.LatencyMs
			case model.ModelProbeStatusFail:
				stats.Fail++
				stats.latencySum += run.LatencyMs
			case model.ModelProbeStatusError:
				stats.Error++
			case model.ModelProbeStatusRunning:
				stats.Running++
			}
			if len(stats.Slots) < 1000 {
				stats.Slots = append(stats.Slots, slot)
			} else {
				stats.SlotsTruncated = true
			}
		}
		if len(runs) < filter.Limit {
			break
		}
	}
	for index := range data.Targets {
		for _, stats := range []*KindStats{&data.Targets[index].Math, &data.Targets[index].Drawing} {
			stats.Total = stats.Pass + stats.Fail
			if stats.Total > 0 {
				stats.PassRate = float64(stats.Pass) * 100 / float64(stats.Total)
				stats.AvgLatencyMs = stats.latencySum / int64(stats.Total)
			}
			slices.Reverse(stats.Slots)
		}
	}
	if config.Enabled {
		latest, err := model.GetLatestSystemTasks([]string{TaskType})
		if err != nil {
			return nil, err
		}
		if groups == nil {
			data.Execution = &ExecutionStatus{}
			if err := model.ValidateModelProbeIdentity(config); err != nil {
				data.Execution.ReadinessError = err.Error()
			}
			if task := latest[TaskType]; task != nil {
				data.Execution.Status, data.Execution.UpdatedAt = task.Status, task.UpdatedAt
				if task.Result != "" && task.Result != "null" {
					var summary RunSummary
					if common.UnmarshalJsonStr(task.Result, &summary) == nil {
						data.Execution.Summary = &summary
					}
				}
			}
		}
		if task := latest[TaskType]; task == nil {
			data.NextRunTs = now
		} else if task.Status != model.SystemTaskStatusRunning && task.Status != model.SystemTaskStatusPending {
			data.NextRunTs = max(now, task.UpdatedAt+data.IntervalSeconds)
		}
	}
	return data, nil
}
