// Every page powers on like a CRT. Pure CSS (transform + opacity), so it stays on the GPU.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page page-enter">{children}</div>;
}
