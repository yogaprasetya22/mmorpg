package ws

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	ClientFPSGauge = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "game_client_fps_average",
			Help: "Average FPS recorded by the game client over a 10s window",
		},
		[]string{"player_id", "username"},
	)

	ClientFPSMinGauge = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "game_client_fps_minimum",
			Help: "Minimum FPS recorded by the game client over a 10s window",
		},
		[]string{"player_id", "username"},
	)

	ClientFPSMaxGauge = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "game_client_fps_maximum",
			Help: "Maximum FPS recorded by the game client over a 10s window",
		},
		[]string{"player_id", "username"},
	)

	ClientFPSJitterGauge = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "game_client_fps_jitter_ms",
			Help: "Jitter of frame times in milliseconds recorded by the game client over a 10s window",
		},
		[]string{"player_id", "username"},
	)

	ClientStutterCounter = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "game_client_stutters_total",
			Help: "Total count of stutters (>100ms frame delta) reported by the game client",
		},
		[]string{"player_id", "username"},
	)

	ClientP99DtGauge = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "game_client_p99_dt_ms",
			Help: "99th percentile frame delta time in milliseconds recorded by the game client",
		},
		[]string{"player_id", "username"},
	)
)
