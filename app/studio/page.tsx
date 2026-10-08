import Link from "next/link";
import Player from "@/components/Player";
import { solarSystem } from "@/lib/examples";

export default function Studio() {
  return (
    <main>
      <header>
        <Link href="/" className="back">← Home</Link>
        <h1>Studio</h1>
        <p>{solarSystem.title}</p>
      </header>
      <Player video={solarSystem} />
    </main>
  );
}
