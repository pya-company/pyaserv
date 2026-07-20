// Mirror of service_areas seed (migration 0009). Kept in code for getStaticPaths
// at build time; runtime fetches still use the API.
export interface ServiceArea {
  readonly slug: string
  readonly name: string
  readonly type: 'barrio' | 'distrito'
  readonly region: 'asuncion' | 'central'
  readonly priority: number
}

export const SERVICE_AREAS: ReadonlyArray<ServiceArea> = [
  { slug: 'villa-morra',          name: 'Villa Morra',                 type: 'barrio',   region: 'asuncion', priority: 0 },
  { slug: 'carmelitas',           name: 'Carmelitas',                  type: 'barrio',   region: 'asuncion', priority: 1 },
  { slug: 'recoleta',             name: 'Recoleta',                    type: 'barrio',   region: 'asuncion', priority: 2 },
  { slug: 'las-mercedes',         name: 'Las Mercedes',                type: 'barrio',   region: 'asuncion', priority: 3 },
  { slug: 'manora',               name: 'Manorá',                      type: 'barrio',   region: 'asuncion', priority: 4 },
  { slug: 'mariscal-lopez',       name: 'Mariscal López',              type: 'barrio',   region: 'asuncion', priority: 5 },
  { slug: 'las-lomas',            name: 'Las Lomas',                   type: 'barrio',   region: 'asuncion', priority: 6 },
  { slug: 'sajonia',              name: 'Sajonia',                     type: 'barrio',   region: 'asuncion', priority: 7 },
  { slug: 'mburicao',             name: 'Mburicaó',                    type: 'barrio',   region: 'asuncion', priority: 8 },
  { slug: 'centro',               name: 'Centro / Casco Histórico',    type: 'barrio',   region: 'asuncion', priority: 9 },
  { slug: 'trinidad',             name: 'Trinidad',                    type: 'barrio',   region: 'asuncion', priority: 10 },
  { slug: 'pinoza',               name: 'Pinozá',                      type: 'barrio',   region: 'asuncion', priority: 11 },
  { slug: 'san-vicente',          name: 'San Vicente',                 type: 'barrio',   region: 'asuncion', priority: 12 },
  { slug: 'vista-alegre',         name: 'Vista Alegre',                type: 'barrio',   region: 'asuncion', priority: 13 },
  { slug: 'bella-vista',          name: 'Bella Vista',                 type: 'barrio',   region: 'asuncion', priority: 14 },
  { slug: 'ciudad-nueva',         name: 'Ciudad Nueva',                type: 'barrio',   region: 'asuncion', priority: 15 },
  { slug: 'santa-ana',            name: 'Santa Ana',                   type: 'barrio',   region: 'asuncion', priority: 16 },
  { slug: 'pettirossi',           name: 'Pettirossi',                  type: 'barrio',   region: 'asuncion', priority: 17 },
  { slug: 'jara',                 name: 'Jara',                        type: 'barrio',   region: 'asuncion', priority: 18 },
  { slug: 'herrera',              name: 'Herrera',                     type: 'barrio',   region: 'asuncion', priority: 19 },
  { slug: 'general-caballero',    name: 'General Caballero',           type: 'barrio',   region: 'asuncion', priority: 20 },
  { slug: 'itay',                 name: 'Itay',                        type: 'barrio',   region: 'asuncion', priority: 21 },
  { slug: 'loma-pyta',            name: 'Loma Pytá',                   type: 'barrio',   region: 'asuncion', priority: 22 },
  { slug: 'san-pablo',            name: 'San Pablo',                   type: 'barrio',   region: 'asuncion', priority: 23 },
  { slug: 'ricardo-brugada',      name: 'Ricardo Brugada (Chacarita)', type: 'barrio',   region: 'asuncion', priority: 24 },
  { slug: 'lambare',              name: 'Lambaré',                     type: 'distrito', region: 'central',  priority: 25 },
  { slug: 'fernando-de-la-mora',  name: 'Fernando de la Mora',         type: 'distrito', region: 'central',  priority: 26 },
  { slug: 'san-lorenzo',          name: 'San Lorenzo',                 type: 'distrito', region: 'central',  priority: 27 },
  { slug: 'luque',                name: 'Luque',                       type: 'distrito', region: 'central',  priority: 28 },
  { slug: 'nemby',                name: 'Ñemby',                       type: 'distrito', region: 'central',  priority: 29 },
  { slug: 'mariano-roque-alonso', name: 'Mariano Roque Alonso',        type: 'distrito', region: 'central',  priority: 30 },
  { slug: 'capiata',              name: 'Capiatá',                     type: 'distrito', region: 'central',  priority: 31 },
  { slug: 'limpio',               name: 'Limpio',                      type: 'distrito', region: 'central',  priority: 32 },
  { slug: 'villa-elisa',          name: 'Villa Elisa',                 type: 'distrito', region: 'central',  priority: 33 },
  { slug: 'san-antonio',          name: 'San Antonio',                 type: 'distrito', region: 'central',  priority: 34 },
  { slug: 'aregua',               name: 'Areguá',                      type: 'distrito', region: 'central',  priority: 35 },
  { slug: 'itaugua',              name: 'Itauguá',                     type: 'distrito', region: 'central',  priority: 36 },
  { slug: 'ypane',                name: 'Ypané',                       type: 'distrito', region: 'central',  priority: 37 },
  { slug: 'ita',                  name: 'Itá',                         type: 'distrito', region: 'central',  priority: 38 },
  { slug: 'villeta',              name: 'Villeta',                     type: 'distrito', region: 'central',  priority: 39 },
]

export interface Oficio {
  readonly slug: string
  readonly name: string
  readonly pluralF: boolean
}

export const OFICIOS: ReadonlyArray<Oficio> = [
  { slug: 'plomero', name: 'Plomero', pluralF: false },
  { slug: 'electricista', name: 'Electricista', pluralF: false },
  { slug: 'tecnico-aire-acondicionado', name: 'Técnico de aire acondicionado', pluralF: false },
  { slug: 'albanil', name: 'Albañil', pluralF: false },
  { slug: 'pintor', name: 'Pintor', pluralF: false },
  { slug: 'carpintero', name: 'Carpintero', pluralF: false },
  { slug: 'jardinero', name: 'Jardinero', pluralF: false },
  { slug: 'limpieza', name: 'Servicio de limpieza', pluralF: false },
  { slug: 'cerrajero', name: 'Cerrajero', pluralF: false },
  { slug: 'gasista', name: 'Gasista', pluralF: false },
]
