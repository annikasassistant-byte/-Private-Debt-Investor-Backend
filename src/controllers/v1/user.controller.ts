import { container } from '../../di/container.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { MESSAGES } from '../../constants/messages.js';

/**
 * @param {import('express').Request} req
 */
function requestContext(req) {
  return {
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.get('user-agent'),
  };
}

export const getMe = asyncHandler(async (req, res) => {
  const user = await container.userService.getProfile(req.user._id || req.user.id);
  return ApiResponse.ok(res, user, MESSAGES.FETCHED);
});

export const updateMe = asyncHandler(async (req, res) => {
  const user = await container.userService.updateProfile(
    req.user._id || req.user.id,
    req.body,
    requestContext(req),
  );
  return ApiResponse.ok(res, user, MESSAGES.UPDATED);
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  const user = await container.userService.uploadAvatar(
    req.user._id || req.user.id,
    req.file,
    requestContext(req),
  );
  return ApiResponse.ok(res, user, MESSAGES.UPLOAD_SUCCESS);
});

export const deleteMe = asyncHandler(async (req, res) => {
  await container.userService.softDeleteUser(
    req.user,
    req.user._id || req.user.id,
    requestContext(req),
  );
  return ApiResponse.ok(res, { success: true }, MESSAGES.DELETED);
});

export const getUsers = asyncHandler(async (req, res) => {
  const result = await container.userService.listUsers(req.user, req.query);
  return ApiResponse.paginated(res, result.data, result.meta || result.pagination, MESSAGES.LIST_FETCHED);
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await container.userService.getUserById(req.user, req.params.id);
  return ApiResponse.ok(res, user, MESSAGES.FETCHED);
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await container.userService.adminUpdateUser(
    req.user,
    req.params.id,
    req.body,
    requestContext(req),
  );
  return ApiResponse.ok(res, user, MESSAGES.UPDATED);
});

export const deleteUser = asyncHandler(async (req, res) => {
  await container.userService.softDeleteUser(req.user, req.params.id, requestContext(req));
  return ApiResponse.ok(res, { success: true }, MESSAGES.DELETED);
});

export const exportUsers = asyncHandler(async (req, res) => {
  const exported = await container.exportService.exportUsers({
    format: req.query.format || 'csv',
    search: req.query.search,
    limit: req.query.limit,
    filter: {
      ...(req.query.role ? { role: req.query.role } : {}),
    },
  });

  res.setHeader('Content-Type', exported.mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);

  if (exported.encoding === 'buffer' || Buffer.isBuffer(exported.content)) {
    return res.send(exported.content);
  }

  return res.send(exported.content);
});

export default {
  getMe,
  updateMe,
  uploadAvatar,
  deleteMe,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  exportUsers,
};
