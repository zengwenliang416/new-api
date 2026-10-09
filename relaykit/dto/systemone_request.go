package dto

import (
	"encoding/json"
	"net/http"

	"github.com/QuantumNous/new-api/relaykit/types"
)

// SystemOneRequest is a TypeSafe System One evaluation.
// RawBody preserves the original JSON so unknown fields are forwarded intact.
type SystemOneRequest struct {
	Model   string          `json:"model"`
	RawBody json.RawMessage `json:"-"`
}

func (r *SystemOneRequest) GetTokenCountMeta() *types.TokenCountMeta {
	combineText := ""
	if len(r.RawBody) > 0 {
		combineText = string(r.RawBody)
	}
	return &types.TokenCountMeta{
		CombineText: combineText,
		TokenType:   types.TokenTypeTokenizer,
	}
}

func (r *SystemOneRequest) IsStream(_ *http.Request) bool {
	return false
}

func (r *SystemOneRequest) SetModelName(modelName string) {
	if modelName != "" {
		r.Model = modelName
	}
}
