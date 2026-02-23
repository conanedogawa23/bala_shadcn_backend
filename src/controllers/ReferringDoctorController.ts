import { Request, Response } from 'express';
import { ReferringDoctorService } from '../services/ReferringDoctorService';
import { logger } from '../utils/logger';

export class ReferringDoctorController {
  static async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '50', search, clinicName } = req.query;
      const result = await ReferringDoctorService.getAll({
        page: Number(page),
        limit: Math.min(Number(limit), 100),
        search: search as string,
        clinicName: clinicName as string
      });

      res.status(200).json({
        success: true,
        data: result.doctors,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: result.total,
          totalPages: Math.ceil(result.total / Number(limit))
        }
      });
    } catch (error) {
      logger.error('Error fetching referring doctors:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch referring doctors',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ success: false, message: 'ID is required' }); return; }
      const doctor = await ReferringDoctorService.getById(id);
      if (!doctor) {
        res.status(404).json({ success: false, message: 'Doctor not found' });
        return;
      }
      res.status(200).json({ success: true, data: doctor });
    } catch (error) {
      logger.error('Error fetching referring doctor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch referring doctor',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { firstName, lastName } = req.body;
      if (!firstName || !lastName) {
        res.status(400).json({ success: false, message: 'firstName and lastName are required' });
        return;
      }
      const doctor = await ReferringDoctorService.create(req.body);
      res.status(201).json({ success: true, data: doctor, message: 'Referring doctor created' });
    } catch (error) {
      logger.error('Error creating referring doctor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create referring doctor',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ success: false, message: 'ID is required' }); return; }
      const doctor = await ReferringDoctorService.update(id, req.body);
      if (!doctor) {
        res.status(404).json({ success: false, message: 'Doctor not found' });
        return;
      }
      res.status(200).json({ success: true, data: doctor, message: 'Referring doctor updated' });
    } catch (error) {
      logger.error('Error updating referring doctor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update referring doctor',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  static async deactivate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ success: false, message: 'ID is required' }); return; }
      const doctor = await ReferringDoctorService.deactivate(id);
      if (!doctor) {
        res.status(404).json({ success: false, message: 'Doctor not found' });
        return;
      }
      res.status(200).json({ success: true, data: doctor, message: 'Referring doctor deactivated' });
    } catch (error) {
      logger.error('Error deactivating referring doctor:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate referring doctor',
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
      const doctors = await ReferringDoctorService.search(q);
      res.status(200).json({ success: true, data: doctors });
    } catch (error) {
      logger.error('Error searching referring doctors:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search referring doctors',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
