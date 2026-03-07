import { Router } from 'express';
import { EmailController } from '@/controllers/EmailController';

const router = Router();

router.post('/appointment-reminder', EmailController.sendAppointmentReminder);
router.post('/invoice', EmailController.sendBillingInvoice);
router.post('/follow-up', EmailController.sendFollowUp);

export default router;
