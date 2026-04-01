'use client';

import { useMemo, useState } from "react";
import type { RotationRow } from "@/lib/types";

type WheelEntry = {
  id: string;
  name: string;
  total_turns: number;
  rotation_rank: number;
};

function pickRandom(entries: WheelEntry[]) {
  return entries[Math.floor(Math.random() * entries.length)];
}

export function MemberPickerWheel({ members }: { members: RotationRow[] }) {
  const [result, setResult] = useState<WheelEntry | null>(null);
  const [rotation, setRotation] = useState(0);
  const [busy, setBusy] = useState(false);

  const entries = useMemo(
    () => members.map((member) => ({
      id: member.member_id,
      name: member.name,
      total_turns: member.total_turns,
      rotation_rank: member.rotation_rank,
    })),
    [members]
  );

  const gradient = useMemo(() => {
    if (entries.length === 0) return "conic-gradient(#27355f 0deg 360deg)";
    const slice = 360 / entries.length;
    const colors = ["#8ab4ff", "#b2c9ff", "#7ed7c1", "#ffcc66", "#f79dc9", "#c8a1ff", "#7db6ff", "#ffc987"];
    let start = 0;
    const segments = entries.map((_, index) => {
      const color = colors[index % colors.length];
      const next = start + slice;
      const piece = `${color} ${start}deg ${next}deg`;
      start = next;
      return piece;
    });
    return `conic-gradient(${segments.join(", ")})`;
  }, [entries]);

  function spin() {
    if (entries.length === 0) return;
    setBusy(true);
    const winner = pickRandom(entries);
    const winnerIndex = entries.findIndex((entry) => entry.id === winner.id);
    const slice = 360 / entries.length;
    const centerAngle = winnerIndex * slice + slice / 2;
    const target = 360 - centerAngle;
    const extraTurns = 360 * (5 + Math.floor(Math.random() * 4));
    setRotation((current) => current + extraTurns + target);
    window.setTimeout(() => {
      setResult(winner);
      setBusy(false);
    }, 4200);
  }

  return (
    <section className="card">
      <div className="rowSplit compactTop">
        <div>
          <span className="eyebrow">Random pick</span>
          <h2>Spinning picker wheel</h2>
          <p>Use this when you want to pick who gets to choose the movie without following the normal rotation.</p>
        </div>
        <button className="inline" type="button" onClick={spin} disabled={busy || entries.length === 0}>
          {busy ? "Spinning..." : "Spin the wheel"}
        </button>
      </div>
      <div className="wheelShell">
        <div className="wheelPointer" aria-hidden="true" />
        <div className="wheel" style={{ backgroundImage: gradient, transform: `rotate(${rotation}deg)` }}>
          <div className="wheelCenter">Pick</div>
        </div>
      </div>
      <div className="wheelLegend">
        {entries.map((entry, index) => (
          <span className="badge" key={entry.id}>
            {index + 1}. {entry.name}
          </span>
        ))}
      </div>
      {result ? (
        <div className="featureCard">
          <strong>{result.name} is up.</strong>
          <p>
            Rotation rank: #{result.rotation_rank}. Total turns so far: {result.total_turns}. This wheel is intentionally random, so it does
            not force the normal order.
          </p>
        </div>
      ) : null}
    </section>
  );
}
