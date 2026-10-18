package model

import (
	"errors"
	"maps"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/model_probe_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// Frozen from v1.0.0-rc.41 (2035a82a): upgrading monitoring must preserve
// historical counters and their model/group/time-bucket uniqueness guarantee.
type monitoringReleasePerfMetric struct {
	Id             int    `gorm:"primaryKey"`
	ModelName      string `gorm:"size:128;uniqueIndex:idx_perf_model_group_bucket,priority:1"`
	Group          string `gorm:"column:group;size:64;uniqueIndex:idx_perf_model_group_bucket,priority:2"`
	BucketTs       int64  `gorm:"uniqueIndex:idx_perf_model_group_bucket,priority:3;index:idx_perf_bucket_ts"`
	RequestCount   int64  `gorm:"default:0"`
	SuccessCount   int64  `gorm:"default:0"`
	TotalLatencyMs int64  `gorm:"default:0"`
	TtftSumMs      int64  `gorm:"default:0"`
	TtftCount      int64  `gorm:"default:0"`
	OutputTokens   int64  `gorm:"default:0"`
	GenerationMs   int64  `gorm:"default:0"`
}

func (monitoringReleasePerfMetric) TableName() string { return "perf_metrics" }

func TestModelProbeStoreDatabaseMatrix(t *testing.T) {
	for _, dialect := range []string{"sqlite", "mysql", "postgres"} {
		t.Run(dialect, func(t *testing.T) {
			var dialector gorm.Dialector
			switch dialect {
			case "sqlite":
				dialector = sqlite.Open(":memory:")
			case "mysql":
				dsn := os.Getenv("TEST_MYSQL_DSN")
				if dsn == "" {
					t.Skip("TEST_MYSQL_DSN is not configured")
				}
				dialector = mysql.Open(dsn)
			case "postgres":
				dsn := os.Getenv("TEST_POSTGRES_DSN")
				if dsn == "" {
					t.Skip("TEST_POSTGRES_DSN is not configured")
				}
				dialector = postgres.Open(dsn)
			}
			db, err := gorm.Open(dialector, &gorm.Config{NamingStrategy: schema.NamingStrategy{TablePrefix: "probe_contract_test_"}})
			require.NoError(t, err)
			sqlDB, err := db.DB()
			require.NoError(t, err)
			sqlDB.SetMaxOpenConns(1)
			oldDB := DB
			oldGroupCol := commonGroupCol
			DB = db
			commonGroupCol = db.Statement.Quote("group")
			t.Cleanup(func() {
				DB = oldDB
				commonGroupCol = oldGroupCol
				require.NoError(t, db.Migrator().DropTable(&ModelProbeRun{}, &PerfMetric{}, &Option{}))
				require.NoError(t, sqlDB.Close())
			})
			require.NoError(t, db.AutoMigrate(&ModelProbeRun{}, &PerfMetric{}))
			var version string
			versionQuery := "SELECT version()"
			if dialect == "sqlite" {
				versionQuery = "SELECT sqlite_version()"
			}
			require.NoError(t, db.Raw(versionQuery).Scan(&version).Error)
			t.Logf("database version: %s", version)
			freshMetric := &PerfMetric{
				ModelName: "fresh-model", Group: "default", BucketTs: 900,
				RequestCount: 1, InputTokens: 1000, CachedInputTokens: 800,
				CodingInputTokens: 1000, CodingCachedInputTokens: 800, CodingCostInputTokens: 1000,
				CodingInputCost: 0.125, CodingCache0Cost: 0.25, CodingCache100Cost: 0.0625,
			}
			require.NoError(t, UpsertPerfMetric(freshMetric))
			require.NoError(t, db.AutoMigrate(&PerfMetric{}))
			freshBuckets, err := GetPerfMetricsGroupBuckets(900, 900, []string{"default"})
			require.NoError(t, err)
			require.Len(t, freshBuckets, 1)
			assert.Equal(t, *freshMetric, freshBuckets[0], "fresh schema stores all cache and input-cost observations")

			run := &ModelProbeRun{
				RunKey: "scheduled-1000-target-math", TargetKey: "target-a", Group: "default", Model: "test-model",
				Effort: "medium", Kind: "math", StartedAt: 1000, TimeoutSeconds: 60,
				Prompt: "Return the number 21", ExpectedAnswer: "21", JudgeVersion: "math-v1", Trigger: "scheduled",
			}
			claimed, err := ClaimModelProbeRun(run)
			require.NoError(t, err)
			require.True(t, claimed)
			require.Positive(t, run.ID)
			duplicate := *run
			duplicate.ID = 0
			claimed, err = ClaimModelProbeRun(&duplicate)
			require.NoError(t, err)
			assert.False(t, claimed, "a scheduled slot must be owned by exactly one insertion")

			run.Status = ModelProbeStatusFail
			run.FinishedAt = 1001
			run.Answer = "20"
			run.OutputText = strings.Repeat("reasoning ", 10000) + "20"
			run.Attempts = 1
			updated, err := FinishModelProbeRun(run)
			require.NoError(t, err)
			require.True(t, updated)
			updated, err = FinishModelProbeRun(run)
			require.NoError(t, err)
			assert.False(t, updated, "a repeated completion must not replace a terminal result")
			for range 2 {
				require.NoError(t, db.AutoMigrate(&ModelProbeRun{}))
			}
			stored, err := GetModelProbeRun(run.ID)
			require.NoError(t, err)
			assert.Equal(t, run.OutputText, stored.OutputText, "output larger than MySQL TEXT survives migrations")
			assert.Equal(t, run.Prompt, stored.Prompt)
			assert.Equal(t, ModelProbeStatusFail, stored.OriginalStatus)
			assert.Equal(t, "21", stored.OriginalExpectedAnswer)
			assert.Zero(t, stored.PromptTokens, "zero metrics must remain zero")
			duplicate.ID = 0
			claimed, err = ClaimModelProbeRun(&duplicate)
			require.NoError(t, err)
			assert.False(t, claimed, "migrations preserve slot uniqueness")

			updated, err = RejudgeModelProbeRun(run.ID, 0, ModelProbeStatusPass, "20", "20", "math-v2")
			require.NoError(t, err)
			require.True(t, updated)
			updated, err = RejudgeModelProbeRun(run.ID, 0, ModelProbeStatusFail, "20", "21", "math-v3")
			require.NoError(t, err)
			assert.False(t, updated, "stale re-evaluation cannot overwrite a newer verdict")
			stored, err = GetModelProbeRun(run.ID)
			require.NoError(t, err)
			assert.Equal(t, ModelProbeStatusPass, stored.Status)
			assert.Equal(t, ModelProbeStatusFail, stored.OriginalStatus)
			assert.Equal(t, "21", stored.OriginalExpectedAnswer)
			assert.Equal(t, "math-v1", stored.OriginalJudgeVersion)
			assert.Equal(t, 1, stored.Revision)

			runs, err := ListModelProbeRuns(ModelProbeRunFilter{Groups: []string{"default"}, StartTs: 1000, EndTs: 1000})
			require.NoError(t, err)
			require.Len(t, runs, 1)
			assert.Empty(t, runs[0].OutputText, "dashboard reads exclude potentially large outputs")
			runs, err = ListModelProbeRuns(ModelProbeRunFilter{Groups: []string{}})
			require.NoError(t, err)
			assert.Empty(t, runs, "an empty authorized group set must not expose all runs")

			abandoned := &ModelProbeRun{RunKey: "abandoned", TargetKey: "target-a", Group: "default", Model: "test-model", Effort: "medium", Kind: "math", StartedAt: 1000, TimeoutSeconds: 60}
			claimed, err = ClaimModelProbeRun(abandoned)
			require.NoError(t, err)
			require.True(t, claimed)
			active := &ModelProbeRun{RunKey: "active", TargetKey: "target-a", Group: "default", Model: "test-model", Effort: "medium", Kind: "drawing", StartedAt: 1060, TimeoutSeconds: 60}
			claimed, err = ClaimModelProbeRun(active)
			require.NoError(t, err)
			require.True(t, claimed)
			expired, err := ExpireModelProbeRuns(1061)
			require.NoError(t, err)
			assert.EqualValues(t, 1, expired)
			abandoned.Status = ModelProbeStatusPass
			abandoned.FinishedAt = 1062
			updated, err = FinishModelProbeRun(abandoned)
			require.NoError(t, err)
			assert.False(t, updated, "a late executor must not revive an interrupted run")
			updated, err = RejudgeModelProbeRun(abandoned.ID, 0, ModelProbeStatusPass, "21", "21", "math-v2")
			require.NoError(t, err)
			assert.False(t, updated, "request errors are not answer verdicts")
			require.NoError(t, DeleteModelProbeRunsBefore(2000))
			runs, err = ListModelProbeRuns(ModelProbeRunFilter{})
			require.NoError(t, err)
			require.Len(t, runs, 1)
			assert.Equal(t, active.ID, runs[0].ID, "retention does not delete an in-flight execution")

			t.Run("upgrade_released_monitoring_schema", func(t *testing.T) {
				// The released version had performance metrics and options but no
				// model-probe table. Only the affected monitoring schema is replayed.
				require.NoError(t, db.Migrator().DropTable(&ModelProbeRun{}, &PerfMetric{}))
				require.NoError(t, db.AutoMigrate(&monitoringReleasePerfMetric{}, &Option{}))
				legacy := monitoringReleasePerfMetric{
					ModelName: "released-model", Group: "default", BucketTs: 1200,
					RequestCount: 3, SuccessCount: 2, TotalLatencyMs: 900,
					TtftSumMs: 100, TtftCount: 2, OutputTokens: 30, GenerationMs: 600,
				}
				require.NoError(t, db.Create(&legacy).Error)
				option := Option{Key: "perf_metrics_setting.retention_days", Value: "90"}
				require.NoError(t, db.Create(&option).Error)
				require.NoError(t, db.AutoMigrate(&PerfMetric{}, &ModelProbeRun{}, &Option{}))
				recorder := &migrationSQLRecorder{}
				require.NoError(t, db.Session(&gorm.Session{Logger: recorder}).AutoMigrate(&PerfMetric{}, &ModelProbeRun{}, &Option{}))
				assert.Empty(t, recorder.schemaMutations(), "a second monitoring migration must not alter the schema")
				var preserved PerfMetric
				require.NoError(t, db.First(&preserved, legacy.Id).Error)
				assert.Equal(t, legacy.ModelName, preserved.ModelName)
				assert.Equal(t, legacy.Group, preserved.Group)
				assert.Equal(t, legacy.BucketTs, preserved.BucketTs)
				assert.Equal(t, legacy.RequestCount, preserved.RequestCount)
				assert.Equal(t, legacy.SuccessCount, preserved.SuccessCount)
				assert.Equal(t, legacy.TotalLatencyMs, preserved.TotalLatencyMs)
				assert.Equal(t, legacy.TtftSumMs, preserved.TtftSumMs)
				assert.Equal(t, legacy.TtftCount, preserved.TtftCount)
				assert.Equal(t, legacy.OutputTokens, preserved.OutputTokens)
				assert.Equal(t, legacy.GenerationMs, preserved.GenerationMs)
				assert.Zero(t, preserved.InputTokens)
				assert.Zero(t, preserved.CachedInputTokens)
				assert.Zero(t, preserved.CodingInputTokens)
				assert.Zero(t, preserved.CodingCachedInputTokens)
				assert.Zero(t, preserved.CodingCostInputTokens)
				assert.Zero(t, preserved.CodingInputCost)
				assert.Zero(t, preserved.CodingCache0Cost)
				assert.Zero(t, preserved.CodingCache100Cost)
				assert.True(t, db.Migrator().HasIndex(&PerfMetric{}, "idx_perf_bucket_ts"))
				duplicateMetric := preserved
				duplicateMetric.Id = 0
				assert.Error(t, db.Create(&duplicateMetric).Error, "released model/group/bucket uniqueness survives the upgrade")
				var preservedOption Option
				require.NoError(t, db.Where(&Option{Key: option.Key}).First(&preservedOption).Error)
				assert.Equal(t, option.Value, preservedOption.Value)
				assert.Error(t, db.Create(&option).Error, "existing option keys remain unique")

				increment := &PerfMetric{
					ModelName: legacy.ModelName, Group: legacy.Group, BucketTs: legacy.BucketTs,
					RequestCount: 1, SuccessCount: 1, TotalLatencyMs: 100,
					InputTokens: 1000, CachedInputTokens: 800,
					CodingInputTokens: 1000, CodingCachedInputTokens: 800, CodingCostInputTokens: 1000,
					CodingInputCost: 0.125, CodingCache0Cost: 0.25, CodingCache100Cost: 0.0625,
				}
				require.NoError(t, UpsertPerfMetric(increment))
				increment.Id = 0
				require.NoError(t, UpsertPerfMetric(increment))
				require.NoError(t, UpsertPerfMetric(&PerfMetric{ModelName: legacy.ModelName, Group: "private", BucketTs: legacy.BucketTs, RequestCount: 9}))
				buckets, err := GetPerfMetricsGroupBuckets(legacy.BucketTs, legacy.BucketTs, []string{legacy.Group})
				require.NoError(t, err)
				require.Len(t, buckets, 1)
				assert.EqualValues(t, 5, buckets[0].RequestCount)
				assert.EqualValues(t, 4, buckets[0].SuccessCount)
				assert.EqualValues(t, 1100, buckets[0].TotalLatencyMs)
				assert.EqualValues(t, 2000, buckets[0].InputTokens)
				assert.EqualValues(t, 1600, buckets[0].CachedInputTokens)
				assert.EqualValues(t, 2000, buckets[0].CodingInputTokens)
				assert.EqualValues(t, 1600, buckets[0].CodingCachedInputTokens)
				assert.EqualValues(t, 2000, buckets[0].CodingCostInputTokens)
				assert.Equal(t, 0.25, buckets[0].CodingInputCost)
				assert.Equal(t, 0.5, buckets[0].CodingCache0Cost)
				assert.Equal(t, 0.125, buckets[0].CodingCache100Cost)
				buckets, err = GetPerfMetricsGroupBuckets(legacy.BucketTs, legacy.BucketTs, []string{})
				require.NoError(t, err)
				assert.Empty(t, buckets, "an empty authorized group set must not expose performance metrics")
				buckets, err = GetPerfMetricsGroupBuckets(legacy.BucketTs+1, legacy.BucketTs+100, nil)
				require.NoError(t, err)
				assert.Empty(t, buckets, "the group dashboard respects the requested time range")
				newRun := &ModelProbeRun{RunKey: "post-upgrade", TargetKey: "target-a", Group: "default", Model: "test-model", Effort: "medium", Kind: "math", StartedAt: 2000, TimeoutSeconds: 60}
				claimed, err := ClaimModelProbeRun(newRun)
				require.NoError(t, err)
				assert.True(t, claimed, "the probe table is available after upgrading a released database")
			})

			t.Run("configuration_atomicity", func(t *testing.T) {
				previousConfigs := config.GlobalConfig.ExportAllConfigs()
				previousPolicy := CurrentRequestPolicy()
				common.OptionMapRWMutex.Lock()
				previousOptions := common.OptionMap
				common.OptionMap = maps.Clone(previousConfigs)
				common.OptionMapRWMutex.Unlock()
				t.Cleanup(func() {
					common.OptionMapRWMutex.Lock()
					defer common.OptionMapRWMutex.Unlock()
					require.NoError(t, config.GlobalConfig.LoadFromDB(previousConfigs))
					common.OptionMap = previousOptions
					requestPolicySnapshot.Store(previousPolicy)
				})
				values := map[string]string{
					model_probe_setting.Prefix + "enabled":          "false",
					model_probe_setting.Prefix + "probe_user_id":    "123",
					model_probe_setting.Prefix + "interval_minutes": "30",
					model_probe_setting.Prefix + "math_answer":      "21",
					model_probe_setting.Prefix + "targets":          `[{"group":"default","model":"test-model","effort":"medium","token_id":456,"enabled":true,"kinds":["math"]}]`,
				}
				require.NoError(t, UpdateOptionsBulk(values))
				initial := model_probe_setting.GetSetting()
				assert.False(t, initial.Enabled)
				assert.Equal(t, 123, initial.ProbeUserID)
				require.Len(t, initial.Targets, 1)
				assert.Equal(t, 456, initial.Targets[0].TokenID)
				var persisted []Option
				require.NoError(t, db.Order(db.Statement.Quote("key")).Find(&persisted).Error)

				assert.Error(t, UpdateOptionsBulk(map[string]string{
					model_probe_setting.Prefix + "interval_minutes": "4",
					model_probe_setting.Prefix + "math_answer":      "99",
				}))
				assert.Equal(t, initial, model_probe_setting.GetSetting(), "invalid bulk input cannot publish a partial configuration")
				var unchanged []Option
				require.NoError(t, db.Order(db.Statement.Quote("key")).Find(&unchanged).Error)
				assert.Equal(t, persisted, unchanged, "invalid input must not persist any option")

				updates := 0
				require.NoError(t, db.Callback().Update().Before("gorm:update").Register("probe_option_failure", func(tx *gorm.DB) {
					if tx.Statement.Table == "probe_contract_test_options" {
						updates++
						if updates == 2 {
							tx.AddError(errors.New("simulated option write failure"))
						}
					}
				}))
				assert.Error(t, UpdateOptionsBulk(map[string]string{
					model_probe_setting.Prefix + "interval_minutes": "45",
					model_probe_setting.Prefix + "math_answer":      "42",
				}))
				require.NoError(t, db.Callback().Update().Remove("probe_option_failure"))
				assert.Equal(t, 2, updates, "the failure occurs after an earlier option write")
				assert.Equal(t, initial, model_probe_setting.GetSetting())
				unchanged = nil
				require.NoError(t, db.Order(db.Statement.Quote("key")).Find(&unchanged).Error)
				assert.Equal(t, persisted, unchanged, "a later write failure rolls back the whole configuration")

				// A malformed persisted snapshot can arrive through an older node
				// or manual repair. Reload must retain all last-known-good fields.
				require.NoError(t, db.Save(&Option{Key: model_probe_setting.Prefix + "probe_user_id", Value: "789"}).Error)
				require.NoError(t, db.Save(&Option{Key: model_probe_setting.Prefix + "targets", Value: "[{"}).Error)
				loadOptionsFromDatabase()
				assert.Equal(t, initial, model_probe_setting.GetSetting(), "invalid reload must not publish even the valid fields")
				common.OptionMapRWMutex.RLock()
				assert.Equal(t, "123", common.OptionMap[model_probe_setting.Prefix+"probe_user_id"])
				assert.Equal(t, values[model_probe_setting.Prefix+"targets"], common.OptionMap[model_probe_setting.Prefix+"targets"])
				common.OptionMapRWMutex.RUnlock()

				values[model_probe_setting.Prefix+"enabled"] = "true"
				values[model_probe_setting.Prefix+"probe_user_id"] = "789"
				values[model_probe_setting.Prefix+"targets"] = `[{"group":"default","model":"replacement-model","effort":"high","token_id":999,"enabled":true,"kinds":["math","drawing"]}]`
				for key, value := range values {
					require.NoError(t, db.Save(&Option{Key: key, Value: value}).Error)
				}
				loadOptionsFromDatabase()
				reloaded := model_probe_setting.GetSetting()
				assert.True(t, reloaded.Enabled)
				assert.Equal(t, 789, reloaded.ProbeUserID)
				require.Len(t, reloaded.Targets, 1)
				assert.Equal(t, 999, reloaded.Targets[0].TokenID)
				assert.Equal(t, "replacement-model", reloaded.Targets[0].Model)
				// No user/token records exist in this isolated database. An
				// administrator can still disable a previously valid configuration.
				require.NoError(t, UpdateOption(model_probe_setting.Prefix+"enabled", "false"))
				loadOptionsFromDatabase()
				assert.False(t, model_probe_setting.GetSetting().Enabled)
				var disabled Option
				require.NoError(t, db.Where(&Option{Key: model_probe_setting.Prefix + "enabled"}).First(&disabled).Error)
				assert.Equal(t, "false", disabled.Value)
			})

			t.Run("credential_candidates", func(t *testing.T) {
				require.NoError(t, db.AutoMigrate(&User{}, &Token{}))
				t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(&Token{}, &User{})) })
				deleted := gorm.DeletedAt{Time: time.Now(), Valid: true}
				for _, user := range []User{
					{Id: 11, Username: "probe-ordinary", DisplayName: "Probe ordinary", AffCode: "probe-ordinary", Role: common.RoleCommonUser, Status: common.UserStatusEnabled},
					{Id: 12, Username: "probe-disabled", AffCode: "probe-disabled", Role: common.RoleCommonUser, Status: common.UserStatusDisabled},
					{Id: 13, Username: "probe-admin", AffCode: "probe-admin", Role: common.RoleAdminUser, Status: common.UserStatusEnabled},
					{Id: 14, Username: "probe-deleted", AffCode: "probe-deleted", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, DeletedAt: deleted},
				} {
					require.NoError(t, db.Create(&user).Error)
				}
				for _, token := range []Token{
					{Id: 101, UserId: 11, Key: "fixture-never-expires", Name: "Never expires", Group: "default", Status: common.TokenStatusEnabled, ExpiredTime: -1},
					{Id: 102, UserId: 11, Key: "fixture-future", Name: "Future expiry", Group: "paid", Status: common.TokenStatusEnabled, ExpiredTime: common.GetTimestamp() + 3600},
					{Id: 103, UserId: 11, Key: "fixture-expired", Group: "default", Status: common.TokenStatusEnabled, ExpiredTime: common.GetTimestamp() - 1},
					{Id: 104, UserId: 11, Key: "fixture-disabled", Group: "default", Status: common.TokenStatusDisabled, ExpiredTime: -1},
					{Id: 105, UserId: 11, Key: "fixture-auto", Group: "auto", Status: common.TokenStatusEnabled, ExpiredTime: -1},
					{Id: 106, UserId: 11, Key: "fixture-empty-group", Group: "", Status: common.TokenStatusEnabled, ExpiredTime: -1},
					{Id: 107, UserId: 12, Key: "fixture-disabled-user", Group: "default", Status: common.TokenStatusEnabled, ExpiredTime: -1},
					{Id: 108, UserId: 13, Key: "fixture-admin-user", Group: "default", Status: common.TokenStatusEnabled, ExpiredTime: -1},
					{Id: 109, UserId: 14, Key: "fixture-deleted-user", Group: "default", Status: common.TokenStatusEnabled, ExpiredTime: -1},
					{Id: 110, UserId: 11, Key: "fixture-deleted-token", Group: "default", Status: common.TokenStatusEnabled, ExpiredTime: -1, DeletedAt: deleted},
				} {
					require.NoError(t, db.Create(&token).Error)
				}
				users, tokens, err := ModelProbeCredentialCandidates()
				require.NoError(t, err)
				assert.Equal(t, []ModelProbeUserCandidate{{ID: 11, Username: "probe-ordinary", DisplayName: "Probe ordinary"}}, users)
				assert.Equal(t, []ModelProbeTokenCandidate{
					{ID: 101, UserID: 11, Name: "Never expires", Group: "default"},
					{ID: 102, UserID: 11, Name: "Future expiry", Group: "paid"},
				}, tokens, "subquery and quoted group filter exclude unusable identities on every database")
				require.NoError(t, db.Model(&User{}).Where("id = ?", 11).Update("status", common.UserStatusDisabled).Error)
				users, tokens, err = ModelProbeCredentialCandidates()
				require.NoError(t, err)
				assert.Empty(t, users)
				assert.Empty(t, tokens, "no ordinary active user means no candidate credentials")
			})
		})
	}
}

func TestModelProbeOptionValidation(t *testing.T) {
	base := model_probe_setting.GetSetting()
	require.NoError(t, model_probe_setting.Validate(base))
	for _, tc := range []struct {
		name, key, value string
	}{
		{"interval too short", "interval_minutes", "4"},
		{"timeout too long", "timeout_seconds", "1801"},
		{"fractional attempts", "max_attempts", "1.5"},
		{"negative retention", "retention_days", "-1"},
		{"bad bool", "enabled", "maybe"},
		{"malformed targets", "targets", "[{"},
		{"unknown option", "upstream_secret", "unused"},
		{"empty answer", "math_answer", " "},
		{"header injection", "user_agent", "probe\r\nAuthorization: value"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Error(t, model_probe_setting.ValidateOption(model_probe_setting.Prefix+tc.key, tc.value))
		})
	}
	assert.Error(t, model_probe_setting.ValidateOptions(map[string]string{model_probe_setting.Prefix + "enabled": "true"}))
	values := map[string]string{
		model_probe_setting.Prefix + "enabled":       "true",
		model_probe_setting.Prefix + "probe_user_id": "123",
		model_probe_setting.Prefix + "targets":       `[{"group":"default","model":"test-model","effort":"medium","token_id":456,"enabled":true,"kinds":["math","drawing"]}]`,
	}
	require.NoError(t, model_probe_setting.ValidateOptions(values), "related options are validated together before enabling")
	values[model_probe_setting.Prefix+"targets"] = `[{"group":"default","model":"test-model","effort":"medium","token_id":0,"enabled":true,"kinds":["math"]}]`
	assert.Error(t, model_probe_setting.ValidateOptions(values))
	values[model_probe_setting.Prefix+"targets"] = `[{"group":"default","model":"test-model","effort":"medium","token_id":456,"enabled":true,"kinds":["math","math"]}]`
	assert.Error(t, model_probe_setting.ValidateOptions(values))
	assert.Equal(t, base, model_probe_setting.GetSetting(), "validation must not mutate the live configuration")
}
