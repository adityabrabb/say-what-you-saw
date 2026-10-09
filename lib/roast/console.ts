// For the judges who open dev tools: a detective's note, printed once. console.log only (never
// console.error, which would raise a badge in Next's dev overlay).

let printed = false;

const ART = String.raw`
        ,-""""-.
       /  ,--.  \
      |  ( () )  |    <- you, opening the console
       \  '--'  /
        '-.__.-'\
                 \
                  \__
`;

export function printDetectiveNote() {
  if (printed || typeof window === "undefined") return;
  printed = true;
  const art = "color:#ffb547;font:12px/1.2 ui-monospace,Consolas,monospace";
  const head = "color:#f3e9d2;background:#030303;font:700 14px Georgia,serif;padding:4px 8px;border-left:4px solid #ffb547";
  const body = "color:#d9ccb0;font:13px/1.6 Georgia,serif";
  console.log(`%c${ART}`, art);
  console.log("%cCASE FILE #1009: SAY WHAT YOU SAW", head);
  console.log(
    "%cDear Detective,\n\nSo you opened the console. Suspicious.\nI have nothing to hide. The director, on the other hand, has a lot to say about you.\n\nIf you're looking for evidence: the camera never leaves your browser, only your words go to the model,\nand this film was built entirely by voice with Wispr Flow.\n\n   - The Management (a.k.a. the washed-up one)",
    body
  );
}
