import { Router } from 'express';
import { InsuranceReferenceController } from '../controllers/InsuranceReferenceController';

const router = Router();

// Combined Reference Data Endpoints
router.get('/all', InsuranceReferenceController.getAllInsuranceReferenceData);
router.get('/form-data', InsuranceReferenceController.getInsuranceFormData);
router.get('/summary', InsuranceReferenceController.getInsuranceReferenceSummary);

// Statistics and Validation
router.get('/stats', InsuranceReferenceController.getReferenceDataStats);
router.get('/validate', InsuranceReferenceController.validateReferenceData);

// Insurance Frequency Routes
router.get('/frequencies', InsuranceReferenceController.getAllFrequencies);
router.get('/frequencies/selectable', InsuranceReferenceController.getSelectableFrequencies);
router.get('/frequencies/:frequencyKey', InsuranceReferenceController.getFrequencyByKey);

// Insurance Policy Holder Routes
router.get('/policy-holders', InsuranceReferenceController.getAllPolicyHolders);
router.get('/policy-holders/valid', InsuranceReferenceController.getValidPolicyHolders);
router.get('/policy-holders/requiring-info', InsuranceReferenceController.getPolicyHoldersRequiringInfo);
router.get('/policy-holders/:policyHolderKey', InsuranceReferenceController.getPolicyHolderByKey);

// Insurance COB Routes
router.get('/cob', InsuranceReferenceController.getAllCOBOptions);
router.get('/cob/default', InsuranceReferenceController.getDefaultCOB);
router.get('/cob/value/:cobValue', InsuranceReferenceController.getCOBByValue);
router.get('/cob/:cobKey', InsuranceReferenceController.getCOBByKey);

// Dropdown Options Routes
router.get('/dropdowns/frequencies', InsuranceReferenceController.getFrequencyDropdownOptions);
router.get('/dropdowns/policy-holders', InsuranceReferenceController.getPolicyHolderDropdownOptions);
router.get('/dropdowns/cob', InsuranceReferenceController.getCOBDropdownOptions);

// Frontend Compatibility Routes
router.get('/frontend-compatible/all', InsuranceReferenceController.getAllReferenceDataForFrontend);
router.get('/frontend-compatible/frequencies', InsuranceReferenceController.getFrequenciesForFrontend);
router.get('/frontend-compatible/policy-holders', InsuranceReferenceController.getPolicyHoldersForFrontend);
router.get('/frontend-compatible/cob', InsuranceReferenceController.getCOBOptionsForFrontend);

export default router;
