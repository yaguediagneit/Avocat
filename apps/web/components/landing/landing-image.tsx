import Image, { type ImageProps } from "next/image";

type LandingImageProps = Omit<ImageProps, "src" | "unoptimized"> & { src: string };

/**
 * `next/image` tolérant aux sources non optimisables : les images de la landing
 * sont stockées en data-URL (base64) dans `tenant.configuration`, que l'optimiseur
 * Next ne peut pas traiter. On désactive alors l'optimisation, tout en conservant
 * le lazy-loading, `sizes` et la priorisation.
 */
export function LandingImage({ src, alt = "", ...props }: LandingImageProps) {
  const optimizable = src.startsWith("https://") || (src.startsWith("/") && !src.startsWith("//"));
  return <Image src={src} alt={alt} unoptimized={!optimizable} {...props} />;
}
