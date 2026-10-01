/* =====================================================================
 * JuIntake V1 — 공개 접수 폼
 * ---------------------------------------------------------------------
 * 4단계(유형 선택 → 기본 정보 → 상세 내용 → 확인/제출) 동작.
 * 제출은 Supabase JS v2 로 오직
 *   supabase.rpc('juintake_submit_request',
 *     {p_request_type, p_name, p_contact, p_title, p_answers})
 * 한 경로만 사용합니다. 테이블을 직접 읽거나 쓰지 않습니다.
 * ===================================================================== */
(function () {
  'use strict';

  var CFG = window.JUINTAKE_CONFIG;
  if (!CFG) {
    return;
  }

  var STEPS = ['접수 유형', '기본 정보', '상세 내용', '확인 및 제출'];
  var ANSWER_VERSION = 1;

  var state = {
    step: 1,
    requestType: null,
    common: {},
    detail: {}
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

  function typeDef(code) {
    for (var i = 0; i < CFG.requestTypes.length; i += 1) {
      if (CFG.requestTypes[i].code === code) {
        return CFG.requestTypes[i];
      }
    }
    return null;
  }

  function isBlank(value) {
    return value == null || String(value).trim() === '';
  }

  /* ------------------------------------------------------------------
   * 값 읽기 / 쓰기
   * ------------------------------------------------------------------ */
  function readField(field) {
    var name = 'f_' + field.key;
    if (field.type === 'checks') {
      var boxes = document.querySelectorAll('input[name="' + name + '"]:checked');
      var picked = [];
      for (var i = 0; i < boxes.length; i += 1) {
        picked.push(boxes[i].value);
      }
      return picked;
    }
    var node = document.querySelector('[name="' + name + '"]');
    return node ? String(node.value).trim() : '';
  }

  function store(scope, field) {
    var value = readField(field);
    if (field.type === 'checks') {
      if (!value.length && !field.required) {
        delete scope[field.key];
        return;
      }
      scope[field.key] = value;
      return;
    }
    if (isBlank(value)) {
      delete scope[field.key];
      return;
    }
    scope[field.key] = value;
  }

  function isValid(field, value) {
    if (field.type === 'checks') {
      var min = field.min || (field.required ? 1 : 0);
      return value.length >= min;
    }
    if (field.required) {
      return !isBlank(value);
    }
    return true;
  }

  function invalidate(field, message) {
    var holder = document.querySelector('[data-field="' + field.key + '"]');
    if (!holder) {
      return;
    }
    holder.classList.add('is-invalid');
    var errNode = holder.querySelector('.err');
    if (errNode) {
      errNode.textContent = message;
    }
  }

  function clearInvalid(scope) {
    var nodes = scope.querySelectorAll('.is-invalid');
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].classList.remove('is-invalid');
    }
  }

  function validateFields(fields, scope) {
    clearInvalid(scope);
    var firstBad = null;
    fields.forEach(function (field) {
      var value = readField(field);
      if (isValid(field, value)) {
        return;
      }
      var message = field.type === 'checks'
        ? '하나 이상 선택해 주세요.'
        : '이 항목은 필수입니다.';
      invalidate(field, message);
      if (!firstBad) {
        firstBad = field;
      }
    });
    if (firstBad) {
      var holder = document.querySelector('[data-field="' + firstBad.key + '"]');
      if (holder && holder.scrollIntoView) {
        holder.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
    return firstBad === null;
  }

  /* ------------------------------------------------------------------
   * 필드 렌더링
   * ------------------------------------------------------------------ */
  function buildField(field) {
    var wrap = make('div', 'field');
    wrap.setAttribute('data-field', field.key);

    var id = 'fld_' + field.key;
    var label = make('label', 'field__label', field.label);
    label.setAttribute('for', id);
    if (field.required) {
      label.appendChild(make('span', 'req', '필수'));
    } else {
      label.appendChild(make('span', 'opt', '선택'));
    }
    wrap.appendChild(label);

    var name = 'f_' + field.key;
    if (field.type === 'textarea') {
      var area = document.createElement('textarea');
      area.id = id;
      area.name = name;
      area.rows = 3;
      if (field.placeholder) {
        area.placeholder = field.placeholder;
      }
      wrap.appendChild(area);
    } else if (field.type === 'select') {
      var select = document.createElement('select');
      select.id = id;
      select.name = name;
      var blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '선택해 주세요';
      select.appendChild(blank);
      field.options.forEach(function (option) {
        var opt = document.createElement('option');
        opt.value = option;
        opt.textContent = option;
        select.appendChild(opt);
      });
      wrap.appendChild(select);
    } else if (field.type === 'checks') {
      var box = make('div', 'checks');
      field.options.forEach(function (option, index) {
        var chip = make('label', 'chip');
        var input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id + '_' + index;
        input.name = name;
        input.value = option;
        var span = document.createElement('span');
        span.textContent = option;
        chip.appendChild(input);
        chip.appendChild(span);
        box.appendChild(chip);
      });
      wrap.appendChild(box);
    } else {
      var input2 = document.createElement('input');
      input2.type = 'text';
      input2.id = id;
      input2.name = name;
      input2.autocomplete = 'off';
      if (field.placeholder) {
        input2.placeholder = field.placeholder;
      }
      wrap.appendChild(input2);
    }

    wrap.appendChild(make('p', 'err', ''));
    if (field.help) {
      wrap.appendChild(make('p', 'field__help', field.help));
    }
    return wrap;
  }

  /* ------------------------------------------------------------------
   * 1단계: 유형 선택
   * ------------------------------------------------------------------ */
  function renderTypes() {
    var host = byId('typeList');
    host.textContent = '';
    CFG.requestTypes.forEach(function (type) {
      var label = make('label', 'type');
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'request_type';
      input.value = type.code;
      if (type.code === state.requestType) {
        input.checked = true;
      }
      var box = make('div', 'type__box');
      var icon = make('div', 'type__icon', type.icon);
      icon.setAttribute('aria-hidden', 'true');
      var body = make('div');
      body.appendChild(make('div', 'type__label', type.label));
      body.appendChild(make('div', 'type__desc', type.desc));
      box.appendChild(icon);
      box.appendChild(body);
      label.appendChild(input);
      label.appendChild(box);
      host.appendChild(label);
    });
  }

  function pickType(code) {
    state.requestType = code;
    state.detail = {};
  }

  /* ------------------------------------------------------------------
   * 2/3단계: 폼 바인딩
   * ------------------------------------------------------------------ */
  function fillValue(scope, field, value) {
    var name = 'f_' + field.key;
    if (field.type === 'checks') {
      var boxes = scope.querySelectorAll('input[name="' + name + '"]');
      var saved = Array.isArray(value) ? value : [];
      for (var i = 0; i < boxes.length; i += 1) {
        boxes[i].checked = saved.indexOf(boxes[i].value) !== -1;
      }
      return;
    }
    var node = scope.querySelector('[name="' + name + '"]');
    if (node) {
      node.value = value == null ? '' : String(value);
    }
  }

  function renderCommon() {
    var host = byId('commonFields');
    host.textContent = '';
    CFG.commonFields.forEach(function (field) {
      var node = buildField(field);
      host.appendChild(node);
      fillValue(host, field, state.common[field.key]);
    });
  }

  function renderDetail() {
    var host = byId('detailFields');
    host.textContent = '';
    var type = typeDef(state.requestType);
    byId('detailTitle').textContent = type ? type.label + ' 상세' : '상세 내용';
    byId('detailDesc').textContent = type
      ? '해당 항목에 답해 주시면 그대로 견적과 일정에 반영합니다. 모르면 모른다고 적어주세요.'
      : '';
    if (!type) {
      return;
    }
    type.questions.forEach(function (field) {
      var node = buildField(field);
      host.appendChild(node);
      fillValue(host, field, state.detail[field.key]);
    });
  }

  /* ------------------------------------------------------------------
   * 4단계: 검토 화면
   * ------------------------------------------------------------------ */
  function displayValue(field, value) {
    if (field.type === 'checks') {
      return value && value.length ? value.join(', ') : '';
    }
    return value == null ? '' : String(value);
  }

  function addReviewGroup(host, title, fields, scope) {
    var group = make('div', 'review__group');
    group.appendChild(make('div', 'review__key', title));
    fields.forEach(function (field) {
      var row = make('div');
      var key = make('div', 'review__key', field.label);
      var val = make('div', 'review__val', displayValue(field, scope[field.key]));
      if (!val.textContent) {
        val.className = 'review__val review__val--empty';
        val.textContent = '답변 없음';
      }
      row.appendChild(key);
      row.appendChild(val);
      group.appendChild(row);
    });
    host.appendChild(group);
  }

  function renderReview() {
    var host = byId('reviewBody');
    host.textContent = '';
    var type = typeDef(state.requestType);

    var head = make('div', 'review__group');
    head.appendChild(make('div', 'review__key', '접수 유형'));
    head.appendChild(make('div', 'review__val', type ? type.icon + ' ' + type.label : ''));
    host.appendChild(head);

    addReviewGroup(host, '기본 정보', CFG.commonFields, state.common);
    if (type) {
      addReviewGroup(host, type.label + ' 상세', type.questions, state.detail);
    }
  }

  /* ------------------------------------------------------------------
   * 단계 이동
   * ------------------------------------------------------------------ */
  function updateStepper() {
    var nodes = document.querySelectorAll('#stepper .step');
    for (var i = 0; i < nodes.length; i += 1) {
      nodes[i].classList.toggle('is-current', i === state.step - 1);
      nodes[i].classList.toggle('is-done', i < state.step - 1);
      nodes[i].setAttribute('aria-current', i === state.step - 1 ? 'step' : 'false');
    }
    for (var j = 0; j < nodes.length; j += 1) {
      var num = nodes[j].querySelector('.step__num');
      var label = nodes[j].querySelector('.step__label');
      if (num) {
        num.textContent = 'STEP ' + (j + 1);
      }
      if (label) {
        label.textContent = STEPS[j];
      }
    }
    byId('stepNote').textContent = state.step + ' / ' + STEPS.length + ' 단계 · ' + STEPS[state.step - 1];
  }

  function showPanel(name) {
    ['panelType', 'panelCommon', 'panelDetail', 'panelReview', 'panelSuccess'].forEach(function (id) {
      var node = byId(id);
      if (node) {
        node.hidden = id !== name;
      }
    });
  }

  function syncButtons() {
    var prev = byId('prevBtn');
    var next = byId('nextBtn');
    if (prev) {
      prev.disabled = state.step === 1;
    }
    if (next) {
      next.hidden = state.step === STEPS.length;
    }
    var submit = byId('submitBtn');
    if (submit) {
      submit.hidden = state.step !== STEPS.length;
    }
  }

  function goTo(step) {
    state.step = Math.min(Math.max(step, 1), STEPS.length);
    showPanel(
      state.step === 1 ? 'panelType'
        : state.step === 2 ? 'panelCommon'
          : state.step === 3 ? 'panelDetail' : 'panelReview'
    );
    updateStepper();
    syncButtons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function collect(scope, fields) {
    fields.forEach(function (field) {
      store(scope, field);
    });
  }

  function next() {
    if (state.step === 1) {
      var checked = document.querySelector('input[name="request_type"]:checked');
      if (!checked) {
        var alert1 = byId('formAlert');
        alert1.textContent = '접수 유형을 먼저 선택해 주세요.';
        alert1.className = 'alert alert--err';
        alert1.hidden = false;
        return;
      }
      pickType(checked.value);
      byId('formAlert').hidden = true;
      goTo(2);
      return;
    }
    if (state.step === 2) {
      collect(state.common, CFG.commonFields);
      if (!validateFields(CFG.commonFields, byId('commonFields'))) {
        return;
      }
      goTo(3);
      return;
    }
    if (state.step === 3) {
      var type = typeDef(state.requestType);
      if (!type) {
        goTo(1);
        return;
      }
      collect(state.detail, type.questions);
      if (!validateFields(type.questions, byId('detailFields'))) {
        return;
      }
      renderReview();
      goTo(4);
    }
  }

  function prev() {
    if (state.step === 2) {
      collect(state.common, CFG.commonFields);
    }
    if (state.step === 3) {
      var type = typeDef(state.requestType);
      if (type) {
        collect(state.detail, type.questions);
      }
    }
    goTo(state.step - 1);
  }

  /* ------------------------------------------------------------------
   * 제출
   * ------------------------------------------------------------------ */
  function payload() {
    return {
      v: ANSWER_VERSION,
      common: state.common,
      detail: state.detail
    };
  }

  function setBusy(busy) {
    var button = byId('submitBtn');
    if (button) {
      button.disabled = busy;
      button.textContent = busy ? '전송 중…' : '접수 완료하기';
    }
    var status = byId('submitStatus');
    if (status) {
      status.hidden = !busy;
    }
  }

  function fail(message) {
    var alert2 = byId('formAlert');
    alert2.textContent = message;
    alert2.className = 'alert alert--err';
    alert2.hidden = false;
  }

  function submit(event) {
    if (event) {
      event.preventDefault();
    }
    var consent = byId('consent');
    if (!consent.checked) {
      fail('개인정보 수집·이용 동의에 체크해 주세요.');
      consent.focus();
      return;
    }

    var type = typeDef(state.requestType);
    if (!type) {
      fail('접수 유형이 선택되지 않았습니다. 처음 단계로 돌아갑니다.');
      goTo(1);
      return;
    }

    var alertBox = byId('formAlert');
    alertBox.hidden = true;
    setBusy(true);

    if (!client) {
      setBusy(false);
      fail('Supabase 연결에 실패했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.');
      return;
    }

    client.rpc(CFG.rpc.submit, {
      p_request_type: type.code,
      p_name: state.common.name || '',
      p_contact: state.common.contact || '',
      p_title: state.common.title || '',
      p_answers: payload()
    })
      .then(function (result) {
        setBusy(false);
        if (result.error) {
          fail('접수에 실패했습니다: ' + result.error.message);
          return;
        }
        var data = result.data || {};
        var ticket = byId('ticket');
        if (ticket) {
          ticket.textContent = data.id ? '접수번호 ' + data.id : '접수가 등록되었습니다.';
        }
        var status = byId('submitStatus');
        if (status) {
          status.hidden = true;
        }
        byId('panelReview').hidden = true;
        byId('panelSuccess').hidden = false;
        byId('nav').hidden = true;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
  }

  function resetAll() {
    state.step = 1;
    state.requestType = null;
    state.common = {};
    state.detail = {};
    renderTypes();
    renderCommon();
    renderDetail();
    byId('consent').checked = false;
    byId('formAlert').hidden = true;
    byId('nav').hidden = false;
    goTo(1);
  }

  /* ------------------------------------------------------------------
   * 시작
   * ------------------------------------------------------------------ */
  function init() {
    if (!byId('formRoot')) {
      return;
    }

    var stepper = byId('stepper');
    STEPS.forEach(function (label, index) {
      var step = make('div', 'step');
      step.appendChild(make('span', 'step__num', 'STEP ' + (index + 1)));
      step.appendChild(make('span', 'step__label', label));
      stepper.appendChild(step);
    });

    renderTypes();
    renderCommon();
    renderDetail();

    byId('nextBtn').addEventListener('click', next);
    byId('prevBtn').addEventListener('click', prev);
    byId('submitBtn').addEventListener('click', submit);
    byId('againBtn').addEventListener('click', resetAll);
    byId('formRoot').addEventListener('change', function (event) {
      var target = event.target;
      if (target && target.name === 'request_type' && target.checked) {
        pickType(target.value);
        byId('formAlert').hidden = true;
        renderDetail();
      }
    });
    byId('formRoot').addEventListener('submit', function (event) {
      event.preventDefault();
      submit(event);
    });

    client = createClient();
    goTo(1);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
