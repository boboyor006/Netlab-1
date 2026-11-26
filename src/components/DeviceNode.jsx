import { Handle, Position } from '@xyflow/react';
import DeviceIcon from '../assets/DeviceIcon.jsx';

export default function DeviceNode({ data, selected }) {
  return (
    <div className={`node ${selected ? 'sel' : ''} ${data.pending ? 'pending' : ''} ${data.power ? '' : 'off'}`}>
      <Handle type="source" position={Position.Top} isConnectable={false} className="center-handle" />
      <Handle type="target" position={Position.Top} isConnectable={false} className="center-handle" />
      <div className="art"><DeviceIcon type={data.type} size={60} /></div>
      <b>{data.name}</b>
    </div>
  );
}
