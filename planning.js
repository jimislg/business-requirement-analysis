(function () {
  "use strict";

  /* ============ 常量与存储 ============ */
  var STORAGE_KEY = "planning_state_v1";
  var STATUS_LIST = [
    { key: "todo", label: "未开始", color: "var(--p-muted)", cls: "c-muted" },
    { key: "doing", label: "进行中", color: "var(--p-yellow)", cls: "c-yellow" },
    { key: "done", label: "已完成", color: "var(--p-green)", cls: "c-green" }
  ];
  var STATUS_COLOR_HEX = {
    todo: "#b9c6cf",
    doing: "#bd7b16",
    done: "#1f8a70"
  };

  /* ============ 演示样例数据 ============ */
  function sampleMembers() {
    return [
      { id: uid(), name: "张伟", role: "产品经理" },
      { id: uid(), name: "李娜", role: "前端工程师" },
      { id: uid(), name: "王强", role: "后端工程师" },
      { id: uid(), name: "赵敏", role: "UI 设计师" },
      { id: uid(), name: "陈晨", role: "测试工程师" }
    ];
  }

  function sampleTasks(members) {
    function owner(i) {
      return members[i % members.length];
    }
    var today = new Date();
    function dateStr(offsetDays) {
      var d = new Date(today);
      d.setDate(d.getDate() + offsetDays);
      var m = "" + (d.getMonth() + 1);
      var day = "" + d.getDate();
      if (m.length < 2) m = "0" + m;
      if (day.length < 2) day = "0" + day;
      return d.getFullYear() + "-" + m + "-" + day;
    }
    return [
      {
        id: uid(),
        name: "需求调研与立项",
        ownerId: owner(0).id,
        start: dateStr(-14),
        end: dateStr(-7),
        status: "done",
        progress: 100
      },
      {
        id: uid(),
        name: "产品原型设计",
        ownerId: owner(3).id,
        start: dateStr(-9),
        end: dateStr(-2),
        status: "done",
        progress: 100
      },
      {
        id: uid(),
        name: "UI 视觉规范",
        ownerId: owner(3).id,
        start: dateStr(-3),
        end: dateStr(2),
        status: "doing",
        progress: 70
      },
      {
        id: uid(),
        name: "前端页面开发",
        ownerId: owner(1).id,
        start: dateStr(0),
        end: dateStr(10),
        status: "doing",
        progress: 35
      },
      {
        id: uid(),
        name: "后端接口开发",
        ownerId: owner(2).id,
        start: dateStr(0),
        end: dateStr(12),
        status: "doing",
        progress: 40
      },
      {
        id: uid(),
        name: "联调与集成测试",
        ownerId: owner(4).id,
        start: dateStr(10),
        end: dateStr(16),
        status: "todo",
        progress: 0
      },
      {
        id: uid(),
        name: "用户验收测试",
        ownerId: owner(4).id,
        start: dateStr(16),
        end: dateStr(20),
        status: "todo",
        progress: 0
      },
      {
        id: uid(),
        name: "上线部署与演示",
        ownerId: owner(0).id,
        start: dateStr(20),
        end: dateStr(22),
        status: "todo",
        progress: 0
      }
    ];
  }

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

  function statusLabel(key) {
    var found = STATUS_LIST.filter(function (s) { return s.key === key; })[0];
    return found ? found.label : key;
  }

  /* ============ 状态 ============ */
  var state = { members: [], tasks: [] };

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.members) && Array.isArray(parsed.tasks)) {
          state.members = parsed.members;
          state.tasks = parsed.tasks;
          return;
        }
      }
    } catch (e) {
      // ignore corrupt data
    }
    // 首次打开：预置演示数据
    state.members = sampleMembers();
    state.tasks = sampleTasks(state.members);
    saveState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // localStorage 可能不可用，忽略
    }
  }

  function memberById(id) {
    return state.members.filter(function (m) { return m.id === id; })[0] || null;
  }

  /* ============ 渲染：概览 ============ */
  function renderSummary() {
    var total = state.tasks.length;
    var done = state.tasks.filter(function (t) { return t.status === "done"; }).length;
    var doing = state.tasks.filter(function (t) { return t.status === "doing"; }).length;
    var todo = state.tasks.filter(function (t) { return t.status === "todo"; }).length;
    var progress = total ? Math.round(state.tasks.reduce(function (a, t) { return a + (Number(t.progress) || 0); }, 0) / total) : 0;

    $("#summaryTotal").textContent = total;
    $("#summaryDone").textContent = done;
    $("#summaryDoing").textContent = doing;
    $("#summaryTodo").textContent = todo;
    $("#summaryMembers").textContent = state.members.length;
    $("#summaryProgress").textContent = progress + "%";
  }

  /* ============ 渲染：任务表 ============ */
  function renderTasks() {
    var tbody = $("#taskTbody");
    tbody.innerHTML = "";
    var keyword = ($("#taskSearch").value || "").trim().toLowerCase();
    var filtered = state.tasks.filter(function (t) {
      if (!keyword) return true;
      var owner = memberById(t.ownerId);
      var ownerName = owner ? owner.name.toLowerCase() : "";
      return (t.name || "").toLowerCase().indexOf(keyword) >= 0 || ownerName.indexOf(keyword) >= 0;
    });

    $("#taskEmpty").style.display = filtered.length ? "none" : "block";

    filtered.forEach(function (t) {
      var owner = memberById(t.ownerId);
      var ownerName = owner ? owner.name : "—";
      var progress = Math.max(0, Math.min(100, Number(t.progress) || 0));
      var row = el("tr", {}, [
        el("td", {}, t.name),
        el("td", {}, ownerName),
        el("td", { className: "muted-cell" }, t.start || "—"),
        el("td", { className: "muted-cell" }, t.end || "—"),
        el("td", {}, [el("span", { className: "badge " + t.status }, statusLabel(t.status))]),
        el("td", {}, [
          (function () {
            var cell = el("div", { className: "progress-cell" }, [
              el("span", { className: "progress-track" }, [el("span", { className: "progress-fill", style: "width:" + progress + "%" })]),
              el("span", { className: "progress-num" }, progress + "%")
            ]);
            return cell;
          })()
        ]),
        el("td", { className: "col-actions" }, [
          (function () {
            var wrap = el("div", { className: "row-actions" }, [
              el("button", { type: "button", className: "icon-btn edit", onclick: function () { openTaskModal(t.id); } }, "编辑"),
              el("button", { type: "button", className: "icon-btn del", onclick: function () { deleteTask(t.id); } }, "删除")
            ]);
            return wrap;
          })()
        ])
      ]);
      tbody.appendChild(row);
    });
  }

  /* ============ 渲染：成员表 ============ */
  function renderMembers() {
    var tbody = $("#memberTbody");
    tbody.innerHTML = "";
    $("#memberEmpty").style.display = state.members.length ? "none" : "block";

    state.members.forEach(function (m) {
      var assigned = state.tasks.filter(function (t) { return t.ownerId === m.id; }).length;
      var done = state.tasks.filter(function (t) { return t.ownerId === m.id && t.status === "done"; }).length;
      var row = el("tr", {}, [
        el("td", {}, m.name),
        el("td", {}, m.role + " · 负责 " + assigned + " / 完成 " + done),
        el("td", { className: "col-actions" }, [
          el("div", { className: "row-actions" }, [
            el("button", { type: "button", className: "icon-btn edit", onclick: function () { openMemberModal(m.id); } }, "编辑"),
            el("button", { type: "button", className: "icon-btn del", onclick: function () { deleteMember(m.id); } }, "删除")
          ])
        ])
      ]);
      tbody.appendChild(row);
    });
  }

  /* ============ 渲染：统计图表 ============ */
  function renderStatusChart() {
    var chart = $("#statusChart");
    var legend = $("#statusLegend");
    chart.innerHTML = "";
    legend.innerHTML = "";

    var counts = STATUS_LIST.map(function (s) {
      return { key: s.key, label: s.label, count: state.tasks.filter(function (t) { return t.status === s.key; }).length };
    });
    var max = Math.max.apply(null, counts.map(function (c) { return c.count; }).concat(1));

    counts.forEach(function (c) {
      var heightPct = Math.round((c.count / max) * 100);
      chart.appendChild(el("div", { className: "bar" }, [
        el("span", { className: "bar-val" }, String(c.count)),
        el("i", { style: "height:" + Math.max(heightPct, 4) + "%;background:" + STATUS_COLOR_HEX[c.key] }),
        el("span", { className: "bar-label" }, c.label)
      ]));
    });

    STATUS_LIST.forEach(function (s) {
      var c = counts.filter(function (x) { return x.key === s.key; })[0];
      legend.appendChild(el("span", { className: s.cls }, s.label + " " + c.count));
    });
  }

  function renderMemberChart() {
    var chart = $("#memberChart");
    var legend = $("#memberLegend");
    chart.innerHTML = "";
    legend.innerHTML = "";

    var data = state.members.map(function (m) {
      return {
        name: m.name,
        done: state.tasks.filter(function (t) { return t.ownerId === m.id && t.status === "done"; }).length,
        total: state.tasks.filter(function (t) { return t.ownerId === m.id; }).length
      };
    });

    if (!data.length) {
      legend.appendChild(el("span", { className: "c-muted" }, "暂无成员"));
      return;
    }

    // 柱高基准=已完成任务数(d.done)，与「完成统计」语义一致；数值仍显示「已完成/总数」
    var max = Math.max.apply(null, data.map(function (d) { return d.done; }).concat(1));
      data.forEach(function (d) {
      var heightPct = Math.round((d.done / max) * 100);
        chart.appendChild(el("div", { className: "bar" }, [
        el("span", { className: "bar-val" }, d.done + "/" + d.total),
        el("i", { style: "height:" + Math.max(heightPct, 4) + "%;background:var(--p-blue)" }),
      el("span", { className: "bar-label" }, d.name)
    ]));
});

    legend.appendChild(el("span", {}, "柱高=已完成任务数，数值=已完成/总数"));
  }

  /* ============ 渲染：整体完成率 ============ */
    function renderOverallProgress() {
    var block = $("#overallProgressBlock");
    if (!block) return;
    block.innerHTML = "";

  var total = state.tasks.length;
    var done = state.tasks.filter(function (t) { return t.status === "done"; }).length;
    var pct = total ? Math.round((done / total) * 100) : 0;

    block.appendChild(el("div", { className: "overall-progress" }, [
      el("div", { className: "overall-progress-head" }, [
        el("span", { className: "overall-progress-label" }, "总体完成率"),
        el("span", { className: "overall-progress-pct" }, done + "/" + total + " · " + pct + "%")
      ]),
      el("div", { className: "overall-progress-track", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100" }, [
        el("span", { className: "overall-progress-fill", style: "width:" + pct + "%" })
      ])
    ]));
  }

  function renderAll() {
    renderSummary();
    renderTasks();
    renderMembers();
    renderStatusChart();
    renderMemberChart();
    renderOverallProgress();
  }

  /* ============ 任务弹窗 ============ */
  function fillOwnerSelect() {
    var sel = $("#taskOwner");
    sel.innerHTML = "";
    if (!state.members.length) {
      sel.appendChild(el("option", { value: "" }, "（请先添加成员）"));
      return;
    }
    state.members.forEach(function (m) {
      sel.appendChild(el("option", { value: m.id }, m.name + " · " + m.role));
    });
  }

  function openTaskModal(id) {
    fillOwnerSelect();
    var modal = $("#taskModal");
    if (id) {
      var t = state.tasks.filter(function (x) { return x.id === id; })[0];
      if (!t) return;
      $("#taskModalTitle").textContent = "编辑任务";
      $("#taskId").value = t.id;
      $("#taskName").value = t.name || "";
      $("#taskOwner").value = t.ownerId || "";
      $("#taskStatus").value = t.status || "todo";
      $("#taskStart").value = t.start || "";
      $("#taskEnd").value = t.end || "";
      $("#taskProgress").value = Number(t.progress) || 0;
      $("#progressValue").textContent = Number(t.progress) || 0;
    } else {
      $("#taskModalTitle").textContent = "新增任务";
      $("#taskForm").reset();
      $("#taskId").value = "";
      $("#progressValue").textContent = "0";
    }
    openModal(modal);
  }

  function submitTask(e) {
    e.preventDefault();
    var id = $("#taskId").value;
    var data = {
      name: $("#taskName").value.trim(),
      ownerId: $("#taskOwner").value,
      status: $("#taskStatus").value,
      start: $("#taskStart").value,
      end: $("#taskEnd").value,
      progress: Number($("#taskProgress").value) || 0
    };
    if (!data.name) return;
    if (!data.ownerId) {
      alert("请先在「人员团队」中添加成员，再为任务指派负责人。");
      return;
    }
    // 状态与进度联动：已完成 → 100%；未开始 → 0
    if (data.status === "done") data.progress = 100;
    if (data.status === "todo") data.progress = 0;

    if (id) {
      var idx = state.tasks.map(function (t) { return t.id; }).indexOf(id);
      if (idx >= 0) {
        data.id = id;
        state.tasks[idx] = data;
      }
    } else {
      data.id = uid();
      state.tasks.push(data);
    }
    saveState();
    renderAll();
    closeModal($("#taskModal"));
  }

  function deleteTask(id) {
    var t = state.tasks.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    if (!confirm("确定删除任务「" + t.name + "」吗？")) return;
    state.tasks = state.tasks.filter(function (x) { return x.id !== id; });
    saveState();
    renderAll();
  }

  /* ============ 成员弹窗 ============ */
  function openMemberModal(id) {
    var modal = $("#memberModal");
    if (id) {
      var m = state.members.filter(function (x) { return x.id === id; })[0];
      if (!m) return;
      $("#memberModalTitle").textContent = "编辑成员";
      $("#memberId").value = m.id;
      $("#memberName").value = m.name;
      $("#memberRole").value = m.role;
    } else {
      $("#memberModalTitle").textContent = "新增成员";
      $("#memberForm").reset();
      $("#memberId").value = "";
    }
    openModal(modal);
  }

  function submitMember(e) {
    e.preventDefault();
    var id = $("#memberId").value;
    var data = {
      name: $("#memberName").value.trim(),
      role: $("#memberRole").value.trim()
    };
    if (!data.name || !data.role) return;

    if (id) {
      var idx = state.members.map(function (m) { return m.id; }).indexOf(id);
      if (idx >= 0) {
        data.id = id;
        state.members[idx] = data;
      }
    } else {
      data.id = uid();
      state.members.push(data);
    }
    saveState();
    renderAll();
    closeModal($("#memberModal"));
  }

  function deleteMember(id) {
    var m = state.members.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    var assigned = state.tasks.filter(function (t) { return t.ownerId === id; }).length;
    var msg = "确定删除成员「" + m.name + "」吗？";
    if (assigned) msg += "\n该成员负责的 " + assigned + " 个任务的负责人将被清空。";
    if (!confirm(msg)) return;
    state.members = state.members.filter(function (x) { return x.id !== id; });
    // 清空相关任务的负责人引用
    state.tasks.forEach(function (t) {
      if (t.ownerId === id) t.ownerId = "";
    });
    saveState();
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

  /* ============ 导出 / 重置 / 清空 ============ */
  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "planning-data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function resetSample() {
    if (!confirm("将覆盖当前数据为演示样例，确定继续吗？")) return;
    state.members = sampleMembers();
    state.tasks = sampleTasks(state.members);
    saveState();
    renderAll();
  }

  function clearAll() {
    if (!confirm("将清空全部任务与成员数据，确定继续吗？")) return;
    state.members = [];
    state.tasks = [];
    saveState();
    renderAll();
  }

  /* ============ 事件绑定 ============ */
  function bind() {
    $("#addTaskBtn").addEventListener("click", function () { openTaskModal(null); });
    $("#addMemberBtn").addEventListener("click", function () { openMemberModal(null); });

    $("#taskForm").addEventListener("submit", submitTask);
    $("#memberForm").addEventListener("submit", submitMember);

    $("#taskProgress").addEventListener("input", function () {
      $("#progressValue").textContent = this.value;
    });

    $("#taskStatus").addEventListener("change", function () {
      if (this.value === "done") {
        $("#taskProgress").value = 100;
        $("#progressValue").textContent = "100";
      } else if (this.value === "todo") {
        $("#taskProgress").value = 0;
        $("#progressValue").textContent = "0";
      }
    });

    $("#taskSearch").addEventListener("input", renderTasks);

    $("#exportBtn").addEventListener("click", exportData);
    $("#resetBtn").addEventListener("click", resetSample);
    $("#clearBtn").addEventListener("click", clearAll);

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
