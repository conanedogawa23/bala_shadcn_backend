import { Router } from 'express';
import { param } from 'express-validator';
import { ClinicController } from '../controllers/ClinicController';

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
router.get('/available', ClinicController.getAvailableClinics);
router.get('/mapping', ClinicController.getClinicMapping);
router.get('/validate/:slug', slugValidation, ClinicController.validateClinicSlug);
router.get('/slug-to-name/:slug', slugValidation, ClinicController.slugToClinicName);

export default router;
