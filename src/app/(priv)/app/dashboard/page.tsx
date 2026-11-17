import { Branding } from "@/components/branding";
import Stats from "@/components/stats";
import SearchForm from "@/components/search-form";
import PetList from "@/components/pet-list";
import PetDetails from "@/components/pet-details";
import ContentBlock from "@/components/content-block";
import PetButton from "@/components/pet-button";

function Dashboard() {
  return (
    <div>
      <div className="flex items-center justify-between text-white py-8">
        <Branding />
        <Stats />
      </div>
      <div className="grid grid-cols-1 grid-rows-[45px_auto_auto] gap-4 md:h-150 md:grid-cols-3 md:grid-rows-[45px_minmax(0,1fr)]">
        <div className="col-start-1 row-start-1 min-w-0">
          <SearchForm />
        </div>
        <ContentBlock className="relative col-start-1 row-start-2 min-h-48 md:min-h-0">
          <div className="h-full overflow-y-auto pb-20">
            <PetList />
          </div>
          <div className="absolute right-4 bottom-4">
            <PetButton actionType="add" />
          </div>
        </ContentBlock>
        <ContentBlock className="row-start-3 min-h-80 overflow-y-auto md:col-span-2 md:col-start-2 md:row-span-2 md:row-start-1 md:min-h-0">
          <PetDetails />
        </ContentBlock>
      </div>
    </div>
  );
}

export default Dashboard;
