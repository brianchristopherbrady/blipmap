const SHORTCUTS = [
  { key: "A", label: "Drop a Patch" },
  { key: "M", label: "Measure" },
  { key: "P", label: "Path Check" },
  { key: "L", label: "Locate me" },
  { key: "Enter", label: "Finish drawing" },
  { key: "Esc", label: "Browse / cancel" },
  { key: "?", label: "Toggle shortcuts" },
];

interface ShortcutsModalProps {
  onClose: () => void;
}

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Keyboard shortcuts</h2>
          <button className="modal__close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <ul className="shortcuts-list">
          {SHORTCUTS.map(({ key, label }) => (
            <li key={key} className="shortcuts-list__item">
              <kbd className="shortcuts-list__key">{key}</kbd>
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
