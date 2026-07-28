import { container } from '../../di/container.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { MESSAGES } from '../../constants/messages.js';

function requestContext(req) {
  return {
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.get('user-agent'),
  };
}

export const createPermission = asyncHandler(async (req, res) => {
  const permission = await container.permissionService.createPermission(
    req.body,
    req.user,
    requestContext(req),
  );
  return ApiResponse.created(res, permission, MESSAGES.CREATED);
});

export const getPermissions = asyncHandler(async (req, res) => {
  const result = await container.permissionService.listPermissions(req.query);
  return ApiResponse.paginated(
    res,
    result.data,
    result.meta || result.pagination,
    MESSAGES.LIST_FETCHED,
  );
});

export const getPermission = asyncHandler(async (req, res) => {
  const permission = await container.permissionService.getPermissionById(req.params.id);
  return ApiResponse.ok(res, permission, MESSAGES.FETCHED);
});

export const updatePermission = asyncHandler(async (req, res) => {
  const permission = await container.permissionService.updatePermission(
    req.params.id,
    req.body,
    req.user,
    requestContext(req),
  );
  return ApiResponse.ok(res, permission, MESSAGES.UPDATED);
});

export const deletePermission = asyncHandler(async (req, res) => {
  await container.permissionService.deletePermission(
    req.params.id,
    req.user,
    requestContext(req),
  );
  return ApiResponse.ok(res, { success: true }, MESSAGES.DELETED);
});

export default {
  createPermission,
  getPermissions,
  getPermission,
  updatePermission,
  deletePermission,
};
