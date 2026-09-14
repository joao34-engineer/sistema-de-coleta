"use client";

import { useState } from "react";
import { Button } from "@/shared/ui/button";

type Props = Readonly<{
  src: string;
  title: string;
}>;

export function LazyPdfPreview({ src, title }: Props) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <Button type="button" variant="primary" size="sm" onClick={() => setOpen(true)}>
          Pré-visualizar
        </Button>
      </div>
    );
  }

  return <iframe src={src} title={title} className="h-full w-full border-0 min-h-[500px]" />;
}
