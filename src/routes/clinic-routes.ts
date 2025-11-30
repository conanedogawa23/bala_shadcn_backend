import { Router } from 'express';
import { param } from 'express-validator';
import { ClinicController } from '../controllers/ClinicController';
import { optionalAuthenticate } from '../middleware/authMiddleware';

const router = Router();

// Validation middleware for clinic name
const nameValidation = [
  param('name')
    .isLength({ min: 1 })
    .withMessage('Clinic name is required')
    .trim()
];

// Routes - All endpoints use MongoDB as source of truth
// Public with optional authentication - frontend can fetch without login
router.get('/frontend-compatible', optionalAuthenticate, ClinicController.getClinicsFrontendCompatible);
router.get('/available', optionalAuthenticate, ClinicController.getAvailableClinics);
router.get('/names', optionalAuthenticate, ClinicController.getClinicNames);
router.get('/find/:name', optionalAuthenticate, nameValidation, ClinicController.findClinicByName);

export default router;
