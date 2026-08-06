(function () {
  "use strict";

  /* ============ 常量与存储 ============ */
  var STORAGE_KEY = "system_settings_v1";
  var ROLE_LIST = [
    { key: "admin", label: "管理员", cls: "badge-red" },
    { key: "member", label: "普通成员", cls: "badge-blue" }
  ];
  var STATUS_LIST = [
    { key: "active", label: "启用", cls: "badge-green" },
    { key: "disabled", label: "禁用", cls: "badge-muted" }
  ];

  /* ============ 工具函数 ============ */
  function uid() {
    return "id-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "className") {
          node.className = attrs[k];
        } else if (k === "dataset") {
          Object.keys(attrs.dataset).forEach(function (d) {
            node.dataset[d] = attrs.dataset[d];
          });
        } else if (k.indexOf("on") === 0) {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (k === "html") {
          node.innerHTML = attrs[k];
        } else {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function roleLabel(key) {
    var found = ROLE_LIST.filter(function (r) { return r.key === key; })[0];
    return found ? found.label : key;
  }

  function roleCls(key) {
    var found = ROLE_LIST.filter(function (r) { return r.key === key; })[0];
    return found ? found.cls : "badge-blue";
  }

  function statusLabel(key) {
    var found = STATUS_LIST.filter(function (s) { return s.key === key; })[0];
    return found ? found.label : key;
  }

  function statusCls(key) {
    var found = STATUS_LIST.filter(function (s) { return s.key === key; })[0];
    return found ? found.cls : "badge-muted";
  }

  // 简易邮箱格式校验
  function isEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  }

  // 时间格式化：YYYY-MM-DD HH:mm
  function formatTime(ts) {
    var d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    var Y = d.getFullYear();
    var M = "" + (d.getMonth() + 1);
    var D = "" + d.getDate();
    var h = "" + d.getHours();
    var m = "" + d.getMinutes();
    if (M.length < 2) M = "0" + M;
    if (D.length < 2) D = "0" + D;
    if (h.length < 2) h = "0" + h;
    if (m.length < 2) m = "0" + m;
    return Y + "-" + M + "-" + D + " " + h + ":" + m;
  }

  /* ============ 状态 ============ */
  var state = {
    users: [],
    teams: [],
    auditLogs: []
  };

  /* ============ 演示样例数据 ============ */
  function sampleTeams() {
    return [
      { id: uid(), name: "研发一组", description: "负责前端与后端开发", createdAt: Date.now() - 86400000 * 30 },
      { id: uid(), name: "产品组", description: "负责需求分析与产品规划", createdAt: Date.now() - 86400000 * 25 },
      { id: uid(), name: "测试组", description: "负责质量保证与测试", createdAt: Date.now() - 86400000 * 20 }
    ];
  }

  function sampleUsers(teams) {
    function team(i) {
      return teams[i % teams.length];
    }
    return [
      { id: uid(), username: "张伟", email: "zhangwei@example.com", role: "admin", teamId: team(0).id, status: "active", createdAt: Date.now() - 86400000 * 28 },
      { id: uid(), username: "李娜", email: "lina@example.com", role: "member", teamId: team(0).id, status: "active", createdAt: Date.now() - 86400000 * 27 },
      { id: uid(), username: "王强", email: "wangqiang@example.com", role: "member", teamId: team(0).id, status: "active", createdAt: Date.now() - 86400000 * 26 },
      { id: uid(), username: "赵敏", email: "zhaomin@example.com", role: "member", teamId: team(1).id, status: "active", createdAt: Date.now() - 86400000 * 24 },
      { id: uid(), username: "陈晨", email: "chenchen@example.com", role: "member", teamId: team(2).id, status: "disabled", createdAt: Date.now() - 86400000 * 18 }
    ];
  }

  function sampleLogs() {
    return [
      { id: uid(), timestamp: Date.now() - 86400000 * 28, operator: "系统管理员", action: "创建团队", target: "研发一组", detail: "初始化团队，描述：负责前端与后端开发" },
      { id: uid(), timestamp: Date.now() - 86400000 * 28, operator: "系统管理员", action: "创建用户", target: "张伟", detail: "新建用户，角色：管理员，邮箱：zhangwei@example.com" },
      { id: uid(), timestamp: Date.now() - 86400000 * 18, operator: "系统管理员", action: "编辑用户", target: "陈晨", detail: "状态由 启用 变更为 禁用" },
      { id: uid(), timestamp: Date.now() - 86400000 * 2, operator: "系统管理员", action: "创建用户", target: "陈晨", detail: "新建用户，角色：普通成员，邮箱：chenchen@example.com" }
    ];
  }

  /* ============ 持久化 ============ */
  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.teams) && Array.isArray(parsed.auditLogs)) {
          state.users = parsed.users;
          state.teams = parsed.teams;
          state.auditLogs = parsed.auditLogs;
          return;
        }
      }
    } catch (e) {
      // ignore corrupt data
    }
    // 首次打开：预置演示数据
    state.teams = sampleTeams();
    state.users = sampleUsers(state.teams);
    state.auditLogs = sampleLogs();
    saveState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // localStorage 可能不可用，忽略
    }
  }

  /* ============ 查询辅助 ============ */
  function teamById(id) {
    return state.teams.filter(function (t) { return t.id === id; })[0] || null;
  }

  function teamName(id) {
    var t = teamById(id);
    return t ? t.name : "—";
  }

  function teamMemberCount(teamId) {
    return state.users.filter(function (u) { return u.teamId === teamId; }).length;
  }

  /* ============ 数据服务层：审计日志 ============ */
  var AuditLogAPI = {
    list: function () {
      // 按时间倒序
      return state.auditLogs.slice().sort(function (a, b) {
        return b.timestamp - a.timestamp;
      });
    },
    add: function (log) {
      state.auditLogs.push({
        id: uid(),
        timestamp: Date.now(),
        operator: log.operator || "系统管理员",
        action: log.action,
        target: log.target,
        detail: log.detail
      });
      saveState();
    },
    clear: function () {
      state.auditLogs = [];
      saveState();
    }
  };

  /* ============ 数据服务层：用户 CRUD（带审计日志中间件） ============ */
  var UserAPI = {
    list: function () {
      return state.users.slice();
    },
    create: function (data) {
      var user = {
        id: uid(),
        username: data.username,
        email: data.email,
        role: data.role,
        teamId: data.teamId || "",
        status: data.status,
        createdAt: Date.now()
      };
      state.users.push(user);
      saveState();
      // 审计日志中间件
      AuditLogAPI.add({
        operator: "系统管理员",
        action: "创建用户",
        target: user.username,
        detail: "新建用户，角色：" + roleLabel(user.role) + "，邮箱：" + user.email
      });
      return user;
    },
    update: function (id, data) {
      var idx = state.users.map(function (u) { return u.id; }).indexOf(id);
      if (idx < 0) return null;
      var old = state.users[idx];
      var changes = [];
      if (old.username !== data.username) changes.push("用户名由 " + old.username + " 变更为 " + data.username);
      if (old.email !== data.email) changes.push("邮箱由 " + old.email + " 变更为 " + data.email);
      if (old.role !== data.role) changes.push("角色由 " + roleLabel(old.role) + " 变更为 " + roleLabel(data.role));
      if (old.teamId !== data.teamId) changes.push("团队由 " + teamName(old.teamId) + " 变更为 " + teamName(data.teamId));
      if (old.status !== data.status) changes.push("状态由 " + statusLabel(old.status) + " 变更为 " + statusLabel(data.status));

      var updated = {
        id: id,
        username: data.username,
        email: data.email,
        role: data.role,
        teamId: data.teamId || "",
        status: data.status,
        createdAt: old.createdAt
      };
      state.users[idx] = updated;
      saveState();
      // 审计日志中间件
      AuditLogAPI.add({
        operator: "系统管理员",
        action: "编辑用户",
        target: updated.username,
        detail: changes.length ? changes.join("；") : "无字段变更"
      });
      return updated;
    },
    remove: function (id) {
      var user = state.users.filter(function (u) { return u.id === id; })[0];
      if (!user) return false;
      state.users = state.users.filter(function (u) { return u.id !== id; });
      saveState();
      // 审计日志中间件
      AuditLogAPI.add({
        operator: "系统管理员",
        action: "删除用户",
        target: user.username,
        detail: "删除用户，邮箱：" + user.email
      });
      return true;
    }
  };

  /* ============ 数据服务层：团队 CRUD（带审计日志中间件） ============ */
  var TeamAPI = {
    list: function () {
      return state.teams.slice();
    },
    create: function (data) {
      var team = {
        id: uid(),
        name: data.name,
        description: data.description || "",
        createdAt: Date.now()
      };
      state.teams.push(team);
      saveState();
      // 审计日志中间件
      AuditLogAPI.add({
        operator: "系统管理员",
        action: "创建团队",
        target: team.name,
        detail: "新建团队，描述：" + (team.description || "无")
      });
      return team;
    },
    update: function (id, data) {
      var idx = state.teams.map(function (t) { return t.id; }).indexOf(id);
      if (idx < 0) return null;
      var old = state.teams[idx];
      var changes = [];
      if (old.name !== data.name) changes.push("团队名称由 " + old.name + " 变更为 " + data.name);
      if (old.description !== data.description) changes.push("描述由 " + (old.description || "无") + " 变更为 " + (data.description || "无"));

      var updated = {
        id: id,
        name: data.name,
        description: data.description || "",
        createdAt: old.createdAt
      };
      state.teams[idx] = updated;
      saveState();
      // 审计日志中间件
      AuditLogAPI.add({
        operator: "系统管理员",
        action: "编辑团队",
        target: updated.name,
        detail: changes.length ? changes.join("；") : "无字段变更"
      });
      return updated;
    },
    remove: function (id) {
      var team = state.teams.filter(function (t) { return t.id === id; })[0];
      if (!team) return false;
      var memberCount = teamMemberCount(id);
      state.teams = state.teams.filter(function (t) { return t.id !== id; });
      // 清空相关用户的团队引用
      state.users.forEach(function (u) {
        if (u.teamId === id) u.teamId = "";
      });
      saveState();
      // 审计日志中间件
      AuditLogAPI.add({
        operator: "系统管理员",
        action: "删除团队",
        target: team.name,
        detail: "删除团队，成员数：" + memberCount
      });
      return true;
    }
  };

  /* ============ 渲染：用户概览 ============ */
  function renderUserSummary() {
    var total = state.users.length;
    var active = state.users.filter(function (u) { return u.status === "active"; }).length;
    var disabled = state.users.filter(function (u) { return u.status === "disabled"; }).length;
    var admin = state.users.filter(function (u) { return u.role === "admin"; }).length;
    $("#summaryUserTotal").textContent = total;
    $("#summaryUserActive").textContent = active;
    $("#summaryUserDisabled").textContent = disabled;
    $("#summaryUserAdmin").textContent = admin;
  }

  /* ============ 渲染：团队概览 ============ */
  function renderTeamSummary() {
    var total = state.teams.length;
    var totalMembers = state.users.filter(function (u) { return u.teamId; }).length;
    var avg = total ? Math.round(totalMembers / total * 10) / 10 : 0;
    var unassigned = state.users.filter(function (u) { return !u.teamId; }).length;
    $("#summaryTeamTotal").textContent = total;
    $("#summaryTeamMembers").textContent = totalMembers;
    $("#summaryTeamAvg").textContent = avg;
    $("#summaryTeamUnassigned").textContent = unassigned;
  }

  /* ============ 渲染：用户表格 ============ */
  function renderUsers() {
    var tbody = $("#userTbody");
    tbody.innerHTML = "";
    var keyword = ($("#userSearch").value || "").trim().toLowerCase();
    var filtered = state.users.filter(function (u) {
      if (!keyword) return true;
      return (u.username || "").toLowerCase().indexOf(keyword) >= 0 || (u.email || "").toLowerCase().indexOf(keyword) >= 0;
    });

    $("#userEmpty").style.display = filtered.length ? "none" : "block";

    filtered.forEach(function (u) {
      var row = el("tr", {}, [
        el("td", {}, u.username),
        el("td", { className: "muted-cell" }, u.email),
        el("td", {}, [el("span", { className: "badge " + roleCls(u.role) }, roleLabel(u.role))]),
        el("td", {}, teamName(u.teamId)),
        el("td", {}, [el("span", { className: "badge " + statusCls(u.status) }, statusLabel(u.status))]),
        el("td", { className: "col-actions" }, [
          el("div", { className: "row-actions" }, [
            el("button", { type: "button", className: "icon-btn edit", onclick: function () { openUserModal(u.id); } }, "编辑"),
            el("button", { type: "button", className: "icon-btn del", onclick: function () { deleteUser(u.id); } }, "删除")
          ])
        ])
      ]);
      tbody.appendChild(row);
    });
  }

  /* ============ 渲染：团队表格 ============ */
  function renderTeams() {
    var tbody = $("#teamTbody");
    tbody.innerHTML = "";
    var keyword = ($("#teamSearch").value || "").trim().toLowerCase();
    var filtered = state.teams.filter(function (t) {
      if (!keyword) return true;
      return (t.name || "").toLowerCase().indexOf(keyword) >= 0;
    });

    $("#teamEmpty").style.display = filtered.length ? "none" : "block";

    filtered.forEach(function (t) {
      var count = teamMemberCount(t.id);
      var row = el("tr", {}, [
        el("td", {}, t.name),
        el("td", { className: "muted-cell" }, t.description || "—"),
        el("td", {}, [el("span", { className: "badge badge-blue" }, String(count))]),
        el("td", { className: "col-actions" }, [
          el("div", { className: "row-actions" }, [
            el("button", { type: "button", className: "icon-btn edit", onclick: function () { openTeamModal(t.id); } }, "编辑"),
            el("button", { type: "button", className: "icon-btn del", onclick: function () { deleteTeam(t.id); } }, "删除")
          ])
        ])
      ]);
      tbody.appendChild(row);
    });
  }

  /* ============ 渲染：操作日志 ============ */
  function renderLogs() {
    var tbody = $("#logTbody");
    tbody.innerHTML = "";
    var logs = AuditLogAPI.list();

    $("#logEmpty").style.display = logs.length ? "none" : "block";

    logs.forEach(function (log) {
      // 操作类型 badge 颜色：创建=green，编辑=blue，删除=red，其它=muted
      var actionCls = "badge-muted";
      if (log.action.indexOf("创建") >= 0) actionCls = "badge-green";
      else if (log.action.indexOf("编辑") >= 0) actionCls = "badge-blue";
      else if (log.action.indexOf("删除") >= 0) actionCls = "badge-red";
      var row = el("tr", {}, [
        el("td", { className: "muted-cell" }, formatTime(log.timestamp)),
        el("td", {}, log.operator),
        el("td", {}, [el("span", { className: "badge " + actionCls }, log.action)]),
        el("td", {}, log.target),
        el("td", {}, [el("div", { className: "log-detail" }, log.detail)])
      ]);
      tbody.appendChild(row);
    });
  }

  function renderAll() {
    renderUserSummary();
    renderTeamSummary();
    renderUsers();
    renderTeams();
    renderLogs();
  }

  /* ============ Tab 切换 ============ */
  function switchTab(tabKey) {
    $all(".tab-item").forEach(function (item) {
      item.classList.toggle("active", item.dataset.tab === tabKey);
    });
    $all(".tab-panel").forEach(function (panel) {
      panel.classList.toggle("hidden", panel.dataset.panel !== tabKey);
    });
  }

  /* ============ 用户弹窗 ============ */
  function fillTeamSelect(select, includeEmpty) {
    select.innerHTML = "";
    if (includeEmpty) {
      select.appendChild(el("option", { value: "" }, "未分配团队"));
    }
    state.teams.forEach(function (t) {
      select.appendChild(el("option", { value: t.id }, t.name));
    });
  }

  function openUserModal(id) {
    fillTeamSelect($("#teamId"), true);
    var modal = $("#userModal");
    $("#userFormError").textContent = "";
    if (id) {
      var u = state.users.filter(function (x) { return x.id === id; })[0];
      if (!u) return;
      $("#userModalTitle").textContent = "编辑用户";
      $("#userId").value = u.id;
      $("#username").value = u.username || "";
      $("#email").value = u.email || "";
      $("#role").value = u.role || "member";
      $("#teamId").value = u.teamId || "";
      $("#status").value = u.status || "active";
    } else {
      $("#userModalTitle").textContent = "新增用户";
      $("#userForm").reset();
      $("#userId").value = "";
    }
    openModal(modal);
  }

  function submitUser(e) {
    e.preventDefault();
    $("#userFormError").textContent = "";
    var id = $("#userId").value;
    var data = {
      username: $("#username").value.trim(),
      email: $("#email").value.trim(),
      role: $("#role").value,
      teamId: $("#teamId").value,
      status: $("#status").value
    };

    // 表单验证
    if (!data.username) {
      $("#userFormError").textContent = "请输入用户名";
      $("#username").focus();
      return;
    }
    if (!data.email) {
      $("#userFormError").textContent = "请输入邮箱";
      $("#email").focus();
      return;
    }
    if (!isEmail(data.email)) {
      $("#userFormError").textContent = "邮箱格式不正确";
      $("#email").focus();
      return;
    }
    // 邮箱唯一性校验
    var dup = state.users.filter(function (u) {
      return u.email.toLowerCase() === data.email.toLowerCase() && u.id !== id;
    })[0];
    if (dup) {
      $("#userFormError").textContent = "该邮箱已被其他用户使用";
      $("#email").focus();
      return;
    }

    if (id) {
      UserAPI.update(id, data);
    } else {
      UserAPI.create(data);
    }
    renderAll();
    closeModal($("#userModal"));
  }

  function deleteUser(id) {
    var u = state.users.filter(function (x) { return x.id === id; })[0];
    if (!u) return;
    if (!confirm("确定删除用户「" + u.username + "」吗？")) return;
    UserAPI.remove(id);
    renderAll();
  }

  /* ============ 团队弹窗 ============ */
  function openTeamModal(id) {
    var modal = $("#teamModal");
    $("#teamFormError").textContent = "";
    if (id) {
      var t = state.teams.filter(function (x) { return x.id === id; })[0];
      if (!t) return;
      $("#teamModalTitle").textContent = "编辑团队";
      $("#teamEditId").value = t.id;
      $("#teamName").value = t.name || "";
      $("#teamDesc").value = t.description || "";
    } else {
      $("#teamModalTitle").textContent = "新增团队";
      $("#teamForm").reset();
      $("#teamEditId").value = "";
    }
    openModal(modal);
  }

  function submitTeam(e) {
    e.preventDefault();
    $("#teamFormError").textContent = "";
    var id = $("#teamEditId").value;
    var data = {
      name: $("#teamName").value.trim(),
      description: $("#teamDesc").value.trim()
    };

    // 表单验证
    if (!data.name) {
      $("#teamFormError").textContent = "请输入团队名称";
      $("#teamName").focus();
      return;
    }
    // 团队名称唯一性校验
    var dup = state.teams.filter(function (t) {
      return t.name === data.name && t.id !== id;
    })[0];
    if (dup) {
      $("#teamFormError").textContent = "该团队名称已存在";
      $("#teamName").focus();
      return;
    }

    if (id) {
      TeamAPI.update(id, data);
    } else {
      TeamAPI.create(data);
    }
    renderAll();
    closeModal($("#teamModal"));
  }

  function deleteTeam(id) {
    var t = state.teams.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    var count = teamMemberCount(id);
    var msg = "确定删除团队「" + t.name + "」吗？";
    if (count) msg += "\n该团队下 " + count + " 名成员将被设为未分配团队。";
    if (!confirm(msg)) return;
    TeamAPI.remove(id);
    renderAll();
  }

  /* ============ Modal 通用 ============ */
  function openModal(modal) {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    var firstInput = modal.querySelector("input:not([type=hidden]),select,textarea");
    if (firstInput) setTimeout(function () { firstInput.focus(); }, 30);
  }

  function closeModal(modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  }

  /* ============ 重置演示数据 ============ */
  function resetSample() {
    if (!confirm("将覆盖当前数据为演示样例，确定继续吗？")) return;
    state.teams = sampleTeams();
    state.users = sampleUsers(state.teams);
    state.auditLogs = sampleLogs();
    saveState();
    renderAll();
  }

  /* ============ 清空日志 ============ */
  function clearLogs() {
    if (!state.auditLogs.length) {
      alert("当前没有操作日志。");
      return;
    }
    if (!confirm("确定清空全部操作日志吗？此操作不可恢复。")) return;
    AuditLogAPI.clear();
    renderLogs();
  }

  /* ============ 事件绑定 ============ */
  function bind() {
    // Tab 切换
    $all(".tab-item").forEach(function (item) {
      item.addEventListener("click", function () {
        switchTab(item.dataset.tab);
      });
    });

    // 用户管理
    $("#addUserBtn").addEventListener("click", function () { openUserModal(null); });
    $("#userForm").addEventListener("submit", submitUser);
    $("#userSearch").addEventListener("input", renderUsers);

    // 团队管理
    $("#addTeamBtn").addEventListener("click", function () { openTeamModal(null); });
    $("#teamForm").addEventListener("submit", submitTeam);
    $("#teamSearch").addEventListener("input", renderTeams);

    // 操作日志
    $("#clearLogBtn").addEventListener("click", clearLogs);

    // 重置演示数据
    $("#resetBtn").addEventListener("click", resetSample);

    // 关闭 modal
    $all("[data-close]").forEach(function (node) {
      node.addEventListener("click", function () {
        closeModal(node.closest(".modal"));
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        $all(".modal.open").forEach(function (m) { closeModal(m); });
      }
    });
  }

  /* ============ 启动 ============ */
  function init() {
    loadState();
    bind();
    renderAll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
