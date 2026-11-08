const CategoryModel = require('../models/category.model');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { slugify } = require('../utils/helpers');

const CategoryController = {
  async getAll(req, res) {
    const activeOnly = req.query.activeOnly === 'true' || req.query.activeOnly === '1';
    const asTree = req.query.tree === 'true' || req.query.tree === '1';

    const categories = await CategoryModel.findAll({ activeOnly });

    if (asTree) {
      // Build hierarchical tree
      const map = {};
      const roots = [];

      categories.forEach((cat) => {
        map[cat.id] = { ...cat, children: [] };
      });

      categories.forEach((cat) => {
        if (cat.parent_id && map[cat.parent_id]) {
          map[cat.parent_id].children.push(map[cat.id]);
        } else {
          roots.push(map[cat.id]);
        }
      });

      return sendSuccess(res, {
        message: 'Category tree retrieved',
        data: roots,
      });
    }

    return sendSuccess(res, {
      message: 'Categories retrieved',
      data: categories,
    });
  },

  async getOne(req, res) {
    const identifier = req.params.identifier || req.params.idOrSlug;
    let category = null;

    if (!isNaN(identifier)) {
      category = await CategoryModel.findById(Number(identifier));
    }

    if (!category) {
      category = await CategoryModel.findBySlug(identifier);
    }

    if (!category) {
      return sendError(res, { statusCode: 404, message: 'Category not found' });
    }

    return sendSuccess(res, {
      message: 'Category retrieved',
      data: category,
    });
  },

  async create(req, res) {
    const { name, parent_id, description, image_url, is_active } = req.body;
    let slug = req.body.slug ? slugify(req.body.slug) : slugify(name);

    // Check duplicate slug
    const existing = await CategoryModel.findBySlug(slug);
    if (existing) {
      slug = `${slug}-${Date.now().toString().slice(-4)}`;
    }

    const category = await CategoryModel.create({
      parent_id: parent_id ? Number(parent_id) : null,
      name,
      slug,
      description: description || null,
      image_url: image_url || null,
      is_active: is_active !== undefined ? Number(is_active) : 1,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Category created successfully',
      data: category,
    });
  },

  async update(req, res) {
    const { id } = req.params;
    const category = await CategoryModel.findById(id);

    if (!category) {
      return sendError(res, { statusCode: 404, message: 'Category not found' });
    }

    const updateData = { ...req.body };
    if (updateData.name && !updateData.slug) {
      updateData.slug = slugify(updateData.name);
    } else if (updateData.slug) {
      updateData.slug = slugify(updateData.slug);
    }

    if (updateData.slug && updateData.slug !== category.slug) {
      const existing = await CategoryModel.findBySlug(updateData.slug);
      if (existing && existing.id !== Number(id)) {
        return sendError(res, { statusCode: 409, message: 'Category slug already in use' });
      }
    }

    const updated = await CategoryModel.update(id, updateData);

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Category updated successfully',
      data: updated,
    });
  },

  async delete(req, res) {
    const { id } = req.params;
    const category = await CategoryModel.findById(id);

    if (!category) {
      return sendError(res, { statusCode: 404, message: 'Category not found or already deleted' });
    }

    const success = await CategoryModel.delete(id);

    if (!success) {
      return sendError(res, { statusCode: 404, message: 'Category not found or already deleted' });
    }

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Category deleted successfully',
    });
  },
};

module.exports = CategoryController;
