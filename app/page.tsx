import Player from "@/components/Player";
import { solarSystem } from "@/lib/examples";

export default function Home() {
  return (
    <main>
      <header>
        <h1>Say What You Saw</h1>
        <p>{solarSystem.title}</p>
      </header>
      <Player video={solarSystem} />
    </main>
  );
}
