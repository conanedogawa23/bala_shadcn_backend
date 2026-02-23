import { Router } from 'express';
import { ClientCompanyController } from '../controllers/ClientCompanyController';

const router = Router();

router.get('/', ClientCompanyController.getAll);
router.get('/search', ClientCompanyController.search);
router.get('/:id', ClientCompanyController.getById);
router.post('/', ClientCompanyController.create);
router.put('/:id', ClientCompanyController.update);
router.delete('/:id', ClientCompanyController.deactivate);

export default router;
