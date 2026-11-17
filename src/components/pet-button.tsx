"use client";

import { LoaderCircle, LogIn, LogOut, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import PetForm from "./pet-form";

type PetButtonProps = {
  actionType: "add" | "edit" | "checkIn" | "checkOut" | "remove";
  onClick?: () => void | Promise<void>;
  /** Used in the confirmation dialog of the "remove" button. */
  petName?: string;
};

const PENDING_LABEL = {
  checkIn: "Checking in…",
  checkOut: "Checking out…",
} as const;

export default function PetButton({
  actionType,
  onClick,
  petName,
}: PetButtonProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // The optimistic update flips this button between Check in and Check out while the
  // request is still running, so the "…ing" label has to follow what was clicked.
  const [startedAs, setStartedAs] = useState<"checkIn" | "checkOut">();

  if (actionType === "add" || actionType === "edit") {
    const isAdd = actionType === "add";

    return (
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogTrigger
          render={
            isAdd ? (
              <Button
                type="button"
                size="icon-lg"
                aria-label="Add a new pet"
                className="cursor-pointer shadow-md"
              />
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="lg"
                className="cursor-pointer bg-zinc-200 hover:bg-zinc-300"
              />
            )
          }
        >
          {isAdd ? <Plus /> : "Edit"}
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isAdd ? "Add a new pet" : "Edit pet"}</DialogTitle>
          </DialogHeader>
          <PetForm
            actionType={actionType}
            onFormSubmission={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (actionType === "remove") {
    // Removing deletes the pet and its history for good, so ask first.
    const handleConfirm = () =>
      startTransition(async () => {
        // State updates inside an async transition are held until it finishes, so force
        // the dialog closed now instead of waiting for the server.
        flushSync(() => setIsConfirmOpen(false));
        await onClick?.();
      });

    return (
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="cursor-pointer text-destructive hover:text-destructive"
            />
          }
        >
          Remove
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {petName ?? "this pet"}?</DialogTitle>
            <DialogDescription>
              This permanently deletes {petName ?? "this pet"} and their stay
              history. It can&apos;t be undone. If they&apos;re only leaving for
              the day, use Check out instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="cursor-pointer"
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              className="cursor-pointer"
              onClick={handleConfirm}
            >
              Remove pet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Check in / check out: a plain button whose loading state comes from the transition.
  const isCheckIn = actionType === "checkIn";
  const Icon = isCheckIn ? LogIn : LogOut;

  return (
    <Button
      onClick={() => {
        if (actionType === "checkIn" || actionType === "checkOut") {
          setStartedAs(actionType);
        }
        startTransition(async () => {
          await onClick?.();
        });
      }}
      disabled={isPending}
      aria-busy={isPending}
      className={
        isCheckIn
          ? "cursor-pointer"
          : "cursor-pointer bg-zinc-200 hover:bg-zinc-300"
      }
      type="button"
      variant={isCheckIn ? "default" : "secondary"}
      size="lg"
    >
      {isPending ? (
        <>
          <LoaderCircle className="animate-spin" aria-hidden="true" />
          {PENDING_LABEL[startedAs ?? actionType]}
        </>
      ) : (
        <>
          <Icon aria-hidden="true" />
          {isCheckIn ? "Check in" : "Check out"}
        </>
      )}
    </Button>
  );
}
