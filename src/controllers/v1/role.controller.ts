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

export const createRole = asyncHandler(async (req, res) => {
  const role = await container.roleService.createRole(
    req.body,
    req.user,
    requestContext(req),
  );
  return ApiResponse.created(res, role, MESSAGES.CREATED);
});

export const getRoles = asyncHandler(async (req, res) => {
  const result = await container.roleService.listRoles(req.query);
  return ApiResponse.paginated(
    res,
    result.data,
    result.meta || result.pagination,
    MESSAGES.LIST_FETCHED,
  );
});

export const getRole = asyncHandler(async (req, res) => {
  const role = await container.roleService.getRoleById(req.params.id);
  return ApiResponse.ok(res, role, MESSAGES.FETCHED);
});

export const updateRole = asyncHandler(async (req, res) => {
  const role = await container.roleService.updateRole(
    req.params.id,
    req.body,
    req.user,
    requestContext(req),
  );
  return ApiResponse.ok(res, role, MESSAGES.UPDATED);
});

export const deleteRole = asyncHandler(async (req, res) => {
  await container.roleService.deleteRole(req.params.id, req.user, requestContext(req));
  return ApiResponse.ok(res, { success: true }, MESSAGES.DELETED);
});

export const assignPermissions = asyncHandler(async (req, res) => {
  const role = await container.roleService.assignPermissions(
    req.params.id,
    req.body.permissions,
    req.user,
    requestContext(req),
  );
  return ApiResponse.ok(res, role, MESSAGES.UPDATED);
});

export default {
  createRole,
  getRoles,
  getRole,
  updateRole,
  deleteRole,
  assignPermissions,
};
