import mongoose, { type ClientSession, type Model, type Types } from 'mongoose';
import { ApiError } from '../utils/ApiError.js';
import type { PaginatedResult, RepositoryOptions } from '../types/common.js';

type Id = string | Types.ObjectId;

/**
 * Generic MongoDB repository with CRUD, soft delete, pagination, and transactions.
 */
export class BaseRepository<T = any> {
  protected model: Model<T>;
  protected resourceName: string;

  constructor(model: Model<T>, resourceName = 'Resource') {
    if (!model) throw new Error('BaseRepository requires a Mongoose model');
    this.model = model;
    this.resourceName = resourceName;
  }

  async create(
    data: Partial<T> | Record<string, unknown>,
    options: { session?: ClientSession; actor?: string | null } = {},
  ) {
    const { session, actor } = options;
    const doc = new this.model(data as any);
    if (actor) (doc as any).$locals = { ...((doc as any).$locals || {}), actor };
    return doc.save({ session });
  }

  async findById(id: Id, options: RepositoryOptions = {}): Promise<any> {
    if (!mongoose.isValidObjectId(id)) return null;

    let query: any = this.model.findById(id);
    if (options.select) query = query.select(options.select);
    if (options.populate) query = query.populate(options.populate);
    if (options.includeDeleted) query = query.setOptions({ includeDeleted: true });
    if (options.lean) query = query.lean();
    return query.exec();
  }

  async findOne(
    filter: Record<string, unknown> = {},
    options: RepositoryOptions = {},
  ): Promise<any> {
    let query: any = this.model.findOne(filter as any);
    if (options.select) query = query.select(options.select);
    if (options.populate) query = query.populate(options.populate);
    if (options.sort) query = query.sort(options.sort);
    if (options.includeDeleted) query = query.setOptions({ includeDeleted: true });
    if (options.lean) query = query.lean();
    return query.exec();
  }

  async findMany(
    filter: Record<string, unknown> = {},
    options: RepositoryOptions = {},
  ): Promise<PaginatedResult<any>> {
    const page = Math.max(1, Number(options.page) || 1);
    // Cap list fan-out; schedules use up to ~500 via authenticated domain queries.
    const limit = Math.min(500, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const queryFilter: Record<string, unknown> = { ...filter };

    if (options.search && options.searchFields?.length) {
      const regex = new RegExp(escapeRegex(options.search), 'i');
      queryFilter.$or = options.searchFields.map((field) => ({ [field]: regex }));
    }

    let query: any = this.model.find(queryFilter as any);
    if (options.select) query = query.select(options.select);
    if (options.populate) query = query.populate(options.populate);
    if (options.includeDeleted) query = query.setOptions({ includeDeleted: true });
    if (options.lean !== false) query = query.lean();

    const sort = parseSort(options.sort);
    query = query.sort(sort).skip(skip).limit(limit);

    const [data, total] = await Promise.all([
      query.exec(),
      this.model
        .countDocuments(queryFilter as any)
        .setOptions(options.includeDeleted ? { includeDeleted: true } : {}),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async update(
    id: Id,
    update: Record<string, unknown>,
    options: RepositoryOptions = {},
  ): Promise<any> {
    if (!mongoose.isValidObjectId(id)) {
      throw ApiError.badRequest(`Invalid ${this.resourceName} id`);
    }

    const { session, actor, includeDeleted = false, select, populate } = options;
    const runValidators = true;

    let query: any = this.model.findOneAndUpdate(
      { _id: id } as any,
      { $set: update } as any,
      {
        new: true,
        runValidators,
        session,
        actor,
        includeDeleted,
      } as any,
    );

    if (select) query = query.select(select);
    if (populate) query = query.populate(populate);
    return query.exec();
  }

  async softDelete(id: Id, deletedBy: Id | null = null) {
    if (!mongoose.isValidObjectId(id)) {
      throw ApiError.badRequest(`Invalid ${this.resourceName} id`);
    }
    if (typeof (this.model as any).softDeleteById === 'function') {
      return (this.model as any).softDeleteById(id, deletedBy);
    }
    return this.update(id, {
      isDeleted: true,
      deletedAt: new Date(),
      ...(deletedBy ? { deletedBy, updatedBy: deletedBy } : {}),
    });
  }

  async hardDelete(id: Id, options: { session?: ClientSession } = {}) {
    if (!mongoose.isValidObjectId(id)) {
      throw ApiError.badRequest(`Invalid ${this.resourceName} id`);
    }
    return this.model.findByIdAndDelete(id, { session: options.session }).exec();
  }

  async count(filter: Record<string, unknown> = {}, options: RepositoryOptions = {}) {
    let query = this.model.countDocuments(filter as any);
    if (options.includeDeleted) query = query.setOptions({ includeDeleted: true });
    return query.exec();
  }

  async aggregate(
    pipeline: Record<string, unknown>[] = [],
    options: { session?: ClientSession } = {},
  ) {
    const agg = this.model.aggregate(pipeline as any);
    if (options.session) agg.session(options.session);
    return agg.exec();
  }

  async withTransaction<R>(work: (session: ClientSession) => Promise<R>): Promise<R> {
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

  async exists(filter: Record<string, unknown> = {}): Promise<boolean> {
    const doc = await this.model.exists(filter as any);
    return Boolean(doc);
  }
}

function escapeRegex(str: string): string {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseSort(sort?: string | Record<string, 1 | -1>): Record<string, 1 | -1> {
  if (!sort) return { createdAt: -1 };
  if (typeof sort === 'object') return sort;

  const result: Record<string, 1 | -1> = {};
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
