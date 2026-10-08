import Link from "next/link";

export default function Home() {
  return (
    <main className="landing">
      <h1>Say What You Saw</h1>
      <p className="tagline">Speak it. Watch it move.</p>
      <div className="modes">
        <Link href="/recall" className="mode recall">
          <span className="mode-name">Recall</span>
          <span className="mode-desc">A scene flashes. Describe it from memory. See how close you got.</span>
        </Link>
        <Link href="/studio" className="mode studio">
          <span className="mode-name">Studio</span>
          <span className="mode-desc">Describe anything and turn it into an animated explainer.</span>
        </Link>
      </div>
    </main>
  );
}
