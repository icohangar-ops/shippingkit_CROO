import { Link } from "@tanstack/react-router";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="group flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center border border-signal/60 bg-signal/10 font-mono text-[11px] font-bold text-signal">
            S/K
          </span>
          <span className="font-mono text-sm tracking-tight">
            <span className="text-foreground">shipkit</span>
            <span className="text-muted-foreground">.cap</span>
          </span>
        </Link>
        <nav className="flex items-center gap-6 font-mono text-[13px]">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            className="text-muted-foreground transition hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            overview
          </Link>
          <Link
            to="/playground"
            className="text-muted-foreground transition hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            playground
          </Link>
          <a
            href="https://dorahacks.io/hackathon/croo-hackathon/detail"
            target="_blank"
            rel="noreferrer"
            className="hidden text-muted-foreground transition hover:text-foreground md:inline"
          >
            hackathon ↗
          </a>
          <Link
            to="/playground"
            className="inline-flex items-center gap-2 border border-signal bg-signal/10 px-3 py-1.5 text-signal transition hover:bg-signal hover:text-primary-foreground"
          >
            <span className="live-dot" />
            <span>open console</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}