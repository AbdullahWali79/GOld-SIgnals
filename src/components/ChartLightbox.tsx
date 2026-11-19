import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ChartLightboxProps {
  image: { url: string; title: string } | null;
  onClose: () => void;
}

export function ChartLightbox({ image, onClose }: ChartLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (image && !dialog.open) {
      dialog.showModal();
    } else if (!image && dialog.open) {
      dialog.close();
    }
  }, [image]);

  if (!image) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      aria-label={image.title}
      className="m-auto max-h-[92vh] w-[94vw] max-w-5xl rounded-xl border border-white/[0.12] bg-[#0E1117] p-0 text-[#E8ECF2] backdrop:bg-black/80 backdrop:backdrop-blur-xs"
    >
      <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-3.5">
        <p className="truncate font-mono text-xs font-medium text-[#CBD5E1]">
          {image.title}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chart preview"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/[0.1] bg-[#161B24] text-[#CBD5E1] transition-colors hover:bg-white/[0.1] hover:text-white focus-visible:outline-2 focus-visible:outline-[#D4A843]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="flex max-h-[82vh] items-center justify-center overflow-auto bg-[#080A0E] p-4">
        <img
          src={image.url}
          alt={image.title}
          referrerPolicy="no-referrer"
          className="max-h-[76vh] w-auto max-w-full rounded object-contain"
        />
      </div>
    </dialog>
  );
}
