import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, connectToDatabase } from "./connection.js";

const migrateData = async () => {
  await connectToDatabase(); // Ensure database connection is established
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  console.log("Migration completed");
  process.exit(0);
};

migrateData().catch((err) => {
  console.error("Error migrating database", err);
  process.exit(1);
});
