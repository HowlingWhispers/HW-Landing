// Device selection is provider-agnostic policy; only discovery is provider work.
// A member with no usable device is a normal, expected state, not an error: the
// room keeps working and Coda is told to say so instead of guessing.
// {provider} is filled in with the provider's own display name.
export const DEVICE_REASONS = {
  none: 'No {provider} device is available on this account. Open {provider} on a phone, desktop, or speaker and start playing anything once so it registers as an active device.',
  restricted: 'The only available {provider} device cannot be controlled remotely. Choose a different device in {provider} device settings.',
  ambiguous: 'More than one {provider} device is available and none is marked active. Pick a device in {provider}, or tell Coda which one to use.',
  missing: 'That {provider} device is no longer available. Open {provider} on a device you can control and start it once.',
};

// devices: [{ id, label, type, active, restricted }] as reported by the provider.
export function selectDevice(devices, preferredId) {
  const usable = (Array.isArray(devices) ? devices : []).filter(device => device && device.id && !device.restricted);
  if (preferredId) {
    const preferred = usable.find(device => device.id === preferredId);
    if (preferred) return { device: preferred, reason: null };
    return { device: null, reason: 'missing' };
  }
  const active = usable.filter(device => device.active);
  if (active.length === 1) return { device: active[0], reason: null };
  if (active.length > 1) return { device: null, reason: 'ambiguous' };
  if (usable.length === 1) return { device: usable[0], reason: null };
  if (usable.length > 1) return { device: null, reason: 'ambiguous' };
  return { device: null, reason: Array.isArray(devices) && devices.length ? 'restricted' : 'none' };
}

export function describeMissingDevice(provider, reason, deviceError) {
  const name = provider?.label || 'music';
  const base = (DEVICE_REASONS[reason] || DEVICE_REASONS.none).split('{provider}').join(name);
  return deviceError ? `${base} (${deviceError})` : base;
}
