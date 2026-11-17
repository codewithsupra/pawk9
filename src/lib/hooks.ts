import { useContext } from "react";
import { PetContext } from "@/contexts/pet-context-provider";
import { SearchContext } from "@/contexts/search-context-provider";

export function useSearchContext() {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error(
      "useSearchContext must be used within a SearchContextProvider",
    );
  }
  return context;
}

export function usePetContext() {
  const context = useContext(PetContext);
  if (!context) {
    throw new Error("usePetContext must be used within a PetContextProvider");
  }
  return context;
}

export function useFilteredPets() {
  const { pets } = usePetContext();
  const { searchQuery } = useSearchContext();

  const query = searchQuery.trim().toLowerCase();
  return pets.filter((pet) => pet.name.toLowerCase().includes(query));
}
