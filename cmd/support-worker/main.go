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

package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/QuantumNous/new-api/supportworker"
)

func main() {
	if err := run(); err != nil {
		// Config and constructor errors intentionally omit DSNs and credentials.
		log.Print(err)
		os.Exit(1)
	}
}

func run() error {
	db, err := supportworker.OpenDatabase(os.Getenv("SUPPORT_DATABASE_DRIVER"), os.Getenv("SUPPORT_DATABASE_DSN"))
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return errors.New("cannot initialize support database")
	}
	defer sqlDB.Close()
	worker, err := supportworker.NewServer(supportworker.ConfigFromEnv(), db)
	if err != nil {
		return err
	}
	address := os.Getenv("SUPPORT_LISTEN_ADDR")
	if address == "" {
		address = "127.0.0.1:8091"
	}
	server := &http.Server{Addr: address, Handler: worker.Handler(), ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout: 30 * time.Second, WriteTimeout: 45 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16 * 1024}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	maintenanceDone := make(chan struct{})
	go func() {
		defer close(maintenanceDone)
		_ = worker.RunMaintenance(ctx)
	}()
	serverDone := make(chan error, 1)
	go func() { serverDone <- server.ListenAndServe() }()
	select {
	case err := <-serverDone:
		stop()
		<-maintenanceDone
		if !errors.Is(err, http.ErrServerClosed) {
			return errors.New("support worker HTTP server stopped unexpectedly")
		}
		return nil
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		err := server.Shutdown(shutdown)
		<-maintenanceDone
		return err
	}
}
