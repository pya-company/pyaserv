// Canned demo specialists used to give the SEO landing pages (servicios/[oficio]/[barrio])
// a dense, realistic look on the dev/preview showcase — WITHOUT injecting fake listings
// into production. Rendering is gated behind `import.meta.env.PUBLIC_DEMO === '1'`, so the
// production build (main) shows only real API data while the dev stand looks full.
//
// Shape mirrors the `Specialist` the API returns and that specialists.astro renders.

export interface DemoSpecialist {
  readonly id: string
  readonly displayName: string
  readonly headlineEs: string
  readonly headlineEn: string
  readonly photo: string | null
  readonly verified: boolean
  readonly primaryCategory: string
  readonly ratingAvg: number
  readonly ratingCount: number
}

// oficio.slug -> API category value (CATEGORIES in lib/api.ts).
export const OFICIO_CATEGORY: Readonly<Record<string, string>> = {
  plomero: 'plumbing',
  electricista: 'electrical',
  'tecnico-aire-acondicionado': 'repair',
  albanil: 'repair',
  pintor: 'repair',
  carpintero: 'repair',
  jardinero: 'other',
  limpieza: 'cleaning',
  cerrajero: 'repair',
  gasista: 'plumbing',
}

// A few plausible pros per oficio. Kept deterministic (no random) so builds are reproducible.
const BY_OFICIO: Readonly<Record<string, ReadonlyArray<DemoSpecialist>>> = {
  plomero: [
    { id: 'demo-plo-1', displayName: 'Julio Giménez', headlineEs: 'Plomero matriculado — destapes, fugas y calefones el mismo día', headlineEn: 'Licensed plumber — clogs, leaks and water heaters, same day', photo: null, verified: true, primaryCategory: 'plumbing', ratingAvg: 4.8, ratingCount: 37 },
    { id: 'demo-plo-2', displayName: 'Ramón Ayala', headlineEs: 'Instalaciones sanitarias y reparación de cañerías, 15 años de oficio', headlineEn: 'Sanitary installs and pipe repair, 15 years on the job', photo: null, verified: true, primaryCategory: 'plumbing', ratingAvg: 4.6, ratingCount: 21 },
    { id: 'demo-plo-3', displayName: 'Derlis Cáceres', headlineEs: 'Urgencias 24 h — pérdidas de agua y desagües', headlineEn: '24 h emergencies — water leaks and drains', photo: null, verified: false, primaryCategory: 'plumbing', ratingAvg: 4.4, ratingCount: 9 },
  ],
  electricista: [
    { id: 'demo-ele-1', displayName: 'Marcos Villalba', headlineEs: 'Electricista domiciliario — tableros, cortocircuitos y tomas', headlineEn: 'Home electrician — panels, short circuits and outlets', photo: null, verified: true, primaryCategory: 'electrical', ratingAvg: 4.9, ratingCount: 44 },
    { id: 'demo-ele-2', displayName: 'Fabián Rojas', headlineEs: 'Instalación de aires, ventiladores de techo y luminarias LED', headlineEn: 'AC, ceiling fans and LED lighting installation', photo: null, verified: true, primaryCategory: 'electrical', ratingAvg: 4.7, ratingCount: 18 },
    { id: 'demo-ele-3', displayName: 'Hugo Benítez', headlineEs: 'Diagnóstico y reparación de fallas eléctricas, presupuesto sin cargo', headlineEn: 'Fault diagnosis and repair, free quote', photo: null, verified: false, primaryCategory: 'electrical', ratingAvg: 4.3, ratingCount: 7 },
  ],
  'tecnico-aire-acondicionado': [
    { id: 'demo-aire-1', displayName: 'César Ortega', headlineEs: 'Carga de gas, service y colocación de split — todas las marcas', headlineEn: 'Gas refill, service and split install — all brands', photo: null, verified: true, primaryCategory: 'repair', ratingAvg: 4.8, ratingCount: 29 },
    { id: 'demo-aire-2', displayName: 'Néstor Fleitas', headlineEs: 'Mantenimiento preventivo de aires acondicionados residenciales', headlineEn: 'Preventive maintenance for home AC units', photo: null, verified: true, primaryCategory: 'repair', ratingAvg: 4.6, ratingCount: 14 },
  ],
  albanil: [
    { id: 'demo-alb-1', displayName: 'Aníbal Duarte', headlineEs: 'Albañilería general — revoques, contrapisos y reformas', headlineEn: 'General masonry — plastering, screeds and remodels', photo: null, verified: true, primaryCategory: 'repair', ratingAvg: 4.7, ratingCount: 26 },
    { id: 'demo-alb-2', displayName: 'Cristian Aquino', headlineEs: 'Construcción en seco (Durlock) y colocación de cerámica', headlineEn: 'Drywall and ceramic tiling', photo: null, verified: false, primaryCategory: 'repair', ratingAvg: 4.5, ratingCount: 11 },
  ],
  pintor: [
    { id: 'demo-pin-1', displayName: 'Lorenzo Meza', headlineEs: 'Pintura de interiores y exteriores, enduido y masillado', headlineEn: 'Interior and exterior painting, filling and puttying', photo: null, verified: true, primaryCategory: 'repair', ratingAvg: 4.8, ratingCount: 31 },
    { id: 'demo-pin-2', displayName: 'Sergio Franco', headlineEs: 'Impermeabilización de techos y tratamiento de humedad', headlineEn: 'Roof waterproofing and damp treatment', photo: null, verified: false, primaryCategory: 'repair', ratingAvg: 4.4, ratingCount: 8 },
  ],
  carpintero: [
    { id: 'demo-car-1', displayName: 'Andreas Weber', headlineEs: 'Carpintero — muebles a medida y restauración', headlineEn: 'Carpenter — custom furniture and restoration', photo: null, verified: true, primaryCategory: 'repair', ratingAvg: 4.9, ratingCount: 22 },
    { id: 'demo-car-2', displayName: 'Osvaldo Riquelme', headlineEs: 'Placards, cocinas y reparación de aberturas de madera', headlineEn: 'Closets, kitchens and wooden fixture repair', photo: null, verified: true, primaryCategory: 'repair', ratingAvg: 4.6, ratingCount: 13 },
  ],
  jardinero: [
    { id: 'demo-jar-1', displayName: 'Blas Cardozo', headlineEs: 'Corte de césped, poda y mantenimiento de jardines', headlineEn: 'Lawn mowing, pruning and garden upkeep', photo: null, verified: true, primaryCategory: 'other', ratingAvg: 4.7, ratingCount: 19 },
    { id: 'demo-jar-2', displayName: 'Elvio Sanabria', headlineEs: 'Diseño de espacios verdes y sistemas de riego', headlineEn: 'Green space design and irrigation systems', photo: null, verified: false, primaryCategory: 'other', ratingAvg: 4.5, ratingCount: 6 },
  ],
  limpieza: [
    { id: 'demo-lim-1', displayName: 'Gloria Espínola', headlineEs: 'Limpieza profunda de casas y departamentos, personal de confianza', headlineEn: 'Deep cleaning of houses and flats, trusted staff', photo: null, verified: true, primaryCategory: 'cleaning', ratingAvg: 4.9, ratingCount: 41 },
    { id: 'demo-lim-2', displayName: 'Mirta González', headlineEs: 'Limpieza de fin de obra y de oficinas', headlineEn: 'Post-construction and office cleaning', photo: null, verified: true, primaryCategory: 'cleaning', ratingAvg: 4.6, ratingCount: 15 },
  ],
  cerrajero: [
    { id: 'demo-cer-1', displayName: 'Rubén Notario', headlineEs: 'Cerrajero 24 h — apertura de puertas y cambio de cerraduras', headlineEn: '24 h locksmith — door opening and lock changes', photo: null, verified: true, primaryCategory: 'repair', ratingAvg: 4.8, ratingCount: 24 },
    { id: 'demo-cer-2', displayName: 'Alfredo Vera', headlineEs: 'Copias de llaves y cerraduras de seguridad', headlineEn: 'Key copies and security locks', photo: null, verified: false, primaryCategory: 'repair', ratingAvg: 4.4, ratingCount: 10 },
  ],
  gasista: [
    { id: 'demo-gas-1', displayName: 'Wilson Barreto', headlineEs: 'Gasista matriculado — instalación de gas y detección de pérdidas', headlineEn: 'Licensed gas fitter — gas installs and leak detection', photo: null, verified: true, primaryCategory: 'plumbing', ratingAvg: 4.8, ratingCount: 17 },
    { id: 'demo-gas-2', displayName: 'Diego Villamayor', headlineEs: 'Conexión de cocinas, calefones y termotanques', headlineEn: 'Hooking up stoves, water heaters and tanks', photo: null, verified: true, primaryCategory: 'plumbing', ratingAvg: 4.5, ratingCount: 9 },
  ],
}

// Demo specialists for an oficio, placed "in" the given barrio. Returns [] for unknown oficios.
export const demoSpecialistsFor = (oficioSlug: string): ReadonlyArray<DemoSpecialist> =>
  BY_OFICIO[oficioSlug] ?? []
