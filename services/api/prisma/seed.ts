import "dotenv/config";
import { PrismaClient, WorkspaceType } from "@prisma/client";
import { createWorkspaceForUser, seedPointsPalaceFixture } from "../src/services/workspace-service";
import { hashPassword } from "../src/utils/password";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_PASSWORD;

  if (!email || !password) {
    console.log("Skipping seed because SEED_EMAIL and SEED_PASSWORD are not set.");
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    console.log(`Seed skipped because ${email} already exists.`);
    return;
  }

  const fullName = process.env.SEED_FULL_NAME?.trim() || "Owner";
  const companyName = process.env.SEED_COMPANY_NAME?.trim();
  const baseCurrency = (process.env.SEED_BASE_CURRENCY?.trim() || "USD").toUpperCase();
  const passwordHash = await hashPassword(password);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName,
      },
    });

    const personalWorkspace = await createWorkspaceForUser(tx, {
      userId: createdUser.id,
      name: `${fullName.split(" ")[0] ?? "Owner"} Personal Books`,
      type: WorkspaceType.PERSONAL,
      baseCurrency,
    });
    await seedPointsPalaceFixture(tx, personalWorkspace.id);

    if (companyName) {
      await createWorkspaceForUser(tx, {
        userId: createdUser.id,
        name: companyName,
        type: WorkspaceType.BUSINESS,
        baseCurrency,
      });
    }

    return createdUser;
  });

  console.log(`Created seeded user ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
