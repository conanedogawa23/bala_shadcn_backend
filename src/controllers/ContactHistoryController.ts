import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { ContactHistoryService } from '@/services/ContactHistoryService';
import { ContactHistoryView } from '@/views/ContactHistoryView';
import { asyncHandler } from '@/utils/asyncHandler';
import { logger } from '@/utils/logger';

export class ContactHistoryController {
  /**
   * Get contact history with filtering and pagination
   * GET /api/v1/contact-history
   */
  static getContactHistory = asyncHandler(async (req: Request, res: Response) => {
    // Handle validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        ContactHistoryView.formatValidationError(errors.array().map(err => err.msg))
      );
    }

    const query = {
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 50, 100),
      clinicName: req.query.clinicName as string,
      clientId: req.query.clientId as string,
      contactType: req.query.contactType as string,
      direction: req.query.direction as string,
      priority: req.query.priority as string,
      followUpRequired: req.query.followUpRequired === 'true' ? true : 
        req.query.followUpRequired === 'false' ? false : undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      search: req.query.search as string
    };

    const result = await ContactHistoryService.getContactHistory(query);
    
    res.status(200).json(ContactHistoryView.formatContactHistoryResponse(result));
  });

  /**
   * Get contact history by ID
   * GET /api/v1/contact-history/:id
   */
  static getContactHistoryById = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        ContactHistoryView.formatValidationError(errors.array().map(err => err.msg))
      );
    }

    const id = parseInt(req.params.id);
    const contact = await ContactHistoryService.getContactHistoryById(id);
    
    res.status(200).json(ContactHistoryView.formatSuccess(contact));
  });

  /**
   * Create new contact history record
   * POST /api/v1/contact-history
   */
  static createContactHistory = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        ContactHistoryView.formatValidationError(errors.array().map(err => err.msg))
      );
    }

    const contactData = req.body;
    const newContact = await ContactHistoryService.createContactHistory(contactData);
    
    res.status(201).json(ContactHistoryView.formatSuccess(newContact, 'Contact history created successfully'));
  });

  /**
   * Update contact history record
   * PUT /api/v1/contact-history/:id
   */
  static updateContactHistory = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        ContactHistoryView.formatValidationError(errors.array().map(err => err.msg))
      );
    }

    const id = parseInt(req.params.id);
    const updateData = req.body;
    
    const updatedContact = await ContactHistoryService.updateContactHistory(id, updateData);
    
    res.status(200).json(ContactHistoryView.formatSuccess(updatedContact, 'Contact history updated successfully'));
  });

  /**
   * Delete contact history record (soft delete)
   * DELETE /api/v1/contact-history/:id
   */
  static deleteContactHistory = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        ContactHistoryView.formatValidationError(errors.array().map(err => err.msg))
      );
    }

    const id = parseInt(req.params.id);
    await ContactHistoryService.deleteContactHistory(id);
    
    res.status(200).json({
      success: true,
      message: 'Contact history deleted successfully'
    });
  });

  /**
   * Get contact history by client
   * GET /api/v1/contact-history/client/:clientId
   */
  static getContactHistoryByClient = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        ContactHistoryView.formatValidationError(errors.array().map(err => err.msg))
      );
    }

    const clientId = req.params.clientId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    
    const contacts = await ContactHistoryService.getContactHistoryByClient(clientId, limit);
    
    res.status(200).json(ContactHistoryView.formatSuccess(contacts));
  });

  /**
   * Get contact history by clinic
   * GET /api/v1/contact-history/clinic/:clinicName
   */
  static getContactHistoryByClinic = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        ContactHistoryView.formatValidationError(errors.array().map(err => err.msg))
      );
    }

    const clinicName = req.params.clinicName;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 200);
    
    const contacts = await ContactHistoryService.getContactHistoryByClinic(clinicName, limit);
    
    res.status(200).json(ContactHistoryView.formatSuccess(contacts));
  });

  /**
   * Get follow-ups required
   * GET /api/v1/contact-history/follow-ups
   */
  static getFollowUpsRequired = asyncHandler(async (req: Request, res: Response) => {
    const clinicName = req.query.clinicName as string;
    
    const followUps = await ContactHistoryService.getFollowUpsRequired(clinicName);
    
    res.status(200).json(ContactHistoryView.formatFollowUpsList(followUps));
  });

  /**
   * Mark follow-up as completed
   * PUT /api/v1/contact-history/:id/follow-up/complete
   */
  static markFollowUpCompleted = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        ContactHistoryView.formatValidationError(errors.array().map(err => err.msg))
      );
    }

    const id = parseInt(req.params.id);
    const { notes } = req.body;
    
    const updatedContact = await ContactHistoryService.markFollowUpCompleted(id, notes);
    
    res.status(200).json(ContactHistoryView.formatSuccess(updatedContact, 'Follow-up marked as completed'));
  });

  /**
   * Get contact history statistics
   * GET /api/v1/contact-history/stats
   */
  static getContactHistoryStats = asyncHandler(async (req: Request, res: Response) => {
    const clinicName = req.query.clinicName as string;
    const days = parseInt(req.query.days as string) || 30;
    
    // Validate days parameter
    if (days < 1 || days > 365) {
      return res.status(400).json(
        ContactHistoryView.formatError('Days parameter must be between 1 and 365', 'INVALID_DAYS')
      );
    }
    
    const stats = await ContactHistoryService.getContactHistoryStats(clinicName, days);
    
    res.status(200).json(ContactHistoryView.formatContactHistoryStats(stats));
  });

  /**
   * Add tag to contact history
   * POST /api/v1/contact-history/:id/tags
   */
  static addTag = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        ContactHistoryView.formatValidationError(errors.array().map(err => err.msg))
      );
    }

    const id = parseInt(req.params.id);
    const { tag } = req.body;
    
    if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
      return res.status(400).json(
        ContactHistoryView.formatError('Tag is required and must be a non-empty string', 'INVALID_TAG')
      );
    }
    
    const updatedContact = await ContactHistoryService.addTag(id, tag.trim());
    
    res.status(200).json(ContactHistoryView.formatSuccess(updatedContact, 'Tag added successfully'));
  });

  /**
   * Get recent activity
   * GET /api/v1/contact-history/recent
   */
  static getRecentActivity = asyncHandler(async (req: Request, res: Response) => {
    const clinicName = req.query.clinicName as string;
    const days = parseInt(req.query.days as string) || 7;
    
    // Validate days parameter
    if (days < 1 || days > 30) {
      return res.status(400).json(
        ContactHistoryView.formatError('Days parameter must be between 1 and 30', 'INVALID_DAYS')
      );
    }
    
    const recentContacts = await ContactHistoryService.getRecentActivity(clinicName, days);
    
    res.status(200).json(ContactHistoryView.formatRecentActivity(recentContacts));
  });

  /**
   * Bulk operations for contact history
   * POST /api/v1/contact-history/bulk
   */
  static bulkOperations = asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(
        ContactHistoryView.formatValidationError(errors.array().map(err => err.msg))
      );
    }

    const { operation, contactIds, data } = req.body;
    
    if (!operation || !Array.isArray(contactIds) || contactIds.length === 0) {
      return res.status(400).json(
        ContactHistoryView.formatError('Operation and contactIds array are required', 'INVALID_BULK_REQUEST')
      );
    }

    // Validate contact IDs are numbers
    const validIds = contactIds.every(id => typeof id === 'number' && id > 0);
    if (!validIds) {
      return res.status(400).json(
        ContactHistoryView.formatError('All contact IDs must be positive numbers', 'INVALID_CONTACT_IDS')
      );
    }

    let results: any[] = [];
    
    try {
      switch (operation) {
      case 'delete':
        // Use Promise.all for parallel processing instead of forEach
        await Promise.all(
          contactIds.map(id => ContactHistoryService.deleteContactHistory(id))
        );
        results = contactIds.map(id => ({ id, status: 'deleted' }));
        break;
          
      case 'update': {
        if (!data) {
          return res.status(400).json(
            ContactHistoryView.formatError('Update data is required for bulk update', 'MISSING_UPDATE_DATA')
          );
        }
          
        // Use Promise.all for parallel processing
        const updatePromises = contactIds.map(id => 
          ContactHistoryService.updateContactHistory(id, data)
        );
        const updatedContacts = await Promise.all(updatePromises);
        results = updatedContacts.map((contact, index) => ({ 
          id: contactIds[index], 
          status: 'updated',
          data: ContactHistoryView.formatContactHistory(contact)
        }));
        break;
      }
          
      case 'addTag':
        if (!data?.tag) {
          return res.status(400).json(
            ContactHistoryView.formatError('Tag is required for bulk tag operation', 'MISSING_TAG')
          );
        }
          
        // Use Promise.all for parallel processing
        await Promise.all(
          contactIds.map(id => ContactHistoryService.addTag(id, data.tag))
        );
        results = contactIds.map(id => ({ id, status: 'tagged', tag: data.tag }));
        break;
          
      default:
        return res.status(400).json(
          ContactHistoryView.formatError(`Unsupported operation: ${operation}`, 'UNSUPPORTED_OPERATION')
        );
      }
      
      res.status(200).json({
        success: true,
        data: results,
        message: `Bulk ${operation} completed successfully`,
        processed: results.length
      });
      
    } catch (error) {
      logger.error('Bulk operation failed:', error);
      res.status(500).json(
        ContactHistoryView.formatError('Bulk operation failed', 'BULK_OPERATION_ERROR')
      );
    }
  });
}
