import { Router } from 'express';
import { param } from 'express-validator';
import { ClinicController } from '../controllers/ClinicController';
import { optionalAuthenticate } from '../middleware/authMiddleware';

const router = Router();

// Validation middleware
const slugValidation = [
  param('slug')
    .isLength({ min: 1 })
    .withMessage('Clinic slug is required')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Clinic slug must contain only lowercase letters, numbers, and hyphens')
    .trim()
];

// Routes
// All clinic discovery/validation endpoints are public with optional authentication
// This allows frontend to fetch clinics without requiring login
router.get('/frontend-compatible', optionalAuthenticate, ClinicController.getClinicsFrontendCompatible);
router.get('/available', optionalAuthenticate, ClinicController.getAvailableClinics);
router.get('/mapping', optionalAuthenticate, ClinicController.getClinicMapping);
router.get('/slug-to-name', optionalAuthenticate, ClinicController.getClinicMapping); // Alias for mapping endpoint
router.get('/validate/:slug', optionalAuthenticate, slugValidation, ClinicController.validateClinicSlug);
router.get('/slug-to-name/:slug', optionalAuthenticate, slugValidation, ClinicController.slugToClinicName);

export default router;
