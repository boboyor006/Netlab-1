import { LESSON } from '../engine/lesson.js';
export default function Guide() {
  return (
    <main className="page guide">
      <h2>Qo‘llanma</h2>
      <div className="card">
        <h3>Qurilma qo‘shish</h3>
        <p>Chap paneldan qurilmani bosing yoki ish maydoniga sudrab olib boring. Telefonda “Qurilmalar” tugmasini bosing.</p>
        <h3>Kabel ulash</h3>
        <p>1) Kabel turini tanlang. 2) Birinchi qurilmani bosib portni tanlang. 3) Ikkinchi qurilmani bosib portni tanlang. Bekor qilish: Esc.</p>
        <h3>Qaysi kabel?</h3>
        <p>Switch tomoni (switch, access point, cloud) bilan boshqa qurilma orasiga to‘g‘ri kabel. Bir xil tomondagi ikki qurilma orasiga (PC–PC, switch–switch, router–PC) krossover. Serial portlar uchun serial kabel.</p>
        <h3>Router</h3>
        <p>Router portlari boshida o‘chiq. Routerni tanlab, o‘ng panelda kerakli portni yoqing.</p>
        <h3>Klaviatura</h3>
        <p><kbd>Delete</kbd> o‘chirish · <kbd>Ctrl+Z</kbd> bekor qilish · <kbd>Ctrl+Y</kbd> qaytarish · <kbd>Esc</kbd> bekor qilish</p>
      </div>
      <div className="card">
        <h3>Mashq</h3>
        <p>Router, switch va 2 ta kompyuter qo‘shing. Hammasini to‘g‘ri kabel bilan switchga ulang, routerning ulangan portini yoqing. Barcha nuqtalar yashil bo‘lsa, mashq bajarildi.</p>
      </div>
      <div className="card">
        <h3>IP berish (oynadan)</h3>
        <p>Kompyuter yoki serverni ikki marta bosing. Router va switchda qurilmani bir marta bosib, “IP sozlash” tugmasini bosing. IP manzil yozilganda subnet mask o‘zi chiqadi, kerak bo‘lsa uni o‘zgartiring.</p>
        <h3>CLI ni ochish</h3>
        <p>Router yoki switchni ikki marta bosing yoki tepadagi “Terminal” tugmasini bosing. Tab — buyruqni to‘ldiradi, ? — yordam, cls — ekranni tozalaydi.</p>
        <h3>Router portiga IP</h3>
        <pre className="code">{`enable
configure terminal
interface g0/0
ip address 192.168.1.1 255.255.255.0
no shutdown
end
show ip interface brief`}</pre>
        <h3>Switch: VLAN va switchport</h3>
        <pre className="code">{`enable
configure terminal
vlan 10
name Ofis
interface range fa0/1 - 2
switchport mode access
switchport access vlan 10
interface g0/1
switchport mode trunk
end
show vlan brief`}</pre>
        <h3>Kompyuter</h3>
        <pre className="code">{`ip 192.168.1.10 255.255.255.0 192.168.1.1
ipconfig
ping 192.168.1.1`}</pre>
      </div>
      <div className="card">
        <h3>To‘liq mashq: barcha buyruqlar ketma-ket</h3>
        <pre className="code">{LESSON}</pre>
      </div>
      <p className="note">Simulation rejimi, DHCP, DNS, STP, RIP, OSPF, NAT, ACL va Wi-Fi hali qo‘shilmagan.</p>
    </main>
  );
}
