const AddressModel = require('../models/address.model');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const AddressController = {
  async getAddresses(req, res) {
    const addresses = await AddressModel.findByUserId(req.user.id);
    return sendSuccess(res, {
      message: 'Addresses retrieved successfully',
      data: addresses,
    });
  },

  async getAddress(req, res) {
    const { id } = req.params;
    const address = await AddressModel.findById(id, req.user.id);

    if (!address) {
      return sendError(res, { statusCode: 404, message: 'Address not found' });
    }

    return sendSuccess(res, {
      message: 'Address retrieved successfully',
      data: address,
    });
  },

  async createAddress(req, res) {
    const address = await AddressModel.create(req.user.id, req.body);
    return sendSuccess(res, {
      statusCode: 201,
      message: 'Address added successfully',
      data: address,
    });
  },

  async updateAddress(req, res) {
    const { id } = req.params;
    const existing = await AddressModel.findById(id, req.user.id);

    if (!existing) {
      return sendError(res, { statusCode: 404, message: 'Address not found' });
    }

    const updated = await AddressModel.update(id, req.user.id, req.body);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Address updated successfully',
      data: updated,
    });
  },

  async setDefaultAddress(req, res) {
    const { id } = req.params;
    const existing = await AddressModel.findById(id, req.user.id);

    if (!existing) {
      return sendError(res, { statusCode: 404, message: 'Address not found' });
    }

    const updated = await AddressModel.setDefault(id, req.user.id);
    return sendSuccess(res, {
      statusCode: 200,
      message: 'Default address updated',
      data: updated,
    });
  },

  async deleteAddress(req, res) {
    const { id } = req.params;
    const success = await AddressModel.delete(id, req.user.id);

    if (!success) {
      return sendError(res, { statusCode: 404, message: 'Address not found' });
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Address deleted successfully',
    });
  },
};

module.exports = AddressController;
