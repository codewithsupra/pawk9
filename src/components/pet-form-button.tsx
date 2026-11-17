"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type PetFormButtonProps = {
  children: React.ReactNode;
  pendingText: string;
};

// useFormStatus reads the status of the parent <form>, so it must live in a child component.
export default function PetFormButton({
  children,
  pendingText,
}: PetFormButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="ml-auto cursor-pointer"
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" aria-hidden="true" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
