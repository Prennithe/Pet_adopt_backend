const router = require('express').Router();
const Pet = require('../models/Pet');
const Application = require('../models/Application');
const { auth, shelterOnly } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Adopter: get all pets with search/filter (only adopters can search)
router.get('/', auth, async (req, res) => {
  try {
    // Only allow adopters to search for pets
    if (req.user.role !== 'USER') {
      return res.status(403).json({ message: 'Only adopters can search for pets' });
    }

    const { name, type, breed, minAge, maxAge } = req.query;
    let query = {};
    if (name) query.name = { $regex: name, $options: 'i' };
    if (type) query.type = { $regex: type, $options: 'i' };
    if (breed) query.breed = { $regex: breed, $options: 'i' };

    // First, get pets matching basic filters
    const pets = await Pet.find(query).populate('shelterId', 'name email').sort({ createdAt: -1 });

    // Handle structured age filtering in JavaScript
    let filteredPets = pets;
    if (minAge || maxAge) {
      let minAgeObj = null;
      let maxAgeObj = null;

      try {
        if (minAge) minAgeObj = JSON.parse(minAge);
        if (maxAge) maxAgeObj = JSON.parse(maxAge);
      } catch (err) {
        // If parsing fails, ignore age filters
        console.log('Invalid age filter format');
      }

      if (minAgeObj || maxAgeObj) {
        // Convert age objects to total days for comparison
        const ageToDays = (age) => {
          if (!age) return 0;
          return (age.years || 0) * 365 + (age.months || 0) * 30 + (age.days || 0);
        };

        const minDays = minAgeObj ? ageToDays(minAgeObj) : 0;
        const maxDays = maxAgeObj ? ageToDays(maxAgeObj) : Number.MAX_SAFE_INTEGER;

        filteredPets = pets.filter(pet => {
          const petDays = ageToDays(pet.age);
          return petDays >= minDays && petDays <= maxDays;
        });
      }
    }

    const petsToProcess = filteredPets;

    // Calculate dynamic status for each pet based on applications
    const petsWithStatus = await Promise.all(pets.map(async (pet) => {
      const applications = await Application.find({ petId: pet._id });
      const approvedApplication = applications.find(app => app.status === 'APPROVED');

      let displayStatus = 'Fully Available';
      if (applications.length > 0) {
        displayStatus = 'In Process';
      }
      if (approvedApplication) {
        displayStatus = 'Adopted';
      }

      return {
        ...pet.toObject(),
        displayStatus
      };
    }));

    res.json(petsWithStatus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Adopter: get single pet (only adopters can view pet details)
router.get('/:id', auth, async (req, res) => {
  try {
    // Only allow adopters to view pet details
    if (req.user.role !== 'USER') {
      return res.status(403).json({ message: 'Only adopters can view pet details' });
    }

    const pet = await Pet.findById(req.params.id).populate('shelterId', 'name email');
    if (!pet) return res.status(404).json({ message: 'Pet not found' });

    // Calculate dynamic status based on applications
    const applications = await Application.find({ petId: pet._id });
    const approvedApplication = applications.find(app => app.status === 'APPROVED');

    let displayStatus = 'Fully Available';
    if (applications.length > 0) {
      displayStatus = 'In Process';
    }
    if (approvedApplication) {
      displayStatus = 'Adopted';
    }

    res.json({
      ...pet.toObject(),
      displayStatus
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Shelter: create pet
router.post('/', auth, shelterOnly, upload.array('images', 5), async (req, res) => {
  try {
    const { name, type, breed, age, gender, vaccinated, location, shelterContact, imageUrls, description, status } = req.body;

    // Parse age from JSON string
    let parsedAge;
    try {
      parsedAge = JSON.parse(age);
    } catch {
      parsedAge = { years: 0, months: 0, days: 0 };
    }

    // Get uploaded filenames
    const uploadedImages = req.files ? req.files.map(file => file.filename) : [];

    // Parse image URLs if provided
    let parsedImageUrls = [];
    if (imageUrls) {
      try {
        parsedImageUrls = JSON.parse(imageUrls);
      } catch {
        parsedImageUrls = [];
      }
    }

    const pet = await Pet.create({
      name,
      type,
      breed,
      age: parsedAge,
      gender,
      vaccinated: vaccinated === 'true',
      location,
      shelterContact,
      images: uploadedImages,
      imageUrls: parsedImageUrls,
      status: status || 'Available',
      shelterId: req.user.id,
      description
    });

    res.status(201).json(pet);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Shelter: update pet
router.put('/:id', auth, shelterOnly, upload.array('images', 5), async (req, res) => {
  try {
    const { name, type, breed, age, gender, vaccinated, location, shelterContact, imageUrls, description, status, existingImages } = req.body;

    // Parse age from JSON string
    let parsedAge;
    try {
      parsedAge = JSON.parse(age);
    } catch {
      parsedAge = { years: 0, months: 0, days: 0 };
    }

    // Get uploaded filenames
    const uploadedImages = req.files ? req.files.map(file => file.filename) : [];

    // Parse existing images to keep
    let existingImagesArray = [];
    if (existingImages) {
      try {
        existingImagesArray = JSON.parse(existingImages);
      } catch {
        existingImagesArray = [];
      }
    }

    // Combine existing and new uploaded images
    const allImages = [...existingImagesArray, ...uploadedImages];

    // Parse image URLs if provided
    let parsedImageUrls = [];
    if (imageUrls) {
      try {
        parsedImageUrls = JSON.parse(imageUrls);
      } catch {
        parsedImageUrls = [];
      }
    }

    const pet = await Pet.findOneAndUpdate(
      { _id: req.params.id, shelterId: req.user.id },
      {
        name,
        type,
        breed,
        age: parsedAge,
        gender,
        vaccinated: vaccinated === 'true',
        location,
        shelterContact,
        images: allImages,
        imageUrls: parsedImageUrls,
        status: status || 'Available',
        description
      },
      { new: true }
    );

    if (!pet) return res.status(404).json({ message: 'Pet not found or unauthorized' });
    res.json(pet);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Shelter: delete pet
router.delete('/:id', auth, shelterOnly, async (req, res) => {
  try {
    const pet = await Pet.findOneAndDelete({ _id: req.params.id, shelterId: req.user.id });
    if (!pet) return res.status(404).json({ message: 'Pet not found or unauthorized' });
    res.json({ message: 'Pet deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Shelter: get own pets
router.get('/shelter/mine', auth, shelterOnly, async (req, res) => {
  try {
    const pets = await Pet.find({ shelterId: req.user.id }).sort({ createdAt: -1 });
    res.json(pets);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
