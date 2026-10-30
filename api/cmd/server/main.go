package main

import (
	"log"
	"net/http"
	"os"

	"nobatak/internal/app"
	"nobatak/internal/httpapi"
)

func main() {
	path := os.Getenv("NOBAT_DB")
	if path == "" {
		path = "/workspace/data/nobat.db"
	}
	addr := os.Getenv("NOBAT_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8090"
	}
	db, err := app.Open(path)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	srv := &httpapi.Server{App: app.New(db)}
	log.Printf("nobat api %s", addr)
	log.Fatal(http.ListenAndServe(addr, srv.Handler()))
}
