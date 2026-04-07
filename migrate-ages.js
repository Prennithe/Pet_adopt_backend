// Migration script to convert legacy age format to structured format
const mongoose = require('mongoose');

// Connect to your database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pet-adoption');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

const convertLegacyAge = (years) => {
  return {
    years: Math.floor(years),
    months: 0,
    days: 0
  };
};

const migratePetAges = async () => {
  try {
    const Pet = require('./models/Pet');

    // Find pets with old age format (number instead of object)
    const pets = await Pet.find({
      $or: [
        { age: { $type: 'number' } },
        { age: { $exists: false } }
      ]
    });

    console.log(`Found ${pets.length} pets to migrate`);

    for (const pet of pets) {
      let newAge = { years: 0, months: 0, days: 0 };

      if (typeof pet.age === 'number') {
        newAge = convertLegacyAge(pet.age);
      }

      await Pet.findByIdAndUpdate(pet._id, { age: newAge });
      console.log(`Migrated pet ${pet.name}: ${pet.age} -> ${JSON.stringify(newAge)}`);
    }

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration error:', error);
  }
};

// Run migration
const runMigration = async () => {
  await connectDB();
  await migratePetAges();
  process.exit(0);
};

if (require.main === module) {
  runMigration();
}

module.exports = { migratePetAges, convertLegacyAge };