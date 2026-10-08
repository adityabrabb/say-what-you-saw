import Link from "next/link";
import Studio from "@/components/Studio";

export default function StudioPage() {
  return (
    <main>
      <header>
        <Link href="/" className="back">← Home</Link>
        <h1>Studio</h1>
        <p>Describe anything. Watch it become an animation.</p>
      </header>
      <Studio />
    </main>
  );
}
