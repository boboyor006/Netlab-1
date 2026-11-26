import IpForm from './IpForm.jsx';
import DeviceIcon from '../assets/DeviceIcon.jsx';

export default function IpWindow({ device, commit, onClose, onCli }) {
  return (
    <div className="modalBg" onClick={onClose}>
      <div className="modal" role="dialog" aria-label={`${device.name} IP sozlash`} onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <div className="row"><DeviceIcon type={device.type} size={36} /><h3>{device.name}: IP Configuration</h3></div>
          <button className="btn icon" onClick={onClose} aria-label="IP oynasini yopish">✕</button>
        </div>
        <IpForm device={device} commit={commit} />
        <button className="btn cli" onClick={onCli}>&gt;_ Terminal</button>
      </div>
    </div>
  );
}
