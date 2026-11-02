package main

import (
	"context"
	"log"
	"net/http"
	"net/url"
	"os"
	"time"

	"github.com/anthropics/anthropic-sdk-go/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type App struct {
	db          *pgxpool.Pool
	jwtSecret   []byte
	claude      *anthropic.Client
	claudeModel string
	uploadDir   string
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	ctx := context.Background()
	// DATABASE_URL wins; otherwise the DSN is assembled from the same POSTGRES_*
	// variables the postgres image uses, so one .env configures both containers.
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		user := env("POSTGRES_USER", "postgres")
		dsn = (&url.URL{
			Scheme:   "postgres",
			User:     url.UserPassword(user, os.Getenv("POSTGRES_PASSWORD")),
			Host:     env("DB_HOST", "db") + ":" + env("DB_PORT", "5432"),
			Path:     env("POSTGRES_DB", user),
			RawQuery: "sslmode=" + env("DB_SSLMODE", "disable"),
		}).String()
	}

	var db *pgxpool.Pool
	var err error
	// Postgres may still be starting when the container comes up.
	for i := 0; i < 30; i++ {
		db, err = pgxpool.New(ctx, dsn)
		if err == nil {
			if err = db.Ping(ctx); err == nil {
				break
			}
		}
		log.Printf("waiting for database: %v", err)
		time.Sleep(time.Second)
	}
	if err != nil {
		log.Fatalf("database: %v", err)
	}

	if err := migrate(ctx, db); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	app := &App{db: db, jwtSecret: []byte(env("JWT_SECRET", "dev-secret-change-me")), claudeModel: env("ANTHROPIC_MODEL", "claude-opus-5-5"), uploadDir: env("UPLOAD_DIR", "/data/uploads")}
	if err := os.MkdirAll(app.uploadDir, 0o755); err != nil {
		log.Fatalf("upload dir: %v", err)
	}
	if os.Getenv("ANTHROPIC_API_KEY") != "" {
		c := anthropic.NewClient()
		app.claude = &c
	} else {
		log.Print("ANTHROPIC_API_KEY is not set: AI assistant is disabled")
	}
	if err := seedSettings(ctx, app); err != nil {
		log.Fatalf("seed settings: %v", err)
	}
	if err := app.seedAdmin(ctx, env("ADMIN_EMAIL", "admin@mdn.kg"), env("ADMIN_PASSWORD", "admin123")); err != nil {
		log.Fatalf("seed admin: %v", err)
	}

	addr := ":" + env("PORT", "8080")
	log.Printf("listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, logRequests(app.routes())))
}

func (a *App) routes() http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	mux.HandleFunc("POST /api/auth/register", a.register)
	mux.HandleFunc("POST /api/auth/login", a.login)
	mux.HandleFunc("GET /api/me", a.requireAuth(a.me))
	mux.HandleFunc("GET /api/me/results", a.requireAuth(a.myResults))
	mux.HandleFunc("GET /api/me/results/{id}", a.requireAuth(a.myResult))

	mux.Handle("GET /uploads/", a.serveUploads())
	mux.HandleFunc("POST /api/admin/uploads", a.requireAdmin(a.uploadImage))

	mux.HandleFunc("GET /api/assistant/status", a.assistantStatus)
	mux.HandleFunc("GET /api/assistant/scripts", a.listScripts)
	mux.HandleFunc("POST /api/assistant/chat", a.requireAuth(a.assistantChat))

	mux.HandleFunc("GET /api/news", a.listNews)
	mux.HandleFunc("GET /api/news/{id}", a.getNews)

	mux.HandleFunc("GET /api/tests", a.listTests)
	mux.HandleFunc("GET /api/tests/{id}", a.getTest)
	mux.HandleFunc("POST /api/tests/{id}/submit", a.requireAuth(a.submitTest))
	mux.HandleFunc("POST /api/tests/{id}/survey", a.submitSurvey)

	mux.HandleFunc("GET /api/admin/stats", a.requireAdmin(a.adminStats))
	mux.HandleFunc("GET /api/admin/results/{id}", a.requireAdmin(a.adminResult))
	mux.HandleFunc("GET /api/admin/students", a.requireAdmin(a.adminStudents))
	mux.HandleFunc("GET /api/admin/students/{id}", a.requireAdmin(a.adminStudent))

	mux.HandleFunc("GET /api/admin/news", a.requireAdmin(a.adminListNews))
	mux.HandleFunc("POST /api/admin/news", a.requireAdmin(a.createNews))
	mux.HandleFunc("PUT /api/admin/news/{id}", a.requireAdmin(a.updateNews))
	mux.HandleFunc("DELETE /api/admin/news/{id}", a.requireAdmin(a.deleteNews))

	mux.HandleFunc("GET /api/admin/assistant/settings", a.requireAdmin(a.adminGetSettings))
	mux.HandleFunc("PUT /api/admin/assistant/settings", a.requireAdmin(a.adminUpdateSettings))

	mux.HandleFunc("GET /api/admin/scripts", a.requireAdmin(a.adminListScripts))
	mux.HandleFunc("POST /api/admin/scripts", a.requireAdmin(a.createScript))
	mux.HandleFunc("PUT /api/admin/scripts/{id}", a.requireAdmin(a.updateScript))
	mux.HandleFunc("DELETE /api/admin/scripts/{id}", a.requireAdmin(a.deleteScript))

	mux.HandleFunc("GET /api/admin/tests", a.requireAdmin(a.adminListTests))
	mux.HandleFunc("GET /api/admin/tests/{id}", a.requireAdmin(a.adminGetTest))
	mux.HandleFunc("POST /api/admin/tests", a.requireAdmin(a.createTest))
	mux.HandleFunc("PUT /api/admin/tests/{id}", a.requireAdmin(a.updateTest))
	mux.HandleFunc("DELETE /api/admin/tests/{id}", a.requireAdmin(a.deleteTest))
	mux.HandleFunc("GET /api/admin/tests/{id}/survey", a.requireAdmin(a.adminSurvey))
	mux.HandleFunc("DELETE /api/admin/tests/{id}/survey", a.requireAdmin(a.adminClearSurvey))
	mux.HandleFunc("POST /api/admin/tests/{id}/survey/import", a.requireAdmin(a.adminImportSurvey))
	mux.HandleFunc("POST /api/admin/tests/{id}/survey/fill", a.requireAdmin(a.adminFillSurvey))

	return mux
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
	})
}
