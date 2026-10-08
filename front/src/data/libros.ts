export interface PaginaLibro {
  numero: number;
  titulo?: string;
  contenido: string;
}

export interface Libro {
  slug: string;
  titulo: string;
  autor: string;
  autorSlug: string;
  categorias: string[];
  edadRango: string;
  rating: number;
  votos: number;
  descargas: number;
  destacado?: boolean;
  nuevo?: boolean;
  descripcion: string;
  paginas: number;
  anio: number;
  portadaGradiente: string;
  portadaIcono: string;
  familiaInfo?: string;
  likes?: number;
  vistas?: number;
  paginasContenido: PaginaLibro[];
}

export const libros: Libro[] = [
  {
    slug: "el-jardin-de-la-fe",
    titulo: "El Jardín de la Fe",
    autor: "Ana Martínez",
    autorSlug: "ana-martinez",
    categorias: ["Cuentos Infantiles", "Fe y Valores"],
    edadRango: "4-6 años",
    rating: 4.8,
    votos: 124,
    descargas: 1240,
    destacado: true,
    nuevo: true,
    descripcion:
      "Un cuento ilustrado que lleva a los más pequeños a descubrir la fe a través de los colores y las flores de un jardín mágico. Ideal para leer en familia antes de dormir.",
    paginas: 48,
    anio: 2024,
    portadaGradiente: "linear-gradient(135deg, #4CAF50 0%, #81C784 50%, #A5D6A7 100%)",
    portadaIcono: "🌸",
    paginasContenido: [
      {
        numero: 1,
        titulo: "El comienzo del jardín",
        contenido: `Había una vez, en un lugar muy lejano pero cercano al corazón, un jardín especial. No era un jardín cualquiera: sus flores brillaban con una luz suave y cálida, como si guardaran un secreto dentro de cada pétalo.\n\nLa pequeña Sofía lo encontró un domingo por la mañana, cuando seguía a una mariposa dorada entre los árboles.\n\n—¿Qué lugar es este? —preguntó Sofía, abriendo muy grandes sus ojos azules.\n\nUna flor grande y rosada se inclinó hacia ella y susurró:\n\n—Este es el Jardín de la Fe. Solo pueden verlo quienes creen.`,
      },
      {
        numero: 2,
        titulo: "Las flores que hablan",
        contenido: `Sofía caminó despacio entre las flores. Había rosas blancas que olían a esperanza, margaritas amarillas que reían con el viento, y girasoles altísimos que siempre miraban hacia arriba.\n\n—¿Por qué siempre miran hacia arriba? —preguntó Sofía al girasol más grande.\n\n—Porque donde hay luz, siempre hay amor —respondió el girasol con voz grave y amable—. Y nosotros buscamos el amor cada día.\n\nSofía sonrió. Ella también quería aprender a buscar la luz cada mañana.`,
      },
      {
        numero: 3,
        titulo: "La semilla pequeña",
        contenido: `En el centro del jardín, Sofía encontró una semilla muy pequeña, casi invisible, enterrada en la tierra oscura.\n\n—¿Esta semilla puede convertirse en algo hermoso? —preguntó con duda.\n\nUna voz suave respondió desde el cielo:\n\n—La fe es como esa semilla. Aunque sea pequeña, si la cuidas con amor, puede convertirse en el árbol más grande del jardín.\n\nSofía tomó la semilla con cuidado y la plantó junto a las rosas. Todos los días la regó con paciencia y con amor. Y un buen día... brotó.`,
      },
      {
        numero: 4,
        titulo: "El regalo del jardín",
        contenido: `Cuando el árbol de Sofía creció, sus ramas daban sombra fresca a todas las flores. Los pájaros venían a cantar en él. Y otros niños que pasaban por ahí comenzaban a ver el jardín también.\n\n—¿Cómo lo lograste? —le preguntaban.\n\n—Con fe —respondía Sofía—. Solo necesitas creer, aunque al principio no puedas ver nada.\n\nY así, el Jardín de la Fe fue creciendo, flor por flor, niño por niño, corazón por corazón. Porque la fe, cuando se comparte, nunca se acaba.`,
      },
    ],
  },
  {
    slug: "devocionales-para-el-hogar",
    titulo: "Devocionales para el Hogar",
    autor: "Carlos Rueda",
    autorSlug: "carlos-rueda",
    categorias: ["Devoción", "Familia"],
    edadRango: "Adultos",
    rating: 4.9,
    votos: 89,
    descargas: 2100,
    destacado: true,
    nuevo: true,
    descripcion:
      "365 devocionales cortos diseñados para leer en familia cada mañana. Reflexiones bíblicas con aplicaciones prácticas para fortalecer la vida espiritual del hogar.",
    paginas: 380,
    anio: 2024,
    portadaGradiente: "linear-gradient(135deg, #1565C0 0%, #1976D2 50%, #42A5F5 100%)",
    portadaIcono: "🏠",
    paginasContenido: [
      {
        numero: 1,
        titulo: "Día 1 – El fundamento del hogar",
        contenido: `"Si el Señor no edifica la casa, en vano se esfuerzan los que la edifican." — Salmo 127:1\n\n**Reflexión:**\nHay una tentación constante de construir nuestra vida familiar sobre nuestras propias fuerzas, planes y estrategias. Trabajamos arduamente, organizamos todo con cuidado, y aun así sentimos que algo falta.\n\nDios no quiere ser un invitado en tu hogar. Quiere ser el arquitecto.\n\n**Para hoy:**\nToma un momento en familia para agradecer por el hogar que tienen, por imperfecto que parezca. Un hogar donde se busca a Dios es ya un hogar bendecido.\n\n**Oración:**\nSeñor, te pedimos que seas Tú quien construya nuestra familia. Que cada decisión, cada conversación, cada abrazo, esté lleno de tu presencia. Amén.`,
      },
      {
        numero: 2,
        titulo: "Día 2 – Amor que se elige cada día",
        contenido: `"Maridos, amad a vuestras mujeres, así como Cristo amó a la iglesia." — Efesios 5:25\n\n**Reflexión:**\nEl amor romántico de las películas surge de repente y parece no necesitar esfuerzo. Pero el amor bíblico es diferente: es una decisión diaria, una elección consciente de poner al otro primero.\n\nAmar como Cristo amó a la iglesia es un llamado alto. Significa dar, servir, sacrificar sin esperar nada a cambio.\n\n**Para hoy:**\nHaz algo concreto hoy por tu cónyuge o familiar que demuestre amor sin esperar reconocimiento. Puede ser algo pequeño: preparar su bebida favorita, escucharle sin interrumpir, escribirle una nota.\n\n**Oración:**\nDios, enséñanos a amarnos como Tú nos amas. Que nuestro amor no dependa de emociones cambiantes, sino de una decisión firme renovada cada mañana. Amén.`,
      },
      {
        numero: 3,
        titulo: "Día 3 – Palabras que construyen",
        contenido: `"Ninguna palabra corrompida salga de vuestra boca, sino la que sea buena para la necesaria edificación." — Efesios 4:29\n\n**Reflexión:**\nLas palabras tienen un poder enorme. Pueden construir o destruir, sanar o herir, dar vida o quitar esperanza. En el hogar, donde estamos más relajados y menos "en guardia", a veces dejamos salir palabras que nunca diríamos fuera de casa.\n\nDios nos llama a que incluso en la intimidad familiar, nuestras palabras sean edificantes.\n\n**Para hoy:**\nAntes de hablar hoy, hazte esta pregunta: ¿Lo que voy a decir construye o destruye? Practica el silencio cuando la respuesta no sea positiva.\n\n**Oración:**\nSeñor, pon guarda a mi boca. Que mis palabras sean medicina y no veneno para los que más amo. Amén.`,
      },
    ],
  },
  {
    slug: "historias-de-valentia-biblica",
    titulo: "Historias de Valentía Bíblica",
    autor: "María Soto",
    autorSlug: "maria-soto",
    categorias: ["Biblia", "Jóvenes"],
    edadRango: "11-14 años",
    rating: 4.7,
    votos: 67,
    descargas: 980,
    destacado: true,
    nuevo: true,
    descripcion:
      "Relatos bíblicos narrados con dinamismo para adolescentes. Cada historia explora el valor, la fe y el carácter de personajes como David, Ester, Daniel y muchos más.",
    paginas: 220,
    anio: 2024,
    portadaGradiente: "linear-gradient(135deg, #B71C1C 0%, #C62828 50%, #EF9A9A 100%)",
    portadaIcono: "⚔️",
    paginasContenido: [
      {
        numero: 1,
        titulo: "David: El pastor que venció gigantes",
        contenido: `El campamento israelita olía a miedo.\n\nDesde hacía cuarenta días, Goliat —el guerrero filisteo de casi tres metros— salía cada mañana y cada tarde a desafiar al ejército de Israel. Su voz retumbaba como trueno en el valle.\n\n—¡Escojan a un hombre que pelee conmigo! ¡Si me vence, seremos sus siervos; si yo lo venzo, ustedes serán los nuestros!\n\nNadie se movía. Ni el rey Saúl, ni sus capitanes, ni los soldados más experimentados.\n\nDavid tenía apenas dieciséis años cuando llegó al campamento a llevarles comida a sus hermanos. Escuchó el desafío y algo se encendió en su interior.\n\n—¿Quién es este filisteo incircunciso para desafiar a los ejércitos del Dios viviente?\n\nSus hermanos se rieron de él. "Eres muy joven. Vete a cuidar tus ovejas."\n\nPero David no se fue.`,
      },
      {
        numero: 2,
        titulo: "David contra Goliat",
        contenido: `Cuando David se presentó ante el rey Saúl y dijo que quería pelear contra Goliat, el rey lo miró de arriba abajo.\n\n—Tú eres apenas un muchacho, y él lleva años en la guerra.\n\n—Señor —respondió David—, cuando cuidaba las ovejas de mi padre, venía un león y un oso y se llevaban una oveja del rebaño. Yo los perseguía, los golpeaba y rescataba la oveja. Al que me atacaba a mí, yo lo agarraba por el cuello y lo mataba. El Señor, que me libró de las garras del león y del oso, también me librará de este filisteo.\n\nSaúl no tenía argumentos. Le prestó su armadura. Pero David se la quitó: no estaba acostumbrado a ella.\n\nTomó su cayado, cinco piedras lisas del arroyo, y su honda. Y avanzó hacia el gigante.`,
      },
      {
        numero: 3,
        titulo: "La piedra y la fe",
        contenido: `Goliat vio venir al muchacho y se burló.\n\n—¿Soy yo un perro para que vengas a mí con palos? ¡Ven acá y daré tu carne a las aves del cielo!\n\nDavid no retrocedió. Respondió con una seguridad que no venía de su tamaño ni de su fuerza:\n\n—Tú vienes a mí con espada, lanza y jabalina. Pero yo vengo a ti en el nombre del Señor de los ejércitos, el Dios de Israel, a quien has desafiado. Este día el Señor te entregará en mi mano... para que toda la tierra sepa que hay un Dios en Israel.\n\nMetió la mano en su bolsa, tomó una piedra, la puso en su honda, la hizo girar... y la lanzó.\n\nLa piedra hundió en la frente de Goliat. El gigante cayó de cara al suelo.\n\nEl ejército filisteo huyó. Y todo Israel aprendió ese día que las batallas no se ganan con el tamaño del guerrero, sino con el tamaño de la fe.`,
      },
    ],
  },
  {
    slug: "construyendo-el-matrimonio",
    titulo: "Construyendo el Matrimonio",
    autor: "Carlos Rueda",
    autorSlug: "carlos-rueda",
    categorias: ["Matrimonio", "Familia"],
    edadRango: "Adultos",
    rating: 4.8,
    votos: 72,
    descargas: 1100,
    destacado: true,
    descripcion:
      "Una guía práctica para parejas que desean construir un matrimonio sólido sobre principios bíblicos. Incluye reflexiones, preguntas de pareja y planes de acción semanales.",
    paginas: 290,
    anio: 2023,
    portadaGradiente: "linear-gradient(135deg, #880E4F 0%, #AD1457 50%, #F48FB1 100%)",
    portadaIcono: "💍",
    paginasContenido: [
      {
        numero: 1,
        titulo: "Capítulo 1 – Dos proyectos, un destino",
        contenido: `Cuando dos personas se casan, no se unen dos individuos: se unen dos historias, dos familias, dos formas de entender el mundo.\n\nEsa es la maravilla y el desafío del matrimonio.\n\nMuchas parejas llegan al altar convencidas de que el amor que sienten es suficiente. Y lo es... por un tiempo. Pero el amor romántico, sin raíces profundas, se marchita cuando llegan las tormentas: la presión económica, el agotamiento con los hijos, las diferencias de carácter, las heridas del pasado.\n\nLa buena noticia es que el matrimonio cristiano no fue diseñado para sostenerse solo con emoción. Fue diseñado para sostenerse sobre algo mucho más sólido: el compromiso, la gracia mutua, y la presencia de Dios en el centro del hogar.`,
      },
      {
        numero: 2,
        titulo: "Las cinco etapas del matrimonio",
        contenido: `Todo matrimonio pasa por etapas. Conocerlas no evita el dolor, pero sí evita la desesperación de pensar que "algo está muy mal" cuando en realidad estás viviendo algo completamente normal.\n\n**Etapa 1 – El enamoramiento (0–2 años)**\nTodo es nuevo, emocionante. Las diferencias parecen encantadoras. La química lo cubre todo.\n\n**Etapa 2 – El desencanto (2–5 años)**\nLas expectativas chocan con la realidad. Aparecen los primeros conflictos reales.\n\n**Etapa 3 – La decisión (variable)**\nLa pareja decide conscientemente: luchar por el matrimonio o alejarse. Esta es la etapa más crítica.\n\n**Etapa 4 – La construcción (5–15 años)**\nSe aprende a negociar, a perdonar, a crecer juntos.\n\n**Etapa 5 – La celebración**\nEl fruto de años de trabajo conjunto: una intimidad profunda y duradera.`,
      },
    ],
  },
  {
    slug: "oraciones-que-mueven-montanas",
    titulo: "Oraciones que Mueven Montañas",
    autor: "David Herrera",
    autorSlug: "david-herrera",
    categorias: ["Oración"],
    edadRango: "Adultos",
    rating: 4.6,
    votos: 55,
    descargas: 760,
    nuevo: true,
    descripcion:
      "Una colección de oraciones poderosas para cada área de la vida familiar: la salud, la provisión, la protección y la unidad. Con versículos bíblicos de respaldo.",
    paginas: 160,
    anio: 2024,
    portadaGradiente: "linear-gradient(135deg, #E65100 0%, #F57C00 50%, #FFCC80 100%)",
    portadaIcono: "🙏",
    paginasContenido: [
      {
        numero: 1,
        titulo: "Introducción – El poder de la oración en familia",
        contenido: `"Pedid, y se os dará; buscad, y hallaréis; llamad, y se os abrirá." — Mateo 7:7\n\nLa oración es el oxígeno del alma. Y cuando una familia ora junta, algo extraordinario sucede: se crea un lazo que ninguna circunstancia puede romper fácilmente.\n\nEste libro nació de años de ministerio familiar. He visto matrimonios restaurados a través de la oración. He visto hijos pródigos volver al hogar. He visto enfermedades sanar, deudas cancelarse, y corazones endurecidos ablandarse.\n\nNo te prometo que la oración es una fórmula mágica. Te prometo algo mejor: que la oración te conecta con Aquel que tiene el poder de mover montañas.\n\nEmpieza hoy. No necesitas palabras perfectas. Solo necesitas un corazón honesto.`,
      },
      {
        numero: 2,
        titulo: "Oración por la unidad familiar",
        contenido: `**Versículo:** "Mirad cuán bueno y cuán delicioso es habitar los hermanos juntos en armonía." — Salmo 133:1\n\n**Oración:**\n\nPadre celestial,\n\nTe damos gracias por el regalo de nuestra familia. Reconocemos que somos personas diferentes, con caracteres distintos, con heridas propias, con sueños únicos. Y a veces esas diferencias nos separan más de lo que nos unen.\n\nHoy te pedimos que seas Tú el hilo que nos mantiene juntos. Que cuando haya desacuerdo, haya también disposición para escuchar. Que cuando haya herida, haya también valentía para pedir perdón.\n\nQue nuestra casa sea un lugar donde cada miembro se sienta amado, aceptado y seguro. Un lugar donde nadie tenga que pretender ser alguien que no es.\n\nÚnenos, Señor. Lo que Tú unes, nada lo puede separar.\n\nEn el nombre de Jesús, amén.`,
      },
    ],
  },
  {
    slug: "cuentos-de-la-biblia-para-ninos",
    titulo: "Cuentos de la Biblia para Niños",
    autor: "Ana Martínez",
    autorSlug: "ana-martinez",
    categorias: ["Cuentos Infantiles", "Biblia"],
    edadRango: "4-8 años",
    rating: 4.9,
    votos: 143,
    descargas: 3200,
    descripcion:
      "Los relatos más queridos de la Biblia adaptados para los más pequeños con lenguaje sencillo y actividades para colorear. Un tesoro para cada familia cristiana.",
    paginas: 120,
    anio: 2023,
    portadaGradiente: "linear-gradient(135deg, #F9A825 0%, #FBC02D 50%, #FFF176 100%)",
    portadaIcono: "⭐",
    paginasContenido: [
      {
        numero: 1,
        titulo: "Noé y el gran barco",
        contenido: `Hace mucho, mucho tiempo, vivía un hombre muy bueno llamado Noé. Noé amaba a Dios con todo su corazón y siempre hacía lo correcto.\n\nUn día, Dios le habló:\n—Noé, voy a hacer llover mucho. Necesito que construyas un barco grandísimo. Muy, muy grande.\n—¿Un barco? ¿Aquí? —preguntó Noé. No había mar cerca.\n—Sí —dijo Dios—. Confía en mí.\n\nNoé no preguntó más. Comenzó a trabajar.\n\nSus vecinos se reían de él: "¿Para qué construyes un barco en tierra seca?"\n\nPero Noé seguía trabajando. Toc, toc, toc. Un clavo más. Una tabla más.\n\nCuando el barco estuvo listo, Dios le dijo: "Mete a tu familia y a dos animales de cada especie."\n\nY así lo hizo. Entraron elefantes y jirafas, leones y palomas, ratones y ballenas.\n\nLuego comenzó a llover. Y llovió, y llovió, y llovió...\n\n¿Qué pasó después? ¡Pasa la página!`,
      },
    ],
  },
  {
    slug: "guia-de-estudio-biblica-familiar",
    titulo: "Guía de Estudio Bíblico Familiar",
    autor: "María Soto",
    autorSlug: "maria-soto",
    categorias: ["Estudio Bíblico", "Familia"],
    edadRango: "Adultos",
    rating: 4.7,
    votos: 38,
    descargas: 650,
    descripcion:
      "Un recurso completo para guiar el estudio bíblico en el hogar. Incluye planes de lectura, preguntas de reflexión y actividades para todas las edades.",
    paginas: 340,
    anio: 2023,
    portadaGradiente: "linear-gradient(135deg, #1B5E20 0%, #2E7D32 50%, #A5D6A7 100%)",
    portadaIcono: "📖",
    paginasContenido: [
      {
        numero: 1,
        titulo: "Cómo usar esta guía",
        contenido: `Esta guía está diseñada para ser flexible. Puedes usarla de varias maneras:\n\n**Opción 1 – Estudio semanal en familia**\nDedica 30–45 minutos cada semana para reunirse como familia, leer el pasaje bíblico asignado y responder las preguntas de reflexión juntos.\n\n**Opción 2 – Devocional diario personal**\nUsa una pregunta por día como punto de partida para tu tiempo personal con Dios.\n\n**Opción 3 – Grupo pequeño**\nLa guía funciona perfectamente para grupos de 3 a 8 personas que quieran estudiar la Biblia juntos.\n\n**Estructura de cada estudio:**\n1. Pasaje bíblico del día\n2. Contexto histórico (breve)\n3. Preguntas de observación: ¿Qué dice el texto?\n4. Preguntas de interpretación: ¿Qué significa?\n5. Preguntas de aplicación: ¿Qué cambio necesito hacer?\n6. Oración de cierre\n\nRecuerda: el objetivo no es terminar el libro. Es conocer mejor a Dios.`,
      },
    ],
  },
  {
    slug: "fe-y-ciencia-para-jovenes",
    titulo: "Fe y Ciencia para Jóvenes",
    autor: "David Herrera",
    autorSlug: "david-herrera",
    categorias: ["Jóvenes", "Apologética"],
    edadRango: "15-18 años",
    rating: 4.5,
    votos: 29,
    descargas: 480,
    descripcion:
      "Respuestas bíblicas y científicas a las preguntas más desafiantes de la fe moderna. Escrito para jóvenes que desean integrar su fe con el conocimiento contemporáneo.",
    paginas: 195,
    anio: 2022,
    portadaGradiente: "linear-gradient(135deg, #4527A0 0%, #5E35B1 50%, #B39DDB 100%)",
    portadaIcono: "🔭",
    paginasContenido: [
      {
        numero: 1,
        titulo: "¿Puede un científico creer en Dios?",
        contenido: `Es la pregunta que muchos jóvenes se hacen cuando entran a la universidad o cuando un amigo los desafía:\n\n*"Si eres inteligente, ¿cómo puedes creer en Dios?"*\n\nLa premisa es equivocada. La inteligencia y la fe no son enemigos.\n\nAlgunos de los científicos más brillantes de la historia fueron creyentes profundos:\n\n**Isaac Newton** escribió más sobre teología que sobre física. Decía que el universo era demasiado complejo para haber surgido por accidente.\n\n**Georges Lemaître**, el sacerdote belga que propuso la teoría del Big Bang, veía su trabajo científico como una forma de entender la mente de Dios.\n\n**Francis Collins**, director del Proyecto Genoma Humano, escribió un libro entero sobre cómo el estudio del ADN lo llevó a la fe.\n\nLa ciencia responde al *cómo*. La fe responde al *por qué*. No compiten: se complementan.`,
      },
    ],
  },
  {
    slug: "david-y-goliat",
    titulo: "David y Goliat",
    autor: "user prueba QA2",
    autorSlug: "user prueba-QA2",
    categorias: ["Cuentos Infantiles", "Biblia"],
    edadRango: "5-8 años",
    rating: 4.0,
    votos: 2,
    descargas: 14,
    destacado: true,
    descripcion: "Historia ilustrada para niños.",
    paginas: 24,
    anio: 2026,
    portadaGradiente: "linear-gradient(135deg, #FF6B6B 0%, #FF8E72 50%, #FFA07A 100%)",
    portadaIcono: "📖",
    paginasContenido: [
      {
        numero: 1,
        titulo: "Introducción",
        contenido: `**David y Goliat**\n\nEsta es una de las historias más famosas de la Biblia. Una historia de valentía, fe y confianza en Dios.\n\nEn los tiempos antiguos, dos pueblos se enfrentaban en batalla: los israelitas y los filisteos. Los filisteos tenían un guerrero muy grande y fuerte llamado Goliat, que parecía invencible.\n\nPero había un joven llamado David que confiaba en que Dios podía ayudarlo.\n\nAcompáñanos en esta aventura de fe y coraje.`,
      },
      {
        numero: 2,
        titulo: "El Desafío",
        contenido: `Goliat era un gigante aterrador. Medía más de tres metros de altura y usaba una armadura pesada de bronce. Su lanza era enorme, como un tronco de árbol.\n\nTodos los días, Goliat se paraba en el medio del campo de batalla y gritaba:\n\n—¡Envíen a su mejor guerrero! ¡Yo solo acabaré con todo su ejército!\n\nLos soldados israelitas temblaban de miedo. Nadie se atrevía a enfrentar a Goliat.\n\nPero entonces llegó David, un joven pastor que traía comida para sus hermanos.`,
      },
      {
        numero: 3,
        titulo: "La Valentía de David",
        contenido: `Cuando David vio a Goliat burlándose del pueblo de Dios, sintió algo fuerte en su corazón.\n\n—¿Por qué todos tienen miedo? —preguntó David.\n\n—Porque Goliat es muy grande y muy fuerte —respondieron.\n\nDavid sonrió y dijo:\n\n—Pero yo confío en Dios. Él me ha ayudado a vencer a leones y osos. También me ayudará a vencer a Goliat.\n\nDavid se presentó ante el rey Saúl y le dijo que él lucharía contra el gigante.\n\nEl rey pensó que David estaba loco, pero decidió dejarlo intentar.`,
      },
      {
        numero: 4,
        titulo: "La Batalla",
        contenido: `David no quiso usar una armadura pesada como otros guerreros. En su lugar, tomó su honda (un arma simple que usaba para cuidar ovejas) y cinco piedras lisas del río.\n\nCuando Goliat vio a David, soltó una carcajada:\n\n—¡Jajajaja! ¿Envías a un niño? ¡Seré tu perdición!\n\nPero David le respondió con confianza:\n\n—Goliat, tú vienes armado con lanza y espada. Pero yo vengo en el nombre del Dios viviente. Hoy aprenderás que Dios salva a su pueblo.\n\nDavid corrió hacia adelante, puso una piedra en su honda, la giró con fuerza y... ¡ZAS! La piedra voló por el aire directamente hacia Goliat.`,
      },
      {
        numero: 5,
        titulo: "La Victoria",
        contenido: `¡CRASH! La piedra golpeó la frente de Goliat con tanta fuerza que el gigante cayó al suelo con un estruendo tremendo.\n\nTodo el ejército filisteo quedó en silencio. ¿Había pasado de verdad? ¿Su invencible Goliat había sido derrotado por un joven?\n\nSí, así fue.\n\nEl pueblo de Israel celebró con alegría. David no solo ganó la batalla, sino que mostró a todos que la verdadera fuerza no viene del tamaño de nuestro cuerpo o nuestras armas...\n\nSino de la fe en Dios.`,
      },
      {
        numero: 6,
        titulo: "Reflexión Final",
        contenido: `**¿Qué aprendemos de David?**\n\n1. **La fe es más fuerte que el miedo** - David confió en Dios aunque Goliat era más grande.\n\n2. **No importa tu edad o tamaño** - David era joven, pero su coraje era enorme.\n\n3. **Dios siempre está con nosotros** - Cuando creemos en Él, no estamos solos.\n\n4. **La confianza en Dios nos da victoria** - No fue la piedra la que venció a Goliat, fue la fe.\n\nCuando enfrentes problemas grandes en tu vida, recuerda a David. ¡Tú también puedes vencer tus \"Goliats\" con fe en Dios!\n\n**Fin**`,
      },
    ],
  },
];

export const categorias = [
  "Cuentos Infantiles",
  "Fe y Valores",
  "Devoción",
  "Familia",
  "Biblia",
  "Jóvenes",
  "Matrimonio",
  "Oración",
  "Estudio Bíblico",
  "Apologética",
];

export const edades = [
  "4-6 años",
  "4-8 años",
  "11-14 años",
  "15-18 años",
  "Adultos",
];
