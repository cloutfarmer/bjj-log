/**
 * The app's mark: a tied blue belt, with the black rank bar and one white tape stripe
 * on the hanging end. Decorative, so it is hidden from assistive tech.
 */
export default function LogoMark({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <rect x="1" y="6" width="22" height="5" rx="1" fill="#3a6fd4" />
        <path d="M9.5 12L6 21.5l3 1L12 13z" fill="#3a6fd4" />
        <path d="M14.5 12l3.5 9.5-3 1L12 13z" fill="#3a6fd4" />
        <path d="M13.1 16.5h3.06L18 21.5l-3 1z" fill="#08090c" />
        <path d="M14.1 19h2.8" stroke="#ffffff" strokeWidth="1.1" />
        <rect x="8.5" y="4.5" width="7" height="8.5" rx="1.8" fill="#2c5bb5" />
      </svg>
    </span>
  );
}
