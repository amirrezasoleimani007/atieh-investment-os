/// <reference types="vite/client" />
import type { ImgHTMLAttributes } from "react";

type StaticImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  priority?: boolean;
  unoptimized?: boolean;
};

export default function StaticImage(props: StaticImageProps) {
  const { src, priority, unoptimized, ...imageProps } = props;
  void priority;
  void unoptimized;
  const value = typeof src === "string" && src.startsWith("/")
    ? `${import.meta.env.BASE_URL}${src.slice(1)}`
    : src;
  // Static hosting cannot use Next's image optimizer; original dimensions remain intact.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...imageProps} src={value} alt={imageProps.alt ?? ""} />;
}
