import PageHeader from "@/components/PageHeader";
import RecallGame from "@/components/RecallGame";

export default function Recall() {
  return (
    <main>
      <PageHeader title="RECALL" subtitle="Watch closely. Then say what you saw." colour="pink" />
      <RecallGame />
    </main>
  );
}
