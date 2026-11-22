import { site } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="on-dark bg-ink text-sm text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-8 sm:px-6">
        <p className="font-display text-base font-extrabold tracking-tight">{site.name}</p>
        <p className="text-line">Lista de precios y gestión de cursos · {new Date().getFullYear()}</p>
      </div>
    </footer>
  );
}
