const fs = require("fs");
const path = require("path");

// Define paths for data files
const DATA_DIR = path.join(__dirname, "..", "data");
const PROPERTIES_FILE = path.join(DATA_DIR, "properties.json");
const EMAILS_FILE = path.join(DATA_DIR, "emails.json");

// Ensure data directory exists
function ensureDataDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  }

  // Initialize properties file if it doesn't exist
  if (!fs.existsSync(PROPERTIES_FILE)) {
    fs.writeFileSync(
      PROPERTIES_FILE,
      JSON.stringify({
        nextId: 1,
        properties: [],
      })
    );
    console.log(`Initialized properties file: ${PROPERTIES_FILE}`);
  }

  // Initialize emails file if it doesn't exist
  if (!fs.existsSync(EMAILS_FILE)) {
    fs.writeFileSync(
      EMAILS_FILE,
      JSON.stringify({
        nextId: 1,
        emails: [],
      })
    );
    console.log(`Initialized emails file: ${EMAILS_FILE}`);
  }
}

// Read data from file
function readData(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading data from ${filePath}:`, error);
    throw error;
  }
}

// Write data to file
function writeData(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`Error writing data to ${filePath}:`, error);
    throw error;
  }
}

// Properties CRUD operations
const Properties = {
  // Get all properties
  findAll: () => {
    const data = readData(PROPERTIES_FILE);
    return data.properties;
  },

  // Get property by ID
  findById: (id) => {
    const data = readData(PROPERTIES_FILE);
    return data.properties.find((property) => property.id === parseInt(id));
  },

  // Create new property
  create: (propertyData) => {
    const data = readData(PROPERTIES_FILE);

    const newProperty = {
      id: data.nextId++,
      name: propertyData.name,
      address: propertyData.address,
      price: propertyData.price,
      image_url: propertyData.image_url || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    data.properties.unshift(newProperty); // Add to beginning of array (newest first)
    writeData(PROPERTIES_FILE, data);

    return newProperty;
  },

  // Update property
  update: (id, propertyData) => {
    const data = readData(PROPERTIES_FILE);
    const index = data.properties.findIndex(
      (property) => property.id === parseInt(id)
    );

    if (index === -1) {
      return null;
    }

    const updatedProperty = {
      ...data.properties[index],
      name: propertyData.name || data.properties[index].name,
      address: propertyData.address || data.properties[index].address,
      price: propertyData.price || data.properties[index].price,
      image_url: propertyData.image_url || data.properties[index].image_url,
      updated_at: new Date().toISOString(),
    };

    data.properties[index] = updatedProperty;
    writeData(PROPERTIES_FILE, data);

    return updatedProperty;
  },

  // Delete property
  delete: (id) => {
    const data = readData(PROPERTIES_FILE);
    const index = data.properties.findIndex(
      (property) => property.id === parseInt(id)
    );

    if (index === -1) {
      return false;
    }

    data.properties.splice(index, 1);
    writeData(PROPERTIES_FILE, data);

    return true;
  },
};

// Emails CRUD operations
const Emails = {
  // Get all emails
  findAll: () => {
    const data = readData(EMAILS_FILE);
    return data.emails;
  },

  // Find email by address
  findByEmail: (email) => {
    const data = readData(EMAILS_FILE);
    return data.emails.find(
      (item) => item.email.toLowerCase() === email.toLowerCase()
    );
  },

  // Create new email subscription
  create: (email) => {
    const data = readData(EMAILS_FILE);

    // Check if email already exists
    const existing = data.emails.find(
      (item) => item.email.toLowerCase() === email.toLowerCase()
    );
    if (existing) {
      return { created: false, email: existing };
    }

    const newEmail = {
      id: data.nextId++,
      email: email,
      created_at: new Date().toISOString(),
    };

    data.emails.push(newEmail);
    writeData(EMAILS_FILE, data);

    return { created: true, email: newEmail };
  },
};

module.exports = {
  ensureDataDirectoryExists,
  Properties,
  Emails,
};
