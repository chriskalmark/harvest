export default function PhotoPlaceholder({
  imageUrl,
  size,
  label = "Foto på vej",
  className = "",
}: {
  imageUrl?: string | null;
  size: number;
  label?: string;
  className?: string;
}) {
  const style = { width: size, height: size };

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        style={style}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  const fontSize = Math.max(9, Math.round(size * 0.09));

  return (
    <div
      style={{ ...style, fontSize }}
      className={`photo-placeholder text-[10px] font-semibold uppercase tracking-[0.06em] ${className}`}
      aria-hidden="true"
    >
      {size >= 90 ? label : null}
    </div>
  );
}
