// Qurilma turlari va portlari (UI'dan mustaqil)
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const fa = (n, from = 0) => range(n, (i) => ({ id: `Fa0/${i + from}`, media: 'copper' }));
const gi = (n) => range(n, (i) => ({ id: `Gi0/${i}`, media: 'copper' }));
const eth = [{ id: 'Eth0', media: 'copper' }];

export const DEVICE_TYPES = {
  router:   { label: 'Router', prefix: 'R', group: 'Tarmoq', ports: [...gi(3), { id: 'Se0/0', media: 'serial' }, { id: 'Se0/1', media: 'serial' }] },
  switch:   { label: 'Switch (L2)', prefix: 'SW', group: 'Tarmoq', ports: [...fa(24, 1), ...range(2, (i) => ({ id: `Gi0/${i + 1}`, media: 'copper' }))] },
  l3switch: { label: 'Switch (L3)', prefix: 'MLS', group: 'Tarmoq', ports: [...fa(24, 1), ...range(2, (i) => ({ id: `Gi0/${i + 1}`, media: 'copper' }))] },
  firewall: { label: 'Firewall', prefix: 'FW', group: 'Tarmoq', ports: fa(8) },
  ap:       { label: 'Access Point', prefix: 'AP', group: 'Tarmoq', ports: eth },
  cloud:    { label: 'Bulut (Cloud)', prefix: 'Cloud', group: 'Tarmoq', ports: [...eth, { id: 'Se0', media: 'serial' }] },
  pc:       { label: 'Kompyuter', prefix: 'PC', group: 'Oxirgi qurilmalar', ports: eth },
  laptop:   { label: 'Noutbuk', prefix: 'Laptop', group: 'Oxirgi qurilmalar', ports: eth },
  server:   { label: 'Server', prefix: 'Server', group: 'Oxirgi qurilmalar', ports: eth },
  phone:    { label: 'IP telefon', prefix: 'Phone', group: 'Oxirgi qurilmalar', ports: eth },
  printer:  { label: 'Printer', prefix: 'Printer', group: 'Oxirgi qurilmalar', ports: eth },
};

export const CABLES = {
  straight: { label: 'To‘g‘ri kabel', media: 'copper' },
  cross:    { label: 'Krossover kabel', media: 'copper' },
  serial:   { label: 'Serial kabel', media: 'serial' },
};
