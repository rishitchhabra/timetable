import { useTimetable } from '../context/TimetableContext';

export default function Alert() {
  const { alert } = useTimetable();

  if (!alert) return null;

  const bgColors = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500'
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  return (
    <div className="fixed top-4 right-4 z-50 alert-slide-in">
      <div className={`${bgColors[alert.type] || bgColors.info} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
        <span className="text-xl">{icons[alert.type] || icons.info}</span>
        <span>{alert.message}</span>
      </div>
    </div>
  );
}
