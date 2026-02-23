import { Request, Response } from 'express';
import { ClientCompanyService } from '../services/ClientCompanyService';
import { logger } from '../utils/logger';

export class ClientCompanyController {
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '50', search } = req.query;
      const result = await ClientCompanyService.getAll({
        page: Number(page),
        limit: Math.min(Number(limit), 100),
        search: search as string
      });

      res.status(200).json({
        success: true,
        data: result.companies,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: result.total,
          totalPages: Math.ceil(result.total / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Error fetching companies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch companies',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ success: false, message: 'ID is required' }); return; }
      const company = await ClientCompanyService.getById(id);
      if (!company) {
        res.status(404).json({ success: false, message: 'Company not found' });
        return;
      }
      res.status(200).json({ success: true, data: company });
    } catch (error) {
      logger.error('Error fetching company:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch company',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { companyName } = req.body;
      if (!companyName) {
        res.status(400).json({ success: false, message: 'companyName is required' });
        return;
      }
      const company = await ClientCompanyService.create(req.body);
      res.status(201).json({ success: true, data: company, message: 'Company created' });
    } catch (error) {
      logger.error('Error creating company:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create company',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ success: false, message: 'ID is required' }); return; }
      const company = await ClientCompanyService.update(id, req.body);
      if (!company) {
        res.status(404).json({ success: false, message: 'Company not found' });
        return;
      }
      res.status(200).json({ success: true, data: company, message: 'Company updated' });
    } catch (error) {
      logger.error('Error updating company:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update company',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async deactivate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ success: false, message: 'ID is required' }); return; }
      const company = await ClientCompanyService.deactivate(id);
      if (!company) {
        res.status(404).json({ success: false, message: 'Company not found' });
        return;
      }
      res.status(200).json({ success: true, data: company, message: 'Company deactivated' });
    } catch (error) {
      logger.error('Error deactivating company:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate company',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async search(req: Request, res: Response): Promise<void> {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        res.status(400).json({ success: false, message: 'Search query (q) is required' });
        return;
      }
      const companies = await ClientCompanyService.search(q);
      res.status(200).json({ success: true, data: companies });
    } catch (error) {
      logger.error('Error searching companies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search companies',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
