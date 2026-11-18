import assert from "node:assert/strict";
import { editingPermissions, isActiveMember } from "../src/lib/team-permissions.ts";

const legacy = { user_id: "old-member" };
assert.equal(isActiveMember(legacy), true);
assert.deepEqual(editingPermissions(legacy), ["*"]);
assert.deepEqual(editingPermissions({ user_id: "staff", ativo: true, papel: "funcionario", pode_editar: ["despesas"] }), ["despesas"]);
assert.deepEqual(editingPermissions({ user_id: "blocked", ativo: false, papel: "admin", pode_editar: [] }), []);
assert.equal(isActiveMember(null), false);
console.log("Acesso da equipe: esquema anterior, permissões atuais e conta desativada OK");
