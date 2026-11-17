"use client";

import { ImagePlus, LoaderCircle, Mail, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { prepareImageForUpload } from "@/lib/client-image";
import { usePetContext } from "@/lib/hooks";
import type { Pet, Photo } from "@/lib/types";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default function PetPhotos({ pet }: { pet: Pet }) {
  const { uploadPhoto } = usePetContext();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleChoose = (files: FileList | null) => {
    // Copy the files out first: clearing the input below empties the FileList.
    const chosen = files ? Array.from(files) : [];
    if (inputRef.current) inputRef.current.value = ""; // lets the same photo be chosen again
    if (chosen.length === 0) return;

    // Plain state, not a transition: uploads aren't optimistic, and a transition can hold
    // back the list update until every file is done.
    void (async () => {
      setIsUploading(true);
      try {
        for (const file of chosen) {
          let prepared: Blob;
          try {
            prepared = await prepareImageForUpload(file);
          } catch {
            toast.error(
              `"${file.name}" couldn't be read as a photo. Try a JPEG or PNG.`,
            );
            continue;
          }
          await uploadPhoto(pet.id, prepared);
        }
      } finally {
        setIsUploading(false);
      }
    })();
  };

  return (
    <div className="mx-8 mt-4 rounded-md border border-black/8 bg-zinc-50 px-6 py-5">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-xs font-medium tracking-wider text-zinc-500 uppercase">
          Photos
        </h3>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => handleChoose(event.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          disabled={isUploading}
          aria-busy={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" />
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus aria-hidden="true" />
              Add photo
            </>
          )}
        </Button>
      </div>

      {pet.photos.length === 0 ? (
        <p className="mt-2 text-base text-zinc-600">No photos yet.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {pet.photos.map((photo) => (
            <Thumbnail key={photo.id} pet={pet} photo={photo} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Thumbnail({ pet, photo }: { pet: Pet; photo: Photo }) {
  const { deletePhoto, sendPhoto } = usePetContext();
  const [isDeleting, startDelete] = useTransition();
  // Plain state, not a transition: a transition can hold back the "Sent" mark.
  const [isSending, setIsSending] = useState(false);
  const src = `/api/photos/${photo.id}`;

  // Not optimistic: an email can't be taken back, so wait for the real answer.
  const handleSend = () => {
    if (!pet.ownerEmail) {
      toast.error(`${pet.name} has no owner email. Use Edit to add one.`);
      return;
    }
    if (!window.confirm(`Email this photo to ${pet.ownerName}?`)) return;
    void (async () => {
      setIsSending(true);
      try {
        await sendPhoto(photo.id);
      } finally {
        setIsSending(false);
      }
    })();
  };

  const handleDelete = () => {
    // Photos are deleted for good, so confirm first.
    if (!window.confirm("Delete this photo? This can't be undone.")) return;
    startDelete(async () => {
      await deletePhoto(pet.id, photo.id);
    });
  };

  return (
    <li>
      <a
        href={src}
        target="_blank"
        rel="noopener"
        className="block aspect-square overflow-hidden rounded-md bg-zinc-200"
      >
        {/* unoptimized: the photo needs a sign-in, which Next's image optimizer (it fetches
            on the server, without your cookies) can't provide. */}
        <Image
          unoptimized
          src={src}
          alt={`${pet.name}, ${dateFormat.format(photo.createdAt)}`}
          width={200}
          height={200}
          loading="lazy"
          className="size-full object-cover"
        />
      </a>
      <div className="mt-1.5 flex items-center gap-1">
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending}
          aria-label={`Email this photo to ${pet.ownerName}`}
          className={`flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border px-1.5 text-xs font-medium disabled:cursor-default disabled:opacity-70 ${
            photo.lastSentAt
              ? "border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : "border-black/15 bg-white text-zinc-800 hover:bg-zinc-100"
          }`}
        >
          {isSending ? (
            <LoaderCircle
              className="size-3.5 shrink-0 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">
            {isSending
              ? "Sending…"
              : photo.lastSentAt
                ? `Sent ${dateFormat.format(photo.lastSentAt)}`
                : "Email owner"}
          </span>
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label={`Delete photo from ${dateFormat.format(photo.createdAt)}`}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-black/15 bg-white text-zinc-600 hover:bg-zinc-100 hover:text-destructive disabled:cursor-default disabled:opacity-70"
        >
          {isDeleting ? (
            <LoaderCircle
              className="size-3.5 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Trash2 className="size-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </li>
  );
}
