const mongoose = require('mongoose');

const petSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  breed: { type: String },
  age: {
    years: { type: Number, default: 0, min: 0 },
    months: { type: Number, default: 0, min: 0, max: 11 },
    days: { type: Number, default: 0, min: 0, max: 29 }
  },
  gender: { type: String, enum: ['Male', 'Female'] },
  vaccinated: { type: Boolean, default: false },
  location: { type: String },
  shelterContact: { type: String, required: true },
  images: [{ type: String }], // Uploaded image filenames
  imageUrls: [{ type: String }], // External image URLs (deprecated, for display only)
  status: { type: String, enum: ['Available', 'Pending', 'Adopted'], default: 'Available' },
  shelterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  description: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('Pet', petSchema);
