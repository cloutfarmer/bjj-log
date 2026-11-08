/** A tied belt: the app's mark. Decorative, so it is hidden from assistive tech. */
export default function LogoMark({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 9.5h20" />
        <path d="M2 13h20" opacity="0.55" />
        <rect x="9.5" y="7.5" width="5" height="7.5" rx="1.2" fill="#fff" fillOpacity="0.2" />
        <path d="M10.5 15l-2.5 6" />
        <path d="M13.5 15l2.5 6" />
      </svg>
    </span>
  );
}
