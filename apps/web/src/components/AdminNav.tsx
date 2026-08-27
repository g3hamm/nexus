import Link from "next/link";

export function AdminNav({ current }: { readonly current: "flags" | "volunteers" }) {
  const link = (href: string, label: string, key: string) => (
    <Link
      key={key}
      href={href}
      className={
        current === key
          ? "text-ink underline underline-offset-4"
          : "text-ink-muted hover:text-ink transition-colors"
      }
    >
      {label}
    </Link>
  );

  return (
    <header className="border-line mb-8 flex items-baseline justify-between border-b pb-4">
      <span className="text-ink font-serif text-lg">Nexus · Administration</span>
      <nav className="flex gap-5 text-sm">
        {link("/admin", "Review queue", "flags")}
        {link("/admin/volunteers", "Volunteers", "volunteers")}
      </nav>
    </header>
  );
}
