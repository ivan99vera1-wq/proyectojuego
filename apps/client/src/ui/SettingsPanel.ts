import { DEFAULT_CONTROLS, UI, type ControlAction } from '@game/config';
import { settings } from '../app/Settings.js';
import { button, el } from './dom.js';

const ACTION_LABELS: Record<ControlAction, string> = {
  moveForward: 'Adelante', moveBackward: 'Atrás', moveLeft: 'Izquierda', moveRight: 'Derecha', jump: 'Saltar', crouch: 'Agacharse',
  sprint: 'Correr', reload: 'Recargar', interact: 'Plantar / Desactivar', buyMenu: 'Tienda', scoreboard: 'Marcador',
  primaryWeapon: 'Arma principal', secondaryWeapon: 'Pistola', melee: 'Cuchillo', grenade: 'Granada', chat: 'Chat', teamChat: 'Chat de equipo',
  emote: 'Emote', toggleCamera: 'Primera / tercera persona', fire: 'Disparar', aim: 'Apuntar',
};

const keyName = (code: string) => code.replace('Key', '').replace('Digit', '').replace('Mouse0', 'Clic izq.').replace('Mouse2', 'Clic der.').replace('Mouse1', 'Rueda').replace('Left', ' izq.').replace('Right', ' der.');

/** Panel de ajustes reutilizable (menú principal y pausa). */
export function buildSettingsPanel(onClose: () => void): HTMLElement {
  const d = settings.data;
  const slider = (label: string, key: 'mouseSensitivity' | 'fov' | 'masterVolume' | 'sfxVolume' | 'musicVolume', min: number, max: number, step: number) => {
    const input = el('input', { type: 'range' });
    input.min = String(min); input.max = String(max); input.step = String(step); input.value = String(d[key]);
    const val = el('span', { class: 'badge', text: String(d[key]) });
    input.addEventListener('input', () => { settings.set(key, Number(input.value)); val.textContent = input.value; });
    return el('div', { class: 'field' }, [el('label', {}, [label + ' ', val]), input]);
  };
  const check = (label: string, key: 'invertY' | 'showFps') => {
    const input = el('input', { type: 'checkbox' });
    input.checked = d[key];
    input.addEventListener('change', () => settings.set(key, input.checked));
    return el('label', { class: 'row' }, [input, label]);
  };
  const quality = el('select');
  for (const q of ['low', 'medium', 'high']) { const o = el('option', { text: q === 'low' ? 'Baja' : q === 'medium' ? 'Media' : 'Alta' }); o.value = q; quality.append(o); }
  quality.value = d.graphicsQuality;
  quality.addEventListener('change', () => settings.set('graphicsQuality', quality.value as 'low' | 'medium' | 'high'));
  const lang = el('select');
  for (const l of Object.keys(UI.strings)) { const o = el('option', { text: l.toUpperCase() }); o.value = l; lang.append(o); }
  lang.value = d.language;
  lang.addEventListener('change', () => settings.set('language', lang.value));

  const bindings = el('div', { class: 'grid' });
  const renderBindings = () => {
    bindings.replaceChildren();
    for (const action of Object.keys(DEFAULT_CONTROLS) as ControlAction[]) {
      const btn = el('button', { class: 'secondary' }, [el('span', { class: 'kbd', text: keyName(settings.data.bindings[action]) })]);
      btn.style.padding = '6px';
      btn.addEventListener('click', () => {
        btn.replaceChildren(el('span', { class: 'kbd', text: '…' }));
        const onKey = (e: KeyboardEvent) => { e.preventDefault(); done(e.code); };
        const onMouse = (e: MouseEvent) => { if (e.target === btn) return; e.preventDefault(); done(`Mouse${e.button}`); };
        const done = (code: string) => {
          window.removeEventListener('keydown', onKey, true); window.removeEventListener('mousedown', onMouse, true);
          settings.data.bindings[action] = code; settings.save(); renderBindings();
        };
        setTimeout(() => { window.addEventListener('keydown', onKey, true); window.addEventListener('mousedown', onMouse, true); }, 50);
      });
      bindings.append(el('div', { class: 'field' }, [el('label', { text: ACTION_LABELS[action] }), btn]));
    }
  };
  renderBindings();
  const reset = button('Restablecer teclas', () => { settings.resetBindings(); renderBindings(); }, 'secondary');
  const close = button('Listo', onClose);

  const panel = el('div', { class: 'panel center-col menu-panel' }, [
    el('div', { class: 'title', text: 'Ajustes' }),
    slider('Sensibilidad', 'mouseSensitivity', 0.1, 4, 0.05),
    slider('Campo de visión', 'fov', 60, 110, 1),
    check('Invertir eje Y', 'invertY'),
    slider('Volumen general', 'masterVolume', 0, 1, 0.05),
    slider('Efectos', 'sfxVolume', 0, 1, 0.05),
    slider('Música', 'musicVolume', 0, 1, 0.05),
    el('div', { class: 'field' }, [el('label', { text: 'Calidad gráfica' }), quality]),
    el('div', { class: 'field' }, [el('label', { text: 'Idioma' }), lang]),
    check('Mostrar FPS', 'showFps'),
    el('div', { class: 'muted', text: 'Controles (clic para reasignar)' }),
    bindings,
    el('div', { class: 'row between' }, [reset, close]),
  ]);
  (panel.querySelector('.title') as HTMLElement).style.fontSize = '28px';
  panel.style.maxHeight = '86vh'; panel.style.overflow = 'auto'; panel.style.width = '560px';
  return panel;
}
