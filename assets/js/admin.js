/* =====================================================================
 * JuIntake V1 — 운영 관리 화면
 * ---------------------------------------------------------------------
 * 관리자 토큰은 이 파일에도, 저장소 어디에도 없습니다.
 * 페이지에 열 때 직접 입력받아 sessionStorage 에만 보관하며,
 * 잘못된 토큰은 백엔드가 예외로 막습니다(fail closed).
 *
 * 사용 RPC (이 둘뿐):
 *   rpc('juintake_admin_list_requests',  {p_token, p_status})
 *   rpc('juintake_admin_update_request', {p_token, p_id, p_status, p_admin_note})
 * ===================================================================== */
(function () {
  'use strict';

  var CFG = window.JUINTAKE_CONFIG;
  if (!CFG) {
    return;
  }

  var state = {
    token: '',
    filter: '',
    rows: [],
    selectedId: null
  };

  var client = null;

  function createClient() {
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
      return null;
    }
    try {
      return window.supabase.createClient(CFG.supabase.url, CFG.supabase.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
    } catch (error) {
      return null;
    }
  }

  /* ------------------------------------------------------------------
   * 유틸
   * ------------------------------------------------------------------ */
  function byId(id) {
    return document.getElementById(id);
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (text != null) {
      node.textContent = text;
    }
    return node;
  }

  function typeLabel(code) {
    for (var i = 0; i < CFG.requestTypes.length; i += 1) {
      if (CFG.requestTypes[i].code === code) {
        return CFG.requestTypes[i].icon + ' ' + CFG.requestTypes[i].label;
      }
    }
    return code || '-';
  }

  function statusLabel(code) {
    for (var i = 0; i < CFG.statuses.length; i += 1) {
      if (CFG.statuses[i].code === code) {
        return CFG.statuses[i].label + ' (' + code + ')';
      }
    }
    return code || '-';
  }

  function statusOptions(selected) {
    return CFG.statuses.map(function (status) {
      var opt = document.createElement('option');
      opt.value = status.code;
      opt.textContent = status.label + ' (' + status.code + ')';
      if (status.code === selected) {
        opt.selected = true;
      }
      return opt;
    });
  }

  function formatDate(value) {
    if (!value) {
      return '-';
    }
    var d = new Date(value);
    if (isNaN(d.getTime())) {
      return String(value);
    }
    var pad = function (n) {
      return n < 10 ? '0' + n : String(n);
    };
    return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate())
      + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function notify(message, kind) {
    var box = byId('adminAlert');
    box.textContent = message;
    box.className = 'alert' + (kind ? ' alert--' + kind : '');
    box.hidden = !message;
  }

  function isAuthFailure(message) {
    return /token|jwt|auth|unauthorized|401|403/i.test(message || '');
  }

  function token() {
    return state.token;
  }

  /* ------------------------------------------------------------------
   * 토큰 보관 (sessionStorage 전용)
   * ------------------------------------------------------------------ */
  function readStoredToken() {
    try {
      return window.sessionStorage.getItem(CFG.storageKey) || '';
    } catch (error) {
      return '';
    }
  }

  function writeStoredToken(value) {
    try {
      if (value) {
        window.sessionStorage.setItem(CFG.storageKey, value);
      } else {
        window.sessionStorage.removeItem(CFG.storageKey);
      }
    } catch (error) {
      /* 세션 저장이 막힌 환경에서는 메모리로만 유지합니다. */
    }
  }

  function logout(message) {
    state.token = '';
    state.rows = [];
    state.selectedId = null;
    writeStoredToken('');
    byId('tokenInput').value = '';
    byId('console').hidden = true;
    byId('gate').hidden = false;
    renderList();
    renderDetail();
    byId('tokenInput').focus();
    notify(message || '로그아웃했습니다. 세션 토큰을 지웠습니다.', 'info');
  }

  /* ------------------------------------------------------------------
   * 데이터
   * ------------------------------------------------------------------ */
  function showListMessage(text) {
    var box = byId('listBox');
    box.textContent = text;
    box.className = 'empty';
    box.hidden = false;
    byId('reqList').textContent = '';
  }

  function refresh() {
    if (!client) {
      showListMessage('Supabase 연결에 실패했습니다.');
      notify('Supabase 연결에 실패했습니다. 네트워크를 확인해 주세요.', 'err');
      return;
    }
    if (!token()) {
      showListMessage('관리자 토큰이 필요합니다.');
      notify('관리자 토큰을 입력해 주세요.', 'err');
      return;
    }

    showListMessage('불러오는 중…');
    byId('listBox').className = 'spinner';

    client.rpc(CFG.rpc.adminList, {
      p_token: token(),
      p_status: state.filter === '' ? null : state.filter
    }).then(function (result) {
      if (result.error) {
        showListMessage('불러오지 못했습니다.');
        notify('토큰이 올바르지 않거나 목록을 읽지 못했습니다: ' + result.error.message, 'err');
        if (isAuthFailure(result.error.message)) {
          logout('토큰이 올바르지 않습니다. 다시 입력해 주세요.');
        }
        return;
      }
      state.rows = Array.isArray(result.data) ? result.data : [];
      notify('총 ' + state.rows.length + '건을 불러왔습니다.', 'ok');
      if (!state.rows.length) {
        state.selectedId = null;
        renderList();
        renderDetail();
        return;
      }
      var keep = state.rows.some(function (row) {
        return row.id === state.selectedId;
      });
      selectRow(keep ? state.selectedId : state.rows[0].id);
    });
  }

  function renderList() {
    var list = byId('reqList');
    list.textContent = '';
    if (!state.rows.length) {
      showListMessage('조건에 맞는 접수가 없습니다.');
      return;
    }
    byId('listBox').hidden = true;
    state.rows.forEach(function (row) {
      var item = make('li');
      var button = make('button', 'req-item' + (row.id === state.selectedId ? ' is-active' : ''));
      button.type = 'button';
      var top = make('div', 'req-item__top');
      top.appendChild(make('span', 'req-item__title', row.title || '(제목 없음)'));
      top.appendChild(make('span', 'badge badge--' + row.status, row.status));
      button.appendChild(top);
      button.appendChild(
        make(
          'div',
          'req-item__meta',
          typeLabel(row.request_type) + ' · ' + (row.name || '-') + ' · ' + formatDate(row.created_at)
        )
      );
      button.addEventListener('click', function () {
        selectRow(row.id);
      });
      item.appendChild(button);
      list.appendChild(item);
    });
  }

  function selectedRow() {
    for (var i = 0; i < state.rows.length; i += 1) {
      if (state.rows[i].id === state.selectedId) {
        return state.rows[i];
      }
    }
    return null;
  }

  function selectRow(id) {
    state.selectedId = id;
    renderList();
    renderDetail();
  }

  function addAnswersGroup(host, title, data) {
    if (!data || typeof data !== 'object') {
      return;
    }
    var group = make('div', 'answers__group');
    group.appendChild(make('div', 'answers__legend', title));
    Object.keys(data).forEach(function (key) {
      var value = data[key];
      var text = Array.isArray(value) ? value.join(', ') : String(value);
      if (text === '' || text === 'undefined' || text === 'null') {
        return;
      }
      var kv = make('dl', 'kv');
      kv.appendChild(make('dt', null, key));
      kv.appendChild(make('dd', null, text));
      group.appendChild(kv);
    });
    if (group.childElementCount > 1) {
      host.appendChild(group);
    }
  }

  function renderDetail() {
    var host = byId('detailPane');
    host.textContent = '';
    var row = selectedRow();
    if (!row) {
      host.appendChild(make('h2', 'card__title', '접수 없음'));
      host.appendChild(make('p', 'empty', '왼쪽 목록에서 접수를 선택해 주세요.'));
      return;
    }

    host.appendChild(make('h2', 'card__title', row.title || '(제목 없음)'));
    host.appendChild(make('p', 'card__hint', typeLabel(row.request_type)));

    var kv = make('dl', 'kv');
    [
      ['접수번호', row.id],
      ['접수일', formatDate(row.created_at)],
      ['최근 변경', formatDate(row.updated_at)],
      ['이름', row.name],
      ['연락처', row.contact],
      ['상태', statusLabel(row.status)]
    ].forEach(function (pair) {
      kv.appendChild(make('dt', null, pair[0]));
      kv.appendChild(make('dd', null, pair[1] == null ? '-' : String(pair[1])));
    });
    host.appendChild(kv);

    var answers = row.answers || {};
    var box = make('div', 'answers');
    addAnswersGroup(box, '기본 정보', answers.common);
    addAnswersGroup(box, typeLabel(row.request_type) + ' 상세', answers.detail);
    if (!answers.common && !answers.detail) {
      addAnswersGroup(box, '전체 응답', answers);
    }
    host.appendChild(box);

    var field = make('div', 'field');
    var label = make('label', 'field__label', '상태 변경');
    label.setAttribute('for', 'statusSelect');
    field.appendChild(label);
    var select = document.createElement('select');
    select.id = 'statusSelect';
    statusOptions(row.status).forEach(function (opt) {
      select.appendChild(opt);
    });
    field.appendChild(select);
    host.appendChild(field);

    var noteField = make('div', 'field');
    var noteLabel = make('label', 'field__label', '운영 메모');
    noteLabel.setAttribute('for', 'adminNote');
    noteField.appendChild(noteLabel);
    var note = document.createElement('textarea');
    note.id = 'adminNote';
    note.rows = 4;
    note.value = row.admin_note || '';
    noteField.appendChild(note);
    host.appendChild(noteField);

    var bar = make('div', 'nav');
    bar.appendChild(make('span', 'admin-bar__spacer'));
    var save = make('button', 'btn btn--primary', '저장');
    save.type = 'button';
    save.id = 'saveBtn';
    save.addEventListener('click', saveRow);
    bar.appendChild(save);
    host.appendChild(bar);
  }

  function saveRow() {
    if (!client) {
      notify('Supabase 연결에 실패했습니다.', 'err');
      return;
    }
    var row = selectedRow();
    if (!row) {
      notify('저장할 접수를 선택해 주세요.', 'err');
      return;
    }
    var save = byId('saveBtn');
    if (save) {
      save.disabled = true;
    }
    notify('저장 중…', 'info');

    client.rpc(CFG.rpc.adminUpdate, {
      p_token: token(),
      p_id: row.id,
      p_status: byId('statusSelect').value,
      p_admin_note: byId('adminNote').value
    }).then(function (result) {
      if (save) {
        save.disabled = false;
      }
      if (result.error) {
        notify('저장에 실패했습니다: ' + result.error.message, 'err');
        if (isAuthFailure(result.error.message)) {
          logout('토큰이 올바르지 않습니다. 다시 입력해 주세요.');
        }
        return;
      }
      notify('저장했습니다.', 'ok');
      refresh();
    });
  }

  /* ------------------------------------------------------------------
   * 화면 전환
   * ------------------------------------------------------------------ */
  function renderFilters() {
    var host = byId('filters');
    host.textContent = '';
    var all = make('button', state.filter === '' ? 'is-active' : '', '전체');
    all.type = 'button';
    all.addEventListener('click', function () {
      state.filter = '';
      renderFilters();
      refresh();
    });
    host.appendChild(all);
    CFG.statuses.forEach(function (status) {
      var button = make('button', state.filter === status.code ? 'is-active' : '', status.label);
      button.type = 'button';
      button.addEventListener('click', function () {
        state.filter = status.code;
        renderFilters();
        refresh();
      });
      host.appendChild(button);
    });
  }

  function enterConsole() {
    byId('gate').hidden = true;
    byId('console').hidden = false;
    renderFilters();
    refresh();
  }

  function login() {
    if (!client) {
      notify('Supabase 연결에 실패했습니다. 네트워크를 확인해 주세요.', 'err');
      return;
    }
    var input = byId('tokenInput');
    var value = String(input.value || '').trim();
    if (!value) {
      notify('관리자 토큰을 입력해 주세요.', 'err');
      input.focus();
      return;
    }

    var button = byId('loginBtn');
    button.disabled = true;
    button.textContent = '확인 중…';

    // 토큰은 백엔드가 승인하기 전까지 보관하지 않습니다(fail closed).
    client.rpc(CFG.rpc.adminList, { p_token: value, p_status: null }).then(function (result) {
      button.disabled = false;
      button.textContent = '확인';
      input.value = '';
      if (result.error) {
        writeStoredToken('');
        state.token = '';
        byId('gate').hidden = false;
        byId('console').hidden = true;
        notify(
          isAuthFailure(result.error.message)
            ? '관리자 토큰이 올바르지 않습니다.'
            : '확인하지 못했습니다: ' + result.error.message,
          'err'
        );
        input.focus();
        return;
      }
      state.token = value;
      writeStoredToken(value);
      enterConsole();
    });
  }

  /* ------------------------------------------------------------------
   * 시작
   * ------------------------------------------------------------------ */
  function init() {
    if (!byId('gate')) {
      return;
    }

    byId('loginBtn').addEventListener('click', login);
    byId('tokenInput').addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        login();
      }
    });
    byId('refreshBtn').addEventListener('click', refresh);
    byId('logoutBtn').addEventListener('click', function () {
      logout();
    });

    client = createClient();

    state.token = readStoredToken();
    if (state.token) {
      enterConsole();
    } else {
      byId('tokenInput').focus();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
