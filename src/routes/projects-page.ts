/** Projects view — board repository CRUD, rendered in the shared shell. */

import { renderShellPage } from "./shell.js";

const PROJECTS_BODY = `        <div class="view">
          <p class="view-intro">
            Repositories the Kanban board and harness can execute against. Deleting a project is blocked
            while cards still reference it.
          </p>
          <ul class="list" id="projects-list"></ul>
        </div>`;

const PROJECTS_OVERLAYS = `  <div id="project-modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
    <div class="modal-panel">
      <h2 id="project-modal-title">New project</h2>
      <div class="field">
        <label for="project-name">name</label>
        <input id="project-name" type="text" autocomplete="off" maxlength="128" />
      </div>
      <div class="field">
        <label for="project-remote-url">remote_url</label>
        <input id="project-remote-url" type="text" autocomplete="off" placeholder="https://… or git@…" />
      </div>
      <div class="field">
        <label for="project-secret-ref">secret_ref</label>
        <input id="project-secret-ref" type="text" autocomplete="off" placeholder="Env var name for clone credential" />
      </div>
      <p id="project-modal-error" class="modal-error" role="alert"></p>
      <div class="modal-actions">
        <button type="button" class="secondary" id="btn-project-cancel">Cancel</button>
        <button type="button" id="btn-project-save">Save</button>
      </div>
    </div>
  </div>

  <div id="project-delete-modal" class="modal hidden" role="dialog" aria-modal="true" aria-labelledby="project-delete-title">
    <div class="modal-panel">
      <h2 id="project-delete-title">Delete project</h2>
      <p id="project-delete-message" class="sub">Delete this project? This cannot be undone.</p>
      <p id="project-delete-error" class="modal-error" role="alert"></p>
      <div class="modal-actions">
        <button type="button" class="secondary" id="btn-project-delete-cancel">Cancel</button>
        <button type="button" class="danger" id="btn-project-delete-confirm">Delete</button>
      </div>
    </div>
  </div>`;

export const PROJECTS_CLIENT_JS = `(function () {
  var auth = window.cursorServerAuth;

  var el = {
    list: document.getElementById("projects-list"),
    btnNew: document.getElementById("btn-project-new"),
    modal: document.getElementById("project-modal"),
    modalTitle: document.getElementById("project-modal-title"),
    name: document.getElementById("project-name"),
    remoteUrl: document.getElementById("project-remote-url"),
    secretRef: document.getElementById("project-secret-ref"),
    modalError: document.getElementById("project-modal-error"),
    btnCancel: document.getElementById("btn-project-cancel"),
    btnSave: document.getElementById("btn-project-save"),
    deleteModal: document.getElementById("project-delete-modal"),
    deleteMessage: document.getElementById("project-delete-message"),
    deleteError: document.getElementById("project-delete-error"),
    btnDeleteCancel: document.getElementById("btn-project-delete-cancel"),
    btnDeleteConfirm: document.getElementById("btn-project-delete-confirm"),
  };

  var projectsById = {};
  var editProjectId = null;
  var deleteProjectId = null;

  function placeholder(text) {
    el.list.innerHTML = "";
    var li = document.createElement("li");
    li.className = "empty";
    li.textContent = text;
    el.list.appendChild(li);
  }

  function actionButton(label, className, id) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = className;
    btn.textContent = label;
    btn.dataset.id = String(id);
    return btn;
  }

  function renderRow(repo) {
    var li = document.createElement("li");

    var main = document.createElement("div");
    main.className = "row-main";
    main.textContent = repo.name;
    if (repo.remote_url) {
      var remote = document.createElement("span");
      remote.className = "row-sub";
      remote.textContent = repo.remote_url;
      main.appendChild(remote);
    }

    var actions = document.createElement("div");
    actions.className = "row-actions";
    actions.appendChild(actionButton("Edit", "secondary btn-project-edit", repo.id));
    actions.appendChild(actionButton("Delete", "secondary btn-project-delete", repo.id));

    li.appendChild(main);
    li.appendChild(actions);
    return li;
  }

  async function loadProjects() {
    placeholder("Loading…");
    try {
      var res = await fetch("/board/repos", { headers: auth.headers() });
      if (res.status !== 200) {
        placeholder("Unable to load projects.");
        return;
      }
      var body = await res.json();
      var repos = body.repos || [];
      projectsById = {};
      repos.forEach(function (r) { projectsById[r.id] = r; });
      if (!repos.length) {
        placeholder("No projects yet.");
        return;
      }
      el.list.innerHTML = "";
      repos.forEach(function (r) { el.list.appendChild(renderRow(r)); });
    } catch (_) {
      placeholder("Unable to load projects.");
    }
  }

  function openProjectModal(repo) {
    el.modalError.textContent = "";
    editProjectId = repo ? repo.id : null;
    el.modalTitle.textContent = repo ? "Edit project" : "New project";
    el.name.value = repo ? repo.name || "" : "";
    el.remoteUrl.value = repo ? repo.remote_url || "" : "";
    el.secretRef.value = repo ? repo.secret_ref || "" : "";
    el.modal.classList.remove("hidden");
    el.name.focus();
  }

  function closeProjectModal() {
    el.modal.classList.add("hidden");
    el.modalError.textContent = "";
    editProjectId = null;
  }

  function openDeleteModal(repo) {
    deleteProjectId = repo.id;
    el.deleteError.textContent = "";
    el.deleteMessage.textContent = 'Delete project "' + (repo.name || "") + '"? This cannot be undone.';
    el.deleteModal.classList.remove("hidden");
  }

  function closeDeleteModal() {
    el.deleteModal.classList.add("hidden");
    el.deleteError.textContent = "";
    deleteProjectId = null;
  }

  async function saveProject() {
    var name = el.name.value.trim();
    var remote_url = el.remoteUrl.value.trim();
    var secret_ref = el.secretRef.value.trim();
    el.modalError.textContent = "";
    if (!name || !remote_url || !secret_ref) {
      el.modalError.textContent = "name, remote_url, and secret_ref are required";
      return;
    }
    el.btnSave.disabled = true;
    try {
      var isEdit = editProjectId != null;
      var res = await fetch(isEdit ? "/board/repos/" + editProjectId : "/board/repos", {
        method: isEdit ? "PUT" : "POST",
        headers: auth.jsonHeaders(),
        body: JSON.stringify({ name: name, remote_url: remote_url, secret_ref: secret_ref }),
      });
      var body = await res.json().catch(function () { return {}; });
      if (res.status !== 200 && res.status !== 201) {
        el.modalError.textContent = body.error || "Save failed (" + res.status + ")";
        return;
      }
      closeProjectModal();
      await loadProjects();
    } catch (_) {
      el.modalError.textContent = "Save failed";
    } finally {
      el.btnSave.disabled = false;
    }
  }

  async function confirmDelete() {
    if (deleteProjectId == null) return;
    el.deleteError.textContent = "";
    el.btnDeleteConfirm.disabled = true;
    try {
      var res = await fetch("/board/repos/" + deleteProjectId, {
        method: "DELETE",
        headers: auth.headers(),
      });
      var body = await res.json().catch(function () { return {}; });
      if (res.status !== 200) {
        el.deleteError.textContent = body.error || "Delete failed (" + res.status + ")";
        return;
      }
      closeDeleteModal();
      await loadProjects();
    } catch (_) {
      el.deleteError.textContent = "Delete failed";
    } finally {
      el.btnDeleteConfirm.disabled = false;
    }
  }

  el.btnNew.addEventListener("click", function () { openProjectModal(null); });
  el.btnCancel.addEventListener("click", closeProjectModal);
  el.btnSave.addEventListener("click", saveProject);
  el.btnDeleteCancel.addEventListener("click", closeDeleteModal);
  el.btnDeleteConfirm.addEventListener("click", confirmDelete);

  el.list.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-id]");
    if (!btn) return;
    var repo = projectsById[Number(btn.dataset.id)];
    if (!repo) return;
    if (btn.classList.contains("btn-project-edit")) openProjectModal(repo);
    else if (btn.classList.contains("btn-project-delete")) openDeleteModal(repo);
  });

  auth.ready(loadProjects);
})();
`;

export function renderProjectsPageHtml(): string {
  return renderShellPage({
    viewId: "projects",
    title: "Projects",
    actions: '<button type="button" id="btn-project-new">New project</button>',
    body: PROJECTS_BODY,
    overlays: PROJECTS_OVERLAYS,
    scripts: ["/ui/projects-client.js"],
  });
}
