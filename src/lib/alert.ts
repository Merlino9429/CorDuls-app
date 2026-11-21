import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Come Alert.alert, ma funziona anche nella versione web
 * (su web react-native-web non mostra nulla): disegna una piccola finestra di dialogo.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    Alert.alert(title, message, buttons);
    return;
  }
  const list = buttons?.length ? buttons : [{ text: 'OK' }];
  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: 'rgba(30,20,15,.45)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: '9999', padding: '24px',
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  });
  const box = document.createElement('div');
  Object.assign(box.style, {
    background: '#fff', borderRadius: '18px', padding: '20px', maxWidth: '320px', width: '100%',
    boxShadow: '0 12px 40px rgba(0,0,0,.25)', color: '#2B1611',
  });
  const h = document.createElement('div');
  h.textContent = title;
  Object.assign(h.style, { fontWeight: '800', fontSize: '17px', marginBottom: message ? '6px' : '14px' });
  box.appendChild(h);
  if (message) {
    const p = document.createElement('div');
    p.textContent = message;
    Object.assign(p.style, { fontSize: '14px', color: '#76605A', marginBottom: '16px', lineHeight: '1.4' });
    box.appendChild(p);
  }
  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' });
  const close = () => overlay.remove();
  list.forEach((b) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = b.text ?? 'OK';
    const destructive = b.style === 'destructive';
    const cancel = b.style === 'cancel';
    Object.assign(btn.style, {
      border: '0', borderRadius: '999px', padding: '10px 16px', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
      background: cancel ? '#F7E4F2' : destructive ? '#C0392B' : '#A9458F', color: cancel ? '#A9458F' : '#fff',
    });
    btn.onclick = () => { close(); b.onPress?.(); };
    row.appendChild(btn);
  });
  box.appendChild(row);
  overlay.appendChild(box);
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.body.appendChild(overlay);
  (row.lastChild as HTMLButtonElement | null)?.focus();
}
