import Image from "next/image";

export default function PhotoPlaceholder({
  imageUrl,
  size,
  label = "Foto på vej",
  className = "",
  priority = false,
}: {
  imageUrl?: string | null;
  size: number;
  label?: string;
  className?: string;
  /** Set true for the above-the-fold hero photo — never lazy-load what the user is already looking at. */
  priority?: boolean;
}) {
  const style = { width: size, height: size };

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={size}
        height={size}
        sizes={`${size}px`}
        quality={80}
        priority={priority}
        loading={priority ? undefined : "lazy"}
        style={style}
        className={`rounded-full object-cover ${className}`}
      />
    );
  }

  const fontSize = Math.max(9, Math.round(size * 0.09));

  return (
    <div
      style={{ ...style, fontSize }}
      className={`photo-placeholder text-[11px] font-semibold uppercase tracking-[0.06em] ${className}`}
      aria-hidden="true"
    >
      {size >= 90 ? label : null}
    </div>
  );
}
