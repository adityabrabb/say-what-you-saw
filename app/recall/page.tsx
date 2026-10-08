import Link from "next/link";
import RecallGame from "@/components/RecallGame";

export default function Recall() {
  return (
    <main>
      <header>
        <Link href="/" className="back">← Home</Link>
        <h1>Recall</h1>
        <p>Watch closely. Then say what you saw.</p>
      </header>
      <RecallGame />
    </main>
  );
}
