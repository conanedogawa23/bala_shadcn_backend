import { Router } from 'express';
import { ReferringDoctorController } from '../controllers/ReferringDoctorController';

const router = Router();

router.get('/', ReferringDoctorController.getAll);
router.get('/search', ReferringDoctorController.search);
router.get('/:id', ReferringDoctorController.getById);
router.post('/', ReferringDoctorController.create);
router.put('/:id', ReferringDoctorController.update);
router.delete('/:id', ReferringDoctorController.deactivate);

export default router;
