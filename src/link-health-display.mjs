export function mapLinkStatusToHealth(status) {
  if (status === 'ok') return 'running';
  if (status === 'missing') return 'standby';
  return 'invalid';
}

export function getHealthIcon(health) {
  if (health === 'running') return '🟢';
  if (health === 'standby') return '🟡';
  return '🔴';
}

export function formatLinkHealthLabel({ status, src, dst }) {
  return `${getHealthIcon(mapLinkStatusToHealth(status))} ${src} --> ${dst}`;
}

export function formatDoctorLine(entry) {
  return `${getHealthIcon(mapLinkStatusToHealth(entry.status))} [${entry.module}] ${entry.srcRaw} --> ${entry.dstRaw}`;
}
