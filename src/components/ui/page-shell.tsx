export function PageShell({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-[30px] font-semibold tracking-tight text-slate-800">{title}</h1>
        {description ? <p className="text-sm text-slate-500">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
