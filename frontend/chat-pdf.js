(() => {
  'use strict';

  const BUTTON_ID = 'chatPdfExportBtn';
  const ROOT_ID = 'peopole-chat-pdf-document';

  function isBangla() {
    return document.body.classList.contains('bn-mode');
  }

  function text(en, bn) {
    return isBangla() ? bn : en;
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function findMessages() {
    return (
      document.querySelector('.messages') ||
      document.querySelector('#messages') ||
      document.querySelector('[data-chat-messages]')
    );
  }

  function extractMessages() {
    const root = findMessages();

    if (!root) return [];

    const nodes = [...root.querySelectorAll('.msg')];

    return nodes.map((node) => {
      const clone = node.cloneNode(true);

      clone.querySelectorAll(
        'button, input, textarea, .msg-actions, .feedback, .copy-btn'
      ).forEach((el) => el.remove());

      const textContent = clone.innerText
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const isUser =
        node.classList.contains('user') ||
        node.classList.contains('user-msg') ||
        node.classList.contains('from-user') ||
        node.querySelector('.user');

      return {
        role: isUser ? 'user' : 'assistant',
        html: clone.innerHTML,
        text: textContent
      };
    }).filter((item) => item.text || item.html);
  }

  function createDocument(messages) {
    const existing = document.getElementById(ROOT_ID);
    if (existing) existing.remove();

    const now = new Date();

    const root = document.createElement('article');
    root.id = ROOT_ID;

    root.innerHTML = `
      <header class="pdf-header">
        <div class="pdf-brand">
          <div class="pdf-logo">PEOPOLE AI</div>
          <div class="pdf-brand-sub">
            Earth Solutions Visa Zone
          </div>
        </div>

        <div class="pdf-document-type">
          ${escapeHTML(text('CHAT TRANSCRIPT', 'চ্যাট ট্রান্সক্রিপ্ট'))}
        </div>
      </header>

      <section class="pdf-cover">
        <div class="pdf-kicker">
          ${escapeHTML(text('Conversation Report', 'কথোপকথন রিপোর্ট'))}
        </div>

        <h1>
          ${escapeHTML(
            text(
              'AI Consultation Conversation',
              'AI পরামর্শমূলক কথোপকথন'
            )
          )}
        </h1>

        <p class="pdf-description">
          ${escapeHTML(
            text(
              'A formatted record of the conversation generated from Peopole AI.',
              'Peopole AI থেকে তৈরি এই নথিতে বর্তমান কথোপকথনের একটি সুশৃঙ্খল রেকর্ড রয়েছে।'
            )
          )}
        </p>

        <div class="pdf-meta-grid">
          <div class="pdf-meta-item">
            <span>${escapeHTML(text('Generated', 'তৈরির সময়'))}</span>
            <strong>${escapeHTML(now.toLocaleString())}</strong>
          </div>

          <div class="pdf-meta-item">
            <span>${escapeHTML(text('Language', 'ভাষা'))}</span>
            <strong>${escapeHTML(text('English', 'বাংলা'))}</strong>
          </div>

          <div class="pdf-meta-item">
            <span>${escapeHTML(text('Messages', 'বার্তা'))}</span>
            <strong>${messages.length}</strong>
          </div>
        </div>
      </section>

      <main class="pdf-conversation">
        <div class="pdf-section-heading">
          <span>${escapeHTML(text('Conversation', 'কথোপকথন'))}</span>
        </div>

        ${messages.map((message, index) => `
          <section class="pdf-message pdf-message-${message.role}">
            <div class="pdf-message-header">
              <div class="pdf-message-role">
                ${escapeHTML(
                  message.role === 'user'
                    ? text('You', 'আপনি')
                    : text('Peopole AI', 'Peopole AI')
                )}
              </div>

              <div class="pdf-message-number">
                ${String(index + 1).padStart(2, '0')}
              </div>
            </div>

            <div class="pdf-message-content">
              ${message.html || escapeHTML(message.text)}
            </div>
          </section>
        `).join('')}
      </main>

      <footer class="pdf-footer">
        <span>
          Peopole AI — Earth Solutions Visa Zone
        </span>
        <span>
          ${escapeHTML(
            text(
              'Generated conversation document',
              'তৈরিকৃত কথোপকথন নথি'
            )
          )}
        </span>
      </footer>
    `;

    document.body.appendChild(root);

    return root;
  }

  function createButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const topbar =
      document.querySelector('.chat .topbar') ||
      document.querySelector('.topbar');

    if (!topbar) return;

    const button = document.createElement('button');

    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'chat-pdf-btn';
    button.title = text('Export conversation as PDF', 'চ্যাট PDF তৈরি করুন');
    button.setAttribute(
      'aria-label',
      text('Export conversation as PDF', 'চ্যাট PDF তৈরি করুন')
    );

    button.innerHTML = `
      <span aria-hidden="true">⇩</span>
      <span class="chat-pdf-label">PDF</span>
    `;

    button.addEventListener('click', exportPDF);

    topbar.appendChild(button);
  }

  function exportPDF() {
    const messages = extractMessages();

    if (!messages.length) {
      window.alert(
        text(
          'There are no chat messages to export.',
          'এক্সপোর্ট করার মতো কোনো চ্যাট বার্তা নেই।'
        )
      );
      return;
    }

    const button = document.getElementById(BUTTON_ID);

    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    }

    const documentRoot = createDocument(messages);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();

        setTimeout(() => {
          documentRoot.remove();

          if (button) {
            button.disabled = false;
            button.removeAttribute('aria-busy');
          }
        }, 700);
      });
    });
  }

  function init() {
    createButton();

    const observer = new MutationObserver(() => {
      createButton();

      if (document.getElementById(BUTTON_ID)) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => observer.disconnect(), 15000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
