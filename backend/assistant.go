package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/anthropics/anthropic-sdk-go/v2"
	"github.com/anthropics/anthropic-sdk-go/v2/packages/param"
	"github.com/anthropics/anthropic-sdk-go/v2/shared/constant"
)

const (
	maxHistory     = 20
	maxMessageLen  = 8000
	maxContinuance = 3
)

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func (a *App) assistantChat(w http.ResponseWriter, r *http.Request) {
	if a.claude == nil {
		writeError(w, http.StatusServiceUnavailable, "assistant is not configured: set ANTHROPIC_API_KEY")
		return
	}
	var in struct {
		Messages []chatMessage `json:"messages"`
	}
	if err := readJSON(r, &in); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json")
		return
	}
	if len(in.Messages) > maxHistory {
		in.Messages = in.Messages[len(in.Messages)-maxHistory:]
	}
	var msgs []anthropic.BetaMessageParam
	for _, m := range in.Messages {
		text := strings.TrimSpace(m.Content)
		if text == "" {
			continue
		}
		text = truncate(text, maxMessageLen)
		block := anthropic.NewBetaTextBlock(text)
		switch m.Role {
		case "user":
			msgs = append(msgs, anthropic.NewBetaUserMessage(block))
		case "assistant":
			msgs = append(msgs, anthropic.BetaMessageParam{OfAssistant: &anthropic.BetaAssistantMessageParam{Content: []anthropic.BetaContentBlockParamUnion{block}}})
		}
	}
	if len(msgs) == 0 || in.Messages[len(in.Messages)-1].Role != "user" {
		writeError(w, http.StatusBadRequest, "last message must be from the user")
		return
	}

	cfg, err := a.loadSettings(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}
	system := []anthropic.BetaTextBlockParam{{Text: cfg.SystemPrompt + "\n\n" + verdictInstructions}}
	if cfg.SiteContext {
		siteText, _, _, err := a.siteContext(r.Context())
		if err != nil {
			writeError(w, http.StatusInternalServerError, "db error")
			return
		}
		// The site context is the large, rarely changing part: cache it between requests.
		system = append(system, anthropic.BetaTextBlockParam{Text: siteText, CacheControl: anthropic.NewBetaCacheControlEphemeralParam()})
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeError(w, http.StatusInternalServerError, "streaming unsupported")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no") // tell nginx not to buffer the stream
	w.WriteHeader(http.StatusOK)

	send := func(v map[string]any) {
		b, _ := json.Marshal(v)
		fmt.Fprintf(w, "data: %s\n\n", b)
		flusher.Flush()
	}

	params := anthropic.BetaMessageNewParams{
		Model:        a.claudeModel,
		MaxTokens:    64000,
		System:       system,
		OutputConfig: anthropic.BetaOutputConfigParam{Effort: anthropic.BetaOutputConfigEffortMedium},
		Fallbacks:    anthropic.BetaFallbacksParamUnion{OfDefault: constant.ValueOf[constant.Default]()},
		Betas:        []anthropic.AnthropicBeta{anthropic.AnthropicBetaServerSideFallback2026_07_01},
		Messages:     msgs,
	}
	if cfg.WebSearch {
		params.Tools = []anthropic.BetaToolUnionParam{{
			OfWebSearchTool20260209: &anthropic.BetaWebSearchTool20260209Param{MaxUses: param.NewOpt[int64](5)},
		}}
	}

	// The web search tool runs server-side; a long search turn may come back as
	// pause_turn, in which case we resend the partial answer to let it continue.
	for i := 0; i <= maxContinuance; i++ {
		stream := a.claude.Beta.Messages.NewStreaming(r.Context(), params)
		var acc anthropic.BetaMessage
		for stream.Next() {
			ev := stream.Current()
			_ = acc.Accumulate(ev)
			switch e := ev.AsAny().(type) {
			case anthropic.BetaRawContentBlockStartEvent:
				if _, ok := e.ContentBlock.AsAny().(anthropic.BetaServerToolUseBlock); ok {
					send(map[string]any{"type": "search"})
				}
			case anthropic.BetaRawContentBlockDeltaEvent:
				if d, ok := e.Delta.AsAny().(anthropic.BetaTextDelta); ok {
					send(map[string]any{"type": "text", "text": d.Text})
				}
			}
		}
		if err := stream.Err(); err != nil {
			log.Printf("assistant: %v", err)
			send(map[string]any{"type": "error", "error": "Ассистент временно недоступен, попробуйте позже."})
			return
		}
		switch acc.StopReason {
		case anthropic.BetaStopReasonPauseTurn:
			params.Messages = append(params.Messages, acc.ToParam())
			continue
		case anthropic.BetaStopReasonRefusal:
			send(map[string]any{"type": "error", "error": "С этим запросом ассистент помочь не может."})
			return
		}
		break
	}
	send(map[string]any{"type": "done"})
}
