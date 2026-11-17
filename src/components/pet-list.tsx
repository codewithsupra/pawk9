"use client";

import Image from "next/image";
import { useFilteredPets, usePetContext } from "@/lib/hooks";
import { isCheckedIn } from "@/lib/stays";
import { cn } from "@/lib/utils";

export default function PetList() {
  const { setSelectedPetId, selectedPetId } = usePetContext();
  const filteredPets = useFilteredPets();

  if (filteredPets.length === 0) {
    return <p className="px-5 py-8 text-center text-zinc-400">No pets found</p>;
  }

  return (
    <ul className="bg-white">
      {filteredPets.map((pet) => (
        <li key={pet.id} className="border-b border-black/8">
          <button
            onClick={() => setSelectedPetId(pet.id)}
            type="button"
            className={cn(
              "flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left text-base transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-700",
              { "bg-zinc-100": pet.id === selectedPetId },
            )}
          >
            <Image
              src={pet.imageUrl}
              alt={pet.name}
              width={48}
              height={48}
              className="size-12 shrink-0 rounded-full object-cover"
            />
            <span className="font-semibold">{pet.name}</span>
            {isCheckedIn(pet) && (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                <span
                  className="size-1.5 rounded-full bg-emerald-600"
                  aria-hidden="true"
                />
                Checked in
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}
