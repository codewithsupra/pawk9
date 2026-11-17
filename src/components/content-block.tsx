import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export default function ContentBlock({
  children,
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-md bg-white shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
