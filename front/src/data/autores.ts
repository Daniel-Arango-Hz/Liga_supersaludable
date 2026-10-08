export interface Autor {
  slug: string;
  nombre: string;
  bio: string;
  bioCorta: string;
  libros: number;
  descargas: number;
  seguidores: number;
  especialidad: string;
}

export const autores: Autor[] = [
  {
    slug: "ana-martinez",
    nombre: "Ana Martínez",
    bio: "Escritora y maestra cristiana con más de 15 años dedicada a la literatura infantil. Ha publicado más de 12 títulos que han llegado a familias de toda América Latina. Su pasión es que los niños crezcan con una fe sólida desde temprana edad.",
    bioCorta: "Escritora y maestra cristiana con más de 15 años dedicada a la...",
    libros: 12,
    descargas: 4800,
    seguidores: 320,
    especialidad: "Literatura Infantil",
  },
  {
    slug: "carlos-rueda",
    nombre: "Carlos Rueda",
    bio: "Pastor y autor de recursos para familias. Apasionado por fortalecer el hogar cristiano a través de la palabra escrita. Lleva más de 20 años en el ministerio y ha visto cómo los recursos adecuados pueden transformar una familia.",
    bioCorta: "Pastor y autor de recursos para familias. Apasionado por fortalecer...",
    libros: 8,
    descargas: 3200,
    seguidores: 210,
    especialidad: "Vida Familiar y Devoción",
  },
  {
    slug: "maria-soto",
    nombre: "María Soto",
    bio: "Teóloga y docente universitaria. Autora de guías de estudio bíblico utilizadas en iglesias y hogares de toda la región. Su enfoque combina el rigor académico con la accesibilidad para toda la familia.",
    bioCorta: "Teóloga y docente universitaria. Autora de guías de estudio bíblico...",
    libros: 6,
    descargas: 2100,
    seguidores: 180,
    especialidad: "Teología y Estudio Bíblico",
  },
  {
    slug: "david-herrera",
    nombre: "David Herrera",
    bio: "Misionero y escritor. Sus relatos de fe han llegado a miles de familias en más de 10 países. David escribe desde la experiencia del campo misionero, con historias reales de transformación y esperanza.",
    bioCorta: "Misionero y escritor. Sus relatos de fe han llegado a miles de familias e...",
    libros: 5,
    descargas: 1900,
    seguidores: 140,
    especialidad: "Misiones y Apologética",
  },
];
