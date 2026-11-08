const BannerModel = require('../models/banner.model');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const BannerController = {
  async getAll(req, res) {
    const activeOnly = req.query.all !== 'true';
    const banners = await BannerModel.findAll({ activeOnly });
    return sendSuccess(res, {
      message: 'Banners retrieved successfully',
      data: banners,
    });
  },

  async create(req, res) {
    const banner = await BannerModel.create(req.body);
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Banner created successfully',
      data: banner,
    });
  },

  async update(req, res) {
    const { id } = req.params;
    const existing = await BannerModel.findById(id);
    if (!existing) {
      return sendError(res, { statusCode: 404, message: 'Banner not found' });
    }
    const updated = await BannerModel.update(id, req.body);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Banner updated successfully',
      data: updated,
    });
  },

  async delete(req, res) {
    const { id } = req.params;
    const deleted = await BannerModel.delete(id);
    if (!deleted) {
      return sendError(res, { statusCode: 404, message: 'Banner not found' });
    }
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Banner deleted successfully',
    });
  },
};

module.exports = BannerController;
