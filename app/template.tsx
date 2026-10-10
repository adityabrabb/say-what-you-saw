// Every page fades in (pure CSS opacity, on the GPU).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page page-enter">{children}</div>;
}
