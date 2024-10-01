import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
});

const connectToDatabase = async () => {
  await pool.connect();
  console.log("Connected to the database");
};

const db = drizzle(pool, { schema });
export { db, connectToDatabase };
