import { describe, it, expect } from "vitest";
import {
  can,
  ROLES,
  validateMemberMutation,
  Permission,
} from "../src/lib/permissions.js";

describe("RBAC Permissions - can() function", () => {
  describe("VIEWER role", () => {
    it("can only view project, issue, and comments", () => {
      expect(can(ROLES.VIEWER, "project:view")).toBe(true);
      expect(can(ROLES.VIEWER, "issue:view")).toBe(true);
      expect(can(ROLES.VIEWER, "comment:view")).toBe(true);
    });

    it("cannot perform write/mutation actions", () => {
      expect(can(ROLES.VIEWER, "issue:create")).toBe(false);
      expect(can(ROLES.VIEWER, "issue:edit")).toBe(false);
      expect(can(ROLES.VIEWER, "issue:move")).toBe(false);
      expect(can(ROLES.VIEWER, "issue:delete:own")).toBe(false);
      expect(can(ROLES.VIEWER, "issue:delete:any")).toBe(false);
      expect(can(ROLES.VIEWER, "comment:create")).toBe(false);
      expect(can(ROLES.VIEWER, "comment:delete:own")).toBe(false);
      expect(can(ROLES.VIEWER, "comment:delete:any")).toBe(false);
      expect(can(ROLES.VIEWER, "member:manage")).toBe(false);
      expect(can(ROLES.VIEWER, "project:settings")).toBe(false);
      expect(can(ROLES.VIEWER, "project:delete")).toBe(false);
    });
  });

  describe("MEMBER role", () => {
    it("can create, edit, move issues, create comments, and delete own items", () => {
      expect(can(ROLES.MEMBER, "project:view")).toBe(true);
      expect(can(ROLES.MEMBER, "issue:view")).toBe(true);
      expect(can(ROLES.MEMBER, "issue:create")).toBe(true);
      expect(can(ROLES.MEMBER, "issue:edit")).toBe(true);
      expect(can(ROLES.MEMBER, "issue:move")).toBe(true);
      expect(can(ROLES.MEMBER, "issue:delete:own")).toBe(true);
      expect(can(ROLES.MEMBER, "comment:view")).toBe(true);
      expect(can(ROLES.MEMBER, "comment:create")).toBe(true);
      expect(can(ROLES.MEMBER, "comment:delete:own")).toBe(true);
    });

    it("cannot delete other people's items or manage project/members", () => {
      expect(can(ROLES.MEMBER, "issue:delete:any")).toBe(false);
      expect(can(ROLES.MEMBER, "comment:delete:any")).toBe(false);
      expect(can(ROLES.MEMBER, "member:manage")).toBe(false);
      expect(can(ROLES.MEMBER, "project:settings")).toBe(false);
      expect(can(ROLES.MEMBER, "project:delete")).toBe(false);
    });
  });

  describe("ADMIN role", () => {
    it("has all member permissions plus administrative powers", () => {
      expect(can(ROLES.ADMIN, "project:view")).toBe(true);
      expect(can(ROLES.ADMIN, "issue:view")).toBe(true);
      expect(can(ROLES.ADMIN, "issue:create")).toBe(true);
      expect(can(ROLES.ADMIN, "issue:edit")).toBe(true);
      expect(can(ROLES.ADMIN, "issue:move")).toBe(true);
      expect(can(ROLES.ADMIN, "issue:delete:own")).toBe(true);
      expect(can(ROLES.ADMIN, "issue:delete:any")).toBe(true);
      expect(can(ROLES.ADMIN, "comment:view")).toBe(true);
      expect(can(ROLES.ADMIN, "comment:create")).toBe(true);
      expect(can(ROLES.ADMIN, "comment:delete:own")).toBe(true);
      expect(can(ROLES.ADMIN, "comment:delete:any")).toBe(true);
      expect(can(ROLES.ADMIN, "member:manage")).toBe(true);
      expect(can(ROLES.ADMIN, "project:settings")).toBe(true);
    });
  });

  describe("Unknown / null roles", () => {
    it("returns false for any permission", () => {
      expect(can(null, "project:view")).toBe(false);
      expect(can(undefined, "issue:view")).toBe(false);
      expect(can("GUEST", "issue:view")).toBe(false);
    });
  });
});

describe("validateMemberMutation() - Admin and Lead Locks", () => {
  const leadId = "lead-user-1";
  const adminId1 = "lead-user-1";
  const adminId2 = "admin-user-2";
  const memberId = "member-user-3";

  it("prevents removing the project lead", () => {
    const res = validateMemberMutation({
      projectLeadId: leadId,
      members: [
        { userId: leadId, role: "ADMIN" },
        { userId: adminId2, role: "ADMIN" },
      ],
      targetUserId: leadId,
      isDelete: true,
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Pemilik project (lead) tidak dapat dikeluarkan");
  });

  it("prevents demoting the project lead", () => {
    const res = validateMemberMutation({
      projectLeadId: leadId,
      members: [
        { userId: leadId, role: "ADMIN" },
        { userId: adminId2, role: "ADMIN" },
      ],
      targetUserId: leadId,
      newRole: "MEMBER",
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("harus tetap memiliki peran ADMIN");
  });

  it("prevents removing the last remaining Admin", () => {
    const res = validateMemberMutation({
      projectLeadId: leadId,
      members: [
        { userId: adminId2, role: "ADMIN" },
        { userId: memberId, role: "MEMBER" },
      ],
      targetUserId: adminId2,
      isDelete: true,
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Admin terakhir tidak dapat dikeluarkan");
  });

  it("prevents demoting the last remaining Admin", () => {
    const res = validateMemberMutation({
      projectLeadId: leadId,
      members: [
        { userId: adminId2, role: "ADMIN" },
        { userId: memberId, role: "MEMBER" },
      ],
      targetUserId: adminId2,
      newRole: "VIEWER",
    });
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Admin terakhir tidak dapat diturunkan");
  });

  it("allows removing an Admin when another Admin exists", () => {
    const res = validateMemberMutation({
      projectLeadId: leadId,
      members: [
        { userId: leadId, role: "ADMIN" },
        { userId: adminId2, role: "ADMIN" },
      ],
      targetUserId: adminId2,
      isDelete: true,
    });
    expect(res.allowed).toBe(true);
  });

  it("allows removing a regular Member", () => {
    const res = validateMemberMutation({
      projectLeadId: leadId,
      members: [
        { userId: leadId, role: "ADMIN" },
        { userId: memberId, role: "MEMBER" },
      ],
      targetUserId: memberId,
      isDelete: true,
    });
    expect(res.allowed).toBe(true);
  });
});
