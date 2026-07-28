import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

/**
 * Generic MongoDB repository with CRUD, soft delete, pagination, and transactions.
 */
export class BaseRepository {
  /**
   * @param {import('mongoose').Model} model
   * @param {string} [resourceName]
   */
  constructor(model, resourceName = 'Resource') {
    if (!model) throw new Error('BaseRepository requires a Mongoose model');
    this.model = model;
    this.resourceName = resourceName;
  }

  /**
   * @param {object} data
   * @param {{ session?: import('mongoose').ClientSession, actor?: string }} [options]
   */
  async create(data, options = {}) {
    const { session, actor } = options;
    const doc = new this.model(data);
    if (actor) doc.$locals = { ...(doc.$locals || {}), actor };
    return doc.save({ session });
  }

  /**
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {{ populate?: string|object|Array, select?: string, includeDeleted?: boolean, lean?: boolean }} [options]
   */
  async findById(id, options = {}) {
    if (!mongoose.isValidObjectId(id)) return null;

    let query = this.model.findById(id);
    if (options.select) query = query.select(options.select);
    if (options.populate) query = query.populate(options.populate);
    if (options.includeDeleted) query = query.setOptions({ includeDeleted: true });
    if (options.lean) query = query.lean();
    return query.exec();
  }

  /**
   * @param {object} filter
   * @param {{ populate?: string|object|Array, select?: string, includeDeleted?: boolean, lean?: boolean, sort?: object }} [options]
   */
  async findOne(filter = {}, options = {}) {
    let query = this.model.findOne(filter);
    if (options.select) query = query.select(options.select);
    if (options.populate) query = query.populate(options.populate);
    if (options.sort) query = query.sort(options.sort);
    if (options.includeDeleted) query = query.setOptions({ includeDeleted: true });
    if (options.lean) query = query.lean();
    return query.exec();
  }

  /**
   * Paginated list with filter/sort.
   * @param {object} [filter={}]
   * @param {{
   *   page?: number,
   *   limit?: number,
   *   sort?: string|object,
   *   populate?: string|object|Array,
   *   select?: string,
   *   includeDeleted?: boolean,
   *   lean?: boolean,
   *   search?: string,
   *   searchFields?: string[],
   * }} [options]
   */
  async findMany(filter = {}, options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const queryFilter = { ...filter };

    if (options.search && options.searchFields?.length) {
      const regex = new RegExp(escapeRegex(options.search), 'i');
      queryFilter.$or = options.searchFields.map((field) => ({ [field]: regex }));
    }

    let query = this.model.find(queryFilter);
    if (options.select) query = query.select(options.select);
    if (options.populate) query = query.populate(options.populate);
    if (options.includeDeleted) query = query.setOptions({ includeDeleted: true });
    if (options.lean !== false) query = query.lean();

    const sort = parseSort(options.sort);
    query = query.sort(sort).skip(skip).limit(limit);

    const [data, total] = await Promise.all([
      query.exec(),
      this.model.countDocuments(queryFilter).setOptions(
        options.includeDeleted ? { includeDeleted: true } : {},
      ),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  /**
   * @param {string|import('mongoose').Types.ObjectId} id
   * @param {object} update
   * @param {{ session?: import('mongoose').ClientSession, actor?: string, includeDeleted?: boolean, runValidators?: boolean, select?: string, populate?: any }} [options]
   */
  async update(id, update, options = {}) {
    if (!mongoose.isValidObjectId(id)) {
      throw ApiError.badRequest(`Invalid ${this.resourceName} id`);
    }

    const {
      session,
      actor,
      includeDeleted = false,
      runValidators = true,
      select,
      populate,
    } = options;

    let query = this.model.findOneAndUpdate(
      { _id: id },
      { $set: update },
      {
        new: true,
        runValidators,
        session,
        actor,
        includeDeleted,
      },
    );

    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    return query.exec();
  }

  /**
   * Soft-delete by id (requires soft-delete plugin on model).
   */
  async softDelete(id, deletedBy = null) {
    if (!mongoose.isValidObjectId(id)) {
      throw ApiError.badRequest(`Invalid ${this.resourceName} id`);
    }
    if (typeof this.model.softDeleteById === 'function') {
      return this.model.softDeleteById(id, deletedBy);
    }
    return this.update(id, {
      isDeleted: true,
      deletedAt: new Date(),
      ...(deletedBy ? { deletedBy, updatedBy: deletedBy } : {}),
    });
  }

  /**
   * Permanent delete.
   */
  async hardDelete(id, options = {}) {
    if (!mongoose.isValidObjectId(id)) {
      throw ApiError.badRequest(`Invalid ${this.resourceName} id`);
    }
    return this.model.findByIdAndDelete(id, { session: options.session }).exec();
  }

  async count(filter = {}, options = {}) {
    let query = this.model.countDocuments(filter);
    if (options.includeDeleted) query = query.setOptions({ includeDeleted: true });
    return query.exec();
  }

  async aggregate(pipeline = [], options = {}) {
    const agg = this.model.aggregate(pipeline);
    if (options.session) agg.session(options.session);
    return agg.exec();
  }

  /**
   * Run work inside a MongoDB transaction.
   * @template T
   * @param {(session: import('mongoose').ClientSession) => Promise<T>} work
   * @returns {Promise<T>}
   */
  async withTransaction(work) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const result = await work(session);
      await session.commitTransaction();
      return result;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async exists(filter = {}) {
    const doc = await this.model.exists(filter);
    return Boolean(doc);
  }
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string|object} [sort]
 * @returns {object}
 */
function parseSort(sort) {
  if (!sort) return { createdAt: -1 };
  if (typeof sort === 'object') return sort;

  const result = {};
  String(sort)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((part) => {
      if (part.startsWith('-')) result[part.slice(1)] = -1;
      else result[part] = 1;
    });
  return Object.keys(result).length ? result : { createdAt: -1 };
}

export default BaseRepository;
