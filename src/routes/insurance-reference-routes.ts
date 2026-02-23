import { Router, Request, Response } from 'express';
import { InsuranceReferenceController } from '../controllers/InsuranceReferenceController';
import { InsuranceGroupNumberModel } from '../models/InsuranceGroupNumber';
import { logger } from '../utils/logger';

const router = Router();

// Legacy API compatibility routes (for testing)
router.get('/companies', InsuranceReferenceController.getAllPolicyHolders);
router.get('/types', InsuranceReferenceController.getAllFrequencies);

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

// Insurance Group Number CRUD Routes
router.get('/group-numbers', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter: any = { isActive: true };
    if (search) {
      const regex = new RegExp(search as string, 'i');
      filter.$or = [{ groupNumber: regex }, { planName: regex }];
    }
    const [groups, total] = await Promise.all([
      InsuranceGroupNumberModel.find(filter).sort({ groupNumber: 1 }).skip(skip).limit(Number(limit)).lean(),
      InsuranceGroupNumberModel.countDocuments(filter)
    ]);
    res.status(200).json({ success: true, data: groups, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    logger.error('Error fetching group numbers:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch group numbers' });
  }
});

router.get('/group-numbers/:id', async (req: Request, res: Response) => {
  try {
    const group = await InsuranceGroupNumberModel.findById(req.params.id).lean();
    if (!group) { res.status(404).json({ success: false, message: 'Group number not found' }); return; }
    res.status(200).json({ success: true, data: group });
  } catch (error) {
    logger.error('Error fetching group number:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch group number' });
  }
});

router.post('/group-numbers', async (req: Request, res: Response) => {
  try {
    const { groupNumber } = req.body;
    if (!groupNumber) { res.status(400).json({ success: false, message: 'groupNumber is required' }); return; }
    const group = new InsuranceGroupNumberModel(req.body);
    await group.save();
    res.status(201).json({ success: true, data: group, message: 'Group number created' });
  } catch (error) {
    logger.error('Error creating group number:', error);
    res.status(500).json({ success: false, message: 'Failed to create group number' });
  }
});

router.put('/group-numbers/:id', async (req: Request, res: Response) => {
  try {
    const group = await InsuranceGroupNumberModel.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true }).lean();
    if (!group) { res.status(404).json({ success: false, message: 'Group number not found' }); return; }
    res.status(200).json({ success: true, data: group, message: 'Group number updated' });
  } catch (error) {
    logger.error('Error updating group number:', error);
    res.status(500).json({ success: false, message: 'Failed to update group number' });
  }
});

router.delete('/group-numbers/:id', async (req: Request, res: Response) => {
  try {
    const group = await InsuranceGroupNumberModel.findByIdAndUpdate(req.params.id, { $set: { isActive: false } }, { new: true }).lean();
    if (!group) { res.status(404).json({ success: false, message: 'Group number not found' }); return; }
    res.status(200).json({ success: true, data: group, message: 'Group number deactivated' });
  } catch (error) {
    logger.error('Error deactivating group number:', error);
    res.status(500).json({ success: false, message: 'Failed to deactivate group number' });
  }
});

export default router;
