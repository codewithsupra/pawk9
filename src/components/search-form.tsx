"use client";

import { useSearchContext } from "@/lib/hooks";

export default function SearchForm() {
  const { searchQuery, handleChangeSearchQuery } = useSearchContext();

  return (
    <form className="h-full w-full" onSubmit={(e) => e.preventDefault()}>
      <input
        className="h-full w-full rounded-md bg-white/20 px-5 outline-none transition placeholder:text-white/55 hover:bg-white/30 focus:bg-white/30"
        type="search"
        placeholder="Search pets..."
        aria-label="Search pets"
        value={searchQuery}
        onChange={(e) => handleChangeSearchQuery(e.target.value)}
      />
    </form>
  );
}
