import { Router, Request, Response } from 'express';
import { CityModel } from '../models/City';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '50', search, province } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const filter: any = { isActive: true };
    if (search) {
      filter.cityName = { $regex: search as string, $options: 'i' };
    }
    if (province) {
      filter.province = province;
    }

    const [cities, total] = await Promise.all([
      CityModel.find(filter).sort({ cityName: 1 }).skip(skip).limit(Number(limit)).lean(),
      CityModel.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: cities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    logger.error('Error fetching cities:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch cities' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const city = await CityModel.findById(req.params.id).lean();
    if (!city) {
      res.status(404).json({ success: false, message: 'City not found' });
      return;
    }
    res.status(200).json({ success: true, data: city });
  } catch (error) {
    logger.error('Error fetching city:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch city' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { cityName } = req.body;
    if (!cityName) {
      res.status(400).json({ success: false, message: 'cityName is required' });
      return;
    }
    const city = new CityModel(req.body);
    await city.save();
    res.status(201).json({ success: true, data: city, message: 'City created' });
  } catch (error) {
    logger.error('Error creating city:', error);
    res.status(500).json({ success: false, message: 'Failed to create city' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const city = await CityModel.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    ).lean();
    if (!city) {
      res.status(404).json({ success: false, message: 'City not found' });
      return;
    }
    res.status(200).json({ success: true, data: city, message: 'City updated' });
  } catch (error) {
    logger.error('Error updating city:', error);
    res.status(500).json({ success: false, message: 'Failed to update city' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const city = await CityModel.findByIdAndUpdate(
      req.params.id,
      { $set: { isActive: false } },
      { new: true }
    ).lean();
    if (!city) {
      res.status(404).json({ success: false, message: 'City not found' });
      return;
    }
    res.status(200).json({ success: true, data: city, message: 'City deactivated' });
  } catch (error) {
    logger.error('Error deactivating city:', error);
    res.status(500).json({ success: false, message: 'Failed to deactivate city' });
  }
});

export default router;
