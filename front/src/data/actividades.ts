export interface Actividad {
  slug: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  color: string;
  introduccion: string;
  pasos: { titulo: string; descripcion: string }[];
}

export const actividades: Actividad[] = [
  {
    slug: 'libro-viajero',
    titulo: 'Libro viajero',
    descripcion: 'Aventuras para compartir',
    categoria: 'Lectura en familia',
    color: 'sky',
    introduccion: 'Cada lectura es una aventura para conversar, imaginar y compartir en familia.',
    pasos: [
      { titulo: 'Elijan un cuento', descripcion: 'Busquen una historia que quieran leer juntos.' },
      { titulo: 'Lean en equipo', descripcion: 'Turnen las voces y descubran qué pasa en cada página.' },
      { titulo: 'Compartan la aventura', descripcion: 'Conversen sobre su personaje o momento favorito.' },
    ],
  },
  {
    slug: 'super-capibara',
    titulo: 'Super Capibara',
    descripcion: 'Salud total',
    categoria: 'Misión saludable',
    color: 'orange',
    introduccion: 'Acompaña a Super Capibara en pequeñas misiones para cuidar el cuerpo y sentirse genial.',
    pasos: [
      { titulo: 'Activa tu energía', descripcion: 'Estírate y muévete durante unos minutos.' },
      { titulo: 'Recarga saludable', descripcion: 'Elige agua y una fruta para recuperar energía.' },
      { titulo: 'Descansa como héroe', descripcion: 'Haz una pausa y respira con calma.' },
    ],
  },
  {
    slug: 'kiwi',
    titulo: 'Kiwi',
    descripcion: 'Bienestar emocional',
    categoria: 'Emociones',
    color: 'yellow',
    introduccion: 'Kiwi te invita a reconocer lo que sientes y encontrar una manera amable de expresarlo.',
    pasos: [
      { titulo: 'Ponle nombre a tu emoción', descripcion: '¿Te sientes alegre, tranquilo, preocupado o con energía?' },
      { titulo: 'Haz una pausa', descripcion: 'Respira despacio tres veces y nota cómo se siente tu cuerpo.' },
      { titulo: 'Compártelo', descripcion: 'Cuéntale a alguien de confianza qué necesitas hoy.' },
    ],
  },
  {
    slug: 'jabonoso',
    titulo: 'Jabonoso',
    descripcion: 'Hábitos saludables',
    categoria: 'Higiene y cuidado',
    color: 'coral',
    introduccion: 'Con Jabonoso, las rutinas de cuidado se convierten en pequeños logros de todos los días.',
    pasos: [
      { titulo: 'Manos limpias', descripcion: 'Lávate las manos con agua y jabón antes de comer.' },
      { titulo: 'Sonrisa brillante', descripcion: 'Cepíllate los dientes con calma por la mañana y por la noche.' },
      { titulo: 'Listo para descansar', descripcion: 'Prepara tu rutina de cuidado antes de dormir.' },
    ],
  },
  {
    slug: 'super-z',
    titulo: 'Super Z',
    descripcion: 'Hábitos saludables',
    categoria: 'Alimentación',
    color: 'purple',
    introduccion: 'Super Z ayuda a descubrir alimentos variados y hábitos que dan energía para crecer.',
    pasos: [
      { titulo: 'Prueba nuevos colores', descripcion: 'Incluye frutas o verduras de distintos colores en tu día.' },
      { titulo: 'Toma agua', descripcion: 'Recuerda hidratarte durante tus actividades.' },
      { titulo: 'Come con atención', descripcion: 'Disfruta cada bocado sin afanes.' },
    ],
  },
  {
    slug: 'retos',
    titulo: 'Retos',
    descripcion: 'Juegos para divertirse',
    categoria: 'Juego y movimiento',
    color: 'green',
    introduccion: 'Elige un reto sencillo, invita a alguien y celebren cada intento.',
    pasos: [
      { titulo: 'Reto de movimiento', descripcion: 'Haz una pausa activa: estírate, salta o baila.' },
      { titulo: 'Reto de observación', descripcion: 'Encuentra tres cosas de la naturaleza a tu alrededor.' },
      { titulo: 'Reto en equipo', descripcion: 'Anima a alguien de tu familia a completar un reto contigo.' },
    ],
  },
  {
    slug: 'retos-desafios',
    titulo: 'Retos y desafíos',
    descripcion: 'Supera nuevas pruebas',
    categoria: 'Desafíos',
    color: 'peach',
    introduccion: 'Avanza paso a paso en desafíos para cuidar de ti, aprender y compartir.',
    pasos: [
      { titulo: 'Desafío de agua', descripcion: 'Ten agua cerca y toma pausas para hidratarte.' },
      { titulo: 'Desafío de descanso', descripcion: 'Regálate cinco minutos para respirar y relajarte.' },
      { titulo: 'Desafío amable', descripcion: 'Haz algo amable por ti o por otra persona.' },
    ],
  },
];
