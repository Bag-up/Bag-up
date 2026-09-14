import { Injectable, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export const STAFF_ROLES = ['admin', 'assistant', 'manager'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

function assertStaff(err: any, user: any, allowed: readonly string[], label: string) {
  if (err || !user) {
    throw new ForbiddenException('Accès refusé');
  }
  if (!allowed.includes(user.role)) {
    throw new ForbiddenException(label);
  }
  return user;
}

/** Accès back-office lecture : admin, assistant, gérant. */
@Injectable()
export class StaffGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    return assertStaff(err, user, STAFF_ROLES, 'Accès staff requis');
  }
}

/** Validation KYC presta/commerçant : admin ou assistante. */
@Injectable()
export class AccountReviewGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    return assertStaff(err, user, ['admin', 'assistant'], 'Accès admin ou assistante requis');
  }
}

/** Mutations opérationnelles : admin ou gérant. */
@Injectable()
export class ManagerWriteGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    return assertStaff(err, user, ['admin', 'manager'], 'Accès gérant ou admin requis');
  }
}

/** Mutations config / droits complets : admin uniquement. */
@Injectable()
export class AdminGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    return assertStaff(err, user, ['admin'], 'Accès admin requis');
  }
}

export function isStaffRole(role?: string | null): boolean {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}
