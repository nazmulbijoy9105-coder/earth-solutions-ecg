(() => {
  'use strict';

  const EXPORT_ID = 'peopole-chat-pdf-export';
  const BUTTON_ID = 'chatPdfExportBtn';

  function getMessagesRoot() {
    return (
      document.querySelector('.messages') ||
      document.querySelector('#messages') ||
      document.querySelector('[data-chat-messages]')
    );
  }

  function getLanguage() {
    return document.body.classList.contains('bn-mode') ? 'বাংলা' : 'English';
  }

  function getExportButton() {
    return document.getElementById(BUTTON_ID);
  }

  function createExportButton() {
    if (getExportButton()) return;

    const topbar =
      document.querySelector('.chat .topbar') ||
      document.querySelector('.topbar');

    if (!topbar) return;

    const button = document.createElement('button');

    button.id = BUTTON_ID;
    button.type = 'button';
    button.className = 'chat-pdf-btn';
    button.setAttribute('aria-label', 'Generate PDF from chat');
    button.title = 'Generate PDF from chat';

    button.innerHTML = `
      <span aria-hidden="true">⇩</span>
      <span class="chat-pdf-label">PDF</span>
    `;

    button.addEventListener('click', generatePDF);

    topbar.appendChild(button);
  }

  function createExportDocument() {
    const messages = getMessagesRoot();

    if (!messages) {
      window.alert(
        getLanguage() === 'বাংলা'
          ? 'চ্যাটের কোনো বার্তা পাওয়া যায়নি।'
          : 'No chat messages were found.'
      );
      return null;
    }

    const old = document.getElementById(EXPORT_ID);
    if (old) old.remove();

    const root = document.createElement('section');
    root.id = EXPORT_ID;
    root.setAttribute('aria-hidden', 'true');

    const now = new Date();

    const title = document.createElement('h1');
    title.textContent =
      getLanguage() === 'বাংলা'
        ? 'Peopole AI — চ্যাট রিপোর্ট'
        : 'Peopole AI — Chat Report';

    const meta = document.createElement('div');
    meta.className = 'chat-pdf-meta';
    meta.textContent =
      `${getLanguage() === 'বাংলা' ? 'ভাষা' : 'Language'}: ${getLanguage()}  •  ` +
      `${getLanguage() === 'বাংলা' ? 'তারিখ' : 'Generated'}: ${now.toLocaleString()}`;

    const body = document.createElement('div');
    body.className = 'chat-pdf-body';

    /*
     * Clone the rendered conversation so the PDF reflects exactly
     * what the user currently sees, including Bangla text.
     */
    body.innerHTML = messages.innerHTML;

    root.appendChild(title);
    root.appendChild(meta);
    root.appendChild(body);

    document.body.appendChild(root);

    return root;
  }

  function generatePDF() {
    const button = getExportButton();

    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    }

    const root = createExportDocument();

    if (!root) {
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
      return;
    }

    /*
     * Allow the browser to render the print DOM before opening
     * the native Save as PDF dialog.
     */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.print();

        setTimeout(() => {
          root.remove();

          if (button) {
            button.disabled = false;
            button.removeAttribute('aria-busy');
          }
        }, 500);
      });
    });
  }

  function init() {
    createExportButton();

    /*
     * The chat UI can be mounted after the initial page load.
     * A small observer keeps the PDF action available without
     * modifying chat rendering logic.
     */
    const observer = new MutationObserver(() => {
      createExportButton();

      if (document.getElementById(BUTTON_ID)) {
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => observer.disconnect(), 10000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
