"use client";
import { createContext, useOptimistic, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import {
  addPet as addPetAction,
  checkInPet as checkInPetAction,
  checkOutPet as checkOutPetAction,
  editPet as editPetAction,
  removePet as removePetAction,
} from "@/actions/actions";
import {
  addPetPhoto as addPetPhotoAction,
  removePetPhoto as removePetPhotoAction,
  sendPhotoToOwner as sendPhotoToOwnerAction,
} from "@/actions/photos";
import type { Pet, Photo, Stay } from "@/lib/types";

type TPetContext = {
  pets: Pet[];
  setPets: React.Dispatch<React.SetStateAction<Pet[]>>;
  selectedPetId: string | null;
  setSelectedPetId: (id: string | null) => void;
  selectedPet: Pet | undefined;
  removePet: (id: string) => Promise<void>;
  checkInPet: (id: string) => Promise<void>;
  checkOutPet: (id: string) => Promise<void>;
  uploadPhoto: (petId: string, photo: Blob) => Promise<void>;
  deletePhoto: (petId: string, photoId: string) => Promise<void>;
  sendPhoto: (photoId: string) => Promise<void>;
  addPet: (
    petData: Omit<Pet, "id" | "stays" | "photos">,
    formData: FormData,
  ) => Promise<void>;
  editPet: (updatedPet: Pet, formData: FormData) => Promise<void>;
};

type OptimisticAction =
  | { type: "add"; pet: Pet }
  | { type: "edit"; pet: Pet }
  | { type: "stays"; id: string; stays: Stay[] }
  | { type: "photos"; id: string; photos: Photo[] }
  | { type: "remove"; id: string };

export const PetContext = createContext<TPetContext | null>(null);

export default function PetContextProvider({
  children,
  initialPets,
}: {
  children: React.ReactNode;
  initialPets: Pet[];
}) {
  const [pets, setPets] = useState<Pet[]>(initialPets);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);

  // `pets` is the confirmed list. `optimisticPets` is what the UI shows: it applies
  // an add, edit or checkout immediately while the server call is in flight, and
  // snaps back to `pets` if the call fails.
  const [optimisticPets, applyOptimistically] = useOptimistic(
    pets,
    (currentPets, action: OptimisticAction) => {
      switch (action.type) {
        case "add":
          return [...currentPets, action.pet];
        case "edit":
          return currentPets.map((pet) =>
            pet.id === action.pet.id ? action.pet : pet,
          );
        case "stays":
          return currentPets.map((pet) =>
            pet.id === action.id ? { ...pet, stays: action.stays } : pet,
          );
        case "photos":
          return currentPets.map((pet) =>
            pet.id === action.id ? { ...pet, photos: action.photos } : pet,
          );
        case "remove":
          return currentPets.filter((pet) => pet.id !== action.id);
      }
    },
  );
  const selectedPet = optimisticPets.find((pet) => pet.id === selectedPetId);

  // Must run inside a transition (the form's action) for the optimistic update to
  // apply and to revert when the transition ends.
  const handleAddPet = async (
    petData: Omit<Pet, "id" | "stays" | "photos">,
    formData: FormData,
  ) => {
    // The real id only exists once the database creates the row, so the optimistic
    // pet gets a temporary one that is swapped out on success.
    const tempId = `temp-${crypto.randomUUID()}`;
    const previousSelectedId = selectedPetId;

    // Called directly (not inside flushSync) so React sees it as part of the action.
    applyOptimistically({
      type: "add",
      pet: { id: tempId, ...petData, stays: [], photos: [] },
    });
    flushSync(() => setSelectedPetId(tempId));

    // The optimistic pet disappears on its own when the transition ends, but the
    // selection is plain state, so put it back by hand.
    const restoreSelection = () =>
      flushSync(() =>
        setSelectedPetId((currentId) =>
          currentId === tempId ? previousSelectedId : currentId,
        ),
      );

    let result: Awaited<ReturnType<typeof addPetAction>>;
    try {
      result = await addPetAction(null, formData);
    } catch {
      restoreSelection();
      toast.error("Could not add the pet. Please try again.");
      return;
    }
    if (!result?.ok) {
      restoreSelection();
      toast.error(result?.error ?? "Could not add the pet.");
      return;
    }

    // Commit the saved pet synchronously, before the optimistic state reverts.
    const savedPet = result.pet;
    flushSync(() => {
      setPets((prevPets) => [...prevPets, savedPet]);
      setSelectedPetId(savedPet.id);
    });
  };

  // Must run inside a transition (the form's action) for the optimistic update to
  // apply and to revert when the transition ends.
  const handleEditPet = async (updatedPet: Pet, formData: FormData) => {
    applyOptimistically({ type: "edit", pet: updatedPet });

    // Failure paths just return: the optimistic edit reverts on its own.
    let result: Awaited<ReturnType<typeof editPetAction>>;
    try {
      result = await editPetAction(updatedPet.id, null, formData);
    } catch {
      toast.error("Could not save the changes. Please try again.");
      return;
    }
    if (!result?.ok) {
      toast.error(result?.error ?? "Could not save the changes.");
      return;
    }

    // Commit the saved pet synchronously, before the optimistic state reverts.
    const savedPet = result.pet;
    flushSync(() => {
      setPets((prevPets) =>
        prevPets.map((pet) => (pet.id === savedPet.id ? savedPet : pet)),
      );
    });
  };

  // Must run inside a transition (PetButton's startTransition) for the
  // optimistic update to apply and to revert when the transition ends.
  const handleRemovePet = async (id: string) => {
    applyOptimistically({ type: "remove", id });

    // Failure paths below just return: nothing to undo by hand, because the
    // optimistic removal reverts on its own when the transition ends.
    let result: Awaited<ReturnType<typeof removePetAction>>;
    try {
      result = await removePetAction(id);
    } catch {
      // The request itself failed (e.g. network), so the action never returned.
      toast.error("Could not remove the pet. Please try again.");
      return;
    }
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    // Commit the confirmed removal synchronously, before the transition ends and the
    // optimistic state reverts, so the pet never flashes back for a frame.
    flushSync(() => {
      setPets((prevPets) => prevPets.filter((pet) => pet.id !== id));
      setSelectedPetId((currentId) => (currentId === id ? null : currentId));
    });
  };

  // Check-in and check-out share one flow: show the new stays at once, ask the server,
  // then replace the pet's stays with the server's list (so tabs that disagreed heal).
  // Must run inside a transition, like the handlers above.
  const changeStays = async (
    id: string,
    nextStays: (stays: Stay[]) => Stay[],
    action: typeof checkInPetAction,
    failureMessage: string,
  ) => {
    const pet = optimisticPets.find((candidate) => candidate.id === id);
    if (!pet) return;
    applyOptimistically({ type: "stays", id, stays: nextStays(pet.stays) });

    let result: Awaited<ReturnType<typeof checkInPetAction>>;
    try {
      result = await action(id);
    } catch {
      toast.error(failureMessage);
      return;
    }
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    flushSync(() => {
      setPets((prevPets) =>
        prevPets.map((candidate) =>
          candidate.id === id
            ? { ...candidate, stays: result.stays }
            : candidate,
        ),
      );
    });
  };

  const handleCheckInPet = (id: string) =>
    changeStays(
      id,
      (stays) =>
        stays.some((stay) => stay.checkedOutAt === null)
          ? stays
          : [
              {
                id: `temp-${crypto.randomUUID()}`,
                checkedInAt: new Date(),
                checkedOutAt: null,
              },
              ...stays,
            ],
      checkInPetAction,
      "Could not check in. Please try again.",
    );

  const handleCheckOutPet = (id: string) =>
    changeStays(
      id,
      (stays) => {
        const now = new Date();
        return stays.map((stay) =>
          stay.checkedOutAt === null ? { ...stay, checkedOutAt: now } : stay,
        );
      },
      checkOutPetAction,
      "Could not check out. Please try again.",
    );

  // Uploading is not optimistic: there is nothing to show until the server has stored the
  // file. The caller shows its own "uploading" state (via a transition) meanwhile.
  const handleUploadPhoto = async (petId: string, photo: Blob) => {
    const formData = new FormData();
    formData.set("photo", photo, "photo.jpg");

    let result: Awaited<ReturnType<typeof addPetPhotoAction>>;
    try {
      result = await addPetPhotoAction(petId, formData);
    } catch {
      toast.error("Could not upload the photo. Please try again.");
      return;
    }
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    flushSync(() => {
      setPets((prevPets) =>
        prevPets.map((pet) =>
          pet.id === petId ? { ...pet, photos: result.photos } : pet,
        ),
      );
    });
    toast.success("Photo added.");
  };

  // Deleting is optimistic like the other removals: the thumbnail goes at once and comes
  // back with a toast if the server refuses. Must run inside a transition.
  const handleDeletePhoto = async (petId: string, photoId: string) => {
    const pet = optimisticPets.find((candidate) => candidate.id === petId);
    if (!pet) return;
    applyOptimistically({
      type: "photos",
      id: petId,
      photos: pet.photos.filter((photo) => photo.id !== photoId),
    });

    let result: Awaited<ReturnType<typeof removePetPhotoAction>>;
    try {
      result = await removePetPhotoAction(photoId);
    } catch {
      toast.error("Could not delete the photo. Please try again.");
      return;
    }
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    flushSync(() => {
      setPets((prevPets) =>
        prevPets.map((candidate) =>
          candidate.id === result.petId
            ? { ...candidate, photos: result.photos }
            : candidate,
        ),
      );
    });
  };

  // Not optimistic: an email can't be taken back, so wait for the real answer. The result
  // carries the photos with their new "Sent" mark.
  const handleSendPhoto = async (photoId: string) => {
    let result: Awaited<ReturnType<typeof sendPhotoToOwnerAction>>;
    try {
      result = await sendPhotoToOwnerAction(photoId);
    } catch {
      toast.error("Could not send the email. Please try again.");
      return;
    }
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    flushSync(() => {
      setPets((prevPets) =>
        prevPets.map((candidate) =>
          candidate.id === result.petId
            ? { ...candidate, photos: result.photos }
            : candidate,
        ),
      );
    });
    toast.success("Photo sent to the owner.");
  };

  const handleSetSelectedPetId = (id: string | null) => {
    setSelectedPetId(id);
  };
  return (
    <PetContext.Provider
      value={{
        pets: optimisticPets,
        setPets,
        selectedPetId,
        selectedPet,
        setSelectedPetId: handleSetSelectedPetId,
        removePet: handleRemovePet,
        checkInPet: handleCheckInPet,
        checkOutPet: handleCheckOutPet,
        uploadPhoto: handleUploadPhoto,
        deletePhoto: handleDeletePhoto,
        sendPhoto: handleSendPhoto,
        addPet: handleAddPet,
        editPet: handleEditPet,
      }}
    >
      {children}
    </PetContext.Provider>
  );
}
