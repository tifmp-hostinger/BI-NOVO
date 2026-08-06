export function Footer() {
  return (
    <footer className="border-t border-line bg-paper px-4 py-4 text-center sm:px-6 lg:px-8">
      <p className="text-2xs text-ink-3">
        <span
          className="font-semibold text-ink"
          style={{ fontFamily: '"Noto Serif", serif', fontStyle: 'italic' }}
        >
          FMP Analytics
        </span>
        {' '}
        &middot; Central de Dashboards &middot;{' '}
        {new Date().getFullYear()}
      </p>
    </footer>
  );
}
