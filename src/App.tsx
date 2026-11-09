// App.tsx
import React, { useEffect, useRef, useState } from "react";

type AppStatus = "Idle" | "Listening..." | "Transcribing..." | "Ready" | "Error";

function App(): JSX.Element {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState<AppStatus>("Idle");
  const [notes, setNotes] = useState("");
  const [transcript, setTranscript] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // copy feedback you already have...
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  const startListening = async (): Promise<void> => {
    try {
      setTranscript("");
      setNotes("");
      setStatus("Listening...");
      setListening(true);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        try {
          setStatus("Transcribing...");

          // stop mic tracks
          mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;

          const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const audioBytes = new Uint8Array(arrayBuffer);

          console.log("window.api =", (window as any).api);
          console.log("userAgent =", navigator.userAgent);

          // Call Electron main via preload
          const result = await window.api.transcribeAudio({
            bytes: audioBytes,
            mimeType: "audio/webm",
          });

          setTranscript(result.transcript);

          // Later: call your LLM summarizer on `result.transcript`
          // For now, just drop it into notes or keep your simulated notes.
          setNotes(`Transcript:\n${result.transcript}`);
          console.log(notes)
          setStatus("Ready");
        } catch (err) {
          console.error(err);
          setStatus("Error");
        }
      };

      recorder.start();
    } catch (err) {
      console.error(err);
      setListening(false);
      setStatus("Error");
    }
  };

  const stopListening = (): void => {
    try {
      setListening(false);
      // onstop will fire and do transcription
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;
    } catch (err) {
      console.error(err);
      setListening(false);
      setStatus("Error");
    }
  };

  const handleListenToggle = (): void => {
    if (!listening) void startListening();
    else stopListening();
  };

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(notes);
      setCopied(true);
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current);
      // ensure mic is stopped if component unmounts
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="bg-gray-100 min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT */}
        <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Capture Conversation</h2>
            <p className="text-sm text-gray-500 mb-6">Status: {status}</p>

            <button
              onClick={handleListenToggle}
              className={`px-6 py-3 rounded-xl font-medium text-white transition ${listening ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
            >
              {listening ? "Stop Listening" : "Start Listening"}
            </button>

            {/* Optional: show transcript live after transcribing */}
            {!!transcript && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Transcript</h3>
                <div className="border border-gray-200 rounded-xl p-3 text-sm whitespace-pre-wrap bg-gray-50 max-h-48 overflow-auto">
                  {transcript}
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 text-sm text-gray-400">
            Audio will be processed after stopping.
          </div>
        </div>

        {/* RIGHT */}
        <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold">Doctor Notes</h2>

            <button
              onClick={handleCopy}
              disabled={!notes}
              className={`px-4 py-2 rounded-lg text-white text-sm transition ${copied ? "bg-green-700" : "bg-green-600 hover:bg-green-700"
                } ${!notes ? "opacity-50 cursor-not-allowed" : ""}`}
              aria-live="polite"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>

          <textarea
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
            placeholder="Generated summary will appear here..."
            className="flex-1 w-full border border-gray-200 rounded-xl p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}

export default App;