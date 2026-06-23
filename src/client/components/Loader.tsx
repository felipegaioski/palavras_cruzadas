type LoaderProps = {
  label?: string;
  size?: "sm" | "md" | "lg";
  fullPage?: boolean;
};

export function Loader({
  label = "Carregando...",
  size = "md",
  fullPage = false
}: LoaderProps) {
  return (
    <div className={`loader ${fullPage ? "is-full-page" : ""}`} role="status">
      <span className={`loader-spinner ${size}`} aria-hidden="true" />
      <span className="loader-label">{label}</span>
    </div>
  );
}
