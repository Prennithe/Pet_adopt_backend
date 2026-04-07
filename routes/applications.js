const router = require('express').Router();
const Application = require('../models/Application');
const Pet = require('../models/Pet');
const { auth, shelterOnly } = require('../middleware/auth');

// Submit adoption application (public or logged in)
router.post('/', async (req, res) => {
  try {
    const { petId, name, email, phone, address, housingType, reason, userId } = req.body;
    const pet = await Pet.findById(petId);
    if (!pet) return res.status(404).json({ message: 'Pet not found' });

    const application = await Application.create({
      petId, name, email, phone, address, housingType, reason,
      userId: userId || null,
    });
    res.status(201).json(application);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Shelter: get all applications for their pets
router.get('/shelter', auth, shelterOnly, async (req, res) => {
  try {
    const pets = await Pet.find({ shelterId: req.user.id }).select('_id');
    const petIds = pets.map((p) => p._id);
    const applications = await Application.find({ petId: { $in: petIds } })
      .populate('petId', 'name type')
      .sort({ createdAt: -1 });
    res.json(applications);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Shelter: update application status
router.patch('/:id/status', auth, shelterOnly, async (req, res) => {
  try {
    const { status } = req.body;
    const application = await Application.findById(req.params.id).populate('petId');
    if (!application) return res.status(404).json({ message: 'Application not found' });

    if (String(application.petId.shelterId) !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    application.status = status;
    await application.save();

    // If application is approved, update pet status to Adopted
    if (status === 'APPROVED') {
      await Pet.findByIdAndUpdate(application.petId._id, { status: 'Adopted' });
    }

    res.json(application);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
