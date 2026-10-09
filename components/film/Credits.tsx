"use client";

import { useState } from "react";
import { buildCreditsCard, download, starName, type FilmState } from "@/lib/film";

// Rolling end credits with the photo strip in the middle, and the three things you can take home.
export default function Credits({ film, onReplay, reduced }: { film: FilmState; onReplay: () => void; reduced: boolean }) {
  const [busy, setBusy] = useState(false);
  const [rolled, setRolled] = useState(reduced);
  const star = starName(film);
  const w = film.witness;
  const d = film.director;

  const shareCard = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await buildCreditsCard(film);
      const file = new File([blob], "say-what-you-saw-credits.png", { type: "image/png" });
      // Phones get the share sheet; desktops just download the PNG.
      if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Say What You Saw", text: `${star} starred in a film directed by voice.` }).catch(() => {});
      } else {
        const url = URL.createObjectURL(blob);
        download(url, file.name);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="credits">
      <div className={rolled ? "credits-viewport still" : "credits-viewport"}>
        <div className="credits-roll" onAnimationEnd={() => setRolled(true)}>
          <p className="cr-kicker">A film directed by voice</p>
          <h1 className="film-title small">Say What You Saw</h1>

          <Role label="Starring" value={star} big />

          <h3 className="cr-act">Act I · The Witness</h3>
          <Role label="Witness score" value={w ? `${w.score} / ${w.max}` : "The witness stayed silent"} />
          {w && <Role label="Best Recall score" value={`${w.best} / ${w.max}`} />}
          {w?.bestLine && <Role label="Best line" value={`“${w.bestLine}”`} quote />}

          <div className="cr-strip">
            {d?.strip ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.strip} alt="Photo strip from the director's stage" />
            ) : (
              <p className="cr-none">No stills were taken on set.</p>
            )}
          </div>

          <h3 className="cr-act">Act II · The Director&apos;s Stage</h3>
          <Role label="Directed by" value={`${star}, by voice`} />
          {d && <Role label="Takes" value={String(d.takes)} />}
          {d?.lines.length ? (
            <div className="cr-scenes">
              {d.lines.slice(0, 12).map((l, i) => (
                <Role key={i} label={`Scene ${i + 1}`} value={`“${l}”`} quote />
              ))}
            </div>
          ) : null}

          <h3 className="cr-act">Crew</h3>
          <Role label="Seen and told by" value={star} />
          <Role label="Dictation" value="Wispr Flow" />
          <Role label="Made by" value="Adi" />
          <Role label="Written with" value="Claude Code" />
          <Role label="Camera & light" value="WebGL2 · MediaPipe" />
          <Role label="Sound" value="Web Audio, no files" />
          {d?.credits.length ? (
            <>
              <h3 className="cr-act">Photography</h3>
              {d.credits.map((c) => (
                <Role key={c.url} label={c.title} value={`${c.author} · ${c.license}`} />
              ))}
            </>
          ) : null}

          <p className="cr-note">Shot at Hacker House Goa 2026.</p>
          <p className="cr-note">No film grain was used in the making of this picture.</p>
          <p className="cr-end">The End</p>
        </div>
      </div>

      <div className="credits-actions">
        {!rolled && (
          <button className="film-btn ghost" onClick={() => setRolled(true)}>
            Skip roll
          </button>
        )}
        <button
          className="film-btn ghost"
          disabled={!d?.strip}
          title={d?.strip ? undefined : "Take four shots on the Director's Stage to print a strip"}
          onClick={() => d?.strip && download(d.strip, `${star.toLowerCase().replace(/\W+/g, "-")}-photo-strip.jpg`)}
        >
          Download photo strip
        </button>
        <button className="film-btn ghost" onClick={() => void shareCard()} disabled={busy}>
          {busy ? "Printing…" : "Share credits card"}
        </button>
        <button className="film-btn" onClick={onReplay}>
          Play again ▸
        </button>
      </div>
    </div>
  );
}

function Role({ label, value, big, quote }: { label: string; value: string; big?: boolean; quote?: boolean }) {
  return (
    <div className={big ? "cr-role big" : "cr-role"}>
      <span className="cr-label">{label}</span>
      <span className={quote ? "cr-value quote" : "cr-value"}>{value}</span>
    </div>
  );
}
