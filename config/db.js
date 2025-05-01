const postgres = require("postgres");
require("dotenv").config();

const DATABASE_URL = process.env.DATABASE_URL;

// Create a postgres.js client with proper SSL configuration
const sql = postgres(DATABASE_URL, { ssl: "verify-full" });

// Function to create a new postgres connection
// This is useful for workers which need their own connection
const createSqlConnection = () => {
  return postgres(DATABASE_URL, { ssl: "verify-full" });
};

// Test the connection
async function testConnection() {
  try {
    // Simple query to test connection
    const result = await sql`SELECT 1 as connection_test`;
    console.log("Database connection has been established successfully.");
    return true;
  } catch (error) {
    console.error("Unable to connect to the database:", error);
    return false;
  }
}

// Initialize the database (create tables if they don't exist)
async function initDB() {
  try {
    // Create the properties table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address TEXT NOT NULL,
        price VARCHAR(255) NOT NULL,
        image_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create the emails table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS emails (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log("Database tables initialized successfully");
  } catch (error) {
    console.error("Error initializing database:", error);
    throw error;
  }
}

module.exports = {
  sql,
  createSqlConnection,
  testConnection,
  initDB,
};
