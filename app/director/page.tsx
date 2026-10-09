import type { Metadata } from "next";
import DirectorStage from "@/components/director/DirectorStage";

export const metadata: Metadata = {
  title: "Director Mode · Say What You Saw",
  description: "Step into the shot and direct the scene, light and look with your voice.",
};

export default function DirectorPage() {
  return <DirectorStage />;
}
