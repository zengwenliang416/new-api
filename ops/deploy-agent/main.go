package main

import (
	"crypto/subtle"
	"log"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"
)

func main() {
	token := os.Getenv("DEPLOY_AGENT_TOKEN")
	script := os.Getenv("ROLLBACK_SCRIPT")
	if len(token) < 32 || script == "" {
		log.Fatal("deploy agent is not configured")
	}

	var mu sync.Mutex
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("POST /rollback", func(w http.ResponseWriter, r *http.Request) {
		if !authorized(r, token) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if !mu.TryLock() {
			http.Error(w, "busy", http.StatusConflict)
			return
		}
		cmd := exec.Command("sh", script)
		cmd.Dir = "/root/new-api"
		if err := cmd.Start(); err != nil {
			mu.Unlock()
			http.Error(w, "start failed", http.StatusInternalServerError)
			return
		}
		go func() {
			defer mu.Unlock()
			_ = cmd.Wait()
		}()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"ok":true}`))
	})

	server := &http.Server{
		Addr:              ":8091",
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Fatal(server.ListenAndServe())
}

func authorized(r *http.Request, token string) bool {
	header := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	got := header[len(prefix):]
	if len(got) != len(token) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(got), []byte(token)) == 1
}
