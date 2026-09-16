/**
 * The permission model is the thing that stops one shop reading another shop's
 * documents. These tests exist so a refactor cannot quietly widen access.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_CODES,
  ROLE_META,
  isPermission,
  isRoleCode,
} from '@/lib/permissions'

describe('permission vocabulary', () => {
  it('has no duplicates', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length)
  })

  it('gives every permission a human label', () => {
    for (const permission of PERMISSIONS) {
      expect(PERMISSION_LABELS[permission], permission + ' has no label').toBeTruthy()
    }
  })

  it('shows every permission somewhere in the grid', () => {
    const shown = new Set(PERMISSION_GROUPS.flatMap((g) => g.permissions))
    for (const permission of PERMISSIONS) {
      expect(shown.has(permission), permission + ' is missing from PERMISSION_GROUPS').toBe(true)
    }
  })

  it('only lists real permissions in the grid', () => {
    for (const group of PERMISSION_GROUPS) {
      for (const permission of group.permissions) {
        expect(isPermission(permission)).toBe(true)
      }
    }
  })
})

describe('roles', () => {
  it('describes every role', () => {
    for (const role of ROLE_CODES) {
      expect(ROLE_META[role]?.name).toBeTruthy()
      expect(ROLE_META[role]?.rank).toBeGreaterThan(0)
    }
  })

  it('ranks roles strictly, so "may only assign below my rank" is well defined', () => {
    const ranks = ROLE_CODES.map((r) => ROLE_META[r].rank)
    expect(new Set(ranks).size).toBe(ranks.length)
    expect(ROLE_META.super_admin.rank).toBeGreaterThan(ROLE_META.admin.rank)
    expect(ROLE_META.admin.rank).toBeGreaterThan(ROLE_META.approver.rank)
    expect(ROLE_META.approver.rank).toBeGreaterThan(ROLE_META.shop_user.rank)
    expect(ROLE_META.shop_user.rank).toBeGreaterThan(ROLE_META.viewer.rank)
  })

  it('only grants permissions that exist', () => {
    for (const role of ROLE_CODES) {
      for (const permission of DEFAULT_ROLE_PERMISSIONS[role]) {
        expect(isPermission(permission), role + ' grants unknown ' + permission).toBe(true)
      }
    }
  })

  it('rejects made-up role codes', () => {
    expect(isRoleCode('super_admin')).toBe(true)
    expect(isRoleCode('hacker')).toBe(false)
  })
})

describe('the default matrix matches what the plan promises', () => {
  const has = (role: (typeof ROLE_CODES)[number], p: string) =>
    DEFAULT_ROLE_PERMISSIONS[role].includes(p as never)

  it('gives Super Admin everything', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.super_admin.length).toBe(PERMISSIONS.length)
  })

  it('keeps Master Control and the permission grid for Super Admin only', () => {
    for (const role of ROLE_CODES) {
      if (role === 'super_admin') continue
      expect(has(role, 'settings.manage'), role + ' must not manage settings').toBe(false)
      expect(has(role, 'role.manage'), role + ' must not edit the grid').toBe(false)
    }
  })

  it('lets only Admin and Super Admin see every shop', () => {
    expect(has('admin', 'shop.view_all')).toBe(true)
    expect(has('approver', 'shop.view_all')).toBe(false)
    expect(has('shop_user', 'shop.view_all')).toBe(false)
    expect(has('viewer', 'shop.view_all')).toBe(false)
  })

  it('lets only Approver, Admin and Super Admin approve', () => {
    expect(has('approver', 'document.approve')).toBe(true)
    expect(has('admin', 'document.approve')).toBe(true)
    expect(has('shop_user', 'document.approve')).toBe(false)
    expect(has('viewer', 'document.approve')).toBe(false)
  })

  it('keeps Viewer read-only', () => {
    for (const write of [
      'document.upload',
      'document.edit',
      'document.submit',
      'document.approve',
      'document.delete_draft',
      'shop.manage',
      'user.manage',
      'membership.manage',
    ]) {
      expect(has('viewer', write), 'viewer must not have ' + write).toBe(false)
    }
  })

  it('does not let an Approver upload by default, so the self-approval rule rarely bites', () => {
    expect(has('approver', 'document.upload')).toBe(false)
  })

  it('gives a Shop User the whole upload-to-submit path', () => {
    for (const p of [
      'document.upload',
      'document.view',
      'document.edit',
      'document.submit',
      'document.retry_ocr',
    ]) {
      expect(has('shop_user', p), 'shop_user needs ' + p).toBe(true)
    }
  })
})
