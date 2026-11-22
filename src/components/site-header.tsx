import { site } from '@/lib/site';

// Cabecera mínima: la marca de la academia. Todo lo demás vive en la página.
export function SiteHeader() {
  return (
    <header className="on-dark bg-ink text-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
        {site.logo ? (
          <img alt="" className="h-8 w-auto" src={site.logo} />
        ) : (
          <svg aria-hidden className="size-7 shrink-0" viewBox="0 0 28 28">
            <rect className="fill-brand" height="28" width="28" />
            <circle className="fill-accent" cx="19" cy="9" r="6" />
            <rect className="fill-white" height="5" width="14" x="0" y="23" />
          </svg>
        )}
        <span className="font-display text-lg font-extrabold tracking-tight">{site.name}</span>
        <span className="ml-auto hidden text-sm text-line sm:block">Lista de precios y gestión de cursos</span>
      </div>
      <div aria-hidden className="h-1 bg-accent" />
    </header>
  );
}
