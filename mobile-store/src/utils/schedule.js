const DEFAULT_WEEKLY_SCHEDULE = [
  { dayIndex: 1, dayName: 'Lunes', isOpen: true, openTime: '11:00', closeTime: '22:00' },
  { dayIndex: 2, dayName: 'Martes', isOpen: true, openTime: '11:00', closeTime: '22:00' },
  { dayIndex: 3, dayName: 'Miércoles', isOpen: true, openTime: '11:00', closeTime: '22:00' },
  { dayIndex: 4, dayName: 'Jueves', isOpen: true, openTime: '11:00', closeTime: '22:00' },
  { dayIndex: 5, dayName: 'Viernes', isOpen: true, openTime: '11:00', closeTime: '23:00' },
  { dayIndex: 6, dayName: 'Sábado', isOpen: true, openTime: '11:00', closeTime: '23:00' },
  { dayIndex: 0, dayName: 'Domingo', isOpen: true, openTime: '11:00', closeTime: '22:00' }
];

const format12h = (time24) => {
  if (!time24) return '';
  const parts = time24.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) || 0;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export const getStoreScheduleStatus = (scheduleRaw) => {
  let schedule = DEFAULT_WEEKLY_SCHEDULE;

  if (scheduleRaw) {
    try {
      const parsed = JSON.parse(scheduleRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        schedule = parsed;
      }
    } catch (e) {
      // Legacy text
    }
  }

  const now = new Date();
  const currentDayIndex = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const todayConfig = schedule.find(d => Number(d.dayIndex) === currentDayIndex);

  if (!todayConfig || !todayConfig.isOpen) {
    return {
      isOpen: false,
      badgeText: 'Cerrado hoy',
      badgeClass: 'closed',
      detailText: 'Hoy no hay servicio'
    };
  }

  const [openH, openM] = (todayConfig.openTime || '00:00').split(':').map(Number);
  const [closeH, closeM] = (todayConfig.closeTime || '23:59').split(':').map(Number);
  const openTotal = openH * 60 + (openM || 0);
  const closeTotal = closeH * 60 + (closeM || 0);

  let isOpenNow = false;
  if (closeTotal > openTotal) {
    isOpenNow = currentMinutes >= openTotal && currentMinutes < closeTotal;
  } else {
    // Horario nocturno
    isOpenNow = currentMinutes >= openTotal || currentMinutes < closeTotal;
  }

  if (isOpenNow) {
    return {
      isOpen: true,
      badgeText: 'Abierto ahora',
      badgeClass: 'open',
      detailText: `Cierra a las ${format12h(todayConfig.closeTime)}`
    };
  }

  if (currentMinutes < openTotal) {
    return {
      isOpen: false,
      badgeText: 'Cerrado',
      badgeClass: 'closed',
      detailText: `Abre a las ${format12h(todayConfig.openTime)}`
    };
  }

  return {
    isOpen: false,
    badgeText: 'Cerrado',
    badgeClass: 'closed',
    detailText: 'Cerrado por hoy'
  };
};
