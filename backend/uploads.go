package main

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const maxUploadSize = 8 << 20 // 8 MB per image

// Allowed image types, detected from the file contents (not the name or the client's header).
// SVG is deliberately excluded: it can carry scripts.
var imageExt = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

func randomName() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// uploadImage stores an image sent as multipart field "file" and returns its public URL.
func (a *App) uploadImage(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize+(1<<20))
	file, _, err := r.FormFile("file")
	if err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, http.StatusRequestEntityTooLarge, "файл больше 8 МБ")
			return
		}
		writeError(w, http.StatusBadRequest, "нужен файл в поле file")
		return
	}
	defer file.Close()

	head := make([]byte, 512)
	n, err := io.ReadFull(file, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) {
		writeError(w, http.StatusBadRequest, "не удалось прочитать файл")
		return
	}
	ext, ok := imageExt[http.DetectContentType(head[:n])]
	if !ok {
		writeError(w, http.StatusUnsupportedMediaType, "поддерживаются JPEG, PNG, WebP и GIF")
		return
	}

	name := randomName() + ext
	path := filepath.Join(a.uploadDir, name)
	out, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		log.Printf("upload: %v", err)
		writeError(w, http.StatusInternalServerError, "не удалось сохранить файл")
		return
	}
	_, err = out.Write(head[:n])
	if err == nil {
		_, err = io.Copy(out, io.LimitReader(file, maxUploadSize))
	}
	if cerr := out.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(path)
		log.Printf("upload: %v", err)
		writeError(w, http.StatusInternalServerError, "не удалось сохранить файл")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"url": "/uploads/" + name})
}

// serveUploads serves stored images without directory listings. Names are random,
// so files never change and can be cached forever.
func (a *App) serveUploads() http.Handler {
	fs := http.StripPrefix("/uploads/", http.FileServer(http.Dir(a.uploadDir)))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		fs.ServeHTTP(w, r)
	})
}
