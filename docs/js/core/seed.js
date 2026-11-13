/**
 * MemoVida · Datos de demostración
 * Se crean solo si la base de datos está vacía. Permite usar la app
 * en el primer segundo, con historial real de 7 días para las gráficas.
 */
import { db, insert, update, persist, localDateStr } from './db.js';
import { hashPassword, makeCode } from './auth.js';

const day = (offset = 0) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const iso = (offsetDays, hhmm) => `${day(offsetDays)}T${hhmm}:00.000Z`;

export function seed() {
  if (db.users.length) return false;
  console.log('[seed] Creando datos de demostración…');

  /* ---------- usuarios ---------- */
  const rosa = insert('users', {
    name: 'Rosa Martínez', email: 'rosa@memovida.app', role: 'paciente',
    password: hashPassword('rosa1234'), linkedPatientIds: [], lastSeen: new Date().toISOString()
  });
  const ana = insert('users', {
    name: 'Ana Martínez', email: 'ana@memovida.app', role: 'cuidador',
    password: hashPassword('ana1234'), linkedPatientIds: [], lastSeen: new Date().toISOString()
  });

  /* ---------- paciente ---------- */
  const p = insert('patients', {
    userId: rosa.id,
    name: 'Rosa Martínez', preferredName: 'Rosa',
    birthDate: '1948-03-12', photo: 'img/rosa.jpg',
    phone: '+34 600 123 456', address: 'Calle del Olivo 12, 3ºB · Madrid',
    bloodType: 'A+', allergies: 'Penicilina',
    conditions: 'Alzheimer fase leve-moderada (diagnóstico 2023) · Hipertensión',
    notes: 'Le tranquiliza escuchar música de los años 60 y hablar de su jardín. Evitar discutir sobre fechas: mejor acompañar y redirigir.',
    anchorPhrase: 'Estás en tu casa, en Madrid. Ana viene a verte a las cinco de la tarde.',
    emergencyContacts: [
      { name: 'Ana Martínez', phone: '+34 611 222 333', relation: 'Hija y cuidadora' },
      { name: 'Lucas Martínez', phone: '+34 622 333 444', relation: 'Nieto' },
      { name: 'Dr. Sanz (neurólogo)', phone: '+34 910 555 111', relation: 'Médico' },
      { name: 'Emergencias', phone: '112', relation: 'Urgencias' }
    ],
    home: { enabled: true, lat: 40.4168, lng: -3.7038, radius: 300, label: 'Casa (Madrid centro)' },
    settings: { fontScale: 1, contrast: false, night: false, voice: true, graceMinutes: 20, shareLocation: false },
    tzOffset: 0, code: makeCode(), lastSeen: new Date().toISOString()
  });
  update('users', rosa.id, { patientId: p.id });
  update('users', ana.id, { linkedPatientIds: [p.id] });

  /* ---------- personas ---------- */
  const people = [
    { name: 'Ana', relation: 'Tu hija', phone: '+34 611 222 333', photo: 'img/ana.jpg', description: 'Vive cerca y viene a verte cada tarde a las cinco.', memory: 'Ana te llama todos los domingos por la mañana.' },
    { name: 'Lucas', relation: 'Tu nieto', phone: '+34 622 333 444', photo: 'img/lucas.jpg', description: 'Estudia informática. Le encanta tu tortilla de patatas.', memory: 'Le enseñaste a montar en bici en el parque.' },
    { name: 'Carmen', relation: 'Tu vecina y amiga', phone: '+34 633 444 555', photo: 'img/carmen.jpg', description: 'Vive en el 3ºA. Paseáis juntas los lunes, miércoles y viernes.', memory: 'Os conocéis desde 1985.' },
    { name: 'Nala', relation: 'Tu perra', phone: '', photo: 'img/nala.jpg', description: 'Golden retriever muy tranquila. Duerme a tus pies.', memory: 'Llegó a casa en 2019.' }
  ];
  people.forEach(x => insert('people', { patientId: p.id, ...x }));

  /* ---------- recuerdos ---------- */
  [
    { title: 'Mi boda con Manuel', year: 1971, place: 'Segovia', description: 'Nos casamos en primavera. Llevé un vestido que cosió mi madre y bailamos pasodobles hasta la madrugada.', photo: '', tags: ['familia', 'fiesta'] },
    { title: 'Nació mi hija Ana', year: 1975, place: 'Madrid', description: 'Una niña de pelo negro que lloraba muy fuerte. Manuel no paraba de sonreír.', photo: 'img/ana.jpg', tags: ['familia'] },
    { title: 'La casa de la playa', year: 1988, place: 'Valencia', description: 'Todos los veranos con los niños. Yo hacía paella los domingos para doce personas.', photo: '', tags: ['verano', 'viajes'] },
    { title: 'Nació mi nieto Lucas', year: 2004, place: 'Madrid', description: 'Lo tuve en brazos el primer día. Le cantaba la misma nana que a su madre.', photo: 'img/lucas.jpg', tags: ['familia'] },
    { title: 'Mi jubilación', year: 2010, place: 'Colegio San Juan', description: 'Treinta años enseñando a leer a niños de seis. Me regalaron un álbum con dibujos de todos.', photo: '', tags: ['trabajo'] },
    { title: 'Llegó Nala a casa', year: 2019, place: 'Madrid', description: 'Una bola de pelo dorada que se durmió en mi regazo el primer día.', photo: 'img/nala.jpg', tags: ['mascota'] }
  ].forEach(x => insert('memories', { patientId: p.id, ...x }));

  /* ---------- recordatorios ---------- */
  const reminders = [
    { title: 'Pastilla de la memoria', type: 'medicacion', dose: 'Donepezilo 10 mg · 1 comprimido', notes: 'Tomar con el desayuno y un vaso de agua.', times: ['09:00'], days: [0, 1, 2, 3, 4, 5, 6], icon: 'pill' },
    { title: 'Pastilla de la tensión', type: 'medicacion', dose: 'Enalapril 5 mg · 1 comprimido', notes: 'Después de comer.', times: ['14:30'], days: [0, 1, 2, 3, 4, 5, 6], icon: 'heart' },
    { title: 'Beber un vaso de agua', type: 'actividad', dose: '', notes: 'Es importante beber aunque no tengas sed.', times: ['11:00', '17:00'], days: [0, 1, 2, 3, 4, 5, 6], icon: 'droplet' },
    { title: 'Paseo con Carmen', type: 'actividad', dose: '', notes: 'Ella te espera en el portal.', times: ['12:00'], days: [1, 3, 5], icon: 'walk' },
    { title: 'Ana viene a verte', type: 'cita', dose: '', notes: 'Trae la compra y se queda a cenar.', times: ['17:00'], days: [0, 1, 2, 3, 4, 5, 6], icon: 'home' },
    { title: 'Pastilla para dormir', type: 'medicacion', dose: 'Memantina 10 mg · 1 comprimido', notes: 'Antes de acostarte.', times: ['21:30'], days: [0, 1, 2, 3, 4, 5, 6], icon: 'moon' }
  ].map(r => {
    const row = insert('reminders', { patientId: p.id, active: true, startDate: null, ...r });
    return update('reminders', row.id, { createdAt: iso(-14, '08:00') });
  });

  /* ---------- rutinas ---------- */
  [
    {
      title: 'Por la mañana', period: 'mañana', steps: [
        { id: 'm1', label: 'Abrir la ventana y saludar al día', icon: 'sunrise' },
        { id: 'm2', label: 'Lavarme la cara y los dientes', icon: 'toothbrush' },
        { id: 'm3', label: 'Vestirme con la ropa de la silla', icon: 'shirt' },
        { id: 'm4', label: 'Desayunar tostada con café', icon: 'coffee' },
        { id: 'm5', label: 'Tomar la pastilla de la memoria', icon: 'pill' },
        { id: 'm6', label: 'Dar de comer a Nala', icon: 'dog' }
      ]
    },
    {
      title: 'Por la tarde', period: 'tarde', steps: [
        { id: 't1', label: 'Comer y descansar un rato', icon: 'utensils' },
        { id: 't2', label: 'Beber un vaso de agua', icon: 'droplet' },
        { id: 't3', label: 'Ejercitar la mente con un juego', icon: 'brain' },
        { id: 't4', label: 'Regar las plantas del balcón', icon: 'plant' }
      ]
    },
    {
      title: 'Por la noche', period: 'noche', steps: [
        { id: 'n1', label: 'Cenar algo ligero', icon: 'bowl' },
        { id: 'n2', label: 'Ponerme el pijama', icon: 'bed' },
        { id: 'n3', label: 'Tomar la pastilla para dormir', icon: 'moon' },
        { id: 'n4', label: 'Cerrar la puerta con llave', icon: 'lock' }
      ]
    }
  ].forEach(r => insert('routines', { patientId: p.id, ...r }));

  /* ---------- historial de 7 días ---------- */
  for (let i = 7; i >= 1; i--) {
    const date = day(-i);
    const wd = new Date(date + 'T12:00:00Z').getUTCDay();
    for (const r of reminders) {
      if (!r.days.includes(wd)) continue;
      for (const t of r.times) {
        const roll = (i * 7 + t.charCodeAt(0) + r.title.length) % 10;
        const status = roll < 8 ? 'tomada' : (roll === 8 ? 'omitida' : 'tomada');
        insert('doseLogs', {
          patientId: p.id, reminderId: r.id, reminderTitle: r.title,
          date, time: t, status, at: iso(-i, t), by: 'Rosa', snoozeUntil: null
        });
      }
    }
    insert('moods', {
      patientId: p.id, date, value: [4, 3, 5, 4, 2, 4, 5][7 - i] || 4,
      note: ['', 'Un poco despistada por la mañana', '', 'Muy contenta con la visita de Lucas', 'Dormí mal', '', ''][7 - i] || '',
      at: iso(-i, '20:00')
    });
    const games = ['parejas', 'caras', 'refranes', 'numeros', 'secuencia', 'orden'];
    const g = games[i % games.length];
    insert('gameScores', {
      patientId: p.id, game: g, level: (i % 3) + 1,
      score: 55 + ((i * 13) % 40), correct: 6, total: 8,
      durationMs: 120000 + i * 15000, date, at: iso(-i, '16:30')
    });
    if (i % 2 === 0) insert('gameScores', {
      patientId: p.id, game: games[(i + 3) % games.length], level: 1,
      score: 60 + ((i * 7) % 35), correct: 5, total: 7,
      durationMs: 95000, date, at: iso(-i, '18:10')
    });
  }

  /* ---------- notas del cuidador ---------- */
  [
    { category: 'sueño', text: 'Se despertó dos veces. Le ayudó dejar la luz del pasillo encendida.', at: iso(-5, '09:10') },
    { category: 'ánimo', text: 'Muy bien después del paseo con Carmen. Se rio mucho recordando lo del autobús.', at: iso(-3, '19:40') },
    { category: 'médica', text: 'El Dr. Sanz revisa la dosis de donepezilo el próximo mes. Traer el informe de adherencia.', at: iso(-2, '11:00') },
    { category: 'conducta', text: 'Al atardecer preguntó varias veces por su madre. Funcionó poner música y mirar el álbum de fotos.', at: iso(-1, '20:15') }
  ].forEach(n => insert('notes', { patientId: p.id, authorId: ana.id, authorName: 'Ana Martínez', ...n }));

  /* ---------- alerta ya atendida (ejemplo en el panel) ---------- */
  insert('alerts', {
    patientId: p.id, type: 'dosis', status: 'resuelta',
    message: 'Sin confirmar: "Pastilla para dormir" de las 21:30.',
    at: iso(-2, '21:55'), resolvedAt: iso(-2, '22:10'), resolvedBy: 'Ana Martínez',
    response: 'Llamé por teléfono y la tomó conmigo.'
  });

  persist();
  console.log('[seed] Listo. Paciente rosa@memovida.app / rosa1234 · Cuidadora ana@memovida.app / ana1234');
  console.log('[seed] Código de vinculación de Rosa:', p.code);
  return true;
}
