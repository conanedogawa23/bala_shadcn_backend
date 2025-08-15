import { Router } from 'express';
import { InsuranceCompanyAddressController } from '../controllers/InsuranceCompanyAddressController';

const router = Router();

// Public routes (read-only access to insurance addresses)
router.get('/', InsuranceCompanyAddressController.getAllAddresses);
router.get('/stats/overview', InsuranceCompanyAddressController.getAddressStats);
router.get('/frontend-compatible', InsuranceCompanyAddressController.getAddressesForFrontend);
router.get('/key/:addressKey', InsuranceCompanyAddressController.getAddressByKey);
router.get('/company/:companyName', InsuranceCompanyAddressController.getAddressesByCompany);
router.get('/province/:province', InsuranceCompanyAddressController.getAddressesByProvince);
router.get('/city/:city', InsuranceCompanyAddressController.getAddressesByCity);
router.get('/postal/:postalCode', InsuranceCompanyAddressController.searchByPostalCode);
router.get('/:id', InsuranceCompanyAddressController.getAddressById);

// Protected routes (require authentication for write operations)
// TODO: Add authentication middleware when auth system is implemented
router.post('/', InsuranceCompanyAddressController.createAddress);
router.put('/:id', InsuranceCompanyAddressController.updateAddress);
router.delete('/:id', InsuranceCompanyAddressController.deleteAddress);

export default router;
