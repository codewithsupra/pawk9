import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Photos from Unsplash (free to use). The host must stay allowed in `images.remotePatterns`
// in next.config.ts, and the path must start with /photo-.
const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=400&h=400&q=75`;

// Contact details are fictional on purpose: example.com is reserved for documentation,
// and 202-555-01xx is the phone range reserved for fiction.
const pets = [
  {
    name: "Benjamin",
    imageUrl: photo("1530281700549-e82e7bf110d6"),
    ownerName: "John Doe",
    ownerEmail: "john.doe@example.com",
    ownerPhone: "+12025550101",
    age: 2,
    notes: "Doesn't like to be touched on the belly. Loves fetch.",
  },
  {
    name: "Richard",
    imageUrl: photo("1543466835-00a7907e9de1"),
    ownerName: "Josephine Dane",
    ownerEmail: "josephine.dane@example.com",
    ownerPhone: "+12025550102",
    age: 5,
    notes: "Needs medication twice a day with food.",
  },
  {
    name: "Anna",
    imageUrl: photo("1552053831-71594a27632d"),
    ownerName: "Frank Doe",
    ownerEmail: "frank.doe@example.com",
    ownerPhone: "+12025550103",
    age: 4,
    notes: "Gets anxious around other dogs. Prefers a quiet room.",
  },
  {
    name: "Luna",
    imageUrl: photo("1537151625747-768eb6cf92b2"),
    ownerName: "Maria Garcia",
    ownerEmail: "maria.garcia@example.com",
    ownerPhone: "+12025550104",
    age: 1,
    notes: "Still being house-trained. Very playful.",
  },
  {
    name: "Max",
    imageUrl: photo("1558788353-f76d92427f16"),
    ownerName: "Samuel Okafor",
    ownerEmail: "samuel.okafor@example.com",
    ownerPhone: "+12025550105",
    age: 9,
    notes: "Senior dog. Short walks only; needs a joint supplement.",
  },
  {
    name: "Bella",
    imageUrl: photo("1561037404-61cd46aa615b"),
    ownerName: "Priya Nair",
    ownerEmail: "priya.nair@example.com",
    ownerPhone: "+12025550106",
    age: 3,
    notes: "Allergic to chicken-based food.",
  },
];

// Sample visits, relative to "now" so the data always looks current. Closed stays are
// [days ago, hours long]; `inForHours` means the pet is checked in right now, and has
// been for that long.
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const sampleStays: Record<
  string,
  { inForHours?: number; history: [daysAgo: number, hours: number][] }
> = {
  Benjamin: {
    inForHours: 2.5,
    history: [
      [1, 9],
      [2, 8],
      [4, 9],
    ],
  },
  Richard: {
    history: [
      [1, 7],
      [3, 9],
    ],
  },
  Anna: {
    history: [
      [2, 8],
      [5, 6],
    ],
  },
  Luna: {
    inForHours: 1,
    history: [
      [1, 4],
      [2, 4],
      [3, 4],
    ],
  },
  Max: {
    history: [
      [1, 6],
      [6, 5],
    ],
  },
  Bella: { history: [[3, 9]] },
};

function staysFor(name: string, petId: string, userId: string, now: number) {
  const plan = sampleStays[name];
  if (!plan) return [];
  const closed = plan.history.map(([daysAgo, hours]) => {
    const checkedInAt = new Date(now - daysAgo * DAY - hours * HOUR);
    return {
      petId,
      userId,
      checkedInAt,
      checkedOutAt: new Date(checkedInAt.getTime() + hours * HOUR),
    };
  });
  const open = plan.inForHours
    ? [
        {
          petId,
          userId,
          checkedInAt: new Date(now - plan.inForHours * HOUR),
          checkedOutAt: null,
        },
      ]
    : [];
  return [...closed, ...open];
}

// Placeholder account for local development. The clerkId is not a real Clerk user,
// so no one can sign in as it; it just guarantees there is always one user to own pets.
const seedUser = {
  clerkId: "user_seed_demo",
  email: "demo@pawk9.example.com",
  name: "Demo Owner",
};

async function main() {
  // Users are created lazily when someone signs in, so keep them. Only pets are reset
  // (their stays go with them), which keeps the seed safe to re-run.
  await prisma.pet.deleteMany();

  await prisma.user.upsert({
    where: { clerkId: seedUser.clerkId },
    update: {},
    create: seedUser,
  });

  // Every user gets their own copy of the sample pets and visits, so whoever signs in
  // has data to play with. (Sign in once, then run the seed again.)
  const now = Date.now();
  const users = await prisma.user.findMany();
  for (const user of users) {
    for (const pet of pets) {
      const created = await prisma.pet.create({
        data: { ...pet, userId: user.id },
      });
      await prisma.stay.createMany({
        data: staysFor(pet.name, created.id, user.id, now),
      });
    }
  }
  console.log(
    `Seeded ${pets.length} pets for each of ${users.length} user(s): ${users
      .map((user) => user.email)
      .join(", ")}`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
