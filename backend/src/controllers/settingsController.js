import Settings from '../models/Settings.js';

export const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(req.body);
    } else {
      const allowedFields = [
        'businessName',
        'ownerName',
        'phone',
        'address',
        'defaultSellingRate',
        'defaultPurchaseRate',
        'currencySymbol',
        'thermalPrintWidth'
      ];
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          settings[field] = req.body[field];
        }
      });
    }
    await settings.save();
    res.json({ success: true, settings, message: 'Settings updated successfully' });
  } catch (error) {
    next(error);
  }
};
