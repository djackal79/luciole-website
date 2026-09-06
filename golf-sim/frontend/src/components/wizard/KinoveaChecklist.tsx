import React, { useState } from 'react';
import { CheckCircle2, Circle, Copy, Check, ExternalLink, Mic, Video, Send } from 'lucide-react';

export const KinoveaChecklist: React.FC = () => {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({
    retro: true,
    audio: false,
    webhook: true,
    camera2: false,
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const toggleCheck = (id: string) => {
    setCheckedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const webhookUrl = 'http://127.0.0.1:8000/api/ingest/body_swing';
  const webhookArgs = '--camera face_on --capture_fps 30 --container_fps 30';

  return (
    <div className="flex flex-col gap-4 text-xs font-mono">
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-neutral-300">
        <p className="leading-relaxed">
          Kinovea captures your body swing automatically using an acoustic trigger on club-ball impact, 
          saving a buffered clip retroactively without manual intervention.
        </p>
      </div>

      <div className="space-y-3">
        {/* Step 1: Retroactive Mode */}
        <div 
          onClick={() => toggleCheck('retro')}
          className="flex items-start gap-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-colors"
        >
          {checkedItems.retro ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Circle className="w-5 h-5 text-neutral-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold">1. Enable Retroactive Buffer</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Recommended: 4.0s</span>
            </div>
            <p className="text-neutral-400 text-[11px] mt-1">
              In Kinovea: <em>Options → Preferences → Capture → Recording Mode</em>. Select <strong>Retroactive Mode</strong> with 3.0s pre-trigger and 1.0s post-trigger.
            </p>
          </div>
        </div>

        {/* Step 2: Audio Trigger */}
        <div 
          onClick={() => toggleCheck('audio')}
          className="flex items-start gap-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-colors"
        >
          {checkedItems.audio ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Circle className="w-5 h-5 text-neutral-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold">2. Calibrate Microphone Threshold</span>
              <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Impact Peak</span>
            </div>
            <p className="text-neutral-400 text-[11px] mt-1">
              Set the trigger threshold above ambient simulator noise (projector fans / AC) so only the acoustic ball strike trips recording.
            </p>
          </div>
        </div>

        {/* Step 3: Webhook Automation */}
        <div 
          onClick={() => toggleCheck('webhook')}
          className="flex items-start gap-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-colors"
        >
          {checkedItems.webhook ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Circle className="w-5 h-5 text-neutral-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="text-white font-bold">3. Configure Post-Capture Webhook</span>
            <p className="text-neutral-400 text-[11px] mt-1 mb-2">
              In Kinovea: <em>Capture Screen → Automation → On Video Saved</em>. Run curl or HTTP POST to dispatch the file:
            </p>

            <div className="bg-black/60 p-2 rounded-lg border border-neutral-800 flex items-center justify-between gap-2">
              <span className="text-emerald-400 truncate">{webhookUrl}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  copyText(webhookUrl, 'url');
                }}
                className="p-1 hover:bg-neutral-800 rounded text-neutral-400 hover:text-white"
                title="Copy Webhook URL"
              >
                {copiedKey === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Step 4: Behind (DTL) Camera */}
        <div 
          onClick={() => toggleCheck('camera2')}
          className="flex items-start gap-3 p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 cursor-pointer transition-colors"
        >
          {checkedItems.camera2 ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Circle className="w-5 h-5 text-neutral-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-white font-bold">4. Secondary Down-The-Line (Behind) Camera</span>
              <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">Optional Cam 2</span>
            </div>
            <p className="text-neutral-400 text-[11px] mt-1">
              Position high-speed USB/Webcam directly behind hands pointing down target line. Export to <code>kinovea_export/behind/</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
