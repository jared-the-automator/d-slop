import { useState, useEffect } from 'react';
import {
  getExtensionState, setExtensionState,
  getUserThreshold, setUserThreshold,
  getMediaSettings, setMediaSettings,
} from '../../lib/storage';
import { DEFAULT_THRESHOLD, DEFAULT_MEDIA_THRESHOLD } from '../../lib/config';
import type { DisplayMode, ExtensionState } from '../../lib/rules-engine/types';
import type { MediaSettings } from '../../lib/media-detector/types';

const MODES: DisplayMode[] = ['highlight', 'collapse', 'hidden'];

const sectionStyle = {
  border: '1px solid #ccc',
  borderRadius: 4,
  padding: '5px 10px 8px',
  marginBottom: 10,
};

const legendStyle = { fontSize: 11, color: '#888', padding: '0 3px' };

export default function App() {
  const [state, setState] = useState<ExtensionState>({ enabled: true, mode: 'highlight' });
  const [flagCount, setFlagCountLocal] = useState(0);
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [mediaSettings, setMediaSettingsLocal] = useState<MediaSettings>({
    mode: 'highlight',
    threshold: DEFAULT_MEDIA_THRESHOLD,
  });
  useEffect(() => {
    getExtensionState().then(setState);
    getUserThreshold().then(setThreshold);
    getMediaSettings().then(setMediaSettingsLocal);
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (!tab?.id) return;
      browser.tabs.sendMessage(tab.id, { type: 'GET_FLAG_COUNT' })
        .then((res: { count: number }) => setFlagCountLocal(res?.count ?? 0))
        .catch(() => setFlagCountLocal(0));
    });
  }, []);

  async function toggleEnabled() {
    const next = !state.enabled;
    await setExtensionState({ enabled: next });
    setState(s => ({ ...s, enabled: next }));
  }

  async function pickTextMode(mode: DisplayMode) {
    await setExtensionState({ mode });
    setState(s => ({ ...s, mode }));
  }

  async function changeThreshold(value: number) {
    await setUserThreshold(value);
    setThreshold(value);
  }

  async function pickMediaMode(mode: DisplayMode) {
    await setMediaSettings({ mode });
    setMediaSettingsLocal(s => ({ ...s, mode }));
  }

  async function changeMediaThreshold(value: number) {
    await setMediaSettings({ threshold: value });
    setMediaSettingsLocal(s => ({ ...s, threshold: value }));
  }

  const dimmed = { opacity: state.enabled ? 1 : 0.4 };

  return (
    <div style={{ width: 220, padding: '12px 14px', fontFamily: 'monospace', fontSize: 13, color: '#222' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong style={{ fontSize: 15 }}>D-slop</strong>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={state.enabled} onChange={toggleEnabled} style={{ cursor: 'pointer' }} />
          <span style={{ color: state.enabled ? '#2a9d2a' : '#999' }}>
            {state.enabled ? 'ON' : 'OFF'}
          </span>
        </label>
      </div>

      {/* Text section */}
      <fieldset style={{ ...sectionStyle, ...dimmed }}>
        <legend style={legendStyle}>Text</legend>
        {MODES.map(m => (
          <label key={m} style={{ display: 'block', margin: '3px 0', cursor: state.enabled ? 'pointer' : 'default' }}>
            <input
              type="radio" name="textMode" value={m}
              checked={state.mode === m} disabled={!state.enabled}
              onChange={() => pickTextMode(m)}
              style={{ marginRight: 6 }}
            />
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </label>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginTop: 6, marginBottom: 2 }}>
          <span>aggressive</span>
          <span style={{ color: '#555', fontWeight: threshold === DEFAULT_THRESHOLD ? 'bold' : 'normal' }}>
            {Math.round(threshold * 100)}%{threshold === DEFAULT_THRESHOLD ? ' (default)' : ''}
          </span>
          <span>cautious</span>
        </div>
        <input
          type="range" min="0.05" max="0.50" step="0.05"
          value={threshold} disabled={!state.enabled}
          onChange={e => changeThreshold(Number(e.target.value))}
          style={{ width: '100%', cursor: state.enabled ? 'pointer' : 'default' }}
        />
      </fieldset>

      {/* Media section */}
      <fieldset style={{ ...sectionStyle, ...dimmed }}>
        <legend style={legendStyle}>Media</legend>
        {MODES.map(m => (
          <label key={m} style={{ display: 'block', margin: '3px 0', cursor: state.enabled ? 'pointer' : 'default' }}>
            <input
              type="radio" name="mediaMode" value={m}
              checked={mediaSettings.mode === m} disabled={!state.enabled}
              onChange={() => pickMediaMode(m)}
              style={{ marginRight: 6 }}
            />
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </label>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginTop: 6, marginBottom: 2 }}>
          <span>aggressive</span>
          <span style={{ color: '#555', fontWeight: mediaSettings.threshold === DEFAULT_MEDIA_THRESHOLD ? 'bold' : 'normal' }}>
            {Math.round(mediaSettings.threshold * 100)}%{mediaSettings.threshold === DEFAULT_MEDIA_THRESHOLD ? ' (default)' : ''}
          </span>
          <span>cautious</span>
        </div>
        <input
          type="range" min="0.05" max="1.00" step="0.05"
          value={mediaSettings.threshold} disabled={!state.enabled}
          onChange={e => changeMediaThreshold(Number(e.target.value))}
          style={{ width: '100%', cursor: state.enabled ? 'pointer' : 'default' }}
        />
        <p style={{ fontSize: 10, color: '#888', margin: '5px 0 0 0' }}>
          C2PA scanning active
        </p>
      </fieldset>

      <div style={{ fontSize: 11, color: '#999', textAlign: 'right' }}>
        {state.enabled
          ? `${flagCount} item${flagCount !== 1 ? 's' : ''} flagged this page`
          : 'detection off'}
      </div>
    </div>
  );
}
