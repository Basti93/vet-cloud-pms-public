"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Vapi from "@vapi-ai/web";
import { Phone, PhoneOff, Mic, MicOff, Volume2, AlertCircle } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type CallStatus = "idle" | "connecting" | "active" | "ending";

interface TranscriptEntry {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

// ── Volume Visualizer ────────────────────────────────────────────────────────

function VolumeBar({ volume, active }: { volume: number; active: boolean }) {
  const bars = 12;
  return (
    <div className="flex items-center gap-1 h-10">
      {Array.from({ length: bars }).map((_, i) => {
        const threshold = (i + 1) / bars;
        const lit = active && volume > threshold * 0.8;
        return (
          <div
            key={i}
            className={`w-1.5 rounded-full transition-all duration-75 ${
              lit ? "bg-green-400" : "bg-gray-700"
            }`}
            style={{
              height: `${20 + Math.sin((i / bars) * Math.PI) * 80}%`,
            }}
          />
        );
      })}
    </div>
  );
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  isSpeaking,
}: {
  status: CallStatus;
  isSpeaking: boolean;
}) {
  const config =
    status === "idle"
      ? { color: "bg-gray-700 text-gray-300", dot: "bg-gray-500", label: "Bereit" }
      : status === "connecting"
      ? {
          color: "bg-yellow-900/50 text-yellow-300",
          dot: "bg-yellow-400 animate-pulse",
          label: "Verbindet…",
        }
      : status === "active" && isSpeaking
      ? {
          color: "bg-green-900/50 text-green-300",
          dot: "bg-green-400 animate-pulse",
          label: "KI spricht",
        }
      : status === "active"
      ? {
          color: "bg-blue-900/50 text-blue-300",
          dot: "bg-blue-400",
          label: "Aktiv — sprechen Sie",
        }
      : {
          color: "bg-gray-700 text-gray-400",
          dot: "bg-gray-500 animate-pulse",
          label: "Beendet…",
        };

  return (
    <span
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${config.color}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ── Transcript Panel ──────────────────────────────────────────────────────────

function TranscriptPanel({ entries }: { entries: TranscriptEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2 p-8">
        <Volume2 size={32} className="opacity-30" />
        <p className="text-sm text-center">
          Das Transkript erscheint hier während des Gesprächs
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`flex gap-3 ${
            entry.role === "user" ? "justify-end" : "justify-start"
          }`}
        >
          {entry.role === "assistant" && (
            <div className="w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5">
              KI
            </div>
          )}
          <div
            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              entry.role === "assistant"
                ? "bg-gray-800 text-gray-100 rounded-tl-sm"
                : "bg-blue-600 text-white rounded-tr-sm"
            }`}
          >
            {entry.text}
          </div>
          {entry.role === "user" && (
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5">
              Sie
            </div>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VoicePage() {
  const vapiRef = useRef<Vapi | null>(null);
  const [status, setStatus] = useState<CallStatus>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Init Vapi ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!publicKey) {
      setError("NEXT_PUBLIC_VAPI_PUBLIC_KEY nicht gesetzt");
      return;
    }

    const vapi = new Vapi(publicKey);
    vapiRef.current = vapi;

    vapi.on("call-start", () => {
      setStatus("active");
      setCallDuration(0);
      setError(null);
      timerRef.current = setInterval(
        () => setCallDuration((s) => s + 1),
        1000
      );
    });

    vapi.on("call-end", () => {
      setStatus("idle");
      setIsSpeaking(false);
      setVolume(0);
      setIsMuted(false);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    vapi.on("speech-start", () => setIsSpeaking(true));
    vapi.on("speech-end", () => setIsSpeaking(false));
    vapi.on("volume-level", (v) => setVolume(v));

    vapi.on("message", (msg: any) => {
      if (msg?.type === "transcript") {
        const role: "user" | "assistant" =
          msg.role === "assistant" ? "assistant" : "user";
        const text: string = msg.transcript ?? "";
        if (!text.trim()) return;

        if (msg.transcriptType === "partial") {
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === role && last.id.endsWith("-partial")) {
              return [
                ...prev.slice(0, -1),
                { ...last, text: `${text}…` },
              ];
            }
            return [
              ...prev,
              {
                id: `${Date.now()}-partial`,
                role,
                text: `${text}…`,
                timestamp: new Date(),
              },
            ];
          });
        } else if (msg.transcriptType === "final") {
          setTranscript((prev) => {
            const filtered = prev.filter((e) => !e.id.endsWith("-partial"));
            return [
              ...filtered,
              {
                id: `${Date.now()}-final`,
                role,
                text,
                timestamp: new Date(),
              },
            ];
          });
        }
      }

      // Function-call result (Terminbuchung durch KI)
      if (
        msg?.type === "function-call" &&
        msg?.functionCall?.name === "bookAppointment"
      ) {
        const params = msg.functionCall.parameters;
        setTranscript((prev) => [
          ...prev,
          {
            id: `${Date.now()}-booking`,
            role: "assistant",
            text: `📅 Termin gebucht für ${params?.patientName ?? "Patient"} am ${params?.date ?? "–"} um ${params?.time ?? "–"}`,
            timestamp: new Date(),
          },
        ]);
      }
    });

    vapi.on("error", (err: any) => {
      console.error("[Vapi Error]", err);
      setError(err?.message ?? "Unbekannter Verbindungsfehler");
      setStatus("idle");
      if (timerRef.current) clearInterval(timerRef.current);
    });

    return () => {
      vapi.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────

  const startCall = useCallback(async () => {
    const vapi = vapiRef.current;
    if (!vapi) return;

    const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
    if (!assistantId) {
      setError("NEXT_PUBLIC_VAPI_ASSISTANT_ID nicht gesetzt");
      return;
    }

    setStatus("connecting");
    setTranscript([]);
    setError(null);

    try {
      await vapi.start(assistantId);
    } catch (err: any) {
      setError(err?.message ?? "Verbindung fehlgeschlagen");
      setStatus("idle");
    }
  }, []);

  const stopCall = useCallback(async () => {
    const vapi = vapiRef.current;
    if (!vapi) return;
    setStatus("ending");
    await vapi.stop();
  }, []);

  const toggleMute = useCallback(() => {
    const vapi = vapiRef.current;
    if (!vapi || status !== "active") return;
    const newMuted = !isMuted;
    vapi.setMuted(newMuted);
    setIsMuted(newMuted);
  }, [isMuted, status]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const isCallActive =
    status === "active" || status === "connecting" || status === "ending";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI-Rezeption</h1>
        <p className="text-gray-600 mt-1">
          KI-gestützte Telefon-Rezeption — jetzt live im Browser testen
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Call Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Main Call Card */}
          <div className="bg-gray-900 rounded-2xl p-8 text-white">
            <div className="flex flex-col items-center gap-6">
              {/* Avatar */}
              <div
                className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 ${
                  status === "active"
                    ? isSpeaking
                      ? "bg-purple-600 shadow-[0_0_40px_rgba(147,51,234,0.6)]"
                      : "bg-gray-700 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                    : status === "connecting"
                    ? "bg-yellow-600 shadow-[0_0_20px_rgba(234,179,8,0.4)] animate-pulse"
                    : "bg-gray-800"
                }`}
              >
                <span className="text-5xl">🤖</span>
                {status === "active" && isSpeaking && (
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-gray-900 flex items-center justify-center">
                    <span className="text-xs">🔊</span>
                  </span>
                )}
              </div>

              {/* Status */}
              <StatusBadge status={status} isSpeaking={isSpeaking} />

              {/* Timer */}
              {status === "active" && (
                <div className="text-3xl font-mono text-gray-300 tabular-nums">
                  {formatDuration(callDuration)}
                </div>
              )}

              {/* Volume bars */}
              {status === "active" && (
                <VolumeBar volume={volume} active={isSpeaking} />
              )}

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/50 px-4 py-2 rounded-lg w-full">
                  <AlertCircle size={16} className="flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Call Buttons */}
              {!isCallActive ? (
                <button
                  onClick={startCall}
                  className="w-full py-4 bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-xl font-semibold text-lg transition-all duration-150 flex items-center justify-center gap-3 shadow-lg"
                >
                  <Phone size={22} />
                  Demo starten
                </button>
              ) : (
                <div className="w-full space-y-3">
                  <button
                    onClick={stopCall}
                    disabled={status === "ending"}
                    className="w-full py-4 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:opacity-50 rounded-xl font-semibold text-lg transition-all duration-150 flex items-center justify-center gap-3 shadow-lg"
                  >
                    <PhoneOff size={22} />
                    Auflegen
                  </button>
                  {status === "active" && (
                    <button
                      onClick={toggleMute}
                      className={`w-full py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                        isMuted
                          ? "bg-yellow-600/80 hover:bg-yellow-500"
                          : "bg-gray-700 hover:bg-gray-600"
                      }`}
                    >
                      {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
                      {isMuted ? "Stummschaltung aufheben" : "Stummschalten"}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Features */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">Was kann die KI?</h3>
            <div className="space-y-2 text-sm">
              {[
                ["📅", "Termine buchen und bestätigen"],
                ["🐾", "Tiere & Halter aufnehmen"],
                ["🕐", "Verfügbarkeit prüfen"],
                ["🔔", "Erinnerungen ankündigen"],
                ["🌙", "24/7 Notfallaufnahme"],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-2 text-gray-700">
                  <span>{icon}</span>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Transcript Panel */}
        <div
          className="lg:col-span-3 bg-gray-900 rounded-2xl flex flex-col overflow-hidden"
          style={{ minHeight: "520px" }}
        >
          <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-white font-semibold">Live-Transkript</h2>
            {transcript.length > 0 && (
              <button
                onClick={() => setTranscript([])}
                className="text-xs text-gray-500 hover:text-gray-400 transition"
              >
                Leeren
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            <TranscriptPanel entries={transcript} />
          </div>
        </div>
      </div>

      {/* Stats row (live data TBD) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Anrufe heute", value: "–", icon: "📞" },
          { label: "Termine gebucht (KI)", value: "–", icon: "📅" },
          { label: "Ø Gesprächszeit", value: "–", icon: "⏱️" },
        ].map(({ label, value, icon }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
