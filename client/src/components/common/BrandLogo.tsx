interface BrandLogoProps {
  variant?: 'nav' | 'auth' | 'workspace';
}

/** Official DentalNova logo — used as provided, without a substitute mark. */
export function BrandLogo({ variant = 'auth' }: BrandLogoProps) {
  return (
    <img
      src="/assets/dentalnova-logo.png"
      alt="DentalNova"
      className={`brand-logo brand-logo--${variant}`}
      draggable={false}
    />
  );
}
